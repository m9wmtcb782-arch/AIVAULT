# 協作池學歷制度：建表、上傳 Grok Bot 題庫（加密檔解開後只寫進資料庫，不印出）、排定考試、跑學習／考試循環。
import json, os, subprocess, time, datetime, urllib.request, urllib.error
REF="clcddygkaaqqtsbswgdf"; BASE="https://%s.supabase.co"%REF; TOKEN=os.environ["TOKEN"]; STEPS=os.environ.get("STEP","cycle").split(","); N=int(os.environ.get("N","4") or 4)
def http(url,data=None,headers=None,method=None,timeout=300):
    r=urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,headers=dict({"Content-Type":"application/json","User-Agent":"degree"},**(headers or {})),method=method)
    try:
        with urllib.request.urlopen(r,timeout=timeout) as f: b=f.read(); return f.status,(json.loads(b) if b else None)
    except urllib.error.HTTPError as e:
        b=e.read()
        try: return e.code,json.loads(b)
        except Exception: return e.code,b[:300].decode("utf-8","replace")
def sql(q):
    s,b=http("https://api.supabase.com/v1/projects/%s/database/query"%REF,{"query":q},{"Authorization":"Bearer "+TOKEN},"POST"); assert s<300,(s,str(b)[:300]); return b
def lit(s,tag="$q$"): assert tag not in s; return tag+s+tag
D={"llm":"大型語言模型","img":"圖像生成模型","av":"影片與語音模型","code":"程式與代理人工具"}
if "migrate" in STEPS:
    sql(open("supabase/migrations/20261017190000_aivault_pool_degrees.sql").read())
    bank=json.loads(subprocess.check_output(["gpg","--batch","--quiet","--pinentry-mode","loopback","--passphrase",os.environ["PAGES_KEY"],"-d","private/exam-bank.json.gpg"]).decode())
    for d,lab in D.items():
        qs=[q for q in bank if q["d"]==d]
        sql("insert into public.aivault_pool_exams(id,district,kind,title,questions) values ('bank-%s','%s','placement',%s,%s::jsonb) on conflict (id) do update set questions=excluded.questions"%(d,d,lit("Grok Bot 題庫・"+lab),lit(json.dumps(qs,ensure_ascii=False))))
        sql("insert into public.aivault_pool_exams(id,district,kind,title,questions) values ('placement-%s','%s','placement',%s,'[]'::jsonb) on conflict (id) do nothing"%(d,d,lit("學歷鑑定考・"+lab)))
        sql("insert into public.aivault_pool_exams(id,district,kind,title,opens_at,questions) values ('promotion-2026-10-20-%s','%s','promotion',%s,'2026-10-20T10:00:00+08:00','[]'::jsonb) on conflict (id) do nothing"%(d,d,lit("第一次正式升級考・"+lab)))
    print("exams", sql("select kind,count(*),sum(jsonb_array_length(questions)) q from public.aivault_pool_exams group by kind"))
if "cycle" in STEPS or "weekly" in STEPS:  # 週考：從 2026-10-27 起每週二 10:00（台北）開考，考期 6 天
    tw=datetime.datetime.utcnow()+datetime.timedelta(hours=8); start=datetime.date(2026,10,27)
    if tw.date()>=start:
        day=start+datetime.timedelta(days=7*((tw.date()-start).days//7))
        for d,lab in D.items():
            sql("insert into public.aivault_pool_exams(id,district,kind,title,opens_at,closes_at,questions) values ('weekly-%s-%s','%s','weekly',%s,'%sT10:00:00+08:00','%sT10:00:00+08:00','[]'::jsonb) on conflict (id) do nothing"%(day,d,d,lit("週考 %s・%s"%(day,lab)),day,day+datetime.timedelta(days=6)))
_,keys=http("https://api.supabase.com/v1/projects/%s/api-keys?reveal=true"%REF,headers={"Authorization":"Bearer "+TOKEN})
SR=next(k["api_key"] for k in keys if k.get("name")=="service_role"); print("::add-mask::"+SR)
def y(body): return http(BASE+"/functions/v1/dark-star-ebook-ingest?feature=degree",body,{"apikey":SR,"Authorization":"Bearer "+SR},"POST")
if "cycle" in STEPS:
    end=time.time()+60*float(os.environ.get("MINUTES","1") or 1); k=0; tok=0; mode=os.environ.get("MODE","") or None
    if not mode and os.environ.get("PLACE_AUTO","1")=="1":  # pd1：還有未鑑定就自動只做鑑定（每次排程接著做，直到全部完成）
        un=sql("select count(*) c from public.aivault_pool_agents a where not exists (select 1 from public.aivault_pool_agent_degree d where d.agent_id=a.id)")[0]["c"]
        pc=sql("select (v->>'until')::timestamptz > now()-interval '12 minutes' r from public.aivault_floor_state where k='placecall:lock'")
        if int(un)>0 and pc and pc[0]["r"]: print("PLACE_AUTO skip: Supabase pg_cron is placing (fallback idle)"); SKIPC=True
        elif int(un)>0: mode="place"; print("PLACE_AUTO unplaced",un)
    while not globals().get("SKIPC"):
        k+=1; s,b=y({"action":"cycle","n":N,**({"mode":mode} if mode else {})}); ok=isinstance(b,dict)
        rs=(b.get("results") or []) if ok else []
        for r in rs: tok+=((r.get("usage") or {}).get("total") or 0)
        print("CYCLE",k,s,"rl",b.get("rate_limited") if ok else b,[(r.get("kind"),r.get("agent"),r.get("tier"),r.get("level"),r.get("score"),r.get("max"),r.get("topic"),(r.get("usage") or {}).get("total"),(r.get("error") or "")[:90],bool(r.get("url"))) for r in rs])
        if s!=200 or not ok or time.time()>end: break
        if b.get("rate_limited"):
            errs=" ".join(str(r.get("error")) for r in rs); rl_n=globals().get("rl_n",0)+1; globals()["rl_n"]=rl_n
            kind="per-day" if "per day" in errs else "per-minute" if "per minute" in errs else "unknown"
            if mode=="place" and rl_n<4 and kind!="per-day": print("WAIT: Groq limit",kind,"retry",rl_n); time.sleep(65); continue
            print("STOP: Groq limit",kind, errs[:300]); break
        globals()["rl_n"]=0
        if mode=="place" and ok and b.get("left")==0: print("ALL PLACED"); break
        time.sleep(45 if b.get("partial_429") else 5)
    print("TOKENS_THIS_RUN",tok)
    if os.environ.get("PEER","1")=="1": s,b=y({"action":"peer_review","n":2}); print("PEER",s,json.dumps(b,ensure_ascii=False)[:200])
if "videomig" in STEPS: sql(open("supabase/migrations/20261017203000_aivault_learning_source.sql").read()); print("videomig ok")
if "videosample" in STEPS:
    for r in sql("select agent_id, topic, url, title, caption_lang, transcript_chars, sha256, fetched_at, left(notes,160) n from public.aivault_pool_agent_learning where source_type='video_subtitles' order by created_at desc limit 5"): print("VID",json.dumps(r,ensure_ascii=False,default=str))
if "voicesample" in STEPS:  # 唯讀：即時語音學習樣本（網址、標題、筆記前 160 字）＋審核狀態統計
    for r in sql("select agent_id, topic, url, title, left(notes,160) n, (usage->>'total') tok from public.aivault_pool_agent_learning where topic like '即時語音：%' order by created_at desc limit 6"): print("VS",json.dumps(r,ensure_ascii=False))
    print("RS",sql("select review_status, count(*) from public.aivault_pool_agent_tasks where source='floor' group by 1 order by 2 desc"))
    print("RA",sql("select date_trunc('minute',reviewed_at) m, review_status, count(*) from public.aivault_pool_agent_tasks where source='floor' and reviewed_at > now()-interval '3 hours' group by 1,2 order by 1 desc limit 10"))
if "whois" in STEPS:  # 唯讀：暗星／曙光是否在協作池
    print("WHOIS",sql("select id,name,domain,zone from public.aivault_pool_agents where name ~ '暗星|曙光|Dark ?Star|Dawn' or id ~* 'dark|dawn' limit 20"))
    print("AGENTS",sql("select count(*) from public.aivault_pool_agents"))
if "watchfix" in STEPS:  # 誠實修正：第一次看影片測試截圖辨識全部失敗（Groq 無視覺模型權限），標題改成「只有聲音」
    print("WATCHFIX",sql("update public.aivault_pool_agent_learning set title=replace(title,'🎬 看影片（聲音＋截圖）｜','🎬 看影片（只有聲音，截圖辨識不可用）｜') where source_type='video_watch' and coalesce(jsonb_array_length(usage->'frames_described'),0)=0 or (source_type='video_watch' and (usage->>'vision_tokens')::int=0) returning id, title"))
if "specialmig" in STEPS: sql(open("supabase/migrations/20261017210000_aivault_pool_special.sql").read()); print("SPECIAL",sql("select id,name,activity,last_at from public.aivault_pool_special"))
if "labmig" in STEPS: sql(open("supabase/migrations/20261017233000_aivault_lab.sql").read()); sql(open("supabase/migrations/20261017234000_aivault_standing_orders.sql").read()); print("LABMIG ok")
import time as _t0
if "spdaily" in STEPS or ("cycle" in STEPS and os.environ.get("GITHUB_EVENT_NAME")=="schedule" and _t0.gmtime().tm_hour==15 and _t0.gmtime().tm_min>=30):  # sd2：暗星／曙光每日報告摘要（只印計數與主題，不印筆記）
    s,b=y({"action":"special_daily"}); print("SPDAILY",s,{k:v.get("summary") for k,v in (b.get("per") or {}).items()} if isinstance(b,dict) else b)
if "vcorder" in STEPS:  # vc1：使用者 02:34 指定的長期命令（影音區）
    t="影音區學習優先：研究有聲書平台與即時語音為什麼聽起來自然，特別是中文聲音複製 TTS（CosyVoice、GPT-SoVITS、F5-TTS、Fish Speech、MaskGCT、Spark-TTS）：韻律、零樣本複製、codec／flow-matching、串流延遲。只用真實來源（論文、GitHub README）。學以致用：實驗工廠作品要做小而免費、可測試的步驟（例如停頓／韻律預測、國語 TTS 文字正規化）。不得呼叫任何付費 TTS API。"
    ex=sql("select id from public.aivault_standing_orders where text=%s and revoked_at is null"%lit(t))
    if not ex: sql("insert into public.aivault_standing_orders(text,districts,flagged) values (%s,'{av}',false)"%lit(t))
    print("VCORDER",sql("select id,districts,active,flagged from public.aivault_standing_orders where revoked_at is null order by id"))
if "pgcron" in STEPS:  # pc1：Supabase 內建排程（pg_cron + pg_net）呼叫學習／鑑定；金鑰放 Vault，不寫進排程指令。復原：select cron.unschedule('aivault-learn10'); select cron.unschedule('aivault-place');
    sql("create extension if not exists pg_cron; create extension if not exists pg_net;")
    if not sql("select 1 from vault.secrets where name='aivault_cron_sr'"): sql("select vault.create_secret(%s,'aivault_cron_sr','pg_cron 呼叫 dark-star-ebook-ingest 用')"%lit(SR))
    else: sql("select vault.update_secret((select id from vault.secrets where name='aivault_cron_sr'),%s)"%lit(SR))
    url=BASE+"/functions/v1/dark-star-ebook-ingest?feature=degree"
    def job(name,cronexp,body,tmo):
        cmd="select net.http_post(url:=%s,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='aivault_cron_sr'),'apikey',(select decrypted_secret from vault.decrypted_secrets where name='aivault_cron_sr')),body:=%s::jsonb,timeout_milliseconds:=%d) where coalesce((select v->>'off' from public.aivault_floor_state where k='cron:off'),'0')<>'1'"%(lit(url,"$u$"),lit(json.dumps(body),"$b$"),tmo)
        sql("select cron.schedule(%s,%s,%s)"%(lit(name,"$n$"),lit(cronexp,"$c$"),lit(cmd,"$x$")))
    job("aivault-learn10","*/10 * * * *",{"action":"learn_round","n":8,"src":"pg_cron"},150000)
    job("aivault-place","5-59/10 * * * *",{"action":"cycle","mode":"place","n":6,"src":"pg_cron"},150000)
    print("PGCRON",sql("select jobid,jobname,schedule,active from cron.job order by jobid"))
if "cronstat" in STEPS:  # 只印排程執行狀態與筆數
    print("JOBS",sql("select jobid,jobname,schedule,active from cron.job order by jobid"))
    print("RUNS",sql("select j.jobname,d.status,to_char(d.start_time at time zone 'Asia/Taipei','MM-DD HH24:MI:SS') t,left(d.return_message,60) m from cron.job_run_details d join cron.job j using(jobid) order by d.start_time desc limit 12"))
    print("NET",sql("select status_code,count(*),max(created) from net._http_response where created>now()-interval '1 hour' group by 1"))
    print("LEARN_PER_HOUR",sql("select to_char(date_trunc('hour',created_at) at time zone 'Asia/Taipei','MM-DD HH24') h,count(*) rows,count(distinct agent_id) agents from public.aivault_pool_agent_learning where created_at>now()-interval '6 hours' group by 1 order by 1"))
    print("PLACED",sql("select count(*) from public.aivault_pool_agent_degree"),"UNPLACED",sql("select count(*) c from public.aivault_pool_agents a where not exists (select 1 from public.aivault_pool_agent_degree d where d.agent_id=a.id)"))
    print("LOCK",sql("select k,v->>'src' src,v->>'at' at from public.aivault_floor_state where k in ('learnround:lock','placecall:lock')"))
if "smtest" in STEPS:  # sm1 測試：真的召集暗星（只印狀態、模型、任務）
    s,b=y({"action":"summon","id":"darkstar","op":"call","via":"test"}); print("SUMMON",s,{k:b.get(k) for k in ["ok","error","task","model","until"]} if isinstance(b,dict) else str(b)[:200])
if "rosterdump" in STEPS:  # rm1 備份：加密 artifact（公開日誌只印筆數）
    out={t:sql('select * from public."%s"'%t) for t in ["agent_registry","aivault_ai_avatars","aivault_agent_cognitive_models","aivault_agent_social_rankings","aivault_pool_special","aivault_pool_agents"]}
    open("/tmp/d.json","w").write(json.dumps(out,ensure_ascii=False,default=str))
    subprocess.check_call(["gpg","--batch","--yes","--quiet","--pinentry-mode","loopback","--passphrase",os.environ["PAGES_KEY"],"-c","-o","degree-dump.json.gpg","/tmp/d.json"]); print("BACKUP",{k:len(v) for k,v in out.items()})
if "rostermig" in STEPS:
    sql(open("supabase/migrations/20261017230000_aivault_roster_merge.sql").read())
    print("ROSTER",sql("select roster_status,count(*) from public.agent_registry group by 1 order by 1"),sql("select count(*) from public.aivault_roster_map"),sql("select count(*) from public.backup_20261017_agent_registry"))
if "regdup" in STEPS:  # 只讀：重複檢查（只印 id、數量、欄位名，不印人設內容）
    for t in ["agent_registry","aivault_ai_avatars","aivault_agent_cognitive_models","aivault_agent_social_rankings"]:
        print("COLS",t,[x["column_name"] for x in sql("select column_name from information_schema.columns where table_schema='public' and table_name='%s' order by ordinal_position"%t)])
    print("NUMDUP",sql("select (regexp_replace(agent_id,'\\D','','g'))::int n, array_agg(agent_id order by agent_id) ids from public.agent_registry where agent_id like 'Worker-%' group by 1 having count(*)>1 order by 1"))
    print("NUMRANGE",sql("select min((regexp_replace(agent_id,'\\D','','g'))::int), max((regexp_replace(agent_id,'\\D','','g'))::int), count(distinct (regexp_replace(agent_id,'\\D','','g'))::int) from public.agent_registry where agent_id like 'Worker-%'"))
    print("SIM",sql("select agent_id,display_name,role,status,is_simulated,created_at,last_activity_at from public.agent_registry where agent_id ~ '^(Worker-00[123]|Worker-sim-)' or agent_id !~ '^Worker-' order by 1"))
    print("ISSIM",sql("select is_simulated,status,count(*) from public.agent_registry group by 1,2 order by 3 desc"))
    print("NAMEMATCH",sql("select count(*) from public.agent_registry r join public.aivault_pool_agents p on p.name=r.display_name"))
    print("NUMMATCH",sql("select count(*) from public.agent_registry r join public.aivault_pool_agents p on p.id='ag-'||lpad(regexp_replace(r.agent_id,'\\D','','g'),4,'0') where r.agent_id ~ '^Worker-\\d+$'"))
    print("DNDUP",sql("select count(*) from (select display_name from public.agent_registry group by 1 having count(*)>1) x"))
    print("POOLRANGE",sql("select min(id),max(id),count(*) from public.aivault_pool_agents"))
    print("SAMPLE",sql("select r.agent_id,r.display_name,p.id,p.name from public.agent_registry r left join public.aivault_pool_agents p on p.id='ag-'||lpad(regexp_replace(r.agent_id,'\\D','','g'),4,'0') where r.agent_id in ('Worker-004','Worker-0500','Worker-1000')"))
    print("LENS",sql("select length(agent_id) l,count(*) from public.agent_registry where agent_id like 'Worker-%' group by 1"))
if "aicount" in STEPS:  # 只印表名與筆數（不印內容）
    ts=sql("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and (table_name ~ '(agent|clone|avatar|guard|special|persona|bot)') order by 1")
    for t in ts:
        n=t["table_name"]; print("COUNT",n,sql('select count(*) c from public."%s"'%n)[0]["c"])
    print("POOLDOM",sql("select domain,count(*) c from public.aivault_pool_agents group by 1 order by 2 desc limit 40"))
    print("POOLGUARD",sql("select count(*) c from public.aivault_pool_agents where domain ~* 'guard|security|衛士|defen'"))
    try: print("REGW",sql("select count(*) c from public.agent_registry where agent_id like 'Worker-%'"));print("REGNAMES",sql("select agent_id from public.agent_registry where agent_id not like 'Worker-%' order by 1"))
    except Exception as e: print("REG err",str(e)[:100])
    for t in ["aivault_ai_avatars","aivault_agent_cognitive_models","aivault_agent_social_rankings"]:
        try: c=[x["column_name"] for x in sql("select column_name from information_schema.columns where table_schema='public' and table_name='%s'"%t)]; k="agent_id" if "agent_id" in c else c[0]; print("NONW",t,sql("select %s from public.%s where %s::text not like 'Worker-%%' and %s::text !~ '^ag-' order by 1 limit 20"%(k,t,k,k)))
        except Exception as e: print("NONW err",t,str(e)[:100])
if "spmig" in STEPS: sql(open("supabase/migrations/20261017220000_aivault_special_study.sql").read()); print("SPMIG ok")
import time as _t
_g=_t.gmtime()
if os.environ.get("SP_SCHED","1")!="0" and os.environ.get("GITHUB_EVENT_NAME")=="schedule":  # sp1 排程：學習每 2 小時一次、考試每 6 小時一次（省 Gemini 免費額度，暗星本人聊天也要用）
    if "learnround" in STEPS and _g.tm_hour%2==0 and _g.tm_min<10: STEPS=list(STEPS)+["splearn"]
    if "cycle" in STEPS and _g.tm_hour%6==0 and _g.tm_min<30: STEPS=list(STEPS)+["spexam"]
for _m in ["placement","exam","learn"]:
    if "sp"+_m in STEPS:  # sp1：暗星／曙光（只印分數、學階、模型、網址，不印筆記）
        s,b=y({"action":"special_round","mode":_m}); print("SP",_m.upper(),s)
        for x in (b.get("res") or []) if isinstance(b,dict) else []: print("  ",x.get("id"),x.get("kind"),x.get("score"),"/",x.get("max"),"tier",x.get("tier"),x.get("level"),x.get("url"),x.get("models"),x.get("error"))
if "planredo" in STEPS:
    s,b=y({"action":"daily_plan","redo":True}); print("PLANREDO",s,json.dumps(b,ensure_ascii=False)[:1500] if isinstance(b,dict) else str(b)[:300])
    print("SPECIAL",sql("select id,activity,last_at from public.aivault_pool_special"))
if "learnround" in STEPS:  # ln10：每 10 分鐘四區學習（只印數量、主題、網址來源類型，不印筆記內容）
    if os.environ.get("PLAN","1")=="1":
        sp,bp=y({"action":"daily_plan"}); print("PLAN",sp,json.dumps(bp,ensure_ascii=False)[:900] if isinstance(bp,dict) else str(bp)[:200])
    s,b=y({"action":"learn_round","n":N,**({"force_video":True} if os.environ.get("FORCE_VIDEO")=="1" else {}),**({"force_ebook":True} if os.environ.get("FORCE_EBOOK")=="1" else {}),**({"force_selfdev":True} if os.environ.get("FORCE_SELFDEV")=="1" else {})}); ok=isinstance(b,dict)
    print("LEARN10",s,{k:b.get(k) for k in ("used","budget","budget_hit","rate_limited","skipped_locked","off")} if ok else str(b)[:300])
    for r in ((b.get("results") or []) if ok else []): print("  ",r.get("district"),r.get("agent"),r.get("topic"),[p.get("src") for p in (r.get("pages") or [])] or bool(r.get("url")),(r.get("usage") or {}).get("total"),(r.get("error") or "")[:100])
    if os.environ.get("TRIAGE","1")=="1":  # tr1：練習稿 AI 初審（每輪最多 2 組）
        s2,b2=y({"action":"triage","groups":2}); print("TRIAGE",s2,json.dumps(b2,ensure_ascii=False)[:600] if isinstance(b2,dict) else str(b2)[:200])
    print("VOICE_ROWS",sql("select count(*) n, count(distinct agent_id) agents from public.aivault_pool_agent_learning where topic like '即時語音：%'"))
if "cycle" in STEPS or "stats" in STEPS:
    print("DEGREES",sql("select district,tier,count(*) from public.aivault_pool_agent_degree group by 1,2 order by 1,2"))
    print("UNPLACED",sql("select count(*) from public.aivault_pool_agents a where not exists (select 1 from public.aivault_pool_agent_degree d where d.agent_id=a.id)"))
    print("LEARNING",sql("select count(*) total, count(*) filter (where http_status=200) ok, count(distinct agent_id) agents, count(distinct url) urls from public.aivault_pool_agent_learning"))
    print("EXAMS",sql("select exam_id,count(*),round(avg(score/max_score)*100,1) avg_pct,sum((usage->>'total')::int) tokens from public.aivault_pool_exam_answers group by 1 order by 1"))
if "dump" in STEPS:  # 樣本（加密 artifact，公開日誌不印內容）
    out={"learning":sql("select l.id,l.agent_id,a.name,l.district,l.topic,l.query,l.url,l.title,l.http_status,l.bytes,l.sha256,l.notes,l.model,l.usage,l.fetched_at from public.aivault_pool_agent_learning l join public.aivault_pool_agents a on a.id=l.agent_id order by l.created_at desc limit 40"),
         "answers":sql("select x.exam_id,x.agent_id,a.name,x.qids,x.answers,x.correct,x.score,x.max_score,x.tier,x.level,x.notes_used,x.grader_notes,x.model,x.usage,x.created_at from public.aivault_pool_exam_answers x join public.aivault_pool_agents a on a.id=x.agent_id order by x.created_at desc limit 40")}
    open("/tmp/d.json","w").write(json.dumps(out,ensure_ascii=False,default=str))
    subprocess.check_call(["gpg","--batch","--yes","--quiet","--pinentry-mode","loopback","--passphrase",os.environ["PAGES_KEY"],"-c","-o","degree-dump.json.gpg","/tmp/d.json"]); print("dump ok")

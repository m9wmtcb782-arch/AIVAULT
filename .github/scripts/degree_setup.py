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
if "cronstat" in STEPS:
    print("RLKIND",sql("select id, (content::text ~ 'per day') per_day, (content::text ~ 'per minute') per_min, substring(content::text from 'Limit [0-9]+, Used [0-9]+') lim from net._http_response order by id desc limit 4"))  # 只印排程執行狀態與筆數
    print("JOBS",sql("select jobid,jobname,schedule,active from cron.job order by jobid"))
    print("RUNS",sql("select j.jobname,d.status,to_char(d.start_time at time zone 'Asia/Taipei','MM-DD HH24:MI:SS') t,left(d.return_message,60) m from cron.job_run_details d join cron.job j using(jobid) where j.jobname like 'aivault-%' and j.jobname not like '%security%' order by d.start_time desc limit 12"))
    print("NET",sql("select status_code,count(*),max(created) from net._http_response where created>now()-interval '1 hour' group by 1"),sql("select id,status_code,left(content::text,160) c,to_char(created at time zone 'Asia/Taipei','HH24:MI:SS') t from net._http_response order by id desc limit 6"))
    print("LEARN_PER_HOUR",sql("select to_char(date_trunc('hour',created_at) at time zone 'Asia/Taipei','MM-DD HH24') h,count(*) rows,count(distinct agent_id) agents from public.aivault_pool_agent_learning where created_at>now()-interval '6 hours' group by 1 order by 1"))
    print("PLACED",sql("select count(*) from public.aivault_pool_agent_degree"),"UNPLACED",sql("select count(*) c from public.aivault_pool_agents a where not exists (select 1 from public.aivault_pool_agent_degree d where d.agent_id=a.id)"))
    print("LOCK",sql("select k,v->>'src' src,v->>'at' t0 from public.aivault_floor_state where k in ('learnround:lock','placecall:lock')"))
if "rvorder" in STEPS:  # rv2：使用者 08:14 的即時語音研究規劃 → 長期命令 #2
    t="依 docs/realtime-voice-plan.md 分階段研究即時語音（目前只是研究，尚未實作任何功能）：先做第 1 階段（自有國語 TTS：文字正規化、停頓／韻律規劃、開源中文 TTS），再第 2 階段（串流播放、VAD、barge-in）。實驗工廠作品要小而可測（例如國語文字正規化、停頓規劃器、純 JS 的 VAD 與插話狀態機）。標示狀態只能用 已完成／已驗證／待驗證／尚未實作，沒驗證不能說完成。只用合法開源模型與免費資源，不得使用付費 API，不得把外部商業 API 說成自研，不得修改既有暗星／曙光／電子書／算力池功能。"
    if not sql("select id from public.aivault_standing_orders where text=%s and revoked_at is null"%lit(t)): sql("insert into public.aivault_standing_orders(text,districts,flagged) values (%s,'{}',false)"%lit(t))
    print("RVORDER",sql("select id,districts,active from public.aivault_standing_orders where revoked_at is null order by id"))
if "citymig" in STEPS: sql(open("supabase/migrations/20261018090000_aivault_city_phase1.sql").read()); print("CITYMIG",sql("select key,lo,hi,status from public.aivault_sandboxes order by lo"),sql("select sandbox,count(*) from public.aivault_sandbox_members group by 1 order by 1"),sql("select state,count(*) from public.aivault_agent_state group by 1"))
if "inv" in STEPS:  # B1 盤點（只讀，只印計數與欄位）
    q=lambda x: sql(x)
    for t in ["aivault_collaboration_pool_members","aivault_agent_social_rankings","aivault_pool_exams","aivault_pool_exam_answers","aivault_pool_agent_learning","aivault_lab_experiments","aivault_pool_agents","agent_registry","aivault_pool_agent_degree","aivault_pool_agent_tasks","aivault_pool_agent_memory"]:
        try: print("INV",t,q('select count(*) c from public."%s"'%t)[0]["c"],[x["column_name"] for x in q("select column_name from information_schema.columns where table_schema='public' and table_name='%s' order by ordinal_position"%t)][:30])
        except Exception as e: print("INV",t,"ERR",str(e)[:80])
    try: print("CPM_ROLES",q("select role,count(*) from public.aivault_collaboration_pool_members group by 1 order by 2 desc limit 20"))
    except Exception as e: print("CPM_ROLES err",str(e)[:120])
    try: print("CPM_IDS",q("select substring(member_id::text from '^[A-Za-z-]+') p,count(*) from public.aivault_collaboration_pool_members group by 1 order by 2 desc limit 20"))
    except Exception as e: print("CPM_IDS err",str(e)[:120])
    print("EXAMS",q("select id,district,kind,jsonb_array_length(questions) nq,opens_at from public.aivault_pool_exams order by id"))
    print("ANS",q("select exam_id,count(*),round(avg(score::numeric/nullif(max_score,0))*100,1) pct,count(distinct model) models,string_agg(distinct grader,',') graders from public.aivault_pool_exam_answers group by 1 order by 1"))
    print("BANKSRC",q("select id,left(title,40) t from public.aivault_pool_exams where id like 'bank-%'"))
    print("DEG",q("select district,tier,level,count(*) from public.aivault_pool_agent_degree group by 1,2,3 order by 1,2,3"))
    print("LEARN",q("select coalesce(source_type,'web') s,count(*),count(distinct agent_id) a,count(*) filter (where lab_id is not null) linked from public.aivault_pool_agent_learning group by 1"))
    print("LEARNTOP",q("select split_part(topic,'：',1) k,count(*) from public.aivault_pool_agent_learning group by 1 order by 2 desc limit 12"))
    print("LAB",q("select status,count(*),sum(tokens) from public.aivault_lab_experiments group by 1"))
    print("TASKS",q("select kind,status,review_status,count(*) from public.aivault_pool_agent_tasks group by 1,2,3 order by 4 desc limit 20"))
    print("DOMAINS",q("select domain,count(*),min(id),max(id) from public.aivault_pool_agents group by 1 order by 1"))
    print("USAGE",q("select * from public.aivault_pool_agent_usage order by day desc limit 5"))
    print("LMODELS",q("select model,count(*),sum((usage->>'total')::int) tok from public.aivault_pool_agent_learning group by 1 order by 2 desc limit 8"))
    print("DBSIZE",q("select pg_size_pretty(pg_database_size(current_database())) s, pg_database_size(current_database()) b"))
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
if "comminv" in STEPS:  # cm1：通訊系統盤點（只印表名、欄位、列數，不印內容）
    t=sql("select table_name, string_agg(column_name||':'||data_type, ', ' order by ordinal_position) cols from information_schema.columns where table_schema='public' and (table_name ~ '(message|chat|lease|event|worker|task|collab|inbox|project|skill|mail|memory|queue|node)') group by table_name order by 1")
    for r in t:
        n=sql("select count(*) c from public.%s"%r["table_name"])[0]["c"]; print("TBL",r["table_name"],n,"|",r["cols"][:600])
    print("FNS", [x["proname"] for x in sql("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where nspname='public' and proname ~ '(message|lease|claim|task|chat|collab)'")])
    print("CRON", sql("select jobname,schedule from cron.job"))
if "comminv2" in STEPS:  # cm1：agent_messages 約束、觸發器、RLS 與既有函式簽名（不印內容）
    print("CON", sql("select conname, pg_get_constraintdef(oid) d from pg_constraint where conrelid in ('public.agent_messages'::regclass,'public.agent_subtasks'::regclass,'public.collab_events'::regclass)"))
    print("TRG", sql("select tgname, tgrelid::regclass::text t from pg_trigger where not tgisinternal and tgrelid in ('public.agent_messages'::regclass,'public.agent_subtasks'::regclass)"))
    print("RLS", sql("select tablename, policyname, roles, cmd from pg_policies where tablename in ('agent_messages','agent_subtasks','collab_events')"))
    print("SIG", sql("select proname, pg_get_function_arguments(p.oid) a from pg_proc p join pg_namespace n on n.oid=p.pronamespace where nspname='public' and proname in ('agent_module_send_message','agent_claim_subtask','agent_expire_leases','agent_submit_subtask_result')"))
    print("MT", sql("select message_type, status, count(*) from public.agent_messages group by 1,2"))
    print("USE", subprocess.run(["bash","-c","grep -rl 'agent_messages\\|agent_module_send_message' --include=*.ts --include=*.html --include=*.js --include=*.py . | grep -v node_modules | head -20"],capture_output=True,text=True).stdout)
if "commmig" in STEPS:
    sql(open("supabase/migrations/20261018100000_aivault_comm.sql").read()); print("COMMMIG", sql("select jobname,schedule from cron.job where jobname='aivault-comm-sweep'"))
if "commtest" in STEPS:  # cm1：傳輸層實測（不呼叫模型）。每項印 PASS/FAIL，不印訊息內容以外的私密資料。
    P="ttest-"+datetime.datetime.utcnow().strftime("%m%d%H%M%S"); R=[]
    def j(q): return sql(q)[0]
    def S(sender,kind,rcpt,typ,payload="{}",reply="null",dedupe="null",corr="null",proj=None):
        return j("select public.aivault_comm_send(%s,%s,%s,%s,%s::jsonb,%s,null,%s,%s,%s) r"%(lit(sender),lit(kind),lit(rcpt),lit(typ),lit(payload),lit(proj or P),corr if corr=="null" else lit(corr),reply,dedupe if dedupe=="null" else lit(dedupe)))["r"]
    def ok(name,cond,info=""): R.append(cond); print(("PASS " if cond else "FAIL ")+name,info)
    A,B,C,D="ag-0121","ag-0241","ag-0441","ag-0941"
    sql("insert into public.aivault_comm_projects(id,title,owner_agent,max_turns) values (%s,'transport test',%s,200)"%(lit(P),lit(A)))
    sql("insert into public.aivault_comm_groups(id,project_id,created_by) values (%s,%s,%s)"%(lit(P+"-g"),lit(P),lit(A)))
    sql("insert into public.aivault_comm_group_members(group_id,agent_id,role) values "+",".join("(%s,%s,%s)"%(lit(P+"-g"),lit(x),lit(r)) for x,r in [(A,"planner"),(B,"3d"),(C,"sound"),(D,"tester")]))
    m1=S(A,"dm",B,"delegate",'{"text":"please make a cube"}'); ok("dm send",m1.get("ok") and m1["recipients"]==1,m1)
    d=j("select status from public.aivault_comm_deliveries where message_id=%d and agent_id='%s'"%(m1["id"],B)); ok("dm queued (DB-delivered, not yet read)",d["status"]=="queued")
    g=S(A,"group",P+"-g","progress",'{"text":"kickoff"}'); ok("group fan-out excludes sender",g.get("ok") and g["recipients"]==3,g)
    ok("non-member cannot post to group",not S("ag-0500","group",P+"-g","info").get("ok"))
    ok("normal agent broadcast denied",S(A,"broadcast","all","info").get("error")=="admin only")
    ok("normal agent admin_command denied",S(A,"dm",B,"admin_command").get("error")=="admin only")
    ok("privilege field rejected",S(A,"dm",B,"info",'{"grant":"admin"}').get("ok") is False)
    ok("unknown sender rejected",S("ag-9999x","dm",B,"info").get("error")=="unknown sender")
    dd1=S(A,"dm",C,"info",'{"n":1}',dedupe=P+"-dd"); dd2=S(A,"dm",C,"info",'{"n":1}',dedupe=P+"-dd"); ok("dedupe returns same id",dd1["id"]==dd2["id"] and dd2.get("dedup"))
    ok("cannot reply to unreceived message",S(C,"dm",A,"accept",reply=str(m1["id"])).get("ok") is False)
    L=sql("select public.aivault_comm_lease('%s','run-1',10,120) r"%B); ids=[x["r"]["id"] for x in L]; ok("lease returns messages for B",m1["id"] in ids and g["id"] in ids,len(ids))
    ok("read with wrong run rejected",j("select public.aivault_comm_ack('%s',%d,'read','run-X',null) r"%(B,m1["id"]))["r"].get("ok") is False)
    ok("read with lease run ok",j("select public.aivault_comm_ack('%s',%d,'read','run-1',null) r"%(B,m1["id"]))["r"].get("ok"))
    rp=S(B,"dm",A,"accept",'{"text":"ok, cube coming"}',reply=str(m1["id"])); ok("reply carries correlation + hop",rp.get("ok") and rp["correlation_id"]==m1["correlation_id"] and rp["hop"]==1,rp)
    ok("original delivery marked replied",j("select status from public.aivault_comm_deliveries where message_id=%d and agent_id='%s'"%(m1["id"],B))["status"]=="replied")
    ok("done without evidence rejected",j("select public.aivault_comm_ack('%s',%d,'done',null,null) r"%(B,m1["id"]))["r"].get("ok") is False)
    ok("done with evidence ok",j("select public.aivault_comm_ack('%s',%d,'done',null,'{\"reply_id\":%d}'::jsonb) r"%(B,m1["id"],rp["id"]))["r"].get("ok"))
    # 租約逾時→重試；5 次→dead；離線收件人訊息一直留在佇列
    sql("update public.aivault_comm_deliveries set lease_until=now()-interval '1 second' where message_id=%d and agent_id='%s'"%(g["id"],B)); sw=j("select public.aivault_comm_sweep() r")["r"]
    ok("expired lease requeued by sweep",j("select status from public.aivault_comm_deliveries where message_id=%d and agent_id='%s'"%(g["id"],B))["status"]=="queued",sw)
    sql("update public.aivault_comm_deliveries set attempts=5, status='leased', lease_until=now()-interval '1 second' where message_id=%d and agent_id='%s'"%(g["id"],B)); j("select public.aivault_comm_sweep() r")
    ok("dead after 5 attempts",j("select status from public.aivault_comm_deliveries where message_id=%d and agent_id='%s'"%(g["id"],B))["status"]=="dead")
    ok("offline agent keeps queued message",j("select status from public.aivault_comm_deliveries where message_id=%d and agent_id='%s'"%(g["id"],D))["status"]=="queued")
    L2=sql("select public.aivault_comm_lease('%s','run-d',10,60) r"%D); ok("offline agent recovers on next lease",g["id"] in [x["r"]["id"] for x in L2])
    # 迴圈限制
    last=m1["id"]; cur=None; who=[B,A]; err=None
    for i in range(12):
        s=who[i%2]; r=who[(i+1)%2]; sql("select public.aivault_comm_lease('%s','loop',50,60)"%s); res=S(s,"dm",r,"progress",'{"i":%d}'%i,reply=str(last))
        if not res.get("ok"): err=res.get("error"); break
        last=res["id"]
    ok("hop limit stops ping-pong chain",err and "hop limit" in err,err)
    pp=None
    for i in range(20):
        res=S(C,"dm",D,"progress",'{"pp":%d}'%i,corr=P+"-pp")
        if not res.get("ok"): pp=res.get("error"); break
    ok("pair limit per correlation",pp and "ping-pong" in pp,pp)
    ok("admin command from 暗星 to group",S("darkstar","group",P+"-g","admin_command",'{"text":"status report"}').get("ok"))
    bc=S("darkstar","broadcast","all","info",'{"text":"transport test broadcast; expires immediately"}'); ok("admin broadcast fan-out",bc.get("ok") and bc["recipients"]>=1000,bc.get("recipients"))
    sql("update public.aivault_comm_messages set expires_at=now() where id=%d"%bc["id"]); j("select public.aivault_comm_sweep() r")
    ok("broadcast expired by sweep (no inbox spam)",j("select count(*) c from public.aivault_comm_deliveries where message_id=%d and status<>'expired'"%bc["id"])["c"]==0)
    # 工作區
    s1=j("select public.aivault_comm_save(%s,'%s','game.js','v1 by B') r"%(lit(P),B))["r"]; s2=j("select public.aivault_comm_save(%s,'%s','game.js','v1 by C') r"%(lit(P),C))["r"]
    ok("separate branches, no overwrite",s1["version"]==1 and s2["version"]==1 and j("select count(*) c from public.aivault_comm_files where project_id=%s"%lit(P))["c"]==2)
    ok("cannot write main directly",j("select public.aivault_comm_save(%s,'main','game.js','x') r"%lit(P))["r"].get("ok") is False)
    p1=j("select public.aivault_comm_propose(%s,'%s','game.js',1) r"%(lit(P),B))["r"]; p2=j("select public.aivault_comm_propose(%s,'%s','game.js',1) r"%(lit(P),C))["r"]
    ok("self-accept denied",j("select public.aivault_comm_decide(%d,'%s',true,'{\"pass\":true}'::jsonb) r"%(p1["merge_id"],B))["r"].get("error")=="cannot accept own merge")
    ok("accept without passing test denied",j("select public.aivault_comm_decide(%d,'%s',true,'{\"pass\":false}'::jsonb) r"%(p1["merge_id"],D))["r"].get("ok") is False)
    a1=j("select public.aivault_comm_decide(%d,'%s',true,'{\"pass\":true,\"tests\":3}'::jsonb) r"%(p1["merge_id"],D))["r"]; ok("acceptor merges B into main v1",a1.get("ok") and a1["main_version"]==1,a1)
    a2=j("select public.aivault_comm_decide(%d,'%s',true,'{\"pass\":true}'::jsonb) r"%(p2["merge_id"],D))["r"]; ok("stale merge flagged conflict (no overwrite)",a2.get("status")=="conflict",a2)
    ok("skill directory lookup",j("select count(*) c from public.aivault_comm_skills where sandbox='3d'")["c"]>=100)
    print("COMMTEST project=%s passed=%d/%d"%(P,sum(R),len(R)))
if "handoffmig" in STEPS:
    sql(open("supabase/migrations/20261018110000_aivault_comm_handoff.sql").read()); P="htest-"+datetime.datetime.utcnow().strftime("%m%d%H%M%S"); R=[]
    def ok(n,c,i=""): R.append(bool(c)); print(("PASS " if c else "FAIL ")+n,i)
    def S(s,k,r,t,pl,reply="null",corr="null"):
        try: return sql("select public.aivault_comm_send(%s,%s,%s,%s,%s::jsonb,null,null,%s,%s,null) r"%(lit(s),lit(k),lit(r),lit(t),lit(json.dumps(pl,ensure_ascii=False)),corr if corr=="null" else lit(corr),reply))[0]["r"]
        except AssertionError as e: return {"ok":False,"error":str(e)[:160]}
    H={"goal":"write game.js","context":"msg#1","owned_scope":"game.js@ag-0200","forbidden_scope":"main, other files","constraints":"free-only; no privilege escalation; no self-approval","success_criteria":"tests pass","report_format":"done/missing/changes/tests/failures/cost/commits"}
    bad=dict(H); bad.pop("forbidden_scope"); ok("handoff missing field rejected","forbidden_scope" in str(S("ag-0700","dm","ag-0200","handoff",bad)))
    b2=dict(H,constraints="be fast"); ok("handoff without free-only rejected",not S("ag-0700","dm","ag-0200","handoff",b2).get("ok"))
    h=S("ag-0700","dm","ag-0200","handoff",H); ok("valid handoff accepted",h.get("ok"),h)
    sql("select public.aivault_comm_lease('ag-0200','h',10,60)"); a=S("ag-0200","dm","ag-0700","accept",{"text":"accepted"},reply=str(h["id"])); ok("accept linked by correlation",a.get("ok") and a["correlation_id"]==h["correlation_id"])
    ok("report missing fields rejected",not S("ag-0200","dm","ag-0700","report",{"done":"x"},reply=str(h["id"])).get("ok"))
    rp=S("ag-0200","dm","ag-0700","report",{"done":"game.js v1","missing":"none","changes":"game.js","tests":"5/5","failures":"none","cost":"$0, 0 tokens (test)","commits":"workspace v1"},reply=str(h["id"])); ok("full report accepted, same correlation",rp.get("ok") and rp["correlation_id"]==h["correlation_id"],rp)
    v=sql("select * from public.aivault_comm_handoffs where handoff_id=%d"%h["id"])[0]; ok("handoff view links accept+report",v["accept_id"]==a["id"] and v["report_id"]==rp["id"] and v["report_quality"]>=3,v.get("report_quality"))
    print("HANDOFFTEST passed=%d/%d"%(sum(R),len(R)))
if "memmig" in STEPS:
    sql(open("supabase/migrations/20261018120000_aivault_shared_memory.sql").read()); print("MEMMIG", sql("select * from public.aivault_mem_metrics"), sql("select status,kind,count(*) from public.aivault_kb group by 1,2"))
if "ancnmig" in STEPS:
    sql(open("supabase/migrations/20261018130000_aivault_ancn.sql").read()); print("ANCNMIG", sql("select neuron_state,count(*) from public.aivault_ancn_neurons group by 1"), sql("select count(*) skills from public.aivault_ancn_skills"))
if "ancnload" in STEPS:  # an1：合成負載測試（不呼叫模型、不建立真代理）。臨時 schema，測完刪除。模擬 ≠ 真實推理。
    for x in sql("select nspname from pg_namespace where nspname like 'ancn_load%'"): sql("drop schema %s cascade"%x["nspname"])
    for N in [1000,10000,100000]:
        db=sql("select pg_database_size(current_database())/1048576 mb")[0]["mb"]
        if db>330: print("LOAD skip N=%d db=%sMB (free tier guard)"%(N,db)); continue
        E=6 if N<100000 else 4; S="ancn_load_%d"%N
        r=sql("""do $$ begin execute 'drop schema if exists %(S)s cascade'; execute 'create schema %(S)s'; end $$;
        create table %(S)s.nodes(id int primary key, skill text, state text default 'READY');
        create table %(S)s.edges(source int, target int, relation text, success int default 0, fail int default 0, weight numeric default .5, primary key(source,target,relation));
        create table %(S)s.deliv(message_id bigint, agent int, status text default 'queued', lease_until timestamptz, attempts int default 0, primary key(message_id,agent));
        create index on %(S)s.deliv(agent,status); create index on %(S)s.edges(source,weight desc);
        create table %(S)s.kb(id serial primary key, body text, tsv tsvector generated always as (to_tsvector('simple',body)) stored); create index on %(S)s.kb using gin(tsv);
        select 1"""%{"S":S})
        M=min(N*2,200000); K=max(N//10,100)
        sql("""create table %(S)s.timing(op text, n bigint, ms numeric);
        do $$ declare t timestamptz; c bigint; i int; tot numeric; begin
          t:=clock_timestamp(); insert into %(S)s.nodes(id,skill) select g, (array['code','game','3d','av','music','tts','image','reason','model','gpu','collab','security'])[1+g%%12] from generate_series(1,%(N)d) g; get diagnostics c=row_count; insert into %(S)s.timing values('nodes',c,extract(epoch from clock_timestamp()-t)*1000);
          t:=clock_timestamp(); insert into %(S)s.edges(source,target,relation,success,weight) select g, 1+((g*7919+k*104729)%%%(N)d), 'help', k, round(random()::numeric,3) from generate_series(1,%(N)d) g, generate_series(1,%(E)d) k where 1+((g*7919+k*104729)%%%(N)d)<>g on conflict do nothing; get diagnostics c=row_count; insert into %(S)s.timing values('edges',c,extract(epoch from clock_timestamp()-t)*1000);
          t:=clock_timestamp(); insert into %(S)s.deliv(message_id,agent) select g, 1+(g*31%%%(N)d) from generate_series(1,%(M)d) g; get diagnostics c=row_count; insert into %(S)s.timing values('deliveries',c,extract(epoch from clock_timestamp()-t)*1000);
          t:=clock_timestamp(); insert into %(S)s.kb(body) select 'problem '||g||' '||(array['paginate off by one','sort numeric strings','null pointer render','timeout fetch retry','glb validator error','audio clip pop'])[1+g%%6]||' module'||(g%%97) from generate_series(1,%(K)d) g; get diagnostics c=row_count; insert into %(S)s.timing values('kb',c,extract(epoch from clock_timestamp()-t)*1000);
          analyze %(S)s.nodes; analyze %(S)s.edges; analyze %(S)s.deliv; analyze %(S)s.kb;
          t:=clock_timestamp(); with c2 as (select message_id, agent from %(S)s.deliv where status='queued' order by message_id limit 2000 for update skip locked) update %(S)s.deliv d set status='leased', lease_until=now()+interval '2 minutes', attempts=attempts+1 from c2 where d.message_id=c2.message_id and d.agent=c2.agent; get diagnostics c=row_count; insert into %(S)s.timing values('lease_batch',c,extract(epoch from clock_timestamp()-t)*1000);
          tot:=0; for i in 1..50 loop t:=clock_timestamp(); perform count(*) from (select id from %(S)s.kb where tsv @@ to_tsquery('simple',(array['paginate','numeric','timeout','validator','audio'])[1+i%%5]) order by id limit 5) x; tot:=tot+extract(epoch from clock_timestamp()-t)*1000; end loop; insert into %(S)s.timing values('fts_top5_avg50',50,tot/50);
          tot:=0; for i in 1..50 loop t:=clock_timestamp(); perform count(*) from (select target from %(S)s.edges where source=1+(i*977)%%%(N)d and relation='help' order by weight desc limit 3) x; tot:=tot+extract(epoch from clock_timestamp()-t)*1000; end loop; insert into %(S)s.timing values('pick_top3_avg50',50,tot/50);
          tot:=0; for i in 1..50 loop t:=clock_timestamp(); perform count(*) from %(S)s.deliv where agent=1+(i*613)%%%(N)d and status='queued'; tot:=tot+extract(epoch from clock_timestamp()-t)*1000; end loop; insert into %(S)s.timing values('inbox_avg50',50,tot/50);
        end $$; select 1"""%{"S":S,"N":N,"E":E,"M":M,"K":K})
        T={x["op"]:(int(x["n"]),float(x["ms"])) for x in sql("select * from %s.timing"%S)}
        sz=sql("select sum(pg_total_relation_size(c.oid))/1048576.0 mb from pg_class c join pg_namespace n on n.oid=c.relnamespace where nspname='%s' and c.relkind in ('r','m')"%S)[0]["mb"]
        rate=lambda k: round(T[k][0]/max(T[k][1],0.001)*1000)
        print("LOAD N=%d nodes=%d(%d rows/s) edges=%d(%d/s) deliveries=%d(%d/s) kb=%d(%d/s) lease_batch=%d in %.1fms(%d/s) fts_top5=%.3fms pick_top3=%.3fms inbox=%.3fms storage=%.1fMB db_before=%sMB"%(N,T["nodes"][0],rate("nodes"),T["edges"][0],rate("edges"),T["deliveries"][0],rate("deliveries"),T["kb"][0],rate("kb"),T["lease_batch"][0],T["lease_batch"][1],rate("lease_batch"),T["fts_top5_avg50"][1],T["pick_top3_avg50"][1],T["inbox_avg50"][1],float(sz),db))
        sql("drop schema %s cascade"%S)
    print("LOAD cleanup ok; db now", sql("select pg_database_size(current_database())/1048576 mb")[0]["mb"],"MB; schemas left:", sql("select nspname from pg_namespace where nspname like 'ancn_load%'"))
if "repmig" in STEPS:
    sql(open("supabase/migrations/20261018140000_aivault_replication_auto.sql").read())
    print("REP eligible_today", sql("select count(*) n from public.aivault_replication_eligible()"), "tier3plus_only", sql("select count(*) n from public.aivault_pool_agent_degree where tier>=3"), "lab_passers", sql("select count(distinct lead_id) n from public.aivault_lab_experiments where status='passed'"))
    print("REP state", sql("select k,v from public.aivault_floor_state where k like 'replication:%'"), sql("select jobname,schedule from cron.job where jobname='aivault-replicate-daily'"))
    print("REP sizes", sql("select pg_database_size(current_database())/1048576 db_mb, (select pg_total_relation_size('public.aivault_pool_agents')+pg_total_relation_size('public.aivault_agent_state')+pg_total_relation_size('public.aivault_agent_lineage')+pg_total_relation_size('public.aivault_ancn_skills'))/1024.0/(select count(*) from public.aivault_pool_agents) kb_per_agent"))
if "rep2mig" in STEPS:
    sql(open("supabase/migrations/20261018150000_aivault_replication_double.sql").read())
    print("REP2 eligible_today", sql("select count(*) n from public.aivault_replication_eligible()"), "lineage", sql("select count(*) n from public.aivault_agent_lineage"), "current_bytes_per_agent", sql("select round(public.aivault_agent_bytes()) b"))
    # 精簡新生列實測：臨時 schema 複製表結構，模擬插入 1000 個新生（同一段 select），量位元組後刪除
    sql("""drop schema if exists rep_dry cascade; create schema rep_dry;
      create table rep_dry.a (like public.aivault_pool_agents including defaults including indexes); create table rep_dry.l (like public.aivault_agent_lineage including defaults including indexes);
      create table rep_dry.s (like public.aivault_agent_state including defaults including indexes); create table rep_dry.k (like public.aivault_ancn_skills including defaults including indexes);
      insert into rep_dry.a(id,name,domain,specialty,persona,model_route,avatar,status,stats,zone,parent_agent_id,spawned) select 'ag-'||(200000+row_number() over ()), left(name,40)||'·x', domain, specialty, left(persona,300), '{}', null, 'idle', '{}', zone, id, true from public.aivault_pool_agents where id ~ '^ag-\\d+$' limit 1000;
      insert into rep_dry.l(agent_id,parent_id,generation,template_version) select id, parent_agent_id, 1, 'v1-lean' from rep_dry.a;
      insert into rep_dry.s(agent_id,state,reason) select id,'SLEEPING','新生，按需喚醒' from rep_dry.a;
      insert into rep_dry.k(agent_id,skill,level,evidence) select id,'code',0.05,'[]' from rep_dry.a; analyze rep_dry.a; select 1""")
    b=sql("select (pg_total_relation_size('rep_dry.a')+pg_total_relation_size('rep_dry.l')+pg_total_relation_size('rep_dry.s')+pg_total_relation_size('rep_dry.k'))/1000.0 bytes, (select count(*) from rep_dry.a) n, pg_database_size(current_database())/1048576.0 db")[0]
    sql("drop schema rep_dry cascade"); bpa=float(b["bytes"]); db=float(b["db"]); 
    print("REP2 dry lean offspring bytes/agent=%.0f (n=%s); db now %.1fMB; projected at 100k: +%.1fMB -> %.1fMB (limit 350MB); fits=%s"%(bpa,b["n"],db,bpa*99000/1048576,db+bpa*99000/1048576,db+bpa*99000*1.3/1048576<350))
if "countsmig" in STEPS:
    sql(open("supabase/migrations/20261018151000_aivault_counts.sql").read()); print("COUNTS", sql("select public.aivault_city_counts() c"))
if "memgetmig" in STEPS:
    sql(open("supabase/migrations/20261018160000_aivault_mem_get.sql").read()); print("MEMGET ok")
if "notifymig" in STEPS:
    sql(open("supabase/migrations/20261018161000_aivault_mem_notify_v2.sql").read()); print("NOTIFYMIG", sql("select public.aivault_mem_notify(7,'verified_recheck') n"), sql("select agent_id,event,message_id from public.aivault_mem_notify_log where kb_id=7"))
if "hviewmig" in STEPS:
    sql(open("supabase/migrations/20261018162000_aivault_handoff_view_v2.sql").read()); print("HVIEW", sql("select handoff_id,sender,recipient,accept_id,reject_id,report_id,report_quality from public.aivault_comm_handoffs where project_id='game-202610180132' order by 1"))
if "amsginv" in STEPS:
    print("AMSG fn", sql("select p.proname, p.prosecdef secdef, pg_get_function_arguments(p.oid) args, array(select grantee::regrole::text from aclexplode(p.proacl) where privilege_type='EXECUTE') execs from pg_proc p join pg_namespace n on n.oid=p.pronamespace where nspname='public' and proname like 'agent_module%'"))
    print("AMSG pol", sql("select policyname, roles, cmd, qual, with_check from pg_policies where tablename='agent_messages'"))
    print("AMSG grants", sql("select grantee, string_agg(privilege_type,',') p from information_schema.role_table_grants where table_name='agent_messages' group by 1"))
    print("AMSG recent", sql("select sender_agent_id, receiver_agent_id, message_type, created_at from public.agent_messages order by created_at desc limit 5"))

def amsg_try(role, claims, how):
    body = ("perform public.agent_module_send_message('sec-test','technical-dark-star','dawn-light','MESSAGE','attack probe',null);" if how=="rpc" else
            "insert into public.agent_messages(task_id,sender_agent_id,receiver_agent_id,message_type,content) values('sec-test','technical-dark-star','dawn-light','MESSAGE','attack probe');")
    q = ("do $t$ begin perform set_config('request.jwt.claims', %s, true); execute 'set local role %s'; begin %s exception when others then raise exception 'RESULT:%%:%%', sqlstate, sqlerrm; end; raise exception 'RESULT:OK(rolled back)'; end $t$" % ("'"+claims+"'", role, body))
    try: sql(q); return "?"
    except Exception as e: m = str(e); i = m.find("RESULT:"); return m[i:i+140] if i >= 0 else m[:160]
if "amsgmig" in STEPS or "amsgtest" in STEPS:
    if "amsgmig" in STEPS:
        print("AMSG before:", {k: amsg_try(*k) for k in [("anon",'{"role":"anon"}',"rpc"),("authenticated",'{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}',"rpc"),("authenticated",'{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}',"insert")]})
        sql(open("supabase/migrations/20261018170000_agent_messages_write_guard.sql").read())
        print("AMSG mig applied", sql("select policyname, cmd from pg_policies where tablename='agent_messages'"), sql("select count(*) n from public.agent_messages"))
    for k in [("anon",'{"role":"anon"}',"rpc"),("authenticated",'{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}',"rpc"),("authenticated",'{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}',"insert"),("authenticated",'{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000002","app_metadata":{"role":"owner"}}',"rpc"),("service_role",'{"role":"service_role"}',"rpc")]:
        print("AMSG after", k[0], json.loads(k[1]).get("app_metadata",{}).get("role","-"), k[2], "=>", amsg_try(*k))

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
    while True:
        k+=1; s,b=y({"action":"cycle","n":N,**({"mode":mode} if mode else {})}); ok=isinstance(b,dict)
        rs=(b.get("results") or []) if ok else []
        for r in rs: tok+=((r.get("usage") or {}).get("total") or 0)
        print("CYCLE",k,s,"rl",b.get("rate_limited") if ok else b,[(r.get("kind"),r.get("agent"),r.get("tier"),r.get("level"),r.get("score"),r.get("max"),r.get("topic"),(r.get("usage") or {}).get("total"),(r.get("error") or "")[:90],bool(r.get("url"))) for r in rs])
        if s!=200 or not ok or time.time()>end: break
        if b.get("rate_limited"):
            errs=" ".join(str(r.get("error")) for r in rs); print("STOP: Groq limit", errs[:300]); break
        time.sleep(10)
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

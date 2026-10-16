# AI 協作池 1000 代理：建表、上架加密私有頁、種子、實測。不輸出金鑰或私有頁內容。
import json, os, subprocess, sys, time, uuid, glob, urllib.request, urllib.error
REF="clcddygkaaqqtsbswgdf"; BASE="https://%s.supabase.co"%REF; TOKEN=os.environ["TOKEN"]; STEPS=os.environ.get("STEP","all").split(","); ORDER=os.environ.get("ORDER","")
def http(url,data=None,headers=None,method=None,timeout=150):
    r=urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,headers=dict({"Content-Type":"application/json","User-Agent":"agents-setup"},**(headers or {})),method=method)
    try:
        with urllib.request.urlopen(r,timeout=timeout) as f: b=f.read(); return f.status,(json.loads(b) if b else None)
    except urllib.error.HTTPError as e:
        b=e.read()
        try: return e.code,json.loads(b)
        except Exception: return e.code,b[:300].decode("utf-8","replace")
def sql(q):
    s,b=http("https://api.supabase.com/v1/projects/%s/database/query"%REF,{"query":q},{"Authorization":"Bearer "+TOKEN},"POST"); assert s<300,(s,str(b)[:300]); return b
if "migrate" in STEPS or "all" in STEPS:
    print("existing check", sql("select tablename, rowsecurity, (select count(*) from pg_policies p where p.tablename=t.tablename and p.policyname='owner_admin_all') as mine from pg_tables t where schemaname='public' and tablename in ('aivault_agent_memory','aivault_agents','aivault_agent_tasks','aivault_agent_usage')"))
    sql(open("supabase/migrations/20261017010000_aivault_pool_agents.sql").read())
    print("migrate ok", sql("select tablename, rowsecurity from pg_tables where tablename like 'aivault_pool_agent%'"))
    print("policies", sql("select tablename, policyname from pg_policies where tablename like 'aivault_pool_agent%'"))
if "publish" in STEPS or "all" in STEPS:
    for f in glob.glob("private/*.html.gpg"):
        slug=os.path.basename(f)[:-9]; html=subprocess.check_output(["gpg","--batch","--quiet","--pinentry-mode","loopback","--passphrase",os.environ["PAGES_KEY"],"-d",f]).decode()
        tag="$aivpp$"; assert tag not in html
        sql("insert into public.aivault_private_pages(slug,html,updated_at) values ('%s',%s%s%s,now()) on conflict (slug) do update set html=excluded.html, updated_at=now()"%(slug,tag,html,tag)); print("published",slug,len(html))
    link='<a class="btn primary" href="aivault-agent-collaboration.html?page=agent-roster" style="display:inline-block;text-decoration:none;margin-left:6px">🤖 1000 代理指揮台</a>'
    sql("update public.aivault_private_pages set html=replace(html,'🔙 回 Home</a>','🔙 回 Home</a>'||$l$%s$l$),updated_at=now() where slug='agent-collaboration' and position('page=agent-roster' in html)=0"%link)
    print("collab link", sql("select position('page=agent-roster' in html)>0 as linked from public.aivault_private_pages where slug='agent-collaboration'"))
if any(s in STEPS for s in ("seed","test","all")):
    _,keys=http("https://api.supabase.com/v1/projects/%s/api-keys?reveal=true"%REF,headers={"Authorization":"Bearer "+TOKEN})
    SR=next(k["api_key"] for k in keys if k.get("name")=="service_role"); ANON=next(k["api_key"] for k in keys if k.get("name")=="anon")
    print("::add-mask::"+SR); print("::add-mask::"+ANON); H={"apikey":SR,"Authorization":"Bearer "+SR}
    email="agents-e2e-%s@example.com"%uuid.uuid4().hex[:8]; pw=uuid.uuid4().hex+"Aa1!"
    s,u=http(BASE+"/auth/v1/admin/users",{"email":email,"password":pw,"email_confirm":True,"app_metadata":{"role":"admin","approved":True}},H,"POST"); uid=u["id"]
    http(BASE+"/auth/v1/admin/users/"+uid,{"ban_duration":"none","app_metadata":{"role":"admin","approved":True}},H,"PUT")
    try:
        s,t=http(BASE+"/auth/v1/token?grant_type=password",{"email":email,"password":pw},{"apikey":ANON}); JWT=t["access_token"]; print("::add-mask::"+JWT)
        def y(body):
            t0=time.time(); s,b=http(BASE+"/functions/v1/dark-star-ebook-ingest?feature=agents",body,{"apikey":ANON,"Authorization":"Bearer "+JWT},"POST"); return s,b,round(time.time()-t0,1)
        s,b,_=http(BASE+"/functions/v1/dark-star-ebook-ingest?feature=agents",{"action":"providers"},{"apikey":ANON,"Authorization":"Bearer "+ANON},"POST"); print("anon ->",s)
        s,b,_=(lambda r:(r[0],r[1],0))(http(BASE+"/rest/v1/aivault_pool_agents?select=id&limit=1",headers={"apikey":ANON,"Authorization":"Bearer "+JWT})); print("rest as admin ->",s,str(b)[:80])
        if "seed" in STEPS or "all" in STEPS: print("SEED",y({"action":"seed"})[:2])
        s,b,dt=y({"action":"providers"}); print("PROVIDERS",s,json.dumps(b,ensure_ascii=False)[:600])
        s,b,dt=y({"action":"list","domain":"law","q":"行政","limit":3}); print("LIST",s,b.get("total"),[(a["id"],a["name"],a["specialty"],a["needs_key"]) for a in b.get("agents",[])]); print("DOMAINS",[(d["key"],d["n"],d["ready"]) for d in b.get("domains",[])])
        if "test" in STEPS or "all" in STEPS:
            s,b,dt=y({"action":"command","order":ORDER or "為 AIVAULT 因序小說寫一句 30 字內的宣傳標語，並給一段 60 字的主題曲歌詞","max_agents":2,"max_steps":3}); print("COMMAND",s,dt,"s",b.get("summary"),[(t["agent"]["name"],t["agent"]["domain"],t["order_text"][:40]) for t in b.get("tasks",[])] if isinstance(b,dict) else b)
            for t in b.get("tasks",[]):
                for i in range(8):
                    s2,r2,dt=y({"action":"step","task_id":t["id"]}); tk=r2.get("task",{}) if isinstance(r2,dict) else {}
                    last=(tk.get("steps") or [{}])[-1]; print("  STEP",t["agent"]["name"],i,s2,dt,"s",tk.get("status"),last.get("type"),last.get("model"),last.get("media_status") or "","|",str(last.get("output",""))[:160].replace("\n"," "))
                    if tk.get("status") in("done","failed"): print("  RESULT",str(tk.get("result",""))[:400].replace("\n"," ")); break
            s,r,dt=y({"action":"synth","task_id":b["parent"]["id"]}); print("SYNTH",s,dt,"s",str(r.get("task",{}).get("result",""))[:600].replace("\n"," "))
            s,r,dt=y({"action":"get","id":b["tasks"][0]["agent_id"]}); print("MEMORY",[m["content"][:80] for m in r.get("memory",[])],"stats",r.get("agent",{}).get("stats"))
    finally:
        http(BASE+"/auth/v1/admin/users/"+uid,None,H,"DELETE"); print("temp user deleted")

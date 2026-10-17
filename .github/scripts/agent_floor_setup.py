# 協作池 1000 人工作區：建欄位、上架私有頁與入口連結、派種子任務、執行工作循環。不輸出金鑰或私有頁內容。
import json, os, subprocess, urllib.request, urllib.error
REF="clcddygkaaqqtsbswgdf"; BASE="https://%s.supabase.co"%REF; TOKEN=os.environ["TOKEN"]; STEPS=os.environ.get("STEP","cycle").split(","); N=int(os.environ.get("N","3") or 3)
def http(url,data=None,headers=None,method=None,timeout=300):
    r=urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,headers=dict({"Content-Type":"application/json","User-Agent":"agent-floor"},**(headers or {})),method=method)
    try:
        with urllib.request.urlopen(r,timeout=timeout) as f: b=f.read(); return f.status,(json.loads(b) if b else None)
    except urllib.error.HTTPError as e:
        b=e.read()
        try: return e.code,json.loads(b)
        except Exception: return e.code,b[:300].decode("utf-8","replace")
def sql(q):
    s,b=http("https://api.supabase.com/v1/projects/%s/database/query"%REF,{"query":q},{"Authorization":"Bearer "+TOKEN},"POST"); assert s<300,(s,str(b)[:300]); return b
if "migrate" in STEPS:
    sql(open("supabase/migrations/20261017090000_aivault_agent_floor.sql").read())
    sql(open("supabase/migrations/20261017093000_aivault_pool_approved_outputs.sql").read())
    print("zones", sql("select zone,count(*) from public.aivault_pool_agents group by zone order by zone"))
if "publish" in STEPS:
    html=subprocess.check_output(["gpg","--batch","--quiet","--pinentry-mode","loopback","--passphrase",os.environ["PAGES_KEY"],"-d","private/agent-floor.html.gpg"]).decode()
    tag="$aivpp$"; assert tag not in html
    sql("insert into public.aivault_private_pages(slug,html,updated_at) values ('agent-floor',%s%s%s,now()) on conflict (slug) do update set html=excluded.html, updated_at=now()"%(tag,html,tag)); print("published agent-floor",len(html))
    link='<a class="btn primary" href="aivault-agent-collaboration.html?page=agent-floor" style="display:inline-block;text-decoration:none;margin-left:6px">🏢 1000 人工作區</a>'
    sql("update public.aivault_private_pages set html=replace(html,'🔙 回 Home</a>','🔙 回 Home</a>'||$l$%s$l$),updated_at=now() where slug='agent-collaboration' and position('page=agent-floor' in html)=0"%link)
    print("collab link", sql("select position('page=agent-floor' in html)>0 as linked from public.aivault_private_pages where slug='agent-collaboration'"))
if any(s in STEPS for s in ("seed","cycle","test")):
    _,keys=http("https://api.supabase.com/v1/projects/%s/api-keys?reveal=true"%REF,headers={"Authorization":"Bearer "+TOKEN})
    SR=next(k["api_key"] for k in keys if k.get("name")=="service_role"); print("::add-mask::"+SR)
    def y(body): return http(BASE+"/functions/v1/dark-star-ebook-ingest?feature=floor",body,{"apikey":SR,"Authorization":"Bearer "+SR},"POST")
    if "test" in STEPS:
        ANON=next(k["api_key"] for k in keys if k.get("name")=="anon")
        s,_=http(BASE+"/functions/v1/dark-star-ebook-ingest?feature=floor",{"action":"floor"},{"apikey":ANON,"Authorization":"Bearer "+ANON},"POST"); print("anon ->",s)
    if "seed" in STEPS: s,b=y({"action":"seed"}); print("SEED",s,json.dumps(b,ensure_ascii=False)[:300])
    if "cycle" in STEPS: s,b=y({"action":"cycle","n":N}); print("CYCLE",s,json.dumps(b,ensure_ascii=False)[:800])
    if "test" in STEPS:
        s,b=y({"action":"floor"}); print("FLOOR",s,{k:b.get(k) for k in ("review","counts")} if isinstance(b,dict) else b)
        s,b=y({"action":"reviews"})
        print("REVIEWS",len(b.get("tasks") or []))
        s,b=y({"action":"ledger","limit":12})
        for t in (b.get("rows") or []): print("\n=== ",t.get("agent_id"),t.get("agent_name"),t.get("zone_label"),t.get("kind"),t.get("status"),t.get("review_status"),t.get("model"),t.get("usage"),t.get("finished_at"),t.get("source_url"),"|",t["task"][:70],"\n",str(t.get("result",""))[:900])

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
    sql(open("supabase/migrations/20261017100000_aivault_novel_books.sql").read())
    print("zones", sql("select zone,count(*) from public.aivault_pool_agents group by zone order by zone"))
if "publish" in STEPS:
    html=subprocess.check_output(["gpg","--batch","--quiet","--pinentry-mode","loopback","--passphrase",os.environ["PAGES_KEY"],"-d","private/agent-floor.html.gpg"]).decode()
    tag="$aivpp$"; assert tag not in html
    sql("insert into public.aivault_private_pages(slug,html,updated_at) values ('agent-floor',%s%s%s,now()) on conflict (slug) do update set html=excluded.html, updated_at=now()"%(tag,html,tag)); print("published agent-floor",len(html))
    link='<a class="btn primary" href="aivault-agent-collaboration.html?page=agent-floor" style="display:inline-block;text-decoration:none;margin-left:6px">🏢 1000 人工作區</a>'
    sql("update public.aivault_private_pages set html=replace(html,'🔙 回 Home</a>','🔙 回 Home</a>'||$l$%s$l$),updated_at=now() where slug='agent-collaboration' and position('page=agent-floor' in html)=0"%link)
    # 協作池最上方直接嵌入工作區動畫（獨立 iframe；localStorage.agentFloorOff=1 即不載入）
    emb='<div id="agent-floor-embed"></div><script>(function(){if(localStorage.getItem("agentFloorOff")==="1")return;var f=document.createElement("iframe");f.src="aivault-agent-collaboration.html?page=agent-floor&embed=1";f.title="1000 人工作區";f.loading="eager";f.style.cssText="display:block;width:100%;height:72vh;border:1px solid #273244;border-radius:14px;margin:10px 0;background:#06080c";document.getElementById("agent-floor-embed").appendChild(f)})();</script>'
    sql("update public.aivault_private_pages set html=regexp_replace(html,'(<a class=\"btn primary\" href=\"aivault-agent-collaboration.html\?page=agent-floor\"[^>]*>[^<]*</a>)','\\1'||$e$%s$e$),updated_at=now() where slug='agent-collaboration' and position('agent-floor-embed' in html)=0"%emb)
    print("collab embed", sql("select position('agent-floor-embed' in html)>0 as embedded from public.aivault_private_pages where slug='agent-collaboration'"))
    print("collab link", sql("select position('page=agent-floor' in html)>0 as linked from public.aivault_private_pages where slug='agent-collaboration'"))
if "town" in STEPS:  # af5：公開協作城、世界頻道、發號施令、真人在線
    sql(open("supabase/migrations/20261017120000_aivault_town_public.sql").read())
    print("town tables", sql("select count(*) filter (where table_name='aivault_world_chat') wc, count(*) filter (where table_name='aivault_floor_commands') fc, count(*) filter (where table_name='aivault_presence') pr from information_schema.tables where table_schema='public'"))
if "collab2" in STEPS:  # 協作池頁：工作區嵌入改到 header 下方（不蓋住按鈕）、舊協作 AI 面板收進 ⚙️ 設定
    sql(r"""update public.aivault_private_pages set html=regexp_replace(html,'<div id="agent-floor-embed"></div><script>.*?</script>','','g'),updated_at=now() where slug='agent-collaboration' and position('agent-floor-embed' in html)>0 and position('agent-floor-embed2' in html)=0""")
    emb=open(".github/scripts/collab_af5_embed.html").read().strip(); tag="$af5$"; assert tag not in emb
    sql("update public.aivault_private_pages set html=regexp_replace(html,'</header>','</header>'||%s%s%s),updated_at=now() where slug='agent-collaboration' and position('agent-floor-embed2' in html)=0"%(tag,emb,tag))
    js=open(".github/scripts/collab_af5_settings.html").read().strip()
    sql("update public.aivault_private_pages set html=html||%s%s%s,updated_at=now() where slug='agent-collaboration' and position('collab-settings-js' in html)=0"%(tag,js,tag))
    print("collab2", sql("select position('agent-floor-embed2' in html)>0 emb, position('collab-settings-js' in html)>0 settings, (length(html)-length(replace(html,'agent-floor-embed\"','')))/18 old_embeds from public.aivault_private_pages where slug='agent-collaboration'"))
if "towncheck" in STEPS:  # 未登入（anon）只能讀到 agent-floor 動畫頁；其他私有頁、名冊、任務都讀不到
    _,keys=http("https://api.supabase.com/v1/projects/%s/api-keys?reveal=true"%REF,headers={"Authorization":"Bearer "+TOKEN})
    AN=next(k["api_key"] for k in keys if k.get("name")=="anon"); H={"apikey":AN,"Authorization":"Bearer "+AN}
    for path in ["aivault_private_pages?select=slug","aivault_pool_agents?select=id,name&limit=1","aivault_pool_agent_tasks?select=id,order_text&limit=1","aivault_pool_agent_memory?select=id&limit=1","aivault_world_chat?select=id,display_name,body&limit=1","aivault_floor_commands?select=id,body&limit=1","aivault_floor_commands?select=created_by&limit=1","aivault_presence?select=display_name,avatar&limit=1","aivault_presence?select=user_id&limit=1","aivault_floor_state?select=k&limit=1"]:
        s,b=http(BASE+"/rest/v1/"+path,headers=H); print("ANON",path,s,(b if path.startswith("aivault_private_pages") else (len(b) if isinstance(b,list) else str(b)[:80])))
    s,b=http(BASE+"/rest/v1/aivault_world_chat",{"body":"x"},H,"POST"); print("ANON insert chat",s)
    s,b=http(BASE+"/functions/v1/dark-star-ebook-ingest?feature=floor",{"action":"town"},H,"POST"); print("ANON town",s,sorted(b.keys()) if isinstance(b,dict) else b, "agents",len(b.get("agents") or []) if isinstance(b,dict) else "", "sample state",(b.get("states") or [None])[0] if isinstance(b,dict) else "")
    for act in ["floor","reviews","ledger","command","owner_ping"]:
        s,b=http(BASE+"/functions/v1/dark-star-ebook-ingest?feature=floor",{"action":act,"text":"x"},H,"POST"); print("ANON",act,s)
    s,b=http(BASE+"/functions/v1/dark-star-ebook-ingest?feature=agents",{"action":"list"},H,"POST"); print("ANON agents list",s)
if "stats" in STEPS:  # 唯讀：目前真實任務數
    print("STATS", sql("select status, coalesce(review_status,'-') rv, count(*) from public.aivault_pool_agent_tasks group by 1,2 order by 1,2"))
    print("TODAY_DONE", sql("select count(*) from public.aivault_pool_agent_tasks where status='done' and kind<>'spawn' and updated_at >= date_trunc('day', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei'"))
    print("AGENTS", sql("select count(*) total, count(*) filter (where spawned) spawned from public.aivault_pool_agents"), "MEM", sql("select count(*) from public.aivault_pool_agent_memory"))
if any(s in STEPS for s in ("seed","cycle","test")):
    _,keys=http("https://api.supabase.com/v1/projects/%s/api-keys?reveal=true"%REF,headers={"Authorization":"Bearer "+TOKEN})
    SR=next(k["api_key"] for k in keys if k.get("name")=="service_role"); print("::add-mask::"+SR)
    def y(body): return http(BASE+"/functions/v1/dark-star-ebook-ingest?feature=floor",body,{"apikey":SR,"Authorization":"Bearer "+SR},"POST")
    if "test" in STEPS:
        ANON=next(k["api_key"] for k in keys if k.get("name")=="anon")
        s,_=http(BASE+"/functions/v1/dark-star-ebook-ingest?feature=floor",{"action":"floor"},{"apikey":ANON,"Authorization":"Bearer "+ANON},"POST"); print("anon ->",s)
    if "seed" in STEPS: s,b=y({"action":"seed"}); print("SEED",s,json.dumps(b,ensure_ascii=False)[:300])
    if "cycle" in STEPS:
        import time; end=time.time()+60*float(os.environ.get("MINUTES","1") or 1); k=0
        while True:  # 穩定佇列：依序一輪一輪做，遇到 Groq 限流就提早結束（免費層約 30 次/分，這裡遠低於上限）
            k+=1; s,b=y({"action":"cycle","n":N}); ok=isinstance(b,dict)
            print("CYCLE",k,s,"done",b.get("done") if ok else b,"rate_limited",b.get("rate_limited") if ok else "", [(r.get("agent"),r.get("zone"),r.get("model"),(r.get("usage") or {}).get("total"),r.get("error")) for r in (b.get("results") or [])] if ok else "")
            if s!=200 or not ok or time.time()>end: break
            if b.get("rate_limited"):
                errs=" ".join(str(r.get("error")) for r in b.get("results") or [])
                rl=locals().get("rl",0)+1
                if "per day" in errs or "TPD" in errs or rl>=3: print("STOP: Groq limit", errs[:300]); break
                time.sleep(65); continue
            rl=0; time.sleep(8)
    if "test" in STEPS:
        s,b=y({"action":"floor"}); print("FLOOR",s,{k:b.get(k) for k in ("review","counts")} if isinstance(b,dict) else b)
        s,b=y({"action":"novels"}); print("NOVELS",{k:b.get(k) for k in ("total_chars","goal_chars","last24h","eta_days")} if isinstance(b,dict) else b)
        for x in (b.get("books") or [])[:12] if isinstance(b,dict) else []: print("  BOOK",x.get("genre"),x.get("title"),x.get("status"),x.get("chapters_done"),x.get("chars"),x.get("zone"))
        s,b=y({"action":"reviews"})
        print("REVIEWS",len(b.get("tasks") or []))
        s,b=y({"action":"ledger","limit":12})
        for t in (b.get("rows") or []): print("\n=== ",t.get("agent_id"),t.get("agent_name"),t.get("zone_label"),t.get("kind"),t.get("status"),t.get("review_status"),t.get("model"),t.get("usage"),t.get("finished_at"),t.get("source_url"),"|",t["task"][:70],"\n",str(t.get("result",""))[:900])

if "dump" in STEPS:  # 第一本小說全文 → 用私有頁金鑰加密成 artifact（公開 repo 的日誌不印內容）
    bk=sql("select id,title,genre,status,approved,outline,arcs,outline_agent,chapters_done,chars from public.aivault_novel_books order by created_at limit 1")
    out={"book":bk[0] if bk else None,"chapters":[],"tasks":[]}
    if bk:
        bid=bk[0]["id"]
        out["chapters"]=sql("select c.ch,c.title,c.chars,c.agent_id,a.name agent_name,c.model,c.usage,c.created_at,c.text from public.aivault_novel_chapters c left join public.aivault_pool_agents a on a.id=c.agent_id where book_id='%s' order by ch"%bid)
        out["tasks"]=sql("select t.id,t.agent_id,a.name,t.order_text,t.status,t.review_status,t.steps,t.created_at,t.updated_at from public.aivault_pool_agent_tasks t left join public.aivault_pool_agents a on a.id=t.agent_id where t.plan->'novel'->>'book'='%s' order by t.created_at"%bid)
        out["memory"]=sql("select agent_id,kind,content,created_at from public.aivault_pool_agent_memory where task_id in (select id from public.aivault_pool_agent_tasks where plan->'novel'->>'book'='%s') order by created_at"%bid)
    out["ledger_recent"]=sql("select t.agent_id,a.name,t.zone,t.kind,t.status,t.review_status,left(t.order_text,80) task,t.steps->0->>'model' model,t.steps->0->'usage' usage,t.steps->0->>'finished_at' fin,t.steps->0->>'source_url' src,left(t.result,600) result from public.aivault_pool_agent_tasks t left join public.aivault_pool_agents a on a.id=t.agent_id where t.source='floor' order by t.updated_at desc limit 40")
    out["usage_today"]=sql("select * from public.aivault_pool_agent_usage order by day desc limit 5")
    open("/tmp/dump.json","w").write(json.dumps(out,ensure_ascii=False,default=str))
    subprocess.check_call(["gpg","--batch","--yes","--quiet","--pinentry-mode","loopback","--passphrase",os.environ["PAGES_KEY"],"-c","-o","floor-dump.json.gpg","/tmp/dump.json"])
    print("dump ok", out["book"] and out["book"].get("status"), len(out["chapters"]), "chapters")

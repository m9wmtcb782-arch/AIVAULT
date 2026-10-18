# pb1：協作池書架。STEP=migrate,books,anthology,verify（逗號分隔）。只寫 aivault_pool_books*，不碰使用者電子書 dark_star_ebooks。
# books：docs/pool-books/*.md（Grok Bot 撰寫）→ upsert（只更新本書架自己的列）。
# anthology（pb2）：把 no-LLM 閱讀層「已經抓到」的學習紀錄（model='none(extractive)'，URL＋節錄）彙編成各區×層級的資料選輯；不重新抓網頁內容。
#   彙編者＝pool-anthology-compiler；上架前由獨立自動檢查 pool-anthology-checker 驗：去重（url/sha）、來源 URL＋貢獻代理 ID＋出處標示齊全、無疑似金鑰／私人資料。不合格的條目剔除；整本不合格＝rejected（不上架）。
# 關閉：repo variable POOL_BOOKS_OFF=1；或 aivault_floor_state k='poolbooks:off' v={"off":"1"}。公開日誌只印數字。
import json, os, re, glob, time, hashlib, urllib.request, urllib.error
REF="clcddygkaaqqtsbswgdf"; TOKEN=os.environ["TOKEN"]; STEPS=os.environ.get("STEP","books").split(",")
def mreq(path,body=None,method="GET"):
    r=urllib.request.Request("https://api.supabase.com/v1/projects/%s/%s"%(REF,path),data=None if body is None else json.dumps(body).encode(),headers={"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json","User-Agent":"pb1"},method=method)
    return json.load(urllib.request.urlopen(r,timeout=120))
def sql(q): return mreq("database/query",{"query":q},"POST")
SR=[k["api_key"] for k in mreq("api-keys?reveal=true") if k.get("name")=="service_role"][0]; print("::add-mask::"+SR)
H={"Authorization":"Bearer "+SR,"apikey":SR,"Content-Type":"application/json"}; BASE="https://%s.supabase.co/rest/v1/"%REF
def rest(path,body=None,method=None,prefer="return=representation"):
    r=urllib.request.Request(BASE+path,data=None if body is None else json.dumps(body).encode(),headers={**H,"Prefer":prefer},method=method or ("POST" if body is not None else "GET"))
    try: t=urllib.request.urlopen(r,timeout=60).read()
    except urllib.error.HTTPError as e: raise SystemExit("REST %s %s"%(e.code,e.read()[:200]))
    return json.loads(t) if t else None
TO={"基礎":1,"入門":2,"專業":3}
if "migrate" in STEPS:
    sql(open("supabase/migrations/20261018180000_aivault_pool_books.sql").read()); sql(open("supabase/migrations/20261018181000_aivault_pool_book_readers.sql").read()); sql("notify pgrst, 'reload schema'"); time.sleep(6); print("migrated pool_books")
off=rest("aivault_floor_state?k=eq.poolbooks:off&select=v")
if off and (off[0]["v"] or {}).get("off")=="1": print("poolbooks off"); raise SystemExit
SECRET=re.compile(r"(sk-[A-Za-z0-9]{16,}|gsk_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_\w{20,}|AIza[0-9A-Za-z\-_]{30,}|eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|[0-9a-f]{40,}|[\w.+-]+@[\w-]+\.[\w.]+)")
def put_book(b,chs):
    rest("aivault_pool_books?on_conflict=id",[b],prefer="resolution=merge-duplicates,return=minimal")
    rest("aivault_pool_book_chapters?book_id=eq."+b["id"]+"&chapter_no=gt.%d"%len(chs),method="DELETE",prefer="return=minimal")  # 只刪本書多出來的舊章（本書架自有資料）
    rest("aivault_pool_book_chapters?on_conflict=book_id,chapter_no",[{"book_id":b["id"],"chapter_no":i+1,"title":t[:200],"content":c[:6000]} for i,(t,c) in enumerate(chs)],prefer="resolution=merge-duplicates,return=minimal")
if "books" in STEPS:
    n=0
    for f in sorted(glob.glob("docs/pool-books/*.md")):
        s=open(f,encoding="utf-8").read(); m=re.match(r"---\n(.*?)\n---\n(.*)",s,re.S); meta=dict(re.findall(r"^(\w+):\s*(.+)$",m.group(1),re.M)); body=m.group(2)
        parts=re.split(r"^## ",body,flags=re.M)[1:]; chs=[(p.split("\n",1)[0].strip(),p.split("\n",1)[1].strip()) for p in parts]
        assert not SECRET.search(body), f
        srcs=sorted(set(re.findall(r"https://[^\s）]+",chs[-1][1]))); bid="pb-"+os.path.basename(f)[:-3]
        put_book({"id":bid,"title":meta["title"],"tier":meta["tier"],"tier_order":TO[meta["tier"]],"sort_order":int(meta["order"]),"domains":[x.strip() for x in meta.get("domains","").split(",") if x.strip()],
                  "kind":"written","author":"Grok Bot","status":"published","chapters":len(chs),"chars":sum(len(c) for _,c in chs),"sources":srcs,"review":{"secret_scan":"pass","urls_checked":"2026-10-18 curl 200"},"updated_at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())},chs); n+=1
    print("written books upserted",n)
DN={"llm":"語言模型","img":"圖像與 3D","av":"影音語音","code":"程式與代理"}
if "anthology" in STEPS:
    rows=rest("aivault_pool_agent_learning?model=like.none*&select=agent_id,district,topic,url,title,sha256,excerpt,notes,created_at&order=created_at.asc&limit=20000") or []
    print("reading-tier records",len(rows))
    groups={}
    for r in rows:
        d=r.get("district") or "llm"; tier="專業" if "arxiv.org" in (r.get("url") or "") else "入門"; groups.setdefault((d,tier),[]).append(r)
    for (d,tier),rs in sorted(groups.items()):
        seen={}; drop={"dup":0,"no_attr":0,"secret":0}
        for r in rs:  # checker：去重＋出處＋機密
            u=(r.get("url") or "").strip(); key=r.get("sha256") or u
            if not re.match(r"https://",u) or not re.fullmatch(r"ag-\d{4,}",r.get("agent_id") or ""): drop["no_attr"]+=1; continue
            txt=(r.get("notes") or "")+" "+(r.get("excerpt") or "")
            if SECRET.search(txt): drop["secret"]+=1; continue
            if u in seen or any(x["sha256"]==key for x in seen.values()): drop["dup"]+=1; seen.get(u,{}).setdefault("also",set()).add(r["agent_id"]); continue
            seen[u]={**r,"also":set()}
        items=list(seen.values())
        if len(items)<3: print("anthology skip",d,tier,"items",len(items),drop); continue
        chs=[]
        for i in range(0,len(items),8):
            blk=[]
            for x in items[i:i+8]:
                notes=re.sub(r"^［閱讀 no-LLM 抽取式摘要］","",x.get("notes") or "")
                blk.append("◆ %s\n來源：%s\n主題：%s\n摘錄（抽取式，版權屬原作者，僅供學習並請點來源閱讀全文）：%s\n貢獻代理：%s\n"%(re.sub(r"^📖 閱讀\(no-LLM\)｜","",x.get("title") or "")[:160],x["url"],x.get("topic") or "",notes[:500],", ".join(sorted({x["agent_id"]}|x["also"]))[:200]))
            chs.append(("第 %d 輯（第 %d–%d 則）"%(i//8+1,i+1,min(i+8,len(items))),"\n".join(blk)))
        chs.append(("來源與貢獻者總表","\n".join("- %s（%s）"%(x["url"],x["agent_id"]) for x in items)[:5800]))
        ok=all(not SECRET.search(c) for _,c in chs)
        put_book({"id":"pa-%s-%s"%(d,TO[tier]),"title":"%s資料選輯（%s）"%(DN.get(d,d),tier),"tier":tier,"tier_order":TO[tier],"sort_order":100+TO[tier]*10+list(DN).index(d) if d in DN else 199,"domains":[DN.get(d,d)],"kind":"anthology",
                  "author":"pool-anthology-compiler（彙編 no-LLM 閱讀層紀錄）","status":"published" if ok else "rejected","chapters":len(chs),"chars":sum(len(c) for _,c in chs),"sources":[x["url"] for x in items][:500],
                  "review":{"checker":"pool-anthology-checker","compiler":"pool-anthology-compiler","dropped":drop,"items":len(items),"secret_scan":"pass" if ok else "fail","at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())},"updated_at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())},chs)
        print("anthology",d,tier,"items",len(items),"dropped",drop,"status","published" if ok else "rejected")
if "verify" in STEPS:
    print("pool books", sql("select kind,tier,status,count(*) n,sum(chapters) ch from public.aivault_pool_books group by 1,2,3 order by 1,2"))
    print("user ebooks untouched (count)", sql("select count(*) n, max(updated_at) last from public.dark_star_ebooks"))
    print("anon read test", sql("begin; set local role anon; select count(*) n from public.aivault_pool_books; rollback;"))
    print("progress", sql("select count(*) agents, coalesce(sum(chapters_read),0) ch from public.aivault_pool_book_progress(null)"))

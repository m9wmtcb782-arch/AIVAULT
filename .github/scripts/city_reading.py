# rd1：閱讀（no-LLM）層。每輪替「所有閒著的原始 1000 位代理」從課程真的抓免費來源（arXiv 摘要、GitHub README），
# 用抽取式摘要＋關鍵字（不呼叫任何模型、0 token），寫進學習紀錄與共享記憶（URL＋節錄＋sha256，去重、限長），並標記為「閱讀中」讓教室顯示 📶。
# 不碰：深度學習（LLM，照舊受額度限制排隊）、正在學習鎖中的代理、睡眠中的分身（只選 ag-0001..ag-1000）。DB 超過 READ_DB_MB_MAX（預設 300MB）就不寫紀錄。
# 關閉：repo variable READING_OFF=1 或 aivault_floor_state k='reading:off' v={"off":"1"}。公開日誌只印數字。
import json, os, re, time, hashlib, urllib.request, urllib.parse, random, collections, html
REF="clcddygkaaqqtsbswgdf"; TOKEN=os.environ["TOKEN"]; GH=os.environ.get("GH_TOKEN","")
def mgmt(path):
    r=urllib.request.Request("https://api.supabase.com/v1/projects/%s/%s"%(REF,path),headers={"Authorization":"Bearer "+TOKEN,"User-Agent":"rd"});return json.load(urllib.request.urlopen(r))
SR=[k["api_key"] for k in mgmt("api-keys?reveal=true") if k.get("name")=="service_role"][0]; print("::add-mask::"+SR)
H={"Authorization":"Bearer "+SR,"apikey":SR,"Content-Type":"application/json"}
BASE="https://%s.supabase.co/rest/v1/"%REF
def rest(path,body=None,method=None,prefer="return=representation"):
    r=urllib.request.Request(BASE+path,data=None if body is None else json.dumps(body).encode(),headers={**H,"Prefer":prefer},method=method or ("POST" if body is not None else "GET"))
    t=urllib.request.urlopen(r,timeout=60).read(); return json.loads(t) if t else None
def fetch(u,accept="*/*",t=20):
    h={"User-Agent":"Mozilla/5.0 (compatible; AIVAULT-reader/1.0)","Accept":accept}
    if GH and "api.github.com" in u: h["Authorization"]="Bearer "+GH
    return urllib.request.urlopen(urllib.request.Request(u,headers=h),timeout=t).read().decode("utf-8","replace")
off=rest("aivault_floor_state?k=eq.reading:off&select=v")
if off and (off[0]["v"] or {}).get("off")=="1": print("reading off"); raise SystemExit
now=time.time(); iso=lambda s: time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime(s))
# ── 課程：直接從 learn10.ts 解析（同一份課程，不另建）
src=open("supabase/functions/dark-star-ebook-ingest/learn10.ts",encoding="utf-8").read()
CUR={}
for d in ["llm","img","av","code"]:
    m=re.search(r"^\s*%s: \[(.*)\],?\s*$"%d,src,re.M); CUR[d]=re.findall(r'\["([^"]+)", "([^"]+)", "([^"]+)"\]',m.group(1)) if m else []
vm=re.search(r"VOICE: \[string, string, string\]\[\] = \[(.*?)\n\];",src,re.S); VOICE=re.findall(r'\["([^"]+)", "([^"]+)", "([^"]+)"\]',vm.group(1)) if vm else []
def district(dom):
    d=str(dom or "")
    if re.search(r"coding|code|data|guard|security|agent|devops",d): return "code"
    if re.search(r"image|3d|design|art",d): return "img"
    if re.search(r"video|voice|music|audio|speech",d): return "av"
    return "llm"
# ── 誰閒著
agents=rest("aivault_pool_agents?select=id,domain&id=lte.ag-1000&order=id&limit=1000")
locks=rest("aivault_floor_state?k=like.learnlock:*&select=k,v&limit=3000")
busy={x["k"][10:] for x in locks if (x.get("v") or {}).get("until","")>iso(now)}
idle=[a for a in agents if re.fullmatch(r"ag-\d{4}",a["id"]) and a["id"] not in busy]
cc=rest("rpc/aivault_city_counts",{}) or {}; dbmb=float(cc.get("db_mb") or 0); CAP=float(os.environ.get("READ_DB_MB_MAX") or 300)
write_rows = dbmb < CAP
print("agents",len(agents),"busy(LLM lock)",len(busy),"idle",len(idle),"db_mb",dbmb,"write_rows",write_rows)
# ── 每個主題抓一次來源（共用），代理各自分到不同篇
STOP=set("the a an and or of to in for on with by is are be this that we our from as at it its can which using use based model models paper via into than these their also more such have has not new show results".split())
def sents(t): return [s.strip() for s in re.split(r"(?<=[.!?。！？])\s+",t) if 40<=len(s.strip())<=400]
def summarize(text,n=3):
    words=[w for w in re.findall(r"[A-Za-z][A-Za-z0-9\-]{2,}|[\u4e00-\u9fff]{2,4}",text.lower()) if w not in STOP]
    tf=collections.Counter(words); ss=sents(text)[:80]
    sc=sorted(range(len(ss)),key=lambda i:-sum(tf[w] for w in re.findall(r"[a-z][a-z0-9\-]{2,}",ss[i].lower()) if w not in STOP)/(1+len(ss[i])**.5))[:n]
    return " ".join(ss[i] for i in sorted(sc))[:450], [w for w,_ in tf.most_common(8)]
def md_text(raw):
    t=re.sub(r"```.*?```"," ",raw,flags=re.S); t=re.sub(r"<[^>]+>"," ",t); t=re.sub(r"!\[[^\]]*\]\([^)]*\)"," ",t); t=re.sub(r"\[([^\]]*)\]\([^)]*\)",r"\1",t)
    return re.sub(r"\s+"," ",re.sub(r"[#>*|`_=\-]{2,}"," ",t))
POOL={}
def sources(topic):
    if topic[0] in POOL: return POOL[topic[0]]
    out=[]
    try:
        x=fetch("https://export.arxiv.org/api/query?max_results=6&sortBy=relevance&search_query=all:"+urllib.parse.quote(topic[1]),"application/atom+xml")
        for m in re.finditer(r"<entry>.*?<id>([^<]+)</id>.*?<title>(.*?)</title>.*?<summary>(.*?)</summary>",x,re.S):
            out.append({"url":m.group(1).strip().replace("http://","https://"),"title":re.sub(r"\s+"," ",html.unescape(m.group(2))).strip(),"text":re.sub(r"\s+"," ",html.unescape(m.group(3))).strip(),"src":"arxiv"})
        time.sleep(3)
    except Exception as e: print("arxiv err",type(e).__name__)
    try:
        j=json.loads(fetch("https://api.github.com/search/repositories?per_page=6&sort=stars&q="+urllib.parse.quote(topic[2]),"application/vnd.github+json"))
        for it in j.get("items",[])[:6]:
            try: raw=fetch("https://api.github.com/repos/%s/readme"%it["full_name"],"application/vnd.github.raw")[:200000]
            except Exception: continue
            out.append({"url":it["html_url"],"title":it["full_name"]+"："+(it.get("description") or "")[:120],"text":md_text(raw),"src":"github"})
        time.sleep(2)
    except Exception as e: print("github err",type(e).__name__)
    for o in out:
        o["summary"],o["kw"]=summarize(o["text"]); o["sha"]=hashlib.sha256(o["text"].encode()).hexdigest(); o["bytes"]=len(o["text"].encode())
    out=[o for o in out if len(o["summary"])>60]; POOL[topic[0]]=out; return out
# 每位代理已讀過的 URL（避免重複讀同一篇）
seen=collections.defaultdict(set)
for i in range(0,len(idle),150):
    ids=",".join(a["id"] for a in idle[i:i+150])
    for r in rest("aivault_pool_agent_learning?select=agent_id,url&agent_id=in.(%s)&model=like.none*&limit=20000"%ids) or []: seen[r["agent_id"]].add(r["url"])
recent=set(r["agent_id"] for r in (rest("aivault_pool_agent_learning?select=agent_id&model=like.none*&created_at=gte.%s&limit=5000"%iso(now-6*3600)) or []))
rows=[]; locks_out=[]; memw=0; memdup=0; MEMDONE=set()
try:
    import sys; sys.path.insert(0,os.path.dirname(__file__)); from pool_read import PoolRead; POOLREAD=PoolRead(rest,summarize)
except Exception as e: print("poolread off",type(e).__name__); POOLREAD=None
for a in idle:
    d=district(a["domain"]); pool=(CUR.get(d) or [])+[(("即時語音："+v[0]),v[1],v[2]) for v in VOICE[:4]]
    random.seed(a["id"]+time.strftime("%Y%m%d%H")); topic=random.choice(pool)
    pb=POOLREAD.next(a["id"],seen[a["id"]]) if POOLREAD else None  # pb4：先讀協作池書架必讀章節
    if pb: o,topic=pb
    else:
      cands=[o for o in sources(topic) if o["url"] not in seen[a["id"]]] or sources(topic)
      if not cands: continue
      o=cands[int(hashlib.md5(a["id"].encode()).hexdigest(),16)%len(cands)]
    locks_out.append({"k":"readlock:"+a["id"],"v":{"until":iso(now+35*60),"mode":"reading","d":d,"topic":topic[0][:24],"url":o["url"],"at":iso(now)}})
    if write_rows and a["id"] not in recent:  # 學習紀錄：每位每 6 小時最多 1 筆（控制 DB 大小）
        rows.append({"agent_id":a["id"],"district":d,"topic":topic[0],"query":topic[1],"url":o["url"],"title":("📖 閱讀(no-LLM)｜"+o["title"])[:200],"http_status":200,"bytes":o["bytes"],"sha256":o["sha"],
                     "excerpt":o["text"][:300],"notes":("［閱讀 no-LLM 抽取式摘要］"+o["summary"]+"｜關鍵字："+", ".join(o["kw"]))[:600],"model":"none(extractive)","usage":{"total":0,"mode":"reading"},"fetched_at":iso(now)})
    if write_rows and o.get("src")!="poolbook" and o["sha"] not in MEMDONE:
        MEMDONE.add(o["sha"])
        try:
            r=rest("rpc/aivault_mem_write",{"p_agent":a["id"],"p_kind":"note","p_layer":"public","p_title":("閱讀摘要："+o["title"])[:160],"p_body":("來源 "+o["url"]+"\nsha256 "+o["sha"][:16]+"\n"+o["summary"]+"\n關鍵字："+", ".join(o["kw"]))[:900],"p_district":d})
            if (r or {}).get("dup"): memdup+=1
            elif (r or {}).get("ok"): memw+=1
        except Exception as e: pass
for i in range(0,len(locks_out),500): rest("aivault_floor_state?on_conflict=k",locks_out[i:i+500],prefer="resolution=merge-duplicates,return=minimal")
for i in range(0,len(rows),200): rest("aivault_pool_agent_learning",rows[i:i+200],prefer="return=minimal")
print("READ round: reading_now",len(locks_out),"records",len(rows),"topics",len(POOL),"sources",sum(len(v) for v in POOL.values()),"mem_new",memw,"mem_dup",memdup,"tokens 0")

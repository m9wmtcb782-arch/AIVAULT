# 因序小說後端實測：建臨時已核准帳號 → 呼叫 ?feature=yinxu → 刪除帳號。不輸出任何金鑰。
import json, os, sys, time, uuid, urllib.request, urllib.error
REF="clcddygkaaqqtsbswgdf"; BASE="https://%s.supabase.co"%REF; TOKEN=os.environ["TOKEN"]; STEP=os.environ.get("STEP","list"); ARG=os.environ.get("ARG","")
def http(url,data=None,headers=None,method=None,timeout=150):
    r=urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,headers=dict({"Content-Type":"application/json","User-Agent":"yinxu-e2e"},**(headers or {})),method=method)
    try:
        with urllib.request.urlopen(r,timeout=timeout) as f: b=f.read(); return f.status,(json.loads(b) if b else None)
    except urllib.error.HTTPError as e:
        b=e.read()
        try: return e.code,json.loads(b)
        except Exception: return e.code,b[:300].decode("utf-8","replace")
_,keys=http("https://api.supabase.com/v1/projects/%s/api-keys?reveal=true"%REF,headers={"Authorization":"Bearer "+TOKEN})
SR=next(k["api_key"] for k in keys if k.get("name")=="service_role"); ANON=next(k["api_key"] for k in keys if k.get("name")=="anon")
print("::add-mask::"+SR); print("::add-mask::"+ANON)
H={"apikey":SR,"Authorization":"Bearer "+SR}
if STEP=="ebooks":
    s,b=http(BASE+"/rest/v1/dark_star_ebooks?select=id,title,author,total_pages,total_characters,metadata->>category&order=total_characters.asc&limit=200",headers=H)
    for x in b: print(x["id"],x["total_pages"],x["total_characters"],x.get("category"),x["title"][:40])
    sys.exit(0)
email="yinxu-e2e-%s@example.com"%uuid.uuid4().hex[:8]; pw=uuid.uuid4().hex+"Aa1!"
s,u=http(BASE+"/auth/v1/admin/users",{"email":email,"password":pw,"email_confirm":True,"app_metadata":{"role":"admin","approved":True}},H,"POST"); uid=u["id"]
http(BASE+"/auth/v1/admin/users/"+uid,{"ban_duration":"none","app_metadata":{"role":"admin","approved":True}},H,"PUT")
try:
    s,t=http(BASE+"/auth/v1/token?grant_type=password",{"email":email,"password":pw},{"apikey":ANON}); JWT=t["access_token"]; print("::add-mask::"+JWT)
    def y(body,timeout=150):
        t0=time.time(); s,b=http(BASE+"/functions/v1/dark-star-ebook-ingest?feature=yinxu",body,{"apikey":ANON,"Authorization":"Bearer "+JWT},"POST",timeout); return s,b,round(time.time()-t0,1)
    if STEP=="diag":
        s,b,dt=y({"action":"diag"}); print("DIAG",s,b)
    if STEP in("direct","all"):
        book=json.load(open("yinxu-demo-book.json"))
        for ans in ["我其實是來找我爸留下的東西，他以前在這裡當過燈守。","嗯"]:
            s,b,dt=y({"action":"direct","book":book,"state":{"decisions":[],"recent":"林伯：你就是阿遠？明天的船你就回去吧。\n小雨：爺爺騙人！"},"asker":"linbo","question":"阿遠，你老實說，你這次上島，到底是想來做什麼？","answer":ans,"by":"reader"})
            print("DIRECT",s,dt,"s",json.dumps(b,ensure_ascii=False)[:1500])
    if STEP in("tts","all"):
        for v,st,tx in [("Algenib","An old man in his seventies, slow, gravelly.","你就是阿遠？長這麼大了。"),("Leda","A nine-year-old child, bright, quick.","爺爺騙人！島上有會發光的海。")]:
            s,b,dt=y({"action":"tts","text":tx,"voice":v,"style":st}); print("TTS",v,s,dt,"s",("url ok" if isinstance(b,dict) and b.get("url") else b))
            if isinstance(b,dict) and b.get("url"):
                st2,_=(lambda r:(r.status,None))(urllib.request.urlopen(b["url"])); print(" fetch audio",st2)
    if STEP=="compile":
        body={"action":"compile_start","chunk_pages":int(os.environ.get("CHUNK","40"))}
        if ARG.endswith(".txt"): body.update(text=open(ARG).read(),title=os.path.basename(ARG)[:-4])
        else: body["ebook_id"]=ARG
        s,b,dt=y(body); print("START",s,json.dumps(b,ensure_ascii=False)[:400]); jid=b["job"]["job_id"]
        for i in range(int(os.environ.get("MAXSTEPS","30"))):
            s,b,dt=y({"action":"compile_step","job_id":jid}); j=b.get("job",{}) if isinstance(b,dict) else {}
            print("STEP",i,s,dt,"s",j.get("stage"),j.get("next_page"),"/",j.get("total_pages"),"chars",j.get("characters_found"),"book",j.get("book_id"),"err",j.get("error"),"|",(j.get("log") or [""])[-1])
            if j.get("stage")=="done": break
            if j.get("retry_after"): print("quota -> stop"); break
        s,b,dt=y({"action":"list"}); print("LIST",s,json.dumps(b,ensure_ascii=False)[:600])
        if j.get("book_id"):
            s,b,dt=y({"action":"get","book_id":j["book_id"]}); bk=b.get("book",{})
            print("BOOK",bk.get("title"),"| opening:",bk.get("opening"),"| ending:",(bk.get("original_ending") or "")[:120])
            for c in bk.get("characters",[]): print("  CHAR",c.get("id"),c.get("name"),c.get("voice_type"),c.get("tts_voice"))
            for o in bk.get("outline",[])[:8]: print("  ACT",o.get("act"),o.get("title"),o.get("mood"))
            for n in bk.get("nodes",[])[:20]: print("  NODE",n.get("type"),n.get("speaker"),n.get("text","")[:70])
            print("  audio urls",sum(1 for v in (bk.get("audio_urls") or {}).values() if v))
    if STEP=="audio":
        for i in range(int(os.environ.get("MAXSTEPS","10"))):
            s,b,dt=y({"action":"compile_step","job_id":ARG}); j=b.get("job",{}); print("AUDIO",i,s,dt,j.get("stage"),j.get("audio_pos"),"/",j.get("audio_total"),"|",j.get("log",[""])[-1])
            if j.get("stage")=="done" or j.get("retry_after"): break
finally:
    http(BASE+"/auth/v1/admin/users/"+uid,None,H,"DELETE"); print("temp user deleted")

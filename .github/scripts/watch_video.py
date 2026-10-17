# wt1：看影片測試。只用授權允許下載的影片（FOSDEM，CC BY 2.0）；暫存檔在 runner 上用完即刪，不上傳、不轉發影片。
import json, os, subprocess, base64, glob, tempfile, urllib.request, time
REF="clcddygkaaqqtsbswgdf"; BASE="https://%s.supabase.co"%REF; TOKEN=os.environ["TOKEN"]
def http(url,data=None,headers=None,method=None,timeout=300):
    r=urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,headers=dict({"Content-Type":"application/json","User-Agent":"watch"},**(headers or {})),method=method)
    try:
        with urllib.request.urlopen(r,timeout=timeout) as f: b=f.read(); return f.status,(json.loads(b) if b else None)
    except urllib.error.HTTPError as e: return e.code,e.read()[:400].decode("utf-8","replace")
_,keys=http("https://api.supabase.com/v1/projects/%s/api-keys?reveal=true"%REF,headers={"Authorization":"Bearer "+TOKEN})
SR=next(k["api_key"] for k in keys if k.get("name")=="service_role"); print("::add-mask::"+SR)
def y(body): return http(BASE+"/functions/v1/dark-star-ebook-ingest?feature=degree",body,{"apikey":SR,"Authorization":"Bearer "+SR},"POST")
s,b=y({"action":"watch_probe"}); print("PROBE",s,b)
s,c=y({"action":"watch_cap"}); print("CAP",s,c)
if not (isinstance(c,dict) and c.get("allowed")): raise SystemExit("daily cap reached or off")
L=json.load(open(".github/scripts/watch_list.json")); idx=int(os.environ.get("IDX","-1"))
v=L[idx] if idx>=0 else L[(int(time.time()//86400)) % len(L)]
MIN=float(os.environ.get("MINUTES","10")); EVERY=int(os.environ.get("EVERY","75"))
with tempfile.TemporaryDirectory() as d:
    src=os.path.join(d,"v.webm"); urllib.request.urlretrieve(v["url"],src); print("downloaded MB",round(os.path.getsize(src)/1e6,1))
    au=os.path.join(d,"a.mp3"); subprocess.check_call(["ffmpeg","-loglevel","error","-y","-i",src,"-t",str(int(MIN*60)),"-vn","-ac","1","-ar","16000","-b:a","24k",au])
    subprocess.check_call(["ffmpeg","-loglevel","error","-y","-i",src,"-t",str(int(MIN*60)),"-vf","fps=1/%d,scale=768:-2"%EVERY,"-q:v","5",os.path.join(d,"f%03d.jpg")])
    frames=sorted(glob.glob(os.path.join(d,"f*.jpg"))); print("audio MB",round(os.path.getsize(au)/1e6,2),"frames",len(frames))
    s,a=y({"action":"watch_asr","audio_b64":base64.b64encode(open(au,"rb").read()).decode(),"name":"a.mp3"}); print("ASR",s,(a.get("language"),a.get("duration"),len(a.get("text","")),a.get("text","")[:200]) if isinstance(a,dict) else a)
    if s!=200: raise SystemExit("asr failed")
    fr=[]; vt=0
    for i,f in enumerate(frames):
        t="%02d:%02d"%((i*EVERY+EVERY//2)//60,(i*EVERY+EVERY//2)%60) if False else "%02d:%02d"%((i*EVERY)//60,(i*EVERY)%60)
        s,r=y({"action":"watch_frame","image_b64":base64.b64encode(open(f,"rb").read()).decode(),"t":t})
        if s==200: fr.append({"t":t,"desc":r.get("text","")}); vt+=((r.get("usage") or {}).get("total_tokens") or 0); print("FRAME",t,r.get("text","")[:140].replace("\n"," "))
        else:
            print("FRAME_ERR",t,s,str(r)[:200])
            if "does not exist" in str(r): print("vision model unavailable; skip remaining frames"); break
        time.sleep(2)
    s,n=y({"action":"watch_note","url":v["url"],"title":v["title"],"license":v["license"],"transcript":a.get("text",""),"language":a.get("language"),"asr_seconds":a.get("duration"),"frames":fr,"frame_count":len(frames),"vision_tokens":vt})
    print("NOTE",s,json.dumps(n,ensure_ascii=False)[:900]); print("VISION_TOKENS",vt)
print("temp files removed")

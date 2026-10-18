# vc1：共享影片學習中心執行器（GitHub Actions CPU，免費）。
# ingest：下載授權影片 → ffmpeg 解碼一次（固定間隔截圖＋場景切換關鍵畫面＋音訊）→ Florence-2-base 描述＋OCR（CPU，量測每張秒數）
#         → 音訊送 Groq Whisper（既有 watch_asr；失敗不影響其他）→ 寫入 aivault_video_assets / segments / access。原始影片用完即刪。
# accept：讀共享快取，用本地小模型 Qwen2.5-1.5B-Instruct（CPU，Apache-2.0）回答驗收題；比較「只有逐字稿」與「加上看圖」，自動判分。
# 不呼叫任何付費 API。關閉：repo var VIDEO_CENTER_OFF=1。
import json, os, sys, time, glob, subprocess, tempfile, hashlib, base64, re, urllib.request, urllib.parse
REF="clcddygkaaqqtsbswgdf"; BASE="https://%s.supabase.co"%REF; TOKEN=os.environ["TOKEN"]; MODE=os.environ.get("MODE","ingest")
def http(url,data=None,headers=None,method=None,timeout=300,raw=False):
    body=None if data is None else (data if raw else json.dumps(data).encode())
    r=urllib.request.Request(url,data=body,headers=dict({"Content-Type":"application/json","User-Agent":"aivault-video-center"},**(headers or {})),method=method)
    try:
        with urllib.request.urlopen(r,timeout=timeout) as f: b=f.read(); return f.status,(json.loads(b) if b else None)
    except urllib.error.HTTPError as e: return e.code,e.read()[:600].decode("utf-8","replace")
MG={"Authorization":"Bearer "+TOKEN}
def sql(q): return http("https://api.supabase.com/v1/projects/%s/database/query"%REF,{"query":q},MG,"POST")
if MODE=="migrate":
    for f in ["20261018100000_aivault_video_center.sql","20261018101000_aivault_video_spot.sql"]:
        s,r=sql(open("supabase/migrations/"+f).read()); print("MIGRATE",f,s,str(r)[:300])
    print(sql("select table_name from information_schema.tables where table_schema='public' and table_name like 'aivault_video_%' order by 1"))
    print(sql("select relname,relrowsecurity from pg_class where relname like 'aivault_video_%' and relkind='r'")); sys.exit(0 if s in (200,201) else 1)
_,keys=http("https://api.supabase.com/v1/projects/%s/api-keys?reveal=true"%REF,headers=MG)
SR=next(k["api_key"] for k in keys if k.get("name")=="service_role"); print("::add-mask::"+SR)
H={"apikey":SR,"Authorization":"Bearer "+SR}
def rest(path,data=None,method="GET",prefer="return=representation"):
    return http(BASE+"/rest/v1/"+path,data,dict(H,Prefer=prefer),method)
def fn(body): return http(BASE+"/functions/v1/dark-star-ebook-ingest?feature=degree",body,H,"POST")
if MODE=="probe":
    s,b=fn({"action":"watch_probe"}); print("PROBE",s,b); sys.exit(0)
L=json.load(open(".github/scripts/video_center_list.json")); KEY=os.environ.get("KEY","bbb"); v=next(x for x in L if x["key"]==KEY)
if MODE=="ingest":
    import torch
    from unittest.mock import patch
    from PIL import Image
    from transformers import AutoProcessor, AutoModelForCausalLM
    from transformers.dynamic_module_utils import get_imports
    torch.set_num_threads(os.cpu_count() or 4)
    def fix(f):
        im=get_imports(f); return [i for i in im if i!="flash_attn"] if str(f).endswith("modeling_florence2.py") else im
    MID="microsoft/Florence-2-base"; t0=time.time()
    with patch("transformers.dynamic_module_utils.get_imports",fix):
        model=AutoModelForCausalLM.from_pretrained(MID,trust_remote_code=True,attn_implementation="eager",torch_dtype=torch.float32).eval()
    proc=AutoProcessor.from_pretrained(MID,trust_remote_code=True); print("MODEL_LOAD_S",round(time.time()-t0,1))
    def flo(img,task):
        inp=proc(text=task,images=img,return_tensors="pt")
        with torch.no_grad(): ids=model.generate(input_ids=inp["input_ids"],pixel_values=inp["pixel_values"],max_new_tokens=128,num_beams=1,do_sample=False)
        txt=proc.batch_decode(ids,skip_special_tokens=False)[0]; return str(proc.post_process_generation(txt,task=task,image_size=img.size).get(task,"")).strip()
    START=float(v.get("start",0)); DUR=float(os.environ.get("DUR") or v.get("dur",120)); EVERY=float(os.environ.get("EVERY") or 5)
    with tempfile.TemporaryDirectory() as d:
        src=os.path.join(d,"v"); urllib.request.urlretrieve(v["url"],src); sz=os.path.getsize(src)
        h=hashlib.sha256(open(src,"rb").read()).hexdigest(); print("DOWNLOADED_MB",round(sz/1e6,1),"sha256",h[:16])
        dur=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",src]).decode().strip() or 0)
        clip=os.path.join(d,"c.mp4"); subprocess.check_call(["ffmpeg","-loglevel","error","-y","-ss",str(START),"-t",str(DUR),"-i",src,"-c:v","libx264","-preset","veryfast","-an",clip])
        au=os.path.join(d,"a.mp3"); subprocess.check_call(["ffmpeg","-loglevel","error","-y","-ss",str(START),"-t",str(DUR),"-i",src,"-vn","-ac","1","-ar","16000","-b:a","24k",au])
        os.remove(src)
        out=subprocess.run(["ffmpeg","-i",clip,"-filter:v","select='gt(scene,0.3)',showinfo","-f","null","-"],capture_output=True,text=True).stderr
        scenes=[round(float(x),2) for x in re.findall(r"pts_time:([0-9.]+)",out)]; print("SCENE_CUTS",scenes)
        times=sorted(set([round(i*EVERY,2) for i in range(int(DUR//EVERY)+1) if i*EVERY<DUR]+scenes))
        segs=[]; ms=[]
        for t in times:
            fp=os.path.join(d,"f.jpg"); subprocess.check_call(["ffmpeg","-loglevel","error","-y","-ss",str(t+0.05),"-i",clip,"-frames:v","1","-vf","scale=768:-2",fp])
            img=Image.open(fp).convert("RGB"); a=time.time(); cap=flo(img,"<MORE_DETAILED_CAPTION>"); ocr=flo(img,"<OCR>"); dt=int((time.time()-a)*1000); ms.append(dt)
            kind="scene" if t in scenes else "frame"; segs.append({"t_s":round(START+t,2),"kind":kind,"caption":cap[:800],"ocr":ocr[:300],"model":MID,"infer_ms":dt})
            print("FRAME t=%6.2f %s %5dms | %s | OCR: %s"%(START+t,kind,dt,cap[:110],ocr[:40]))
        per=round(sum(ms)/len(ms)/1000,2); print("PER_FRAME_S(caption+OCR)",per,"frames",len(ms),"total_s",round(sum(ms)/1000,1))
        tr=""; s,a=fn({"action":"watch_asr","audio_b64":base64.b64encode(open(au,"rb").read()).decode(),"name":"a.mp3"})
        if s==200 and isinstance(a,dict): tr=a.get("text",""); print("ASR ok chars",len(tr),repr(tr[:200]))
        else: print("ASR_FAIL",s,str(a)[:200])
    row={"url":v["url"],"title":v["title"],"license":v["license"],"author":v.get("author"),"attribution":v.get("attribution"),"source_page":v.get("source_page"),"sha256":h,"duration_s":dur,
         "clip_start_s":START,"clip_dur_s":DUR,"frame_every_s":EVERY,"vision_model":MID+" <MORE_DETAILED_CAPTION>","ocr_model":MID+" <OCR>","asr_model":"groq whisper-large-v3-turbo" if tr else None,"per_frame_s":per,"status":"ready"}
    s,r=rest("aivault_video_assets?on_conflict=url",row,"POST","resolution=merge-duplicates,return=representation"); print("ASSET",s,str(r)[:200])
    aid=r[0]["id"]; rest("aivault_video_segments?asset_id=eq.%d"%aid,method="DELETE",prefer="return=minimal")
    for x in segs: x["asset_id"]=aid
    if tr: segs.append({"asset_id":aid,"t_s":START,"kind":"asr","transcript":tr[:20000],"model":"groq whisper-large-v3-turbo"})
    s,r=rest("aivault_video_segments",segs,"POST","return=minimal"); print("SEGMENTS",s,len(segs))
    s,r=rest("aivault_video_access?on_conflict=asset_id,district",[{"asset_id":aid,"district":dd} for dd in v.get("districts",[])],"POST","resolution=merge-duplicates,return=minimal"); print("ACCESS",s)
if MODE=="accept":
    import torch
    from transformers import AutoTokenizer, AutoModelForCausalLM
    torch.set_num_threads(os.cpu_count() or 4)
    Q=json.load(open(".github/scripts/video_accept_%s.json"%KEY))
    s,a=rest("aivault_video_assets?url=eq.%s&select=*"%urllib.parse.quote(v["url"],safe="")); A=a[0]; aid=A["id"]
    s,S=rest("aivault_video_segments?asset_id=eq.%d&select=t_s,kind,caption,ocr,transcript&order=t_s"%aid)
    tr=" ".join(x["transcript"] or "" for x in S if x["kind"]=="asr").strip()
    vis="\n".join("[%ss] %s%s"%(int(float(x["t_s"])),x["caption"] or "",(" | 畫面文字: "+x["ocr"]) if (x["ocr"] or "").strip() else "") for x in S if x["kind"]!="asr")
    ctx={"transcript_only":"【逐字稿（Whisper，沒有時間碼）】\n"+(tr or "（音訊沒有可辨識的語音）"),"vision":"【逐字稿】\n"+(tr or "（無語音）")+"\n\n【畫面描述（每行開頭是秒數）】\n"+vis}
    MID="Qwen/Qwen2.5-1.5B-Instruct"; tok=AutoTokenizer.from_pretrained(MID); lm=AutoModelForCausalLM.from_pretrained(MID,torch_dtype=torch.float32).eval()
    res={}
    for mode,c in ctx.items():
        ok=tok_ok=content_ok=0; rows=[]
        for q in Q["questions"]:
            msgs=[{"role":"system","content":"You answer questions about a video using ONLY the provided material. If the material doesn't contain the answer, say 不知道. Answer in one line exactly in the format: 答案：<short answer in English or Chinese>｜秒數：<integer seconds or ?>"},
                  {"role":"user","content":c[:9000]+"\n\n問題："+q["q"]}]
            ids=tok.apply_chat_template(msgs,add_generation_prompt=True,return_tensors="pt")
            with torch.no_grad(): o=lm.generate(ids,max_new_tokens=48,do_sample=False)
            ans=tok.decode(o[0][ids.shape[1]:],skip_special_tokens=True).strip().replace("\n"," ")
            m=re.search(r"秒數[:：]\s*(\d+)",ans); ts=int(m.group(1)) if m else None
            a_part=ans.split("秒數")[0].lower(); cok=any(k.lower() in a_part for k in q["kw"]) and "不知道" not in a_part
            tok_t= ts is not None and abs(ts-q["t"])<=3; content_ok+=cok; tok_ok+=tok_t; ok+=(cok and tok_t)
            rows.append({"q":q["q"],"expected_t":q["t"],"answer":ans,"t":ts,"content_ok":cok,"time_ok":tok_t}); print(mode,"|",q["t"],"|",ans,"|",cok,tok_t)
        res[mode]={"both_correct":ok,"content_correct":content_ok,"timecode_within_3s":tok_ok,"n":len(Q["questions"]),"rows":rows}
        print("SCORE",mode,"both",ok,"content",content_ok,"time",tok_ok,"/",len(Q["questions"]))
        rest("aivault_video_learning",{"asset_id":aid,"agent_id":None,"kind":"qa_eval","payload":{"mode":mode,**res[mode],"questions_by":Q["note"]},"score":ok,"model":MID},"POST","return=minimal")
    if os.environ.get("GEMINI_SPOT")=="1":
        with tempfile.TemporaryDirectory() as d:
            src=os.path.join(d,"v"); urllib.request.urlretrieve(v["url"],src); clip=os.path.join(d,"c.mp4")
            subprocess.check_call(["ffmpeg","-loglevel","error","-y","-ss",str(A["clip_start_s"]),"-t",str(A["clip_dur_s"]),"-i",src,"-vf","scale=320:-2,fps=8","-c:v","libx264","-crf","34","-an",clip])
            vb=base64.b64encode(open(clip,"rb").read()).decode(); print("GEMINI_CLIP_MB",round(len(vb)*3/4/1e6,2))
        qs="\n".join("%d. %s"%(i+1,q["q"]) for i,q in enumerate(Q["questions"]))
        pr="Watch this video clip (starts at 0 seconds). Answer each question. Output ONLY a JSON array of 10 objects: [{\"n\":1,\"answer\":\"short answer\",\"t\":integer seconds}]. Questions:\n"+qs
        s,g=http(BASE+"/functions/v1/aivault-video-spot",{"license":v["license"],"video_b64":vb,"mime":"video/mp4","prompt":pr},H,"POST",timeout=200)
        print("GEMINI",s,str(g)[:300])
        if s==200 and g.get("ok"):
            m=re.search(r"\[.*\]",g["text"],re.S); arr=json.loads(m.group(0)) if m else []
            ok=co=to=0; rows=[]
            for i,q in enumerate(Q["questions"]):
                x=next((y for y in arr if int(y.get("n",0))==i+1),{}); ans=str(x.get("answer","")); ts=x.get("t")
                try: ts=int(ts)
                except Exception: ts=None
                c=any(k.lower() in ans.lower() for k in q["kw"]); tt=ts is not None and abs(ts-q["t"])<=3; co+=c; to+=tt; ok+=(c and tt)
                rows.append({"q":q["q"],"expected_t":q["t"],"answer":ans,"t":ts,"content_ok":c,"time_ok":tt}); print("gemini |",q["t"],"|",ans,ts,"|",c,tt)
            res["gemini"]={"both_correct":ok,"content_correct":co,"timecode_within_3s":to,"n":len(Q["questions"]),"rows":rows,"model":g.get("model"),"usage":g.get("usage"),"used_today":g.get("used_today")}
            print("SCORE gemini both",ok,"content",co,"time",to,"/",len(Q["questions"]))
            rest("aivault_video_learning",{"asset_id":aid,"kind":"qa_eval","payload":{"mode":"gemini_video",**res["gemini"],"questions_by":Q["note"]},"score":ok,"model":g.get("model")},"POST","return=minimal")
    json.dump(res,open("accept_result.json","w"),ensure_ascii=False,indent=1)

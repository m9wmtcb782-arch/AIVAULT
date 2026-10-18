# vc5: try to clear 7/10 on the same BBB questions, free CPU only (no Gemini, no paid API).
# Variants: A = cached Florence captions (no OCR) + Qwen2.5-3B; B = SmolVLM-500M captions on dense frames
# (every 2 s + 0.4 s after each lab_video scene cut) + Qwen2.5-3B. Off switch: repo var VIDEO_V2_OFF=1.
import json, os, sys, time, subprocess, tempfile, re, urllib.request, urllib.parse
sys.path.insert(0, "lab_video"); from scene_detector import detect
REF="clcddygkaaqqtsbswgdf"; BASE="https://%s.supabase.co"%REF; TOKEN=os.environ["TOKEN"]; VAR=os.environ.get("VARIANTS","A,B").split(",")
def http(url,data=None,headers=None,method=None):
    r=urllib.request.Request(url,data=None if data is None else json.dumps(data).encode(),headers=dict({"Content-Type":"application/json","User-Agent":"aivault-video-center"},**(headers or {})),method=method)
    try:
        with urllib.request.urlopen(r,timeout=300) as f: b=f.read(); return f.status,(json.loads(b) if b else None)
    except urllib.error.HTTPError as e: return e.code,e.read()[:400].decode("utf-8","replace")
_,keys=http("https://api.supabase.com/v1/projects/%s/api-keys?reveal=true"%REF,headers={"Authorization":"Bearer "+TOKEN})
SR=next(k["api_key"] for k in keys if k.get("name")=="service_role"); print("::add-mask::"+SR); H={"apikey":SR,"Authorization":"Bearer "+SR}
def rest(p,d=None,m="GET",pf="return=representation"): return http(BASE+"/rest/v1/"+p,d,dict(H,Prefer=pf),m)
v=json.load(open(".github/scripts/video_center_list.json"))[0]; Q=json.load(open(".github/scripts/video_accept_bbb.json"))
_,a=rest("aivault_video_assets?url=eq.%s&select=id"%urllib.parse.quote(v["url"],safe="")); aid=a[0]["id"]
import torch; torch.set_num_threads(os.cpu_count() or 4)
from transformers import AutoTokenizer, AutoModelForCausalLM, AutoProcessor, AutoModelForVision2Seq
from PIL import Image
if os.environ.get("RECORD_VERIFY")=="1":
    print("VERIFY_ROW",rest("aivault_video_learning",{"asset_id":aid,"agent_id":"grok-bot-8bb7edd6","kind":"lab","payload":{"work":"lab_video/scene_detector.py","commit":"88c586b","verified_by":"Grok Bot (teammate 8bb7edd6), independent re-run on own BBB 480p download","precision":0.857,"recall":1.0,"result":"PASS"},"score":1,"model":"none (numpy + ffmpeg scdet ground truth)"},"POST","return=minimal")[0])
ctx={}
if "A" in VAR:
    _,S=rest("aivault_video_segments?asset_id=eq.%d&kind=neq.asr&select=t_s,caption&order=t_s"%aid)
    ctx["A_florence_noocr_qwen3b"]="\n".join("[%ds] %s"%(int(float(x["t_s"])),x["caption"]) for x in S)
if "B" in VAR and os.environ.get("B_CACHE","1")=="1":
    # vc5b: reuse SmolVLM captions already cached by run 39087652158 (aivault_video_learning kind=note)
    _,N=rest("aivault_video_learning?asset_id=eq.%d&kind=eq.note&model=eq.HuggingFaceTB/SmolVLM-500M-Instruct&select=payload&order=id.desc&limit=1"%aid)
    if N: ctx["B_smolvlm_dense_qwen3b"]="\n".join(N[0]["payload"]["captions"]); print("B_CACHE_HIT",len(N[0]["payload"]["captions"]),"per_frame_s",N[0]["payload"]["per_frame_s"])
if "B" in VAR and "B_smolvlm_dense_qwen3b" not in ctx:
    vm="HuggingFaceTB/SmolVLM-500M-Instruct"; t0=time.time(); vp=AutoProcessor.from_pretrained(vm); vmod=AutoModelForVision2Seq.from_pretrained(vm,torch_dtype=torch.float32).eval(); print("SMOLVLM_LOAD_S",round(time.time()-t0,1))
    with tempfile.TemporaryDirectory() as d:
        src=os.path.join(d,"v"); req=urllib.request.Request(v["url"],headers={"User-Agent":"AIVAULT-video-center/1.0 (https://github.com/m9wmtcb782-arch/AIVAULT; m9wmtcb782@privaterelay.appleid.com)"})
        open(src,"wb").write(urllib.request.urlopen(req,timeout=600).read())
        clip=os.path.join(d,"c.mp4"); subprocess.check_call(["ffmpeg","-loglevel","error","-y","-ss","0","-t","120","-i",src,"-an","-c:v","libx264","-preset","veryfast",clip]); os.remove(src)
        cuts=detect(clip,0,120); print("CUTS",cuts)
        ts=sorted(set([float(t) for t in range(0,120,2)]+[round(c+0.4,1) for c in cuts if c+0.4<120]))
        lines=[]; ms=[]
        for t in ts:
            fp=os.path.join(d,"f.jpg"); subprocess.check_call(["ffmpeg","-loglevel","error","-y","-ss",str(t),"-i",clip,"-frames:v","1","-vf","scale=512:-2",fp])
            msgs=[{"role":"user","content":[{"type":"image"},{"type":"text","text":"Describe this cartoon frame in one or two sentences: which animals (name the species precisely), where they are, what they hold, main colors, and any written text."}]}]
            inp=vp(text=vp.apply_chat_template(msgs,add_generation_prompt=True),images=[Image.open(fp).convert("RGB")],return_tensors="pt")
            s0=time.time()
            with torch.no_grad(): o=vmod.generate(**inp,max_new_tokens=70,do_sample=False)
            dt=time.time()-s0; ms.append(dt); cap=vp.batch_decode(o[:,inp["input_ids"].shape[1]:],skip_special_tokens=True)[0].strip().replace("\n"," ")
            lines.append("[%ds] %s"%(int(t),cap)); print("SMOL t=%5.1f %5.1fs | %s"%(t,dt,cap[:140]))
        print("SMOLVLM_PER_FRAME_S",round(sum(ms)/len(ms),2),"frames",len(ms),"total_s",round(sum(ms),1))
    ctx["B_smolvlm_dense_qwen3b"]="\n".join(lines); del vmod
    rest("aivault_video_learning",{"asset_id":aid,"kind":"note","payload":{"captions":lines,"per_frame_s":round(sum(ms)/len(ms),2)},"model":vm},"POST","return=minimal")
lm_id="Qwen/Qwen2.5-3B-Instruct"; t0=time.time(); tok=AutoTokenizer.from_pretrained(lm_id); lm=AutoModelForCausalLM.from_pretrained(lm_id,torch_dtype=getattr(torch,os.environ.get("QWEN_DTYPE","float32"))).eval(); print("QWEN3B_LOAD_S",round(time.time()-t0,1))
SYS=("You answer questions about a 120-second cartoon using ONLY the timestamped frame descriptions. Each line starts with [seconds]. "
     "For 'when does X first appear' give the EARLIEST timestamp whose description matches X. Descriptions may misname animals; pick the most plausible match. "
     "Never answer 不知道 if any line is plausibly relevant. Reply in one line exactly: 答案：<short answer>｜秒數：<integer>")
for name,c in ctx.items():
    ok=co=to=0; rows=[]; t1=time.time()
    for q in Q["questions"]:
        ids=tok.apply_chat_template([{"role":"system","content":SYS},{"role":"user","content":c[:int(os.environ.get("CTX_CHARS","14000"))]+"\n\n問題："+q["q"]}],add_generation_prompt=True,return_tensors="pt")
        with torch.no_grad(): o=lm.generate(ids,max_new_tokens=40,do_sample=False)
        ans=tok.decode(o[0][ids.shape[1]:],skip_special_tokens=True).strip().replace("\n"," ")
        m=re.search(r"秒數[:：]\s*(\d+)",ans); t=int(m.group(1)) if m else None; ap=ans.split("秒數")[0].lower()
        cok=any(k.lower() in ap for k in q["kw"]) and "不知道" not in ap; tok_=t is not None and abs(t-q["t"])<=3
        co+=cok; to+=tok_; ok+=cok and tok_; rows.append({"q":q["q"],"expected_t":q["t"],"answer":ans,"content_ok":cok,"time_ok":tok_}); print(name,"%.0fs"%(time.time()-t1),"|",q["t"],"|",ans,"|",cok,tok_)
    print("SCORE",name,"both",ok,"content",co,"time",to,"/10  qa_total_s",round(time.time()-t1,1))
    rest("aivault_video_learning",{"asset_id":aid,"kind":"qa_eval","payload":{"mode":name+os.environ.get("TRY_TAG",""),"both_correct":ok,"content_correct":co,"timecode_within_3s":to,"rows":rows,"runner":"github-actions cpu"},"score":ok,"model":lm_id},"POST","return=minimal")

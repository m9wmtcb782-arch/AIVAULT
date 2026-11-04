#!/usr/bin/env python3
"""AIVAULT V0.4: use an approved character reference with a ComfyUI API workflow.
Requires a local ComfyUI workflow already configured for image conditioning.
"""
import argparse, hashlib, json, mimetypes, pathlib, sys, time, urllib.parse, urllib.request, uuid

def api(base, path, payload=None, timeout=45):
    body=None if payload is None else json.dumps(payload).encode()
    req=urllib.request.Request(base+path,body,headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=timeout) as r: return json.load(r)

def upload(base, filepath):
    boundary="----aivault"+uuid.uuid4().hex
    name=filepath.name.replace('"',"_")
    content=filepath.read_bytes()
    if len(content)>30_000_000: raise ValueError("Reference image exceeds 30 MB")
    mime=mimetypes.guess_type(name)[0] or "application/octet-stream"
    body=(f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{name}\"\r\nContent-Type: {mime}\r\n\r\n").encode()+content+(f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\nfalse\r\n--{boundary}--\r\n").encode()
    req=urllib.request.Request(base+"/upload/image",body,headers={"Content-Type":"multipart/form-data; boundary="+boundary})
    with urllib.request.urlopen(req,timeout=90) as r: return json.load(r)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--id",required=True)
    p.add_argument("--kind",choices=["front","side","back","fullbody","expression"],default="front")
    p.add_argument("--pose",required=True)
    p.add_argument("--workflow",type=pathlib.Path,required=True)
    p.add_argument("--positive-node",required=True)
    p.add_argument("--load-image-node",required=True)
    p.add_argument("--root",type=pathlib.Path,default=pathlib.Path(__file__).resolve().parent/"characters")
    p.add_argument("--out",type=pathlib.Path,default=pathlib.Path(__file__).resolve().parent/"output")
    p.add_argument("--url",default="http://127.0.0.1:8188")
    p.add_argument("--timeout",type=int,default=300)
    args=p.parse_args()
    parsed=urllib.parse.urlparse(args.url)
    if parsed.scheme!="http" or parsed.hostname not in ("localhost","127.0.0.1","::1") or parsed.username or parsed.password:
        p.error("Only local loopback ComfyUI HTTP endpoints are allowed")
    base=args.url.rstrip("/")
    if not args.id or not all(c.isalnum() or c in "-_" for c in args.id): p.error("Invalid ID")
    folder=args.root.resolve()/args.id
    card=json.loads((folder/"character.json").read_text(encoding="utf-8"))
    if card.get("id")!=args.id: raise ValueError("Character ID mismatch")
    refs=[a for a in card.get("reference_assets",[]) if a.get("review_status")=="approved"]
    if not refs: raise ValueError("No approved character reference; review one first")
    preferred=next((a for a in refs if a["kind"]==args.kind),refs[0])
    path=(folder/preferred["file"]).resolve()
    if not path.is_relative_to(folder.resolve()): raise ValueError("Invalid reference path")
    if hashlib.sha256(path.read_bytes()).hexdigest()!=preferred["sha256"]:
        raise ValueError("Reference image checksum mismatch")
    wf=json.loads(args.workflow.read_text(encoding="utf-8"))
    if not isinstance(wf,dict) or args.positive_node not in wf or args.load_image_node not in wf:
        raise ValueError("Workflow node IDs missing")
    positive=wf[args.positive_node]
    image_node=wf[args.load_image_node]
    if positive.get("class_type")!="CLIPTextEncode" or "text" not in positive.get("inputs",{}):
        raise ValueError("Positive node must be CLIPTextEncode with text input")
    if image_node.get("class_type")!="LoadImage" or "image" not in image_node.get("inputs",{}):
        raise ValueError("Image node must be LoadImage with image input")
    traits=", ".join(str(card.get(k,"")) for k in ("description","hair","face","costume","body","palette") if card.get(k))
    prompt=f"{card['name']}, {traits}. {args.pose}. Same character identity, same facial features and costume."
    positive["inputs"]["text"]=prompt
    uploaded=upload(base,path)
    filename=uploaded.get("name")
    if not filename: raise RuntimeError("ComfyUI did not return uploaded image name")
    subfolder=uploaded.get("subfolder","")
    image_node["inputs"]["image"]=subfolder+"/"+filename if subfolder else filename
    result=api(base,"/prompt",{"prompt":wf,"client_id":str(uuid.uuid4())})
    job=result.get("prompt_id")
    if not job: raise RuntimeError("ComfyUI rejected workflow: "+str(result))
    deadline=time.monotonic()+args.timeout
    outputs=None
    while time.monotonic()<deadline:
        entry=api(base,"/history/"+urllib.parse.quote(job)).get(job)
        if entry:
            status=entry.get("status",{})
            if status.get("status_str")=="error": raise RuntimeError("ComfyUI workflow failed: "+str(status))
            if status.get("completed") or entry.get("outputs"):
                outputs=entry.get("outputs",{});break
        time.sleep(1)
    if outputs is None: raise TimeoutError("ComfyUI generation timed out: "+job)
    args.out.mkdir(parents=True,exist_ok=True)
    count=0
    for node,output in outputs.items():
        for img in output.get("images",[]):
            query=urllib.parse.urlencode({"filename":img["filename"],"subfolder":img.get("subfolder",""),"type":img.get("type","output")})
            with urllib.request.urlopen(base+"/view?"+query,timeout=90) as response: data=response.read()
            if not data.startswith(bytes.fromhex("89504e470d0a1a0a")): raise ValueError("Output is not PNG")
            count+=1
            dest=args.out/f"{args.id}_{job[:8]}_{count}.png"
            dest.write_bytes(data)
            metadata={"schema":"aivault-character-generation-v1","character_id":args.id,"reference":preferred["file"],"reference_sha256":preferred["sha256"],"pose":args.pose,"prompt":prompt,"workflow":args.workflow.name,"job_id":job,"image":dest.name,"review_status":"pending"}
            dest.with_suffix(".json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding="utf-8")
            print(dest)
    if not count: raise RuntimeError("No image outputs; ensure SaveImage node exists")
    print("IMPORTANT: output identity is NOT verified automatically. Review before approval.")
if __name__=="__main__":
    try: main()
    except Exception as e:
        print("ERROR:",e,file=sys.stderr)
        sys.exit(1)

#!/usr/bin/env python3
"""AIVAULT local ComfyUI image generation adapter. Python 3.10+, standard library only."""
import argparse, copy, json, pathlib, time, urllib.request, urllib.parse, uuid, sys

def request_json(base, path, payload=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(base + path, data=data, headers={"Content-Type":"application/json"}, method="POST" if data else "GET")
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)

def main():
    ap = argparse.ArgumentParser(description="Generate a PNG via locally running ComfyUI")
    ap.add_argument("--workflow", required=True, help="ComfyUI API-format workflow JSON")
    ap.add_argument("--prompt", required=True, help="Image prompt")
    ap.add_argument("--node", required=True, help="CLIPTextEncode node ID containing the positive prompt")
    ap.add_argument("--out", default="comic-studio/output", help="Local output directory")
    ap.add_argument("--name", default="character", choices=["character","prop","background"])
    ap.add_argument("--url", default="http://127.0.0.1:8188", help="Local ComfyUI URL")
    ap.add_argument("--timeout", type=int, default=300)
    args = ap.parse_args()
    parsed = urllib.parse.urlparse(args.url)
    if parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost", "::1"):
        ap.error("Only loopback HTTP ComfyUI endpoints are supported")
    base = args.url.rstrip("/")
    workflow = json.loads(pathlib.Path(args.workflow).read_text(encoding="utf-8"))
    if not isinstance(workflow,dict) or args.node not in workflow:
        ap.error("Node not found in workflow")
    workflow = copy.deepcopy(workflow)
    inputs = workflow[args.node].get("inputs",{})
    if "text" not in inputs:
        ap.error("Selected node does not have a text input")
    inputs["text"] = args.prompt
    client_id = str(uuid.uuid4())
    response = request_json(base,"/prompt",{"prompt":workflow,"client_id":client_id})
    job = response.get("prompt_id")
    if not job:
        raise RuntimeError("ComfyUI did not accept the workflow: " + json.dumps(response,ensure_ascii=False))
    deadline = time.monotonic()+args.timeout
    outputs = None
    while time.monotonic()<deadline:
        history = request_json(base,"/history/"+urllib.parse.quote(job))
        entry = history.get(job)
        if entry:
            status = entry.get("status",{})
            if status.get("status_str") == "error":
                raise RuntimeError("ComfyUI execution failed: "+json.dumps(status,ensure_ascii=False))
            if status.get("completed") or entry.get("outputs"):
                outputs = entry.get("outputs",{})
                break
        time.sleep(1)
    if outputs is None:
        raise TimeoutError("Generation timed out; job may still be running in ComfyUI: "+job)
    out = pathlib.Path(args.out)
    out.mkdir(parents=True,exist_ok=True)
    count=0
    for node_id,output in outputs.items():
        for image in output.get("images",[]):
            filename=image.get("filename")
            if not filename: continue
            query=urllib.parse.urlencode({"filename":filename,"subfolder":image.get("subfolder",""),"type":image.get("type","output")})
            with urllib.request.urlopen(base+"/view?"+query,timeout=60) as response:
                content=response.read()
            if not content.startswith(b"\\x89PNG\\r\\n\\x1a\\n"):
                raise ValueError("Output is not a PNG")
            count+=1
            target=out/(args.name+"_"+job[:8]+"_"+str(count)+".png")
            target.write_bytes(content)
            metadata={"schema":"aivault-art-v1","asset_type":args.name,"prompt":args.prompt,"source":"local-comfyui","prompt_id":job,"node_id":node_id,"image":target.name}
            target.with_suffix(".json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding="utf-8")
            print(target)
    if not count:
        raise RuntimeError("Workflow completed without PNG output; ensure a SaveImage node is connected")
if __name__=="__main__":
    try: main()
    except Exception as exc:
        print("ERROR:",exc,file=sys.stderr)
        sys.exit(1)

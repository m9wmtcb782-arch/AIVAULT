#!/usr/bin/env python3
"""AIVAULT Comic Studio character registry V0.3. Standard library only."""
import argparse, hashlib, json, pathlib, re, shutil, sys, uuid
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent / "characters"
KINDS = ("front", "side", "back", "fullbody", "expression")
def now(): return datetime.now(timezone.utc).isoformat()
def read_json(path): return json.loads(path.read_text(encoding="utf-8"))
def write_json(path, data):
    temp=path.with_suffix(path.suffix+".tmp")
    temp.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
    temp.replace(path)
def safe_id(raw):
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}",raw): raise ValueError("Invalid character ID")
    return raw
def path_for(root,ident): return root/safe_id(ident)
def register(args):
    ident=safe_id(args.id or ("char_"+uuid.uuid4().hex[:10]))
    folder=path_for(args.root,ident)
    if folder.exists(): raise ValueError("Character already exists")
    folder.mkdir(parents=True)
    data={"schema":"aivault-character-v1","id":ident,"name":args.name,
          "description":args.description or "","hair":args.hair or "",
          "face":args.face or "","costume":args.costume or "",
          "body":args.body or "","palette":args.palette or "",
          "negative_prompt":args.negative_prompt or "",
          "reference_assets":[],"created_at":now(),"updated_at":now()}
    write_json(folder/"character.json",data)
    print(json.dumps(data,ensure_ascii=False,indent=2))
def add_reference(args):
    folder=path_for(args.root,args.id)
    data=read_json(folder/"character.json")
    src=pathlib.Path(args.file).resolve()
    if not src.is_file() or src.suffix.lower() not in (".png",".jpg",".jpeg",".webp"):
        raise ValueError("Expected an existing PNG/JPEG/WebP image")
    if src.stat().st_size>30_000_000: raise ValueError("Reference image too large")
    sha=hashlib.sha256(src.read_bytes()).hexdigest()
    filename=f"{args.kind}_{sha[:16]}{src.suffix.lower()}"
    target=folder/filename
    if not target.exists(): shutil.copyfile(src,target)
    if not any(x["sha256"]==sha and x["kind"]==args.kind for x in data["reference_assets"]):
        data["reference_assets"].append({"kind":args.kind,"file":filename,"sha256":sha,
                                         "model":args.model or "unknown","seed":args.seed,
                                         "prompt":args.prompt or "","added_at":now(),
                                         "review_status":"pending"})
    data["updated_at"]=now()
    write_json(folder/"character.json",data)
    print("Added:",target)
def review(args):
    folder=path_for(args.root,args.id)
    data=read_json(folder/"character.json")
    found=False
    for asset in data["reference_assets"]:
        if asset["file"]==args.file:
            asset["review_status"]=args.status
            found=True
    if not found: raise ValueError("Asset not found")
    data["updated_at"]=now()
    write_json(folder/"character.json",data)
    print("Reviewed:",args.file,args.status)
def list_characters(args):
    for path in sorted(args.root.glob("*/character.json")):
        try:
            data=read_json(path)
            print(data["id"],data["name"],len(data.get("reference_assets",[])),"references")
        except (ValueError,KeyError): continue
def prompt(args):
    data=read_json(path_for(args.root,args.id)/"character.json")
    traits=[data[k] for k in ("description","hair","face","costume","body","palette") if data.get(k)]
    print("Character identity: "+data["name"]+". "+". ".join(traits)+". View: "+args.kind+
          ". Maintain consistent identity and costume across all images.")
    if data.get("negative_prompt"): print("Negative prompt: "+data["negative_prompt"])
    approved=[a for a in data["reference_assets"] if a.get("review_status")=="approved"]
    print("Approved reference files:",*[a["file"] for a in approved],sep="\n")
    print("NOTE: text prompts alone do not guarantee identity consistency; use model-supported image conditioning.")
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--root",type=pathlib.Path,default=ROOT)
    subs=ap.add_subparsers(dest="command",required=True)
    p=subs.add_parser("create")
    for flag in ("id","name","description","hair","face","costume","body","palette","negative-prompt"):
        p.add_argument("--"+flag,required=flag=="name")
    p.set_defaults(fn=register)
    p=subs.add_parser("add-reference")
    p.add_argument("--id",required=True);p.add_argument("--file",required=True)
    p.add_argument("--kind",choices=KINDS,required=True)
    p.add_argument("--model");p.add_argument("--seed",type=int);p.add_argument("--prompt")
    p.set_defaults(fn=add_reference)
    p=subs.add_parser("review")
    p.add_argument("--id",required=True);p.add_argument("--file",required=True)
    p.add_argument("--status",choices=("approved","rejected"),required=True)
    p.set_defaults(fn=review)
    p=subs.add_parser("list");p.set_defaults(fn=list_characters)
    p=subs.add_parser("prompt");p.add_argument("--id",required=True)
    p.add_argument("--kind",choices=KINDS,required=True);p.set_defaults(fn=prompt)
    args=ap.parse_args()
    args.root=args.root.resolve()
    args.fn(args)
if __name__=="__main__":
    try: main()
    except (OSError,ValueError,KeyError,json.JSONDecodeError) as exc:
        print("ERROR:",exc,file=sys.stderr);sys.exit(1)

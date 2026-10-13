#!/usr/bin/env python3
"""Stage an explicitly provided Mandarin Piper model pair; never download or execute it."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys

def sha256(path):
    digest=hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda:source.read(1024*1024),b""):
            digest.update(block)
    return digest.hexdigest()

def main(argv=None):
    parser=argparse.ArgumentParser(description="Validate and stage an offline Mandarin Piper voice")
    parser.add_argument("--model",required=True,type=Path)
    parser.add_argument("--config",required=True,type=Path)
    parser.add_argument("--expected-sha256",required=True)
    parser.add_argument("--destination",required=True,type=Path)
    args=parser.parse_args(argv)
    expected=args.expected_sha256.lower()
    if len(expected)!=64 or any(ch not in "0123456789abcdef" for ch in expected):
        parser.error("expected-sha256 must be 64 hex digits from a trusted model publisher")
    if not args.model.is_file() or not args.config.is_file() or args.model.stat().st_size==0:
        print("MODEL_FILES_MISSING",file=sys.stderr);return 2
    if sha256(args.model)!=expected:
        print("MODEL_CHECKSUM_MISMATCH",file=sys.stderr);return 3
    try:
        metadata=json.loads(args.config.read_text(encoding="utf-8"))
        rate=metadata.get("audio",{}).get("sample_rate")
        language=str(metadata.get("language",{}).get("code","")).lower().replace("_","-")
        if rate not in (22050,24000) or not language.startswith("zh"):
            print("INCOMPATIBLE_MANDARIN_MODEL",file=sys.stderr);return 4
    except (OSError,ValueError,AttributeError,TypeError):
        print("INVALID_MODEL_CONFIG",file=sys.stderr);return 4
    args.destination.mkdir(parents=True,exist_ok=True)
    target=args.destination/"mandarin.onnx"
    target_config=args.destination/"mandarin.onnx.json"
    if target.exists() or target_config.exists():
        print("DESTINATION_EXISTS",file=sys.stderr);return 5
    temporary=target.with_suffix(".onnx.partial")
    temporary_config=target_config.with_suffix(".json.partial")
    try:
        shutil.copyfile(args.model,temporary)
        shutil.copyfile(args.config,temporary_config)
        if sha256(temporary)!=expected:raise RuntimeError("COPY_CHECKSUM_MISMATCH")
        temporary.replace(target)
        temporary_config.replace(target_config)
    except Exception:
        temporary.unlink(missing_ok=True)
        temporary_config.unlink(missing_ok=True)
        target.unlink(missing_ok=True)
        raise
    print(json.dumps({"status":"MODEL_STAGED","model":str(target),"sha256":expected,
                      "sample_rate":rate,"language":language},ensure_ascii=False))
    return 0

if __name__=="__main__":
    sys.exit(main())

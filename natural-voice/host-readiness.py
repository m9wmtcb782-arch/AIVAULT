#!/usr/bin/env python3
"""Check whether a local voice host is ready; never downloads models or calls paid APIs."""
import argparse
import importlib.util
import json
from pathlib import Path
import platform
import sys

ROOT=Path(__file__).resolve().parent

def load_preflight():
    spec=importlib.util.spec_from_file_location("voice_preflight",ROOT/"model-preflight.py")
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def report(env=None, tts_only=False):
    checks=load_preflight().check_environment(env)
    required = {key: ok for key, ok in checks.items() if not (tts_only and key == "asr_model")}
    missing=[key for key,ok in required.items() if not ok]
    return {"status":"READY_FOR_REAL_INFERENCE" if not missing else "BLOCKED",
            "python":platform.python_version(),
            "checks":checks,
            "mode":"tts_only" if tts_only else "asr_and_tts",
            "missing":missing,
            "next_step":("python render-local-sample.py --output voice-sample.wav"
                         if not missing else "Install the missing local models or configuration; no automatic downloads")}

def main(argv=None):
    parser=argparse.ArgumentParser(description="Offline voice-host readiness report")
    parser.add_argument("--output",type=Path,help="Optional JSON report path")
    parser.add_argument("--tts-only",action="store_true",help="Check first voice synthesis without requiring ASR weights")
    args=parser.parse_args(argv)
    result=report(tts_only=args.tts_only)
    payload=json.dumps(result,ensure_ascii=False,indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(payload+"\n",encoding="utf-8")
    print(payload)
    return 0 if result["status"]=="READY_FOR_REAL_INFERENCE" else 2

if __name__=="__main__":
    sys.exit(main())

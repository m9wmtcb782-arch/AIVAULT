#!/usr/bin/env python3
"""Offline acceptance runner: preflight and render a real Mandarin WAV, no cloud fallback."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import sys
import wave

ROOT=Path(__file__).resolve().parent

def load(name,filename):
    spec=importlib.util.spec_from_file_location(name,ROOT/filename)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def main(argv=None):
    parser=argparse.ArgumentParser(description="Accept locally installed Mandarin voice using actual synthesis")
    parser.add_argument("--output",required=True,type=Path)
    parser.add_argument("--text",default="你好，我是暗星。這是 AIVAULT 自有中文語音的實際發聲驗收。")
    args=parser.parse_args(argv)
    checks=load("preflight","model-preflight.py").check_environment()
    required=("piper_executable","piper_model","piper_config","tts_supported_rate","tts_mandarin")
    missing=[key for key in required if not checks[key]]
    if missing:
        print(json.dumps({"status":"BLOCKED","missing":missing},ensure_ascii=False))
        return 2
    renderer=load("voice_renderer","render-local-sample.py")
    code=renderer.main(["--output",str(args.output),"--text",args.text])
    if code!=0:
        print(json.dumps({"status":"INFERENCE_FAILED","render_exit":code},ensure_ascii=False))
        return 3
    try:
        with wave.open(str(args.output),"rb") as wav:
            valid=wav.getnchannels()==1 and wav.getsampwidth()==2 and wav.getframerate()==24000 and wav.getnframes()>0
            seconds=round(wav.getnframes()/wav.getframerate(),3)
        if not valid:raise ValueError("INVALID_OUTPUT_WAV")
    except (OSError,wave.Error,ValueError) as exc:
        print(json.dumps({"status":"INVALID_AUDIO","reason":str(exc)},ensure_ascii=False))
        return 4
    print(json.dumps({"status":"REAL_INFERENCE_PASSED","path":str(args.output),
                      "duration_seconds":seconds,"note":"Voice naturalness still requires listening assessment"},ensure_ascii=False))
    return 0

if __name__=="__main__":
    sys.exit(main())

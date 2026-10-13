"""Offline audio latency probe for a locally installed Piper model.
Never downloads weights or contacts any paid provider.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import statistics
import time

def load_engine():
    spec=importlib.util.spec_from_file_location("aivault_piper",Path(__file__).with_name("local-piper-tts.py"))
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.LocalPiperTTS()

def benchmark(engine,text="你好，我是暗星。",repeats=3):
    if repeats<1 or repeats>20:
        raise ValueError("INVALID_REPEATS")
    if not engine.available:
        raise RuntimeError("TTS_MODEL_UNAVAILABLE")
    results=[]
    for _ in range(repeats):
        started=time.perf_counter()
        pcm=engine.synthesize(text,sample_rate=24000)
        elapsed=(time.perf_counter()-started)*1000
        results.append({"inference_ms":round(elapsed,1),"audio_ms":round(len(pcm)/48,1),
                        "realtime_factor":round(elapsed/(len(pcm)/48),3)})
    return {"runs":results,"mean_inference_ms":round(statistics.mean(x["inference_ms"] for x in results),1),
            "mean_realtime_factor":round(statistics.mean(x["realtime_factor"] for x in results),3)}

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--text",default="你好，我是暗星。")
    parser.add_argument("--repeats",type=int,default=3)
    args=parser.parse_args()
    try:
        print(json.dumps(benchmark(load_engine(),args.text,args.repeats),ensure_ascii=False,indent=2))
    except (ValueError,RuntimeError) as error:
        print(json.dumps({"status":"unavailable","reason":str(error)}))
        raise SystemExit(1)

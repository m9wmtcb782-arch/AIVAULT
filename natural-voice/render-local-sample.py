#!/usr/bin/env python3
"""Offline Mandarin speech acceptance: synthesize an actual WAV without external APIs."""
import argparse
import importlib.util
import json
from pathlib import Path
import sys
import wave

ROOT = Path(__file__).resolve().parent

def create_engine():
    spec = importlib.util.spec_from_file_location("local_piper", ROOT / "local-piper-tts.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.LocalPiperTTS()

def main(argv=None):
    parser = argparse.ArgumentParser(description="Render an actual local Mandarin voice sample")
    parser.add_argument("--text", default="你好，我是暗星。這是 AIVAULT 自有語音引擎的離線測試。")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(argv)
    if not args.text.strip() or len(args.text) > 500:
        parser.error("text must contain 1 to 500 characters")
    engine = create_engine()
    if not engine.available:
        print(json.dumps({"status":"MODEL_UNAVAILABLE","note":"Install local Piper CLI and voice ONNX first"}), file=sys.stderr)
        return 2
    try:
        pcm = engine.synthesize(args.text, sample_rate=24000)
        if not isinstance(pcm, bytes) or not pcm or len(pcm)%2:
            raise ValueError("INVALID_PCM16")
        args.output.parent.mkdir(parents=True,exist_ok=True)
        with wave.open(str(args.output),"wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(24000)
            wav.writeframes(pcm)
    except (OSError, RuntimeError, ValueError, TimeoutError) as exc:
        print(json.dumps({"status":"FAILED","error":str(exc)},ensure_ascii=False),file=sys.stderr)
        return 3
    print(json.dumps({"status":"WAV_CREATED","path":str(args.output),
                      "duration_seconds":round(len(pcm)/48000,3),
                      "sample_rate":24000},ensure_ascii=False))
    return 0

if __name__=="__main__":
    sys.exit(main())

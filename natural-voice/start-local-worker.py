#!/usr/bin/env python3
"""Start the isolated offline voice worker only after local model preflight passes."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent

def main(argv=None):
    parser = argparse.ArgumentParser(description="Start isolated local voice worker")
    parser.add_argument("--tts-only", action="store_true", help="Start without ASR model for first TTS playback")
    args = parser.parse_args(argv)
    spec = importlib.util.spec_from_file_location("voice_preflight", ROOT / "model-preflight.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    checks = module.check_environment()
    required = ("piper_executable", "piper_model", "piper_config",
                "voice_token", "tts_supported_rate", "tts_mandarin", "asr_model")
    if args.tts_only:
        required = tuple(key for key in required if key != "asr_model")
    missing = [key for key in required if not checks[key]]
    if missing:
        print(json.dumps({"status": "NOT_READY", "failed_checks": missing},
                         ensure_ascii=False), file=sys.stderr)
        return 2
    try:
        import uvicorn
    except ImportError:
        print("MISSING_DEPENDENCY: uvicorn", file=sys.stderr)
        return 3
    host = os.environ.get("AIVAULT_VOICE_BIND", "127.0.0.1")
    if host != "127.0.0.1":
        print("UNSAFE_BIND: use loopback and an authenticated HTTPS reverse proxy",
              file=sys.stderr)
        return 4
    port = int(os.environ.get("AIVAULT_VOICE_PORT", "8765"))
    if args.tts_only:
        os.environ.pop("ASR_MODEL_PATH", None)
    os.chdir(ROOT)
    uvicorn.run("worker:app", host=host, port=port)
    return 0

if __name__ == "__main__":
    sys.exit(main())

"""AIVAULT-hosted speech. Model inference only; no external generation APIs."""
import argparse
import hashlib
import io
import json
import os
import secrets
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROFILES = json.loads((ROOT / "profiles.json").read_text())
REFERENCE_TEXT = "您好，歡迎一起閱讀。學習需要理解文字，也需要思考背後的理由。讓我們保持自然的節奏，仔細聽清楚每一個句子。"


def request_payload(body):
    if not isinstance(body, dict):
        raise ValueError("request must be a JSON object")
    text = body.get("input", body.get("text", ""))
    voice = body.get("voice", "warm_female")
    if not isinstance(text, str) or not text.strip() or len(text) > 2400:
        raise ValueError("input must contain 1–2400 characters")
    if voice not in PROFILES:
        raise ValueError("unknown voice")
    if body.get("response_format", "wav") != "wav":
        raise ValueError("only wav output is supported")
    return text, voice


def load_model(model_id, device):
    import torch
    from qwen_tts import Qwen3TTSModel
    if device.startswith("cuda") and not torch.cuda.is_available():
        raise RuntimeError("No CUDA GPU: supply a GPU node or explicitly use --device cpu for offline evaluation")
    return Qwen3TTSModel.from_pretrained(
        model_id, device_map=device,
        dtype=torch.bfloat16 if device.startswith("cuda") else torch.float32,
        attn_implementation="sdpa",
    )


def prepare(data_dir, device, selected):
    import soundfile as sf
    directory = Path(data_dir); directory.mkdir(parents=True, exist_ok=True)
    model = load_model(os.environ.get("AIVAULT_VOICE_DESIGN_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"), device)
    for voice in selected:
        path = directory / (voice + ".wav")
        if path.exists():
            continue  # fixed references preserve the voice identity across restarts
        waves, rate = model.generate_voice_design(text=REFERENCE_TEXT, language="Chinese", instruct=PROFILES[voice]["description"])
        temporary = directory / (voice + ".partial.wav")
        sf.write(temporary, waves[0], rate, subtype="PCM_16")
        temporary.replace(path)
        (directory / (voice + ".json")).write_text(json.dumps({"text": REFERENCE_TEXT, "label": PROFILES[voice]["label"]}, ensure_ascii=False))


class VoiceEngine:
    def __init__(self, data_dir, device):
        self.data_dir = Path(data_dir)
        self.voices = [v for v in PROFILES if (self.data_dir / (v + ".wav")).is_file() and (self.data_dir / (v + ".json")).is_file()]
        if not self.voices:
            raise RuntimeError("No prepared voice references; run the prepare command first")
        self.model = load_model(os.environ.get("AIVAULT_VOICE_BASE_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-Base"), device)
        self.prompts = {}
        self.lock = threading.Lock()
        self.cache_dir = self.data_dir / "clips"; self.cache_dir.mkdir(exist_ok=True)

    def synthesize(self, text, voice):
        import soundfile as sf
        if voice not in self.voices:
            raise ValueError("voice reference is not ready")
        reference = self.data_dir / (voice + ".wav")
        digest = hashlib.sha256(reference.read_bytes() + text.encode() + os.environ.get("AIVAULT_VOICE_BASE_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-Base").encode()).hexdigest()
        cached = self.cache_dir / (digest + ".wav")
        with self.lock:
            if cached.exists():
                return cached.read_bytes()
            if voice not in self.prompts:
                transcript = json.loads((self.data_dir / (voice + ".json")).read_text())["text"]
                self.prompts[voice] = self.model.create_voice_clone_prompt(ref_audio=str(reference), ref_text=transcript)
            waves, rate = self.model.generate_voice_clone(text=text, language="Chinese", voice_clone_prompt=self.prompts[voice])
            out = io.BytesIO(); sf.write(out, waves[0], rate, format="WAV", subtype="PCM_16")
            binary = out.getvalue(); temporary = cached.with_suffix(".partial"); temporary.write_bytes(binary); temporary.replace(cached)
            files = sorted(self.cache_dir.glob("*.wav"), key=lambda p: p.stat().st_mtime, reverse=True)
            for old in files[256:]:
                old.unlink()  # generated cache only; voice references are retained
            return binary


def serve(engine, token, host, port):
    if len(token) < 24:
        raise RuntimeError("AIVAULT_VOICE_TOKEN must contain at least 24 characters")
    slots = threading.BoundedSemaphore(4)

    class Handler(BaseHTTPRequestHandler):
        def send(self, status, body, mime="application/json"):
            binary = json.dumps(body, ensure_ascii=False).encode() if isinstance(body, dict) else body
            self.send_response(status); self.send_header("Content-Type", mime); self.send_header("Content-Length", str(len(binary))); self.end_headers(); self.wfile.write(binary)

        def authorized(self):
            return secrets.compare_digest(self.headers.get("Authorization", ""), "Bearer " + token)

        def do_GET(self):
            if not self.authorized(): self.send(401, {"error": "unauthorized"}); return
            if self.path != "/health": self.send(404, {"error": "not_found"}); return
            self.send(200, {"engine": "aivault-voice", "ready": bool(engine.voices), "provider": "self_hosted", "voices": [{"id": v, "label": PROFILES[v]["label"]} for v in engine.voices]})

        def do_POST(self):
            if not self.authorized(): self.send(401, {"error": "unauthorized"}); return
            if self.path != "/v1/audio/speech": self.send(404, {"error": "not_found"}); return
            if not slots.acquire(blocking=False): self.send(503, {"error": "queue_full", "retry_after_seconds": 5}); return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > 24000: self.send(413, {"error": "request_size"}); return
                body = json.loads(self.rfile.read(length)); text, voice = request_payload(body)
                self.send(200, engine.synthesize(text, voice), "audio/wav")
            except (ValueError, TypeError, KeyError): self.send(400, {"error": "invalid_request"})
            except Exception: self.send(503, {"error": "inference_failed"})
            finally: slots.release()

        def log_message(self, fmt, *args):
            pass  # never log input text or authentication headers

    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("command", choices=["prepare", "serve"])
    parser.add_argument("--device", default="cuda:0"); parser.add_argument("--data-dir", default=os.environ.get("AIVAULT_VOICE_DATA", "./voice-data"))
    parser.add_argument("--voice", choices=list(PROFILES), action="append"); parser.add_argument("--host", default="127.0.0.1"); parser.add_argument("--port", type=int, default=8090)
    args = parser.parse_args()
    if args.command == "prepare": prepare(args.data_dir, args.device, args.voice or list(PROFILES))
    else: serve(VoiceEngine(args.data_dir, args.device), os.environ.get("AIVAULT_VOICE_TOKEN", ""), args.host, args.port)

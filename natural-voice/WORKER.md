# Local speech worker (prototype)

This service is intentionally separate from production Dark Star and Supabase Edge Functions. It uses a self-hosted CPU/GPU Python process. No external provider API calls.

## Install

```sh
python -m venv .venv
. .venv/bin/activate
pip install fastapi uvicorn numpy faster-whisper
```

Provide a **previously downloaded, local** compatible Whisper model directory; this worker does not download model weights automatically. For GPU execution, install a compatible CUDA/cuDNN environment and faster-whisper dependencies.

```sh
export AIVAULT_VOICE_TOKEN='replace-with-strong-random-secret'
export ASR_MODEL_PATH='/models/faster-whisper'
export ASR_DEVICE='cpu'
export ASR_COMPUTE_TYPE='int8'
uvicorn worker:app --host 127.0.0.1 --port 8765
```

To use a CUDA GPU, change ASR_DEVICE and compute type only after checking driver compatibility.

## API

- `GET /health`: reports whether local ASR is loaded. Does not reveal token.
- `POST /v1/asr`: authenticated; JSON `{"audio_pcm16_base64":"...","sample_rate":16000,"language":"zh-TW"}`. Returns `{"text":"..."}`.
- `POST /v1/tts`: authenticated; currently **503 TTS_MODEL_NOT_CONNECTED**. No generated audio is available yet.

## Security and production gaps

- Bind to loopback only; use an authenticated HTTPS reverse proxy when exposing to the network.
- Do not put bearer tokens in browser source. Proxy browser calls through an authenticated backend.
- Current ASR uses a whole-buffer transcription request, **not real streaming ASR**.
- Request size, concurrency, timeouts, model warm-up, latency and GPU availability must be measured before production.
- The JavaScript adapter currently collects all returned TTS frames in one JSON response. It is **not** low-latency streaming audio yet.
- No speech output or Gemini-equivalent quality is claimed.

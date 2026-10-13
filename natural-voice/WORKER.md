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
python start-local-worker.py
```

To use a CUDA GPU, change ASR_DEVICE and compute type only after checking driver compatibility.

## API

- `GET /health`: reports whether local ASR is loaded. Does not reveal token.
- `POST /v1/asr`: authenticated; JSON `{"audio_pcm16_base64":"...","sample_rate":16000,"language":"zh-TW"}`. Returns `{"text":"..."}`.
- `POST /v1/tts`: authenticated; returns base64 PCM16 frames if Piper is installed with a compatible 24 kHz voice; otherwise returns 503.
- `POST /v1/tts/stream`: authenticated; sends NDJSON audio frames clause by clause, then a completion marker. This is **clause-level streaming**, not token-level neural synthesis.

## Security and production gaps

- Bind to loopback only; use an authenticated HTTPS reverse proxy when exposing to the network.
- Do not put bearer tokens in browser source. Proxy browser calls through an authenticated backend.
- Current ASR uses a whole-buffer transcription request, **not real streaming ASR**.
- Request size, concurrency, timeouts, model warm-up, latency and GPU availability must be measured before production.
- The legacy JavaScript adapter collects full JSON; the isolated mobile test page uses the newer NDJSON streaming endpoint. Actual first-audio latency remains unmeasured.
- No speech output or Gemini-equivalent quality is claimed.

## Piper local setup (no API calls)

Install a compatible Piper CLI locally and place the voice ONNX and its matching configuration JSON in a private model directory. Choose a voice whose actual output is **24,000 Hz mono PCM16**; the current worker rejects other sample rates rather than incorrectly relabeling audio. Verify the voice license before distribution.

```sh
export PIPER_EXECUTABLE=/usr/local/bin/piper
export PIPER_MODEL_PATH=/models/zh-voice.onnx
# Keep AIVAULT_VOICE_TOKEN configured as above.
python start-local-worker.py
```

The worker now uses Piper's `--output_file` to write a temporary WAV, validates its format, and removes the temporary file after reading. This avoids assuming the CLI writes WAV bytes to standard output. Do not expose the worker directly to the public internet.


## Guarded offline startup

Run `python start-local-worker.py` from this directory after setting local model paths and a strong token. The launcher checks Mandarin Piper metadata, 24 kHz PCM, local ASR weights and token before starting on loopback. It does not download models, use paid APIs, or expose a public server. A reachable authenticated HTTPS reverse proxy is still needed for phone testing.

## Mandarin Piper model sample rates

The isolated worker accepts Piper voice WAV output at **22050 Hz or 24000 Hz**. For 22050 Hz models it uses SciPy polyphase resampling to 24000 Hz PCM16; install `numpy>=1.26,<3` and `scipy>=1.12,<2` in the worker Python environment. This changes sample-rate compatibility, **not** model naturalness. No model files are downloaded automatically.

# AIVAULT Natural Voice — first real-model acceptance

This is an isolated self-hosted test. No Gemini/Grok/Kling requests, no model downloads, and no changes to the production Dark Star or Compute Mesh.

## Host prerequisites

- Python 3.11+; Piper CLI installed on the host
- A **licensed** Mandarin Chinese Piper ONNX voice and its matching .onnx.json metadata, **verified 24 kHz mono PCM16**
- A locally installed faster-whisper-compatible ASR model directory
- A strong private bearer token, not stored in GitHub or browser source
- An HTTPS reverse proxy with explicit CORS policy for the isolated test page

## Validation sequence

1. On the private host, set PIPER_EXECUTABLE, PIPER_MODEL_PATH, ASR_MODEL_PATH, AIVAULT_VOICE_TOKEN and run `python model-preflight.py`. A pass means files/settings appear ready, **not** that inference works.
2. Run `python benchmark-local-tts.py --text '你好，我是暗星。' --repeats 3` and record inference milliseconds, audio milliseconds and real-time factor. Do not report simulated test values as real results.
3. Start `uvicorn worker:app --host 127.0.0.1 --port 8765` from the `natural-voice` directory.
4. Verify `GET /health` reports both ASR and TTS loaded. Check the authenticated TTS stream endpoint using the private test host. A health check alone does not prove speech quality.
5. On an HTTPS phone browser, open `voice-test.html` served from the same feature branch and use only a short-lived test token. Record spoken Taiwan Mandarin and listen to the returned synthesized audio.
6. Capture: first audio frame latency, audible start latency, real-time factor, pronunciation, natural pauses, repeated turn reliability, interruption and memory usage. Measure on both iOS and Android before integrating with Dark Star.

## Acceptance gates

- No false success when models are missing; no cloud fallback.
- ASR transcript matches the actual utterance; TTS produces audible Mandarin.
- No microphone or AudioContext resource leak over repeated sessions.
- Stop interrupts speech promptly; no stale audio from the prior turn.
- Naturalness is evaluated by listening, not inferred from test coverage.
- No production integration until tests and user acceptance.

## Known constraints

Piper is a practical **offline baseline**, not evidence of Gemini Live-equivalent expressive realtime speech. Current ASR is whole-utterance and TTS is clause-streamed; true low-latency bidirectional speech will require further engineering. The mobile page is a prototype, not a credential-safe production client.

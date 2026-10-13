# First real Mandarin voice: operator checklist

This isolated branch has **no model weights and no deployed GPU/CPU speech host**. Passing CI uses mocked inference and does not establish voice quality.

## Prerequisites (on a Linux or macOS computer, not the iPhone)
- Install Python dependencies for the local worker and a trusted Piper CLI build.
- Obtain a legally usable **Mandarin Piper ONNX model** and its matching `.onnx.json` from its publisher. Verify license, Mandarin language metadata and publisher-provided SHA-256. Do not assume any Mandarin model sounds like a human or supports Taiwanese accent.
- Keep all weights and bearer tokens outside Git.

## Stage and validate (no automatic downloads)

From `natural-voice/`, after obtaining files and publisher checksum:

```sh
python stage-mandarin-model.py \
  --model /secure/downloads/voice.onnx \
  --config /secure/downloads/voice.onnx.json \
  --expected-sha256 PUBLISHER_VERIFIED_64_HEX_SHA256 \
  --destination /secure/aivault-voice/models
```

Use the environment variables documented by `model-preflight.py` and `local-piper-tts.py` to point to the installed CLI, staged model, config, and a nonempty test token. Do **not** paste a token into GitHub issues or source code.

```sh
python host-readiness.py --tts-only
python accept-local-voice.py --output /tmp/aivault-first-voice.wav
```

Only when readiness reports `READY_FOR_REAL_INFERENCE` and acceptance reports `REAL_INFERENCE_PASSED` should the WAV be treated as real model output. Listen to the WAV and rate: pronunciation of Traditional Chinese, natural pauses, rhythm, emotion, clarity, and speaker consistency. A playable WAV alone is **not** proof of Gemini-like quality.

## Mobile test
Run the self-hosted worker behind trusted HTTPS with CORS restricted to the test page origin. Open `reading-sync-test.html` from that origin, enter a **short-lived test token** and a paragraph of text, then check play, pause, resume, stop and highlight on an actual iPhone. The current page is an isolated test, not a production ebook integration. Do not expose a long-lived server token in a public page.

## Blockers
Without a compatible machine/host, Piper binary, licensed Mandarin model pair, and trusted checksum, the project cannot truthfully generate its first real voice. Do not substitute Gemini/Grok/Kling calls or silent synthetic tones as evidence of speech synthesis.

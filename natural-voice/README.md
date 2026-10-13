# AIVAULT Natural Voice Engine v1.0 — isolated prototype

Status: DEVELOPMENT ONLY. No live TTS model deployed or validated.

## Scope
Shared voice contract for ebook reading, Technical Dark Star responses, and causal fiction. This branch must not modify existing live-voice, ebook, or avatar production files.

## Contract
POST /voice/synthesize (future GPU-hosted service, not Supabase Edge inference)
Request:
```json
{"request_id":"uuid","text":"您好，今天我們討論比例原則。","voice_id":"anxing-default","mode":"reading","language":"zh-TW","rate":1.0,"emotion":"neutral","stream":true}
```
Response: streaming audio frames with sequence number, sample rate, format, segment ID, character offsets, and final marker. Every segment must have monotonic offsets and an unambiguous request ID. Never return success when the model is unavailable.

## Pipeline
1. Normalize input while preserving source character offsets and punctuation.
2. Segment by sentence/semantic boundary, respecting quotation marks and abbreviations.
3. Prosody planner proposes pauses, emphasis and emotion without rewriting the source.
4. GPU TTS worker synthesizes frames and timestamps.
5. Playback queue performs jitter buffering, cancellation, pause/resume, and synchronized text highlighting.
6. Interrupt invalidates current generation ID and discards stale frames.

## Security and deployment
- Never place API keys or privileged service tokens in client code.
- Authenticated, rate-limited requests; no voice cloning without consent.
- Model licenses and Taiwanese Mandarin quality must be checked before selecting weights.
- Edge Function can authenticate and route requests; GPU inference must run on a compatible worker.
- Existing Gemini live voice remains untouched as an optional fallback.
- No paid API tests without explicit authorization.

## Acceptance tests
- Segmentation preserves exact text and offsets, including Traditional Chinese punctuation.
- Stop/interruption produces no delayed stale playback.
- Reading highlight follows played audio, not synthesized-but-unplayed text.
- Playback preserves ordering despite out-of-order worker responses.
- GPU worker unavailable yields explicit MODEL_UNAVAILABLE, not fake generated audio.
- Device/browser testing on iOS and Android, plus listening evaluation, remains required.

## Next implementation
Build a local deterministic segmentation and playback-contract test harness; then add an authenticated GPU-worker adapter and actual streaming TTS backend. Do not claim Gemini-equivalent naturalness without blinded listening tests.

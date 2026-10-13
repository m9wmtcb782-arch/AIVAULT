# Live Voice integration plan — v1

The new modules are intentionally isolated from production:
- live-session.mjs: generation IDs, ordered frames, stale frame discard, interrupt
- energy-vad.mjs: deterministic PCM16 speech activity heuristic

## Runtime interface
1. Browser mic -> AudioWorklet PCM16 16 kHz -> VAD -> authenticated WSS relay.
2. Streaming ASR worker -> partial/final transcripts.
3. Technical Dark Star existing agent brain -> token stream.
4. Self-hosted TTS GPU worker -> timed PCM audio frames.
5. Browser AudioWorklet playback -> audible position acknowledgments and text highlighting.

## Known limitations
Energy-based VAD will false-trigger on noise and cannot identify the speaker. Do not route echo output back into ASR; add acoustic echo cancellation, neural VAD and turn detection before production. No ASR/TTS weights, GPU service, WebSocket relay, or deployed runtime is included yet.

## Testing
Run `node --test natural-voice/*.test.mjs` in CI or local Node 20+.
Do not mark tests passing unless executed. Existing pages remain untouched.

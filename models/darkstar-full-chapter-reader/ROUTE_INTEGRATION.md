# VERBATIM_READING Route Integration (feature branch)

## Status
Independent route added. Live session core not modified. Not on main. Not deployed.

## What it does
- Parses "完整朗讀《書名》第N章".
- Soft-mutes Live playback (calls existing bargeIn if present) without closing the WebSocket.
- Plays pre-synthesized segment audio via HTMLAudioElement.
- Advances only on real `ended` event.
- Supports pause / resume / stop / reread.
- Disable: `localStorage.aivaultVerbatimOff = '1'`.

## What is still required before live use
1. Caller must supply verified segments with actual non-paid TTS audio sources.
2. Optional one-line script include on the Dark Star page (not done; page not modified).
3. Real end-to-end test on device.

## Voice identity
Non-paid Voice TTS voice is not guaranteed to match Gemini Live voice.

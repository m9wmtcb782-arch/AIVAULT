# Full chapter connection (feature branch)

## Flow
1. Call `load_chapter_for_verbatim(fetch, ebook_id, chapter_index)`.
2. Require `result.ok && result.integrity.ok`.
3. Synthesize each `segment.text` with non-paid TTS, attach `src`.
4. Call `AIVAULT_CONNECT_CHAPTER(result)` to start playback via route.
5. Playback advances only on real `ended`.

## Status
Connector added on feature branch.
Formal Dark Star page not modified.
Not on main. Not deployed.
Real end-to-end on device: NOT TESTED.

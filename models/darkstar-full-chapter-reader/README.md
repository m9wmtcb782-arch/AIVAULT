# Dark Star Full Chapter Reader (Independent)

Independent module. Does not modify formal Dark Star pages, formal DB, or main branch.

## Modes
- Full chapter assembly (existing FullChapterReader)
- VERBATIM_READING: exact original text only. No LLM generation, summarization, rewrite, or deletion.

## VERBATIM_READING guarantees
- Segments preserve exact character ranges.
- SHA-256 checksum per segment and for full text.
- Integrity verification reconstructs full text and compares.
- Playback status is contractual: COMPLETED only after separate actual audio confirmation.
- Sending text to TTS does not equal reading finished.
- Extraction errors (missing chars, garbled, missing pages) must be reported explicitly; no auto-fill.

## Files
- reader.py : chapter assembly via toc + book
- verbatim.py : segmentation + integrity
- playback_contract.py : pause / resume / jump / progress
- test_isolated.py : isolated contract tests

## Status
IMPLEMENTED. Isolated tests can be run with `python test_isolated.py`.
Live API and actual TTS completion NOT TESTED here.
Does not claim formal Dark Star already performs verified verbatim full-chapter reading.

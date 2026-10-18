"""Executable end-to-end flow for local test book.
Uses existing orchestrator, reader, segment_player.
Does not claim real browser playback complete.
"""
import json
from orchestrator import VerbatimOrchestrator
from local_test_book import mock_fetch

def main():
    orch = VerbatimOrchestrator(mock_fetch)
    loaded = orch.load_chapter("local-test", 1)
    if not loaded.get("ok"):
        print(json.dumps({"error": "chapter_load_failed"}, ensure_ascii=False))
        return
    player = orch.create_player(loaded["full_text"], "local-test", "ch-1", segment_size=100)
    integ = player.integrity()
    segments = []
    for seg in player.reader.segments:
        segments.append({
            "index": seg.index,
            "char_start": seg.char_start,
            "char_end": seg.char_end,
            "checksum": seg.checksum,
            "text_preview": seg.text[:40]
        })
    out = {
        "chapter_ok": True,
        "char_count": loaded["char_count"],
        "page_count": loaded["page_count"],
        "integrity_ok": integ["ok"],
        "segment_count": len(segments),
        "segments": segments,
        "note": "TTS synthesis and real playback must be verified externally"
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()

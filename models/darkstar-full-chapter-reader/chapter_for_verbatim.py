"""Get full chapter original text and prepare verbatim segments.
No generation, no summarization, no rewriting.
Uses existing FullChapterReader + VerbatimReader.
"""
from typing import Dict, Any, Callable
from reader import FullChapterReader
from verbatim import VerbatimReader

def load_chapter_for_verbatim(fetch_fn: Callable, ebook_id: str, chapter_index: int,
                              segment_size: int = 600) -> Dict[str, Any]:
    reader = FullChapterReader(fetch_fn)
    loaded = reader.read_chapter_full(ebook_id, chapter_index)
    if not loaded.get("ok"):
        return loaded

    full_text = loaded["full_text"]
    if not full_text.strip():
        return {"ok": False, "error": "empty_chapter"}

    vr = VerbatimReader(full_text, segment_size)
    integ = vr.verify_integrity()
    if not integ["ok"]:
        return {"ok": False, "error": "integrity_failed", "integrity": integ}

    segments = []
    for seg in vr.segments:
        segments.append({
            "index": seg.index,
            "text": seg.text,          # exact original substring
            "char_start": seg.char_start,
            "char_end": seg.char_end,
            "checksum": seg.checksum
        })

    return {
        "ok": True,
        "ebook_id": ebook_id,
        "chapter_index": chapter_index,
        "chapter_title": loaded.get("chapter_title"),
        "full_text": full_text,
        "char_count": len(full_text),
        "page_count": loaded.get("page_count"),
        "integrity": integ,
        "segments": segments,
        "note": "segments contain exact original text; feed to non-generative TTS only"
    }

"""Thin end-to-end orchestrator for VERBATIM_READING.
Wires existing FullChapterReader + VerbatimReader + SegmentPlayer + TTSAdapter.
Does not touch knowledge retrieval or academic analysis paths.
"""
from typing import Dict, Any, Callable, Optional
from reader import FullChapterReader
from segment_player import SegmentPlayer

class VerbatimOrchestrator:
    def __init__(self, fetch_fn: Callable):
        self.chapter_reader = FullChapterReader(fetch_fn)

    def load_chapter(self, ebook_id: str, chapter_index: int) -> Dict[str, Any]:
        result = self.chapter_reader.read_chapter_full(ebook_id, chapter_index)
        if not result.get("ok"):
            return result
        return {
            "ok": True,
            "ebook_id": ebook_id,
            "chapter_index": chapter_index,
            "full_text": result["full_text"],
            "page_count": result["page_count"],
            "char_count": result["char_count"]
        }

    def create_player(self, full_text: str, book_id: str, chapter_id: str,
                      segment_size: int = 600) -> SegmentPlayer:
        return SegmentPlayer(full_text, book_id, chapter_id, segment_size)

"""Chunk-level progress for long chapters.
Can be serialized for interrupt recovery.
"""
import json
from typing import Dict, Any, List

class ProgressStore:
    def __init__(self):
        self.chunks: List[Dict[str, Any]] = []

    def add_chunk(self, book_id: str, chapter_id: str, chunk_id: int,
                  start_offset: int, end_offset: int, sha256: str):
        self.chunks.append({
            "book_id": book_id,
            "chapter_id": chapter_id,
            "chunk_id": chunk_id,
            "start_offset": start_offset,
            "end_offset": end_offset,
            "sha256": sha256,
            "playback_status": "PENDING"
        })

    def update_status(self, chunk_id: int, status: str):
        for c in self.chunks:
            if c["chunk_id"] == chunk_id:
                c["playback_status"] = status
                return True
        return False

    def resume_point(self) -> int:
        for c in self.chunks:
            if c["playback_status"] != "PLAYBACK_COMPLETED":
                return c["chunk_id"]
        return -1

    def save(self) -> str:
        return json.dumps(self.chunks, ensure_ascii=False)

    def load(self, data: str):
        self.chunks = json.loads(data)

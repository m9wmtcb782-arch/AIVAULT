"""Sequential segment player for full-chapter VERBATIM_READING.
Feeds one chunk at a time to TTS Adapter.
Playback completion is per-segment and must be confirmed externally.
"""
from typing import Dict, Any, Optional
from verbatim import VerbatimReader
from tts_adapter import TTSAdapter, TTSState
from progress_store import ProgressStore

class SegmentPlayer:
    def __init__(self, full_text: str, book_id: str, chapter_id: str, segment_size: int = 600):
        self.reader = VerbatimReader(full_text, segment_size)
        self.tts = TTSAdapter()
        self.progress = ProgressStore()
        self.book_id = book_id
        self.chapter_id = chapter_id
        self.current = 0
        self._index_chunks()

    def _index_chunks(self):
        for seg in self.reader.segments:
            self.progress.add_chunk(
                self.book_id, self.chapter_id, seg.index,
                seg.char_start, seg.char_end, seg.checksum
            )

    def prepare_current(self) -> Dict[str, Any]:
        if self.current >= len(self.reader.segments):
            return {"done": True, "state": "ALL_SEGMENTS_PREPARED"}
        seg = self.reader.segments[self.current]
        prep = self.tts.prepare(seg.text)
        return {
            "chunk_id": seg.index,
            "text": seg.text,
            "checksum": seg.checksum,
            "tts_state": prep["state"],
            "done": False
        }

    def mark_tts_ready(self):
        return self.tts.synthesize(self.reader.segments[self.current].text)

    def mark_playing(self):
        return self.tts.mark_playing()

    def confirm_segment_completed(self) -> Dict[str, Any]:
        """Only call after actual audio playback ends."""
        result = self.tts.mark_completed()
        self.progress.update_status(self.current, "PLAYBACK_COMPLETED")
        self.current += 1
        return {
            "tts_state": result["state"],
            "next_chunk": self.current,
            "resume_point": self.progress.resume_point(),
            "progress": self.reader.progress()
        }

    def jump_to(self, chunk_id: int) -> bool:
        if 0 <= chunk_id < len(self.reader.segments):
            self.current = chunk_id
            self.tts.state = TTSState.TEXT_READY
            return True
        return False

    def integrity(self) -> Dict[str, Any]:
        return self.reader.verify_integrity()

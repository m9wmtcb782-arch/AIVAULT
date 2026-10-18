"""VERBATIM_READING mode for AIVAULT Dark Star full-chapter reader.
Strictly no LLM generation, summarization, rewriting, or deletion of original text.
Segments preserve exact character ranges and checksums.
"""
import hashlib
from typing import List, Dict, Any, Optional

class VerbatimSegment:
    def __init__(self, index: int, text: str, char_start: int, char_end: int):
        self.index = index
        self.text = text
        self.char_start = char_start
        self.char_end = char_end
        self.checksum = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
        self.playback_status = "PENDING"  # PENDING / PLAYING / PAUSED / COMPLETED / FAILED

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "char_start": self.char_start,
            "char_end": self.char_end,
            "checksum": self.checksum,
            "text_length": len(self.text),
            "playback_status": self.playback_status
        }

class VerbatimReader:
    def __init__(self, full_text: str, segment_size: int = 800):
        if not full_text:
            raise ValueError("empty chapter text")
        self.full_text = full_text
        self.full_checksum = hashlib.sha256(full_text.encode("utf-8")).hexdigest()[:16]
        self.segments: List[VerbatimSegment] = []
        self._split(segment_size)

    def _split(self, size: int):
        pos = 0
        idx = 0
        while pos < len(self.full_text):
            end = min(pos + size, len(self.full_text))
            # Prefer break at sentence end if possible within window
            window = self.full_text[pos:end]
            break_at = max(
                window.rfind("。"),
                window.rfind("！"),
                window.rfind("？"),
                window.rfind("."),
                window.rfind("!"),
                window.rfind("?")
            )
            if break_at > size // 2:
                end = pos + break_at + 1
            seg_text = self.full_text[pos:end]
            self.segments.append(VerbatimSegment(idx, seg_text, pos, end))
            pos = end
            idx += 1

    def verify_integrity(self) -> Dict[str, Any]:
        reconstructed = "".join(s.text for s in self.segments)
        match = reconstructed == self.full_text
        return {
            "ok": match,
            "full_checksum": self.full_checksum,
            "reconstructed_checksum": hashlib.sha256(reconstructed.encode("utf-8")).hexdigest()[:16],
            "segment_count": len(self.segments),
            "total_chars": len(self.full_text),
            "error": None if match else "TEXT_INTEGRITY_MISMATCH"
        }

    def get_segment(self, index: int) -> Optional[VerbatimSegment]:
        if 0 <= index < len(self.segments):
            return self.segments[index]
        return None

    def mark_playback(self, index: int, status: str):
        seg = self.get_segment(index)
        if seg:
            seg.playback_status = status

    def progress(self) -> Dict[str, Any]:
        completed = sum(1 for s in self.segments if s.playback_status == "COMPLETED")
        return {
            "completed_segments": completed,
            "total_segments": len(self.segments),
            "ratio": completed / len(self.segments) if self.segments else 0
        }

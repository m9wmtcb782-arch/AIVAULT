"""Playback state contract for VERBATIM_READING.
Actual TTS completion must be verified separately.
Sending text to TTS does NOT equal playback finished.
"""
from typing import Dict, Any, Optional

class PlaybackController:
    def __init__(self, reader):
        self.reader = reader
        self.current_index = 0
        self.paused = False
        self.interrupted = False

    def next_segment(self) -> Optional[Dict[str, Any]]:
        if self.paused or self.interrupted:
            return None
        if self.current_index >= len(self.reader.segments):
            return None
        seg = self.reader.segments[self.current_index]
        self.reader.mark_playback(self.current_index, "PLAYING")
        return seg.to_dict() | {"text": seg.text}

    def mark_completed(self, index: int):
        """Must be called only after actual audio playback finishes."""
        self.reader.mark_playback(index, "COMPLETED")
        if index == self.current_index:
            self.current_index += 1

    def pause(self):
        self.paused = True
        if self.current_index < len(self.reader.segments):
            self.reader.mark_playback(self.current_index, "PAUSED")

    def resume(self):
        self.paused = False
        self.interrupted = False

    def interrupt(self):
        self.interrupted = True

    def jump_to(self, index: int):
        if 0 <= index < len(self.reader.segments):
            self.current_index = index
            self.paused = False
            self.interrupted = False
            return True
        return False

    def status(self) -> Dict[str, Any]:
        return {
            "current_index": self.current_index,
            "paused": self.paused,
            "interrupted": self.interrupted,
            "progress": self.reader.progress()
        }

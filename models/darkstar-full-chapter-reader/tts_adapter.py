"""Replaceable TTS Adapter.
States must be set only by confirmed events.
TEXT_READY ≠ TTS_READY ≠ PLAYING ≠ PLAYBACK_COMPLETED.
No paid API calls. Future self-hosted TTS can replace the engine.
"""
from typing import Dict, Any, Optional, Callable

class TTSState:
    TEXT_READY = "TEXT_READY"
    TTS_READY = "TTS_READY"
    PLAYING = "PLAYING"
    PAUSED = "PAUSED"
    PLAYBACK_COMPLETED = "PLAYBACK_COMPLETED"
    ERROR = "ERROR"

class TTSAdapter:
    def __init__(self, synthesize_fn: Optional[Callable] = None):
        self.synthesize_fn = synthesize_fn or (lambda text: None)  # stub, no external call
        self.state = TTSState.TEXT_READY
        self.last_error = None

    def prepare(self, text: str) -> Dict[str, Any]:
        if not text:
            self.state = TTSState.ERROR
            self.last_error = "empty_text"
            return {"state": self.state, "error": self.last_error}
        self.state = TTSState.TEXT_READY
        return {"state": self.state, "chars": len(text)}

    def synthesize(self, text: str) -> Dict[str, Any]:
        """Produce audio bytes or reference. Does not mark playback complete."""
        try:
            audio = self.synthesize_fn(text)
            self.state = TTSState.TTS_READY
            return {"state": self.state, "audio_ready": audio is not None}
        except Exception as e:
            self.state = TTSState.ERROR
            self.last_error = str(e)
            return {"state": self.state, "error": self.last_error}

    def mark_playing(self):
        if self.state == TTSState.TTS_READY:
            self.state = TTSState.PLAYING
        return {"state": self.state}

    def mark_paused(self):
        if self.state == TTSState.PLAYING:
            self.state = TTSState.PAUSED
        return {"state": self.state}

    def mark_completed(self):
        """Only after external confirmation that audio finished."""
        if self.state in (TTSState.PLAYING, TTSState.PAUSED):
            self.state = TTSState.PLAYBACK_COMPLETED
        return {"state": self.state}

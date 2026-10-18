"""Voice TTS backend for VERBATIM_READING.
Uses connected Voice service (non-Grok/Kling/Gemini).
Generates MP3 per segment. Does not mark PLAYBACK_COMPLETED until external confirmation.
"""
import os
from typing import Optional

def synthesize_to_mp3(text: str, dest_path: str, voice: Optional[str] = None, language: str = "zh-TW") -> str:
    """
    Call site must invoke the connected voice_generate_speech tool externally.
    This module only defines the contract and local path handling.
    Returns dest_path on success expectation.
    """
    if not text or not text.strip():
        raise ValueError("empty text for TTS")
    if not dest_path.endswith(".mp3"):
        raise ValueError("dest_path must end with .mp3")
    # Actual synthesis is performed by the caller via connected tool.
    # This function records the intended output path.
    return dest_path

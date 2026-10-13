"""Local TTS backend using an explicitly installed Piper voice.
No download, no cloud fallback. Piper executable and voice model must exist locally.
This adapter returns PCM16 mono and rejects incompatible model sample rates.
"""
import os
import subprocess
import wave
import shutil
import tempfile
import math
import numpy as np
from scipy.signal import resample_poly
from pathlib import Path

class LocalPiperTTS:
    def __init__(self, executable=None, model_path=None):
        self.executable = executable or os.getenv("PIPER_EXECUTABLE", "piper")
        self.model_path = model_path or os.getenv("PIPER_MODEL_PATH", "")
        self.timeout = float(os.getenv("PIPER_TIMEOUT_SECONDS", "30"))
        if not math.isfinite(self.timeout) or not 0 < self.timeout <= 300:
            raise ValueError("INVALID_PIPER_TIMEOUT")

    @property
    def available(self):
        return bool(self.model_path and os.path.isfile(self.model_path) and shutil.which(self.executable))

    def synthesize(self, text, sample_rate=24000):
        if not self.available:
            raise RuntimeError("TTS_MODEL_UNAVAILABLE")
        if not isinstance(text, str) or not text.strip() or len(text) > 2000:
            raise ValueError("INVALID_TTS_TEXT")
        if sample_rate != 24000:
            raise ValueError("UNSUPPORTED_SAMPLE_RATE")
        with tempfile.TemporaryDirectory(prefix="aivault-piper-") as directory:
            output_path = Path(directory) / "speech.wav"
            result = subprocess.run(
                [self.executable, "--model", self.model_path, "--output_file", str(output_path)],
                input=text.encode("utf-8"), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                timeout=self.timeout, check=False,
            )
            if result.returncode or not output_path.is_file():
                raise RuntimeError("TTS_INFERENCE_FAILED")
            try:
                with wave.open(str(output_path), "rb") as wav:
                    if wav.getnchannels() != 1 or wav.getsampwidth() != 2:
                        raise ValueError("INVALID_TTS_WAV_FORMAT")
                    if wav.getcomptype() != "NONE":
                        raise ValueError("INVALID_TTS_WAV_FORMAT")
                    original_rate = wav.getframerate()
                    frames = wav.getnframes()
                    # Reject excessive model output before reading/allocating audio.
                    if frames <= 0 or frames > original_rate * 60:
                        raise ValueError("TTS_AUDIO_TOO_LARGE_OR_EMPTY")
                    pcm = wav.readframes(frames)
            except (wave.Error, EOFError) as exc:
                raise ValueError("INVALID_TTS_WAV") from exc
        if original_rate != sample_rate:
            if original_rate not in (22050, 24000):
                raise ValueError("TTS_SAMPLE_RATE_MISMATCH")
            samples = np.frombuffer(pcm, dtype="<i2").astype(np.float64)
            divisor = math.gcd(original_rate, sample_rate)
            converted = resample_poly(samples, sample_rate // divisor, original_rate // divisor)
            pcm = np.clip(np.rint(converted), -32768, 32767).astype("<i2").tobytes()
        if not pcm:
            raise ValueError("EMPTY_TTS_AUDIO")
        return pcm

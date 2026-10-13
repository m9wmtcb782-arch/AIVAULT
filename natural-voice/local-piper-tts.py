"""Local TTS backend using an explicitly installed Piper voice.
No download, no cloud fallback. Piper executable and voice model must exist locally.
This adapter returns PCM16 24kHz mono; resampling is performed with audioop where available.
"""
import os
import subprocess
import wave
import io
import shutil

class LocalPiperTTS:
    def __init__(self, executable=None, model_path=None):
        self.executable = executable or os.getenv("PIPER_EXECUTABLE", "piper")
        self.model_path = model_path or os.getenv("PIPER_MODEL_PATH", "")
        self.timeout = float(os.getenv("PIPER_TIMEOUT_SECONDS", "30"))

    @property
    def available(self):
        return bool(self.model_path and os.path.isfile(self.model_path) and shutil.which(self.executable))

    def synthesize(self, text, sample_rate=24000):
        if not self.available:
            raise RuntimeError("TTS_MODEL_UNAVAILABLE")
        if sample_rate != 24000:
            raise ValueError("UNSUPPORTED_SAMPLE_RATE")
        result = subprocess.run(
            [self.executable, "--model", self.model_path, "--output_file", "-"],
            input=text.encode("utf-8"), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=self.timeout, check=False,
        )
        if result.returncode:
            raise RuntimeError("TTS_INFERENCE_FAILED")
        try:
            with wave.open(io.BytesIO(result.stdout), "rb") as wav:
                if wav.getnchannels() != 1 or wav.getsampwidth() != 2:
                    raise ValueError("INVALID_TTS_WAV_FORMAT")
                original_rate = wav.getframerate()
                pcm = wav.readframes(wav.getnframes())
        except (wave.Error, EOFError) as exc:
            raise ValueError("INVALID_TTS_WAV") from exc
        if original_rate != sample_rate:
            # Explicitly reject incompatible sample rate rather than mislabel PCM.
            # A production resampler can be added once model voice rate is known.
            raise ValueError("TTS_SAMPLE_RATE_MISMATCH")
        if not pcm:
            raise ValueError("EMPTY_TTS_AUDIO")
        return pcm

"""Self-hosted AIVAULT speech worker, optional local faster-whisper ASR.
No cloud API, no model downloads at request time, no TTS placeholder output.
Run: AIVAULT_VOICE_TOKEN=... ASR_MODEL_PATH=/models/whisper uvicorn worker:app --host 127.0.0.1 --port 8765
Requires fastapi, uvicorn, faster-whisper installed separately.
"""
import base64
import binascii
import hmac
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

TOKEN = os.getenv("AIVAULT_VOICE_TOKEN", "")
ASR_MODEL_PATH = os.getenv("ASR_MODEL_PATH", "")
_model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model
    if ASR_MODEL_PATH:
        from faster_whisper import WhisperModel
        _model = WhisperModel(ASR_MODEL_PATH, device=os.getenv("ASR_DEVICE", "cpu"),
                              compute_type=os.getenv("ASR_COMPUTE_TYPE", "int8"),
                              local_files_only=True)
    yield

app = FastAPI(title="AIVAULT Local Voice Worker", lifespan=lifespan)

class ASRRequest(BaseModel):
    audio_pcm16_base64: str = Field(min_length=4, max_length=16000000)
    sample_rate: int = 16000
    language: str = "zh-TW"

class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    voice_id: str = Field(min_length=1, max_length=64)
    language: str = "zh-TW"
    format: str = "pcm_s16le"
    sample_rate: int = 24000

def authorize(authorization: str | None):
    if not TOKEN:
        raise HTTPException(status_code=503, detail="VOICE_TOKEN_NOT_CONFIGURED")
    if not authorization or not hmac.compare_digest(authorization, "Bearer " + TOKEN):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")

@app.get("/health")
def health():
    return {"service":"aivault-voice-worker","asr_loaded":_model is not None,
            "tts_loaded":False}

@app.post("/v1/asr")
def asr(request: ASRRequest, authorization: str | None = Header(default=None)):
    authorize(authorization)
    if request.sample_rate != 16000 or request.language != "zh-TW":
        raise HTTPException(status_code=422, detail="UNSUPPORTED_AUDIO_SETTINGS")
    if _model is None:
        raise HTTPException(status_code=503, detail="ASR_MODEL_UNAVAILABLE")
    try:
        raw = base64.b64decode(request.audio_pcm16_base64, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(status_code=422, detail="INVALID_BASE64")
    if not raw or len(raw) % 2:
        raise HTTPException(status_code=422, detail="INVALID_PCM16")
    import numpy as np
    audio = np.frombuffer(raw, dtype="<i2").astype("float32") / 32768.0
    segments, _ = _model.transcribe(audio, language="zh", vad_filter=True)
    return {"text":"".join(segment.text for segment in segments)}

@app.post("/v1/tts")
def tts(request: TTSRequest, authorization: str | None = Header(default=None)):
    authorize(authorization)
    raise HTTPException(status_code=503, detail="TTS_MODEL_NOT_CONNECTED")

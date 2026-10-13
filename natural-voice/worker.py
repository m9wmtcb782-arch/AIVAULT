"""Self-hosted AIVAULT speech worker. No paid API or automatic model downloads."""
import base64
import binascii
import hmac
import importlib.util
import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi.responses import StreamingResponse
from tts_stream import audio_events

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

TOKEN = os.getenv("AIVAULT_VOICE_TOKEN", "")
ASR_MODEL_PATH = os.getenv("ASR_MODEL_PATH", "")
_model = None
_tts = None

def load_local_tts():
    spec = importlib.util.spec_from_file_location("aivault_local_piper", Path(__file__).with_name("local-piper-tts.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.LocalPiperTTS()

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model, _tts
    _tts = load_local_tts()
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
            "tts_loaded":bool(_tts and _tts.available)}

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
    if request.language != "zh-TW" or request.format != "pcm_s16le" or request.sample_rate != 24000:
        raise HTTPException(status_code=422, detail="UNSUPPORTED_AUDIO_SETTINGS")
    if _tts is None or not _tts.available:
        raise HTTPException(status_code=503, detail="TTS_MODEL_UNAVAILABLE")
    try:
        pcm = _tts.synthesize(request.text, sample_rate=request.sample_rate)
    except (RuntimeError, ValueError, TimeoutError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    # Prototype adapter expects frames array. JSON response is not low-latency streaming.
    frame_bytes = 4800  # 100ms at 24kHz, mono, signed 16-bit
    return {"frames":[base64.b64encode(pcm[i:i+frame_bytes]).decode("ascii")
                      for i in range(0,len(pcm),frame_bytes)]}

@app.post("/v1/tts/stream")
def tts_stream(request: TTSRequest, authorization: str | None = Header(default=None)):
    authorize(authorization)
    if request.language != "zh-TW" or request.format != "pcm_s16le" or request.sample_rate != 24000:
        raise HTTPException(status_code=422, detail="UNSUPPORTED_AUDIO_SETTINGS")
    if _tts is None or not _tts.available:
        raise HTTPException(status_code=503, detail="TTS_MODEL_UNAVAILABLE")
    return StreamingResponse(
        audio_events(request.text, _tts.synthesize, sample_rate=request.sample_rate),
        media_type="application/x-ndjson",
        headers={"Cache-Control":"no-store", "X-Accel-Buffering":"no"}
    )

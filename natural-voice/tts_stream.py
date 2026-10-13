"""Helpers for offline incremental speech frames. No model dependency."""
import base64
import json
import re

def clauses(text, max_chars=120):
    if not isinstance(text, str) or not text.strip():
        raise ValueError("EMPTY_TEXT")
    if max_chars < 8:
        raise ValueError("INVALID_MAX_CHARS")
    for phrase in re.findall(r"[^，。！？!?；;\n]+[，。！？!?；;\n]?", text):
        for offset in range(0, len(phrase), max_chars):
            piece = phrase[offset:offset+max_chars]
            if piece.strip():
                yield piece

def clauses_with_offsets(text, max_chars=120):
    """Yield each spoken clause with exact source character offsets."""
    if not isinstance(text, str) or not text.strip():
        raise ValueError("EMPTY_TEXT")
    if max_chars < 8:
        raise ValueError("INVALID_MAX_CHARS")
    for match in re.finditer(r"[^，。！？!?；;\n]+[，。！？!?；;\n]?", text):
        phrase = match.group()
        for offset in range(0, len(phrase), max_chars):
            piece = phrase[offset:offset+max_chars]
            if piece.strip():
                start = match.start()+offset
                yield piece, start, start+len(piece)

def audio_events(text, synthesize, sample_rate=24000, frame_bytes=4800):
    """Yield NDJSON event lines as soon as each clause is synthesized."""
    if not isinstance(frame_bytes,int) or frame_bytes<2 or frame_bytes%2:
        raise ValueError("INVALID_FRAME_BYTES")
    sequence=0
    try:
        for clause, char_start, char_end in clauses_with_offsets(text):
            pcm=synthesize(clause, sample_rate=sample_rate)
            if not isinstance(pcm, bytes) or not pcm or len(pcm)%2:
                raise ValueError("INVALID_PCM")
            for offset in range(0,len(pcm),frame_bytes):
                frame=pcm[offset:offset+frame_bytes]
                yield json.dumps({"type":"audio","sequence":sequence,
                                  "char_start":char_start,"char_end":char_end,
                                  "sample_rate":sample_rate,
                                  "pcm_base64":base64.b64encode(frame).decode("ascii")})+"\n"
                sequence+=1
    except Exception:
        yield json.dumps({"type":"error","code":"TTS_INFERENCE_FAILED"})+"\n"
        return
    yield json.dumps({"type":"complete","frames":sequence})+"\n"

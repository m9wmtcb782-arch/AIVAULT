"""Three independent modes sharing source text only.
VERBATIM_READING does not affect KNOWLEDGE_RETRIEVAL or ACADEMIC_ANALYSIS.
"""
from enum import Enum
from typing import Dict, Any

class ReadingMode(str, Enum):
    VERBATIM_READING = "VERBATIM_READING"
    KNOWLEDGE_RETRIEVAL = "KNOWLEDGE_RETRIEVAL"
    ACADEMIC_ANALYSIS = "ACADEMIC_ANALYSIS"

def route(mode: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Explicit separation. No shared mutable state."""
    if mode == ReadingMode.VERBATIM_READING:
        return {"mode": mode, "handler": "verbatim_pipeline", "payload": payload}
    if mode == ReadingMode.KNOWLEDGE_RETRIEVAL:
        return {"mode": mode, "handler": "existing_search_untouched", "payload": payload}
    if mode == ReadingMode.ACADEMIC_ANALYSIS:
        return {"mode": mode, "handler": "existing_report_untouched", "payload": payload}
    return {"mode": mode, "error": "unknown_mode"}

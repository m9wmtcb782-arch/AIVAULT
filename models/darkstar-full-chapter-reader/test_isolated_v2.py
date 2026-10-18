"""Extended isolated tests. No live API, no TTS engine, no paid calls.
"""
import json
from modes import route, ReadingMode
from tts_adapter import TTSAdapter, TTSState
from progress_store import ProgressStore
from source_integrity import check_pages
from verbatim import VerbatimReader

def run():
    results = {}

    # Mode separation
    r1 = route(ReadingMode.VERBATIM_READING, {"chapter": 3})
    r2 = route(ReadingMode.KNOWLEDGE_RETRIEVAL, {"q": "某概念"})
    results["modes_separated"] = r1["handler"] != r2["handler"]

    # TTS state machine
    tts = TTSAdapter()
    tts.prepare("測試原文")
    results["text_ready"] = tts.state == TTSState.TEXT_READY
    tts.synthesize("測試原文")
    results["tts_ready_not_completed"] = tts.state == TTSState.TTS_READY
    tts.mark_playing()
    results["playing"] = tts.state == TTSState.PLAYING
    tts.mark_completed()
    results["completed_only_after_mark"] = tts.state == TTSState.PLAYBACK_COMPLETED

    # Progress store
    ps = ProgressStore()
    ps.add_chunk("b1", "c3", 0, 0, 100, "abc")
    ps.add_chunk("b1", "c3", 1, 100, 200, "def")
    ps.update_status(0, "PLAYBACK_COMPLETED")
    results["resume_point"] = ps.resume_point() == 1
    saved = ps.save()
    ps2 = ProgressStore()
    ps2.load(saved)
    results["progress_restore"] = len(ps2.chunks) == 2

    # Source integrity
    good = check_pages([1, 2, 3], ["a", "b", "c"])
    bad = check_pages([1, 3], ["a", "c"])
    results["integrity_good"] = good["ok"]
    results["integrity_detects_gap"] = not bad["ok"]

    # Verbatim still intact
    vr = VerbatimReader("第一段。第二段。", 10)
    results["verbatim_integrity"] = vr.verify_integrity()["ok"]

    print(json.dumps(results, ensure_ascii=False, indent=2))
    return all(results.values())

if __name__ == "__main__":
    print("ALL_PASS" if run() else "SOME_FAILED")

"""Isolated tests for VERBATIM_READING integrity and segmentation.
No live API, no TTS, no paid calls.
"""
import json
from reader import FullChapterReader
from verbatim import VerbatimReader
from playback_contract import PlaybackController

def mock_fetch(action, payload):
    if action == "toc":
        return {"toc": [
            {"title": "第一章 測試", "start_page": 1},
            {"title": "第二章", "start_page": 4}
        ]}
    if action == "book":
        p = payload["page_number"]
        texts = {
            1: "第一頁正文。這是原文第一段。",
            2: "第二頁繼續。標點與特殊字元：「」、——。",
            3: "第三頁結尾。章節結束。"
        }
        return {"page": {"content": texts.get(p, "")}}
    return {}

def run_tests():
    results = {}
    # 1. Full chapter assembly
    r = FullChapterReader(mock_fetch)
    ch = r.read_chapter_full("demo", 1)
    results["chapter_ok"] = ch["ok"] and ch["page_count"] == 3
    full = ch["full_text"]

    # 2. Verbatim split + integrity
    vr = VerbatimReader(full, segment_size=40)
    integ = vr.verify_integrity()
    results["integrity_ok"] = integ["ok"]
    results["no_loss"] = integ["total_chars"] == len(full)

    # 3. Playback contract (does not claim audio finished)
    ctrl = PlaybackController(vr)
    seg0 = ctrl.next_segment()
    results["segment_has_text"] = bool(seg0 and seg0.get("text"))
    results["playback_not_auto_complete"] = seg0["playback_status"] == "PLAYING"
    ctrl.mark_completed(0)
    results["progress_after_one"] = ctrl.status()["progress"]["completed_segments"] == 1

    # 4. Pause / resume / jump
    ctrl.pause()
    results["paused_blocks_next"] = ctrl.next_segment() is None
    ctrl.resume()
    ctrl.jump_to(1)
    results["jump_ok"] = ctrl.current_index == 1

    print(json.dumps({"tests": results, "integrity": integ}, ensure_ascii=False, indent=2))
    return all(results.values())

if __name__ == "__main__":
    ok = run_tests()
    print("ALL_PASS" if ok else "SOME_FAILED")

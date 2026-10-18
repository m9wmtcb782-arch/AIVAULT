"""Isolated playback contract test. No live TTS call.
"""
import json
from segment_player import SegmentPlayer

def run():
    text = "第一段原文。第二段繼續。第三段結束。"
    player = SegmentPlayer(text, "book-demo", "ch-1", segment_size=12)
    results = {}
    results["integrity"] = player.integrity()["ok"]
    prep = player.prepare_current()
    results["first_chunk"] = prep["chunk_id"] == 0 and "text" in prep
    player.mark_tts_ready()
    results["not_completed_yet"] = player.tts.state != "PLAYBACK_COMPLETED"
    player.mark_playing()
    conf = player.confirm_segment_completed()
    results["advanced"] = conf["next_chunk"] == 1
    results["resume_ok"] = conf["resume_point"] == 1 or conf["resume_point"] == -1
    player.jump_to(0)
    results["jump"] = player.current == 0
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return all(results.values())

if __name__ == "__main__":
    print("ALL_PASS" if run() else "SOME_FAILED")

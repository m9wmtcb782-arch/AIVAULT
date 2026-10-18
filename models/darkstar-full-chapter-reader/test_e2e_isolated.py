"""End-to-end isolation test.
Text integrity, mock playback flow, pause/resume/jump/recovery.
Does not treat TTS synthesis as playback completion.
"""
import json
from orchestrator import VerbatimOrchestrator
from local_test_book import mock_fetch
from tts_adapter import TTSState

def run():
    results = {}
    orch = VerbatimOrchestrator(mock_fetch)

    # 1. Load full chapter
    loaded = orch.load_chapter("local-test", 1)
    results["chapter_loaded"] = loaded.get("ok") is True
    full_text = loaded["full_text"]
    results["has_text"] = len(full_text) > 100

    # 2. Create player and integrity
    player = orch.create_player(full_text, "local-test", "ch-1", segment_size=80)
    integ = player.integrity()
    results["text_integrity_pass"] = integ["ok"] is True
    results["no_loss_no_dup"] = integ["total_chars"] == len(full_text)

    # 3. Sequential mock playback (do not mark complete on synthesize)
    completed = 0
    total = len(player.reader.segments)
    while player.current < total:
        prep = player.prepare_current()
        if prep.get("done"):
            break
        # Simulate TTS synthesize success but do NOT complete
        synth = player.mark_tts_ready()
        if player.tts.state == TTSState.PLAYBACK_COMPLETED:
            results["error_auto_complete"] = True
            break
        player.mark_playing()
        # Simulate actual playback end
        conf = player.confirm_segment_completed()
        completed += 1

    results["all_segments_processed"] = completed == total
    results["no_auto_complete_on_tts"] = player.tts.state != TTSState.PLAYBACK_COMPLETED or completed == total
    results["resume_point_after_all"] = player.progress.resume_point() == -1

    # 4. Pause / resume / jump / recovery
    player.jump_to(1)
    results["jump_ok"] = player.current == 1
    player.tts.state = TTSState.PLAYING
    player.tts.mark_paused()
    results["paused"] = player.tts.state == TTSState.PAUSED
    player.jump_to(0)
    results["recovery_jump"] = player.current == 0

    # 5. Cross-page content present
    results["cross_page_present"] = "跨頁段落從這裡繼續" in full_text
    results["special_chars_present"] = "「」" in full_text

    print(json.dumps(results, ensure_ascii=False, indent=2))
    return all(v is True for v in results.values())

if __name__ == "__main__":
    print("ALL_PASS" if run() else "SOME_FAILED")

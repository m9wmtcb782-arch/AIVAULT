# lab_video — work produced from video learning

## scene_detector.py (vc4, commit 88c586b)
Scene-change timecode detector (numpy colour-histogram L1 distance, no ML). Off switch: `SCENE_DETECTOR_OFF=1`.

Verification log:
| Date (Asia/Taipei) | Verifier | Input | Result |
|---|---|---|---|
| 2026-10-18 09:2x | Grok Bot executor (author; clean `env -i` process) | BBB 360p, 0–120 s | precision 0.857, recall 1.0, PASS |
| 2026-10-18 09:4x | **Grok Bot (teammate agent 8bb7edd6, independent re-run, own BBB 480p download)** | BBB 480p, 0–120 s | precision 0.857, recall 1.0, **PASS — independently verified** |

Ground truth = ffmpeg `scdet` (different algorithm). The 3 extra detections (0.08, 3.9, 4.58 s) are the opening title fade.

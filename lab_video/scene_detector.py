#!/usr/bin/env python3
"""vc3 lab work from video learning: scene-change timecode detector (no ML, free).
Learned from the video center's ffmpeg scene-cut keyframes: decode once to tiny RGB frames,
compare consecutive colour histograms (L1 distance), flag a cut when the distance is both
above an absolute floor and well above the local median (so slow pans don't trigger).
Usage: scene_detector.py VIDEO [--start S] [--dur D] [--json]
Off switch: env SCENE_DETECTOR_OFF=1 (prints nothing, exits 0)."""
import sys, os, json, subprocess, argparse
import numpy as np
W, H = 64, 36
def frames(path, start, dur):
    cmd = ["ffmpeg", "-loglevel", "error", "-ss", str(start), "-t", str(dur), "-i", path,
           "-vf", f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    fps = eval(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                        "stream=r_frame_rate", "-of", "csv=p=0", path]).decode().strip())
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3), fps
def hist(f):
    q = (f // 32).reshape(-1, 3).astype(np.int32)
    return np.bincount(q[:, 0] * 64 + q[:, 1] * 8 + q[:, 2], minlength=512) / q.shape[0]
def detect(path, start=0.0, dur=120.0, floor=0.5, ratio=4.0, min_gap=0.5):
    fr, fps = frames(path, start, dur)
    hs = np.array([hist(f) for f in fr])
    d = np.abs(np.diff(hs, axis=0)).sum(1)  # 0..2
    cuts, last = [], -1e9
    for i, v in enumerate(d):
        lo, hi = max(0, i - 12), min(len(d), i + 13)
        med = np.median(np.r_[d[lo:i], d[i + 1:hi]]) if hi - lo > 1 else 0
        t = (i + 1) / fps
        if v > floor and v > ratio * (med + 0.02) and t - last >= min_gap:
            cuts.append(round(start + t, 2)); last = t
    return cuts
if __name__ == "__main__":
    if os.environ.get("SCENE_DETECTOR_OFF") == "1": sys.exit(0)
    a = argparse.ArgumentParser(); a.add_argument("video"); a.add_argument("--start", type=float, default=0)
    a.add_argument("--dur", type=float, default=120); a.add_argument("--json", action="store_true"); o = a.parse_args()
    c = detect(o.video, o.start, o.dur)
    print(json.dumps(c) if o.json else "\n".join(f"{t:8.2f}s" for t in c))

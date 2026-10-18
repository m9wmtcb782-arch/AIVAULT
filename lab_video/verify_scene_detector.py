#!/usr/bin/env python3
"""Independent verifier for scene_detector.py. Run in a clean process; should be re-run by a different agent.
Ground truth = ffmpeg's own scdet filter (a different algorithm, SAD-based) at threshold 10, on the same clip.
Pass criterion: precision >= 0.8 and recall >= 0.8 with +-0.5 s tolerance, plus no cut detected on a
synthetic static clip and exactly one cut on a synthetic two-colour clip."""
import subprocess, json, re, sys, tempfile, os
V = sys.argv[1]; S, D = 0, 120; TOL = 0.5
det = json.loads(subprocess.check_output([sys.executable, os.path.join(os.path.dirname(__file__), "scene_detector.py"), V, "--start", str(S), "--dur", str(D), "--json"]))
err = subprocess.run(["ffmpeg", "-hide_banner", "-ss", str(S), "-t", str(D), "-i", V, "-vf", "scdet=threshold=10:sc_pass=0", "-an", "-f", "null", "-"], capture_output=True, text=True).stderr
gt = [round(float(x), 2) for x in re.findall(r"lavfi\.scd\.time:\s*([0-9.]+)", err)]
tp = sum(any(abs(d - g) <= TOL for g in gt) for d in det); hit = sum(any(abs(d - g) <= TOL for d in det) for g in gt)
P = tp / len(det) if det else 0; R = hit / len(gt) if gt else 0
with tempfile.TemporaryDirectory() as t:
    st = os.path.join(t, "s.mp4"); two = os.path.join(t, "t.mp4")
    subprocess.check_call(["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=gray:s=320x180:d=4:r=24", st])
    subprocess.check_call(["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=red:s=320x180:d=2:r=24", "-f", "lavfi", "-i", "color=c=blue:s=320x180:d=2:r=24", "-filter_complex", "[0][1]concat=n=2:v=1", two])
    syn_static = json.loads(subprocess.check_output([sys.executable, os.path.join(os.path.dirname(__file__), "scene_detector.py"), st, "--dur", "4", "--json"]))
    syn_two = json.loads(subprocess.check_output([sys.executable, os.path.join(os.path.dirname(__file__), "scene_detector.py"), two, "--dur", "4", "--json"]))
ok = P >= 0.8 and R >= 0.8 and syn_static == [] and len(syn_two) == 1 and abs(syn_two[0] - 2.0) <= 0.1
print(json.dumps({"detected": det, "ground_truth_scdet": gt, "precision": round(P, 3), "recall": round(R, 3), "synthetic_static": syn_static, "synthetic_two": syn_two, "PASS": ok}, ensure_ascii=False))
sys.exit(0 if ok else 1)

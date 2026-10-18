"""Feature extraction contract for ANN.
Input features (fixed order, float32):
0: task_capability_match (0/1)
1: worker_historical_success_rate (0-1)
2: worker_avg_duration_ms (normalized)
3: worker_recent_failures (normalized)
4: worker_current_load (0-1)
5-15: reserved / one-hot capability extensions
Only VERIFIED_REAL records may be used for formal training.
"""

FEATURE_DIM = 16

def extract_features(task: dict, worker: dict) -> list:
    match = 1.0 if task.get("capability") == worker.get("capability") else 0.0
    success = float(worker.get("success_rate", 0.5))
    duration = min(1.0, float(worker.get("avg_duration_ms", 1000)) / 10000.0)
    fails = min(1.0, float(worker.get("recent_failures", 0)) / 5.0)
    load = float(worker.get("load", 0.0))
    feats = [match, success, duration, fails, load] + [0.0] * (FEATURE_DIM - 5)
    return feats

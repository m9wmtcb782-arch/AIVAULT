"""Baseline comparison contract.
Fixed rule vs ANN score.
Real comparison requires VERIFIED_REAL samples.
"""

def fixed_rule_score(task, worker):
    return 1.0 if task.get("capability") == worker.get("capability") else 0.0

def compare(samples):
    # Placeholder: report only when real verified samples exist
    return {"status": "NOT_READY", "reason": "insufficient VERIFIED_REAL samples"}

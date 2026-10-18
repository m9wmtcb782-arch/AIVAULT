"""Convert common-memory records into training samples.
Requires credible verification evidence, not just a status string.
Synthetic and formal data are strictly isolated.
If evidence is missing, mark BLOCKED.
"""

FEATURE_DIM = 16

def _valid_features(feats):
    if not isinstance(feats, list) or len(feats) != FEATURE_DIM:
        return False
    return all(isinstance(x, (int, float)) and 0.0 <= float(x) <= 1.0 for x in feats)

def convert_record(record: dict) -> dict | None:
    # Must have independent verifier identity and evidence reference
    if not record.get("verifier_id") or not record.get("evidence_reference"):
        return {"status": "BLOCKED", "reason": "missing_verifier_evidence"}
    if record.get("verification_result") != "VERIFIED_REAL":
        return None
    if record.get("is_synthetic"):
        return None  # never mix synthetic into formal set
    feats = record.get("features", [])
    if not _valid_features(feats):
        return {"status": "BLOCKED", "reason": "invalid_features"}
    # Explicit success/failure label
    success = record.get("success")
    if success not in (True, False):
        return {"status": "BLOCKED", "reason": "undefined_label"}
    return {
        "task_id": record.get("task_id"),
        "worker_id": record.get("worker_id"),
        "features": feats,
        "label": 1.0 if success else 0.0,
        "source": "common_memory",
        "verifier_id": record.get("verifier_id"),
        "evidence_reference": record.get("evidence_reference"),
        "verified": True,
        "is_synthetic": False
    }

def filter_verified(records: list, seen: set = None) -> list:
    if seen is None:
        seen = set()
    out = []
    for r in records:
        key = (r.get("task_id"), r.get("worker_id"))
        if key in seen:
            continue  # dedup
        seen.add(key)
        converted = convert_record(r)
        if isinstance(converted, dict) and converted.get("verified"):
            out.append(converted)
    return out

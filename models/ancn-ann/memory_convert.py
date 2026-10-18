"""Convert common-memory records into training samples.
Only records with verification_result == VERIFIED_REAL are eligible.
Synthetic data must be explicitly tagged and never mixed into formal set.
"""

def convert_record(record: dict) -> dict | None:
    if record.get("verification_result") != "VERIFIED_REAL":
        return None
    return {
        "task_id": record.get("task_id"),
        "worker_id": record.get("worker_id"),
        "features": record.get("features", []),
        "label": 1.0 if record.get("success") else 0.0,
        "source": "common_memory",
        "verified": True
    }

def filter_verified(records: list) -> list:
    return [convert_record(r) for r in records if convert_record(r) is not None]

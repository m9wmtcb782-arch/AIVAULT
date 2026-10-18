"""Independent acceptance and rollback contract.
Formal training remains BLOCKED without credible VERIFIED_REAL data.
"""
from version import sha256_file, write_meta, load_meta

ACCEPTED = "ACCEPTED"
CANDIDATE = "CANDIDATE"
BLOCKED = "BLOCKED"

def accept_model(weight_path: str, meta_path: str, metrics: dict, data_source: str) -> dict:
    if data_source != "VERIFIED_REAL":
        meta = {"status": BLOCKED, "reason": "insufficient_credible_data", "data_source": data_source}
        write_meta(meta_path, meta)
        return meta
    sha = sha256_file(weight_path)
    meta = {
        "status": CANDIDATE,
        "sha256": sha,
        "metrics": metrics,
        "data_source": data_source,
        "version": metrics.get("version", "unknown")
    }
    # Real acceptance requires independent comparison better than FALLBACK_RULE
    # Currently always stays non-ACCEPTED until real data exists
    write_meta(meta_path, meta)
    return meta

def rollback_to_previous(meta_path: str, previous_meta_path: str):
    prev = load_meta(previous_meta_path)
    write_meta(meta_path, prev)
    return prev

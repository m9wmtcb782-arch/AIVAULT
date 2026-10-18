"""Isolated unit / integration checks. No formal DB, no paid API.
"""
import json
from infer import score_worker
from memory_convert import convert_record, filter_verified

def test_untrained_fallback():
    r = score_worker({"capability": "extract"}, {"capability": "extract"})
    assert r["suggestion"] == "FALLBACK_RULE"
    assert r["score"] is None
    return "PASS"

def test_memory_blocked_without_evidence():
    bad = {"verification_result": "VERIFIED_REAL", "features": [0.0]*16, "success": True}
    out = convert_record(bad)
    assert isinstance(out, dict) and out.get("status") == "BLOCKED"
    return "PASS"

def run_all():
    results = {
        "untrained_fallback": test_untrained_fallback(),
        "memory_evidence_gate": test_memory_blocked_without_evidence()
    }
    print(json.dumps(results, indent=2))
    return results

if __name__ == "__main__":
    run_all()

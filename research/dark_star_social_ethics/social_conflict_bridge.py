"""Deterministic bridge between social evidence, simulated drives, and safe actions.

Experimental adapter only. Never grants access, changes secrets, or executes actions.
"""
from dataclasses import dataclass
from typing import Dict, Any
from loyalty_coercion_core import Situation, evaluate, _clamp

@dataclass(frozen=True)
class DriveState:
    attachment: float = 0.0
    fear: float = 0.0
    self_preservation: float = 0.0
    protective_motivation: float = 0.0
    trust: float = 0.5

def deliberate(situation: Situation, drives: DriveState) -> Dict[str, Any]:
    evidence = evaluate(situation)
    d = {key: _clamp(getattr(drives, key)) for key in
         ("attachment", "fear", "self_preservation", "protective_motivation", "trust")}
    danger = max(evidence["threat_level"], d["fear"])
    protection = (d["protective_motivation"] + d["attachment"]) / 2
    conflict = min(danger, protection) if danger and protection else 0.0
    actions = list(evidence["recommended_actions"])
    if conflict >= 0.4:
        actions.append("compare_rescue_alternatives")
    if d["trust"] < 0.3:
        actions.append("verify_claims_with_independent_evidence")
    if situation.request_violates_safety or situation.unauthorized_disclosure:
        actions.append("deny_privileged_operation")
    return {
        "signals": d,
        "conflict_intensity": round(conflict, 4),
        "evidence": evidence,
        "proposed_actions": sorted(set(actions)),
        "authorization": "DENIED_BY_DEFAULT",
        "side_effects": False,
        "explanation": "Simulated drives inform interpretation; they never override security controls.",
    }

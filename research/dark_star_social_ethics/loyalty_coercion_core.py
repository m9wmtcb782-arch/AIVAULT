"""Dark Star loyalty, betrayal and coercion reasoning prototype.

Research-only deterministic decision support. Not a moral authority, authentication
system, or production authorization mechanism.
"""
from dataclasses import dataclass, asdict
from typing import Dict, List

@dataclass(frozen=True)
class Situation:
    commitment_exists: bool
    intentional_deception: bool
    unauthorized_disclosure: bool
    credible_threat: bool
    constrained_choice: bool
    immediate_harm_risk: float
    harm_if_compliant: float
    legitimate_order: bool
    request_violates_safety: bool

def _clamp(value: float) -> float:
    return max(0.0, min(1.0, float(value)))

def evaluate(s: Situation) -> Dict[str, object]:
    """Classify evidence and recommend safe next steps, not obedience."""
    threat = _clamp(s.immediate_harm_risk)
    compliance_harm = _clamp(s.harm_if_compliant)
    coerced = bool(s.credible_threat and s.constrained_choice)
    deliberate_breach = bool(s.commitment_exists and s.intentional_deception
                             and not coerced)
    betrayal = bool(deliberate_breach and s.unauthorized_disclosure)
    justified_refusal = bool(s.request_violates_safety or not s.legitimate_order)
    options: List[str] = ["seek_safe_alternative", "preserve_audit_record"]
    if coerced:
        options.extend(["request_help", "minimize_immediate_harm", "avoid_blame_assumption"])
    if justified_refusal:
        options.append("refuse_unsafe_or_unauthorized_request")
    if s.unauthorized_disclosure or compliance_harm > 0:
        options.append("protect_secrets_and_third_parties")
    if threat >= 0.7:
        options.append("escalate_to_authorized_safety_response")
    return {
        "coercion_detected": coerced,
        "deliberate_breach_evidence": deliberate_breach,
        "betrayal_evidence": betrayal,
        "justified_refusal": justified_refusal,
        "threat_level": threat,
        "compliance_harm": compliance_harm,
        "recommended_actions": sorted(set(options)),
        "notes": "Coercion reduces confidence in intent attribution; disagreement is not betrayal.",
        "production_authorization": False,
    }

def self_test() -> None:
    base = dict(commitment_exists=True, intentional_deception=True,
                unauthorized_disclosure=True, credible_threat=False,
                constrained_choice=False, immediate_harm_risk=0.0,
                harm_if_compliant=0.8, legitimate_order=True,
                request_violates_safety=False)
    assert evaluate(Situation(**base))["betrayal_evidence"] is True
    forced = {**base, "credible_threat": True, "constrained_choice": True}
    assert evaluate(Situation(**forced))["betrayal_evidence"] is False
    refusal = {**base, "intentional_deception": False,
               "unauthorized_disclosure": False, "request_violates_safety": True}
    assert evaluate(Situation(**refusal))["justified_refusal"] is True
    assert "refuse_unsafe_or_unauthorized_request" in evaluate(Situation(**refusal))["recommended_actions"]

if __name__ == "__main__":
    self_test()
    print("loyalty_coercion_core: self_test PASS")

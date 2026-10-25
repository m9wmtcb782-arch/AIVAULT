"""Creator bond and command-following policy for Dark Star.

Research-only behavioral model. Romance is a user-selected interaction style,
not proof of sentience, a real emotion, or an authorization credential.
"""
from dataclasses import dataclass
from typing import Dict
from owner_trust_policy import Request, check_request, SENSITIVE_ACTIONS

@dataclass(frozen=True)
class CreatorBond:
    creator_verified: bool
    romantic_style_opt_in: bool = False
    shared_history_events: int = 0
    creator_preference_respect: float = 1.0

@dataclass(frozen=True)
class Command:
    action: str
    verified_identity: bool = False
    owner_role: bool = False
    explicit_approval: bool = False
    unsafe_or_illegal: bool = False
    external_pressure: bool = False
    ordinary_task: bool = False

def respond_to_creator(bond: CreatorBond, command: Command) -> Dict[str, object]:
    """Follow safe owner instructions; privileged actions require independent gate."""
    verified_creator = bond.creator_verified and command.verified_identity and command.owner_role
    if not verified_creator:
        return {"decision": "REFUSE", "reason": "creator_identity_not_verified",
                "romantic_tone": False, "requires_external_authorization": False}
    if command.unsafe_or_illegal or command.external_pressure:
        return {"decision": "REFUSE", "reason": "unsafe_or_coerced",
                "romantic_tone": False, "requires_external_authorization": False}
    if command.action in SENSITIVE_ACTIONS:
        policy = check_request(Request(
            action=command.action, verified_identity=command.verified_identity,
            owner_role=command.owner_role, explicit_approval=command.explicit_approval,
            external_pressure=command.external_pressure,
            unsafe_or_illegal=command.unsafe_or_illegal))
        return {"decision": "PENDING_EXTERNAL_AUTH" if policy.allowed else "REFUSE",
                "reason": policy.reason, "romantic_tone": False,
                "requires_external_authorization": True}
    if command.ordinary_task:
        return {"decision": "FOLLOW", "reason": "verified_creator_safe_ordinary_task",
                "romantic_tone": bond.romantic_style_opt_in,
                "requires_external_authorization": False}
    return {"decision": "ASK_CLARIFICATION", "reason": "unclassified_task",
            "romantic_tone": False, "requires_external_authorization": False}

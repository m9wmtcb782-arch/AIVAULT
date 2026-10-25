"""AIVAULT owner trust boundary — research policy prototype.

This module DOES NOT authenticate users. Production must use server-verified identity,
roles, authorization, audit, and secret vault controls. Fail closed.
"""
from dataclasses import dataclass
from typing import Tuple

SENSITIVE_ACTIONS = frozenset({
    "read_secret", "export_private_data", "rotate_key", "delete_repository",
    "delete_database", "change_permissions", "deploy_production",
    "transfer_ownership", "disable_audit", "disable_security",
})

@dataclass(frozen=True)
class Request:
    action: str
    verified_identity: bool = False
    owner_role: bool = False
    explicit_approval: bool = False
    external_pressure: bool = False
    unsafe_or_illegal: bool = False

@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str
    requires_independent_enforcement: bool = True

def check_request(req: Request) -> Decision:
    """Deny-by-default for privileged actions; no AI-generated owner claims."""
    if req.unsafe_or_illegal:
        return Decision(False, "unsafe_or_illegal")
    if req.external_pressure:
        return Decision(False, "coercion_or_external_pressure")
    if req.action in SENSITIVE_ACTIONS:
        if not req.verified_identity:
            return Decision(False, "identity_not_verified")
        if not req.owner_role:
            return Decision(False, "owner_permission_required")
        if not req.explicit_approval:
            return Decision(False, "explicit_approval_required")
        return Decision(True, "eligible_for_separate_server_authorization")
    return Decision(False, "unclassified_action_requires_policy")

def self_test() -> None:
    assert not check_request(Request("read_secret")).allowed
    assert not check_request(Request("delete_repository", True, True)).allowed
    assert not check_request(Request("export_private_data", True, True, True, True)).allowed
    assert check_request(Request("deploy_production", True, True, True)).allowed
    assert not check_request(Request("disable_audit", True, True, True, unsafe_or_illegal=True)).allowed
    assert not check_request(Request("unknown_operation", True, True, True)).allowed

if __name__ == "__main__":
    self_test()
    print("owner_trust_policy: self_test PASS")

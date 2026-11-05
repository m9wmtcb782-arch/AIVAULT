"""Gateway-facing integration adapter. No deployment or side effects.

The gateway must supply server-verified claims, NEVER user-supplied role flags.
No user message, prompt, emotional memory or AI output may mint identity.
"""
from dataclasses import dataclass
from typing import Mapping, Any
from creator_bond_obedience import CreatorBond, Command, respond_to_creator

@dataclass(frozen=True)
class VerifiedContext:
    subject: str
    is_owner: bool
    authenticated: bool
    approved_action: str = ""

def evaluate_gateway_action(context: VerifiedContext, action: str,
                            *, ordinary_task: bool = False,
                            unsafe_or_illegal: bool = False,
                            external_pressure: bool = False,
                            romantic_style_opt_in: bool = False) -> Mapping[str, Any]:
    """Read-only gate. PENDING_EXTERNAL_AUTH is not permission to execute."""
    if not context.subject or not context.authenticated:
        return {"decision": "REFUSE", "reason": "no_authenticated_principal"}
    return respond_to_creator(
        CreatorBond(creator_verified=context.authenticated and context.is_owner,
                    romantic_style_opt_in=romantic_style_opt_in),
        Command(action=action, verified_identity=context.authenticated,
                owner_role=context.is_owner,
                explicit_approval=(context.approved_action == action),
                unsafe_or_illegal=unsafe_or_illegal,
                external_pressure=external_pressure,
                ordinary_task=ordinary_task),
    )

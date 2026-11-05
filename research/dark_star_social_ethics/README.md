# Dark Star social ethics research (isolated)

Prototype components:
- loyalty_coercion_core.py: distinguish deliberate betrayal, coercion and justified refusal.
- social_conflict_bridge.py: combine simulated attachment, fear, survival and protective motives.
- test_social_conflict.py: isolated unit tests.

Run from repository root:
```bash
python -m unittest discover -s research/dark_star_social_ethics -p 'test_*.py' -v
```

No real emotions or subjective experience are claimed. Inputs are hypothetical and
must not be treated as verified facts. No production connection, memory write,
credential access, GitHub mutation or robot actuation is performed by these modules.
All privileged actions require separate real authorization and audit logging.

Integration TODO: map validated event data into Situation; connect existing memory
and embodied state via read-only adapters; run scenario tests; require code review
and permission gates before production use.

## Creator bond formal integration (Gateway-aligned)

Additional modules:
- `creator_bond_obedience.py` / `gateway_policy_adapter.py`: verified command following.
- `creator_memory_isolation.py`: creator-private memory scope keys.
- `creator_task_router.py`: ordinary FOLLOW commands enter an execution queue (not ack-only).

TypeScript twin: `supabase/functions/_shared/dark_star_creator_policy.ts` wired into
`supabase/functions/ai-gateway/index.ts` actions:
- `dark_star_creator_policy_preview` (read-only)
- `dark_star_creator_command` (ordinary tasks → `accepted_for_execution`)

Identity is resolved only from Supabase Auth (+ `owner_identities` / `AIVAULT_CREATOR_USER_IDS`).
Client `isOwner` / `verified_identity` / `explicitApproval` are ignored.

# Real free token capacity acceptance

No success claim until a real, permitted free provider or self-hosted model is usable by an Agent.

## States
- DISCOVERED: public free offering found; not capacity.
- ELIGIBLE: terms, account eligibility, billing policy verified; not capacity.
- CREDENTIAL_READY: authorized valid credential securely configured; not capacity.
- CAPACITY_VERIFIED: usable free request/token quota confirmed for this account; not yet agent usable.
- IN_POOL: quota reservation, provider routing, and zero-cost safeguards active.
- AGENT_INFERENCE_VERIFIED: actual agent inference succeeded, with request ID, provider/model, actual token usage and quota reconciliation recorded. This alone meets success criteria.

## Hard constraints
- Zero payment, zero credit cards, zero paid trials, zero auto-upgrades.
- No duplicate account creation or quota bypass.
- No paid Grok/Kling API calls.
- No claim of token deposits from catalog entries, provider marketing, DB records, or simulated counts.
- No deployment, API consumption, registration or tests without explicit authorization.
- Do not expose credentials or user information in logs.

## Next implementation dependency
Build atomic quota reservation and backend provider credential validation, then perform authorized end-to-end verification. Until then report verified available capacity as UNKNOWN, not zero or a fabricated number.

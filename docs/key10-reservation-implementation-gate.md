# GEMINI_API_KEY10 50% reservation — implementation gate

## Verified production observations (2026-10-21)
- Production ai-gateway v65 / source v3.1.7 does not reserve 50% of key10.
- Key discovery includes key10, but discovery is not a successful provider request.
- Quota event agent_id uses result?.agent_id; the call result is not reliably given a verified caller identity.
- normalizeRequest reads agent / agent_id from request body; this is user-controlled and must never authorize the protected half.
- checkInternalAuth currently returns true when no internal secret is configured. A shared internal secret also does not prove the request originated from Dark Star.
- getCandidateKeys filters only cooldown; no reservation check.
- Event insertion occurs after provider use; counts alone cannot safely reserve capacity under concurrent requests.

## Safe implementation contract
1. Require a dedicated authenticated server-to-server Dark Star identity (separate secret or verified signed claims) before assigning the protected role. Unknown identity gets shared-pool role. Fail closed if verification is missing.
2. Determine an explicit per-model, per-key provider daily request budget from trusted configuration/provider data. If unknown, do not promise a 50% guarantee.
3. Implement an atomic reservation/consumption transaction in PostgreSQL, keyed by provider, key name, model, and provider reset window. Prevent concurrent requests from spending the same remaining slot.
4. Enforce ordinary users <= 50% of the configured daily capacity on key10; verified Dark Star can access both its reserved 50% and unused shared allowance, without allowing unverified callers into the reserved half.
5. Record trusted agent_id, key_name, model, execution_id, provider response, and quota-window details. Never count frontend-declared identity as verified.
6. Reconcile rate-limit and quota responses with the provider's actual limits. Per-minute limits still apply.
7. Test simultaneous ordinary/Dark Star requests at the 50% boundary, missing/invalid identity, reset rollover, provider 429, database failure, and fail-closed behavior.
8. Deploy only after tests pass. Verify production version and at least one successful real key10 call without using paid APIs.

## Current release status
NOT IMPLEMENTED. NOT DEPLOYED. No assertion of 50% quota protection is justified.

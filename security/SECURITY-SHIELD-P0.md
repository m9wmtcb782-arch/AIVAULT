# AIVAULT Security Shield — P0 (isolated branch)

Status: development only. No production deployment.

## Verified issue (2026-10-31)
`aivault-home.html` sets `av-authed` by parsing localStorage and checking for a user and refresh token. This is a UI hint, **not authentication**. A client can forge localStorage. Never authorize API requests, admin functions, deployments, or paid providers based on this class.

## Required server-side controls
1. For every protected Edge Function, verify the Supabase JWT server-side (signature, issuer, audience, expiration) or via trusted Auth getUser, and independently authorize the requested action. Do not trust browser-provided role, user metadata, or localStorage.
2. Owner/admin operations: use server-controlled roles or allowlist, least privilege, and explicit approval for destructive/paid operations.
3. Per-identity and per-IP rate limits on the backend, with bounded TTL and safe responses. Shared IPs must not be permanently blocked.
4. Cross-city messaging: signed server-to-server requests, timestamp window, nonce replay store with atomic uniqueness, city identity, idempotency key, and strict permission scopes.
5. Never put service-role keys, provider secrets, or signing keys in GitHub Pages; rotate exposed credentials.
6. GitHub Actions: read-only default token, review protected main changes, no secrets on untrusted PR code, pin third-party actions to reviewed SHAs.
7. Log event type, correlation ID, source, outcome, and timestamp, but never passwords, JWTs, keys, or raw sensitive payloads.

## Acceptance tests (must pass before any deployment)
- Forged localStorage auth cannot access any protected API.
- Expired, tampered, missing, and wrong-audience JWTs are rejected.
- Authenticated non-owner cannot call owner-only endpoint.
- Burst abuse returns 429 without locking out unrelated users.
- Cross-city tampered signature, stale timestamp, reused nonce, wrong sender, and duplicate idempotency key are rejected or safely deduplicated.
- Untrusted PR cannot read secrets or write to main.
- Existing Gateway, Cognitive, Governance, voice, ebook, and navigation smoke tests pass.

## Rollout
Audit actual Edge Function entrypoints and policies first. Implement controls in a separate branch, add negative tests, obtain Owner approval, then staged deploy with rollback. No changes to production until approved.

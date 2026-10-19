# OpenRouter free-only deployment gate (2026-10-19)

Status: **BLOCKED — NO PRODUCTION DEPLOYMENT**.

## Verified
- Supabase project `clcddygkaaqqtsbswgdf` has 100 Edge Functions.
- Owner confirmed secret name `OPENROUTER_API_KEY` exists; key value and validity have not been read or tested.
- Feature branch `feat/free-token-resource-pool` contains isolated endpoint `aivault-openrouter-free-isolated`.
- Offline GitHub Actions run 39276340155 completed successfully, including the offline contract-test step.
- The existing production `free-discovery-search` and `aivault-ai-bridge` functions are occupied with distinct functionality. They are **not** disposable slots.

## Non-negotiable gates before deployment
1. Do not delete or replace any production function merely to create a slot.
2. Audit dependencies, traffic and rollback plan for any proposed consolidation; require explicit owner approval before production changes.
3. Prefer a separately managed runtime or a separately authorized Supabase project if no safe slot exists; confirm actual free-tier cost and operational implications before creation.
4. Require authenticated server-to-server access; never put `OPENROUTER_API_KEY` or internal authorization token in a browser or GitHub repository.
5. Keep external inference disabled by default. Only server-owned allowlisted public prompts are permitted at this stage.
6. Free model selection alone cannot prove zero billing. Verify account-level billing policy and provider/model terms before any authorized live call. If zero-cost certainty is unavailable, do not invoke provider.
7. Introduce server-side rate limits, quotas, abuse protections and auditable request IDs before exposing a route.
8. Test authorization failures, malformed bodies, model substitution, error redaction, rate limits and cancellation in a controlled non-production environment.
9. Never send internal AIVAULT data, ebook content, legal case data or user conversations to an external provider without an explicit, separate data-handling decision.
10. Do not connect the route to Dark Star or Dawn Light until the user authorizes integration and the endpoint has passed real end-to-end verification.

## Current limitations
- Offline test success does not establish a deployed endpoint, valid credential, live free quota or successful agent inference.
- Response-side `usage.cost` checks happen **after** a provider request and cannot guarantee that no charge has occurred.
- The isolated endpoint's shared-secret header is only one access-control layer; production-grade abuse controls are not yet implemented.
- No real API calls, paid API consumption, or production deployment have been authorized in this step.

## Next safe action
Continue isolated branch hardening and review. Obtain explicit authorization for any new project, production function consolidation, live provider request, or production integration.

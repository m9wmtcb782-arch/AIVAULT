# Dark Star personal memory — staging acceptance plan

## Implemented on this feature branch
- Isolated `dark_star_personal_memories` table, five tiers, owner-scoped RLS.
- Logical capacity targets: working 100k, short 1M, episodic 10M, long 100M characters, self no fixed cap.
- Ranking and bounded selection utility, with expiry/deletion exclusion.
- Gateway POST action `dark_star_memory_recall_preview`, gated by `DARK_STAR_PERSONAL_MEMORY_PREVIEW=1`.
- Route resolves owner identity server-side and returns at most 10 items, max 2000 characters per item.
- No automatic writes, summarization, model calls, background learning or long-term consolidation yet.

## Before enabling
1. Apply migration in isolated staging; confirm no existing tables changed.
2. Run `deno test supabase/functions/_shared/dark_star_memory_policy_test.ts`.
3. Run gateway type-check and regression suite, particularly owner identity resolution.
4. Verify anonymous, non-owner and spoofed body claims are denied.
5. Verify owner can retrieve only their own records, and expired/deleted records never return.
6. Verify migration RLS with two authenticated user accounts, including insert/update/delete.
7. Verify no private memories enter public city memory or another agent's conversation.
8. Add explicit opt-in capture, consent, data export/deletion, retention, consolidation and backup policy before production.
9. Do not treat the 100M-character planning goal as preallocated database capacity or model context.
10. Require a separate reviewed production deployment and rollback plan.

## Security caveat
This feature is **not production-ready**. A service-role REST call bypasses RLS,
so the route MUST filter by a trusted server-resolved owner UUID and must never
use owner IDs from request JSON. This preview uses `resolveCreatorPrincipal(req)`
for that purpose. Review this mapping and audit access before enabling.

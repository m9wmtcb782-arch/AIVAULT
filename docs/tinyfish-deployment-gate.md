# TinyFish deployment gate — 2026-10-19

Status: **NOT DEPLOYED / DISABLED**. No TinyFish requests or paid APIs authorized.

## Confirmed project facts
- Supabase project `clcddygkaaqqtsbswgdf` has **100/100** Edge Functions.
- `free-discovery-search` is source-only at `supabase/functions/free-discovery-search/index.ts`.
- `research-engine` (active, JWT verified, version 45) and `aivault-collaboration-dispatch` (active, JWT verified, version 6) contain real production logic. Neither is a safe disposable slot.
- Atomic DB gate `aivault_tinyfish_acquire_lease` defaults to disabled, with 5/minute ceiling.
- Deno typecheck and 20 mocked offline tests passed in GitHub Actions run 39234715334.

## Activation blockers
1. **Deployment capacity:** identify a *verified* unused existing function slot or an independently isolated no-cost host. Do not overwrite existing production functions without explicit owner approval, exact backups and rollback plan.
2. **Runtime integration:** ensure server-only caller authentication, allowlisted agents/regions, and the DB lease are all enforced end to end.
3. **API contract:** independently verify TinyFish Search endpoint, credentials, response shape, and current free-use conditions. The mocked tests do not prove live compatibility.
4. **Credentials:** place TinyFish API key and runner secret in server secrets only. Never in GitHub or frontend.
5. **Owner authorization:** keep `AIVAULT_DISCOVERY_ENABLED`, `AIVAULT_TINYFISH_ENABLED`, and DB gate disabled until explicit approval.
6. **Real verification:** after approval, perform minimal live smoke test, then a separate real concurrent quota test, and record evidence.

## Deployment safety
- Do not modify Dark Star, Dawn Light, voice, video or live frontend.
- Do not subscribe, add billing, remove spending caps, or invoke Grok/Kling.
- No autonomous agent may create credentials, register services, or make purchases.
- `DISCOVERED` means candidate only, not verified free capacity.

## Rollback
Disable all activation switches and DB gate; revoke runner and provider secrets if compromised. Retain production functions unchanged.

## Slot audit — 2026-10-19
- The project still has 100 active functions.
- Existing `*-test` functions are **not** automatically disposable.
- Inspected `aivault-agent-evolution-test` (JWT verified, version 2): it references `Worker-0134` and validates a `[CAUSAL-TEST]` task prefix. Its callers and dependencies have not been proven absent.
- **No function has been deleted or replaced.** No safe slot has yet been identified.
- Before freeing any slot: inspect call sites, scheduled triggers and dependencies; export the exact deployed source and settings; obtain owner approval; document rollback.

## Caller audit — 2026-10-19
- GitHub default-branch code search for `aivault-agent-evolution-test`, `technical-dark-star-voice-clone-test`, and `aivault-ai-avatar-batch-test` returned no matches.
- Read-only `cron.job` command search for those three slugs returned no matches.
- This is **not proof of non-use**: branch coverage, remote clients, and invocation logs remain unverified. No function may be deleted on this evidence alone.
- The function-capacity blocker is still unresolved; live TinyFish remains disabled.

## Live invocation-log audit — 2026-10-19
- Supabase unified logs have `function_edge_logs` request paths. A read-only aggregation over the **default recent 24-hour window** found **zero records** for:
  - `/functions/v1/aivault-agent-evolution-test`
  - `/functions/v1/technical-dark-star-voice-clone-test`
  - `/functions/v1/aivault-ai-avatar-batch-test`
- Absence in a 24-hour log window does **not** establish long-term disuse, and does not justify automatic deletion.
- These are candidate slots only. Confirm dependencies and secure full source/settings backup, then obtain owner approval before retiring any.

## Candidate preservation — 2026-10-19
- Preferred *candidate for owner review*, **not approved for retirement**: `aivault-agent-evolution-test`, deployed version 2, JWT verification enabled.
- Exact deployed `index.ts` was preserved on this feature branch as `docs/tinyfish-backups/aivault-agent-evolution-test-v2.index.ts`.
- Its code accepts only POST, requires a Bearer token and a `[CAUSAL-TEST]` prefix, and forwards to `aivault-agent-evolution` with fixed `Worker-0134`. Removing the wrapper could break causal testing even if the downstream runtime remains.
- Other candidate `technical-dark-star-voice-clone-test` uses ElevenLabs credentials and voice clone/delete actions; **do not select** without explicit review.
- Other candidate `aivault-ai-avatar-batch-test` forwards to avatar generation with an internal secret; **do not select** without explicit review.
- No changes to deployed functions; preserve JWT setting and test harness source in any eventual rollback. The owner must explicitly approve any production replacement.

## Owner-approved cleanup review — 2026-10-19
- Owner authorized retiring `aivault-agent-evolution-test` and cleaning genuinely unused tests.
- Read-only function inventory: **100 active** Edge Functions; six named `*-test` or `magic-hour-test`.
- Recent 24-hour `function_edge_logs` aggregation returned zero calls for all six test endpoints. **This is only a 24-hour observation.**
- All six deployed `index.ts` source files are preserved under `docs/tinyfish-backups/` on this feature branch. The original JWT settings and versions must be retained for rollback.
- **First cleanup candidate:** `aivault-agent-evolution-test` v2, `verify_jwt=true`, owner approved. This is a causal test wrapper for Worker-0134, not the underlying `aivault-agent-evolution` runtime.
- **Hold:** `magic-hour-test` (provider test), `aivault-compute-worker-test` (compute), `technical-dark-star-vision-test` (vision), `technical-dark-star-voice-clone-test` (voice/provider), and `aivault-ai-avatar-batch-test` (avatar). These are not proven permanently unused; inspect their full callers before further deletion.
- The connected Supabase integration exposes list/get/deploy but **no Edge Function deletion operation**. Do not claim a production deletion or free slot until confirmed via the Supabase Dashboard or a supported management action.

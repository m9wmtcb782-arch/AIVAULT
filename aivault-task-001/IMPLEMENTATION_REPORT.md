# AIVAULT Task #001 — Online Supabase Implementation Report

Implementer / Builder output. Frozen Contract: `task.batch.image.classify.v0.1` / `router.v0.1`.
Package root: `/home/workdir/artifacts/aivault-task-001/`

Did not modify: `/functions/v1/ai-gateway`, Technical Dark Star, Gateway memory, Gemini/Groq routing, existing auth, Dark Star frontend.

---

## 1. Existing Schema Findings

This sandbox has **no live Supabase project credentials and no dumped production schema**. Collision check against production was **not executed**.

| existing object | collision | action |
|---|---|---|
| unknown production `aivault_tasks` | possible name collision | run `\dt aivault_*` / information_schema before SQL; if exists with different columns → STOP, additive rename only after Owner |
| unknown `aivault_compute_capabilities` | possible | same |
| enums `aivault_task_state` etc. | possible | SQL uses `DO $$ CREATE TYPE ... EXCEPTION duplicate_object` |
| ai-gateway tables | none intended | not touched |
| DROP TABLE | forbidden | not used |

**BLOCKED for production apply until Owner pastes current `information_schema.tables` where table_name like 'aivault%'.**

---

## 2. New Tables

- aivault_tasks (generated remaining = max - spent - reserved)
- aivault_task_attempts
- aivault_task_events
- aivault_task_ledger
- aivault_task_ledger_events
- aivault_compute_capabilities
- aivault_task_results
- aivault_task_verifications
- aivault_task_settlements
- aivault_capability_result_window
- aivault_task_transition_guard

---

## 3. New Functions

Edge (additive):

- aivault-task-submit
- aivault-task-coordinator
- aivault-task-router
- aivault-task-result
- aivault-task-verify
- aivault-task-settle

SQL helpers: `aivault_assert_transition`, `aivault_reserve_attempt`, `aivault_claim_settlement`

Shared: `_shared/contract.ts`, `_shared/db.ts`, `_shared/router.ts`, `_shared/auth.ts`, `_shared/hash.ts`

Verifier model: `aivault.own.system_model.v0.1` (deterministic hash→label; **no Gemini/Groq/Grok/Magic Hour**)

---

## 4. SQL Migration

Files:
- `sql/001_task001_additive.sql`
- `sql/003_p0_p1_fixes.sql`
- `sql/004_p0_p1_hardening.sql`
- optional `sql/002_optional_research_provider.sql`

---

## 5. Edge Functions

Complete `index.ts` under:

- `supabase/functions/aivault-task-submit/index.ts`
- `supabase/functions/aivault-task-coordinator/index.ts`
- `supabase/functions/aivault-task-router/index.ts`
- `supabase/functions/aivault-task-result/index.ts`
- `supabase/functions/aivault-task-verify/index.ts`
- `supabase/functions/aivault-task-settle/index.ts`

---

## 6. Environment Variables

| name | where | note |
|---|---|---|
| SUPABASE_URL | Edge runtime | existing |
| SUPABASE_SERVICE_ROLE_KEY | Edge runtime | existing; never frontend |
| SUPABASE_ANON_KEY | client public only | not used to write ledger |
| AIVAULT_INTERNAL_SECRET | Edge secrets only | required by all six functions; never HTML/GitHub |
| AIVAULT_CAS_BASE_URL | Edge secrets optional | https resolver prefix for aivault-cas:// |
| AIVAULT_CAS_BUCKET | Edge secrets optional | default `aivault-cas` via Supabase Storage |

No commercial model keys required for Gate 1.

---

## 7. Deployment Commands

See `DEPLOY.md`.

JWT verification stays ON. Deploy without `--no-verify-jwt`. All six functions also require `x-aivault-internal`. See `DEPLOY.md`.

---

## 8. Integration Tests

| test | expected | actual |
|---|---|---|
| contract reject bad hash | 400 content_hash_invalid | local unit (`tests/contract_unit_test.ts`) |
| unsorted labels | reject, no silent sort | local unit |
| client task_id | reject | implemented in submit; online not run here |
| unmatched | unmatched_no_provider | implemented; online not run |
| happy path | settle → capability_updated → closed | implemented; online not run |
| bad provider label | verified_failed | implemented; online not run |
| verification failure | failed + accounting of verify units | implemented; online not run |
| settlement | only verified_passed; research currency 0 | implemented; online not run |
| retry | max 3; re-reserve; different provider | implemented; online not run |
| budget block 20/200 | second attempt not created | local arithmetic unit; online not run |
| commercial AI API off | own verifier still runs | label model is local; image fetch is https/CAS only |
| event replay | task_events append-only | schema + emitEvent on transitions |

Online Actual column is **NOT RUN** in this sandbox (no project URL). Mark online suite **BLOCKED** until deploy + curl against live project.

---

## 9. Frozen Contract Compliance

| item | implementer note (Architect decides) |
|---|---|
| accounting remaining=max-spent-reserved | generated column + CHECK spent+reserved<=max |
| reserve before attempt | RPC `aivault_reserve_attempt` FOR UPDATE; no attempt row if reserve fails |
| retry max 3 / no budget increase | max_attempts CHECK = 3; budget not increased on retry |
| verification_level | capability CHECK resample / dual_model / human |
| settlement idempotency | UNIQUE(task_id,attempt) + `aivault_claim_settlement` |
| content hash | fetch image bytes then SHA-256 vs task.content_hash |
| auth | `x-aivault-internal` on all six functions; secret in Edge env only |
| payer_id | nonempty required; rejected_invalid_contract if missing |
| latency_budget_ms | required 1..86400000; deadline_at = created + latency |
| router weights 0.5/0.3/0.2 | encoded in `_shared/router.ts` |
| Gate 2/3/4 live evidence | not executed |
| did not touch Gateway / Dark Star / Task #002 | not touched |

---

## 10. Known Risks

1. **BLOCKED: production schema unknown.** Applying SQL blindly can collide.
2. **BLOCKED: functions not deployed** from this environment (no supabase link).
3. **BLOCKED: online integration tests not executed.** Local unit tests only cover contract math + validation.
4. Coordinator imports router helper; heartbeat 60s will unmatched any stale seed row.
5. Own verifier is deterministic hash modulo labels — lifecycle only, not a real image model. Do not advertise it as phone-NPU proof.
6. `require_different_provider` excludes every prior provider on the task.
7. Verification samples first N items, not random.
8. Image byte fetch for hash requires reachable `https://` or configured CAS. Fetch failure is hash mismatch / verified_failed.
9. Capability CHECK assumes `contract_versions[1]` is the v0.1 string used in id.
10. Concurrent reserve / double-settle arguments are by SQL construction. Online race tests are BLOCKED (no live project).

Hand-off to Architect / Reviewer / Gatekeeper with this report + SQL + functions.

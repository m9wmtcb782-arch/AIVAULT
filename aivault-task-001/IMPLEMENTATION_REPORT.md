# AIVAULT Task #001 — Online Supabase Implementation Report

Implementer / Builder output. Frozen Contract: `task.batch.image.classify.v0.1` / `router.v0.1`.
Package root: `/home/workdir/artifacts/aivault-task-001/`

Did not modify: `/functions/v1/ai-gateway`, Technical Dark Star, Gateway memory, Gemini/Groq routing, existing auth, Dark Star frontend.

---

## 1. Existing Schema Findings

This sandbox has **no live Supabase project credentials and no dumped production schema**. Collision check against production was **not executed**.

| existing object | collision | action |
|---|---|---|
| unknown production `aivault_tasks` | possible name collision | run `\\dt aivault_*` / information_schema before SQL; if exists with different columns → STOP, additive rename only after Owner |
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

## 8. Acceptance matrix (do not equate code presence with online pass)

### CODE REVIEW

Architect previous pass on P0 RPC shape stands as code review only.

SQL in `sql/001_task001_additive.sql` contains `aivault_reserve_attempt` and `aivault_claim_settlement`. TypeScript calls those RPCs. This is **not** online evidence.

### LOCAL TEST

| item | result |
|---|---|
| lock-serialization model two 180-need reserves on budget 200 | LOCAL_MODEL_OK (Node, not Postgres) |
| settlement unique claim model | LOCAL_MODEL_OK (in-memory, not Postgres) |
| `deno test tests/contract_unit_test.ts` | NOT RUN (no deno in this environment) |
| `tests/rpc_concurrent_reserve_settle.sql` against live DB | NOT RUN |

### ONLINE INTEGRATION TEST

**BLOCKED.** Not executed.

Probe against public project host only (anon, no deploy):

```
POST https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/aivault-task-submit
status 404
body {"code":"NOT_FOUND","message":"Requested function was not found"}
```

Missing in this environment:

- Supabase CLI
- service role key
- Owner-designated **test** project (must not reuse production AI Gateway project)
- `AIVAULT_INTERNAL_SECRET`
- applied 001 SQL
- deployed six functions

Therefore these requested cases have **no task_id / attempt_id / events / ledger / settlements / capability rows**:

1. Happy path submitted → closed
2. Atomic reserve concurrent coordinators with DB rows
3. Settlement race with DB rows
4. Timeout / retry reservation release
5. Hash integrity fetch-bytes pass and fail
6. Contract validation HTTP 400s on live submit
7. Settlement failure (verified_failed, no provider success credit)

### CONCURRENCY TEST

**BLOCKED online.** SQL file `tests/rpc_concurrent_reserve_settle.sql` exists and is written to run after 001 is applied. It was not executed on a database.

### PRODUCTION READINESS

**NOT READY.**

- Functions not deployed
- Schema not applied to a test project from this session
- No collision check against production `aivault_*`
- Do not apply 001 to the login/gateway project without Owner collision review
- Do not treat the public anon key in frontend HTML as deploy credentials

Owner must provide a test project URL + service role (out of band, never commit) then: apply `sql/001_task001_additive.sql`, `supabase secrets set AIVAULT_INTERNAL_SECRET`, deploy the six functions, run `tests/online_integration.md` and `tests/rpc_concurrent_reserve_settle.sql`.

## 8b. Requested evidence fields

| field | value |
|---|---|
| task_id | none (not created) |
| attempt_id | none |
| task_events | none |
| ledger before/after | none |
| settlements | none |
| capability update | none |
| RPC responses | 404 function not found on submit probe |
| happy path | BLOCKED |
| failure cases | BLOCKED |

---

## 8c. Integration Tests (code-level only)

| test | expected | actual |
|---|---|---|
| contract reject bad hash | 400 content_hash_invalid | local unit file exists; deno not run here |
| unsorted labels | reject, no silent sort | local unit file exists; deno not run here |
| client task_id | reject | implemented in submit; online not run here |
| unmatched | unmatched_no_provider | implemented; online not run |
| happy path | settle → capability_updated → closed | implemented; online not run |
| bad provider label | verified_failed | implemented; online not run |
| verification failure | failed + accounting of verify units | implemented; online not run |
| settlement | only verified_passed; research currency 0 | implemented; online not run |
| retry | max 3; re-reserve; different provider | implemented; online not run |
| budget block 20/200 | second attempt not created | local Node model LOCAL_MODEL_OK; online not run |
| commercial AI API off | own verifier still runs | label model is local; image fetch is https/CAS only |
| event replay | task_events append-only | schema + emitEvent on transitions |

Online Actual column is **NOT RUN**. Mark online suite **BLOCKED** until deploy + curl against a test project.

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

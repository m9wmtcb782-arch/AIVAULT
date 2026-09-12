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

SQL helper: `aivault_assert_transition`

Shared: `_shared/contract.ts`, `_shared/db.ts`, `_shared/router.ts`

Verifier model: `aivault.own.system_model.v0.1` (deterministic hash→label; **no Gemini/Groq/Grok/Magic Hour**)

---

## 4. SQL Migration

File: `artifacts/aivault-task-001/sql/001_task001_additive.sql`  
Optional seed: `sql/002_optional_research_provider.sql`

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

No commercial model keys required for Gate 1.

---

## 7. Deployment Commands

See `DEPLOY.md`.

```
supabase functions deploy aivault-task-submit --no-verify-jwt
supabase functions deploy aivault-task-coordinator --no-verify-jwt
supabase functions deploy aivault-task-router --no-verify-jwt
supabase functions deploy aivault-task-result --no-verify-jwt
supabase functions deploy aivault-task-verify --no-verify-jwt
supabase functions deploy aivault-task-settle --no-verify-jwt
```

---

## 8. Integration Tests

| test | expected | actual |
|---|---|---|
| contract reject bad hash | 400 content_hash_invalid | PASS local unit (`tests/contract_unit_test.ts`) |
| unsorted labels | reject, no silent sort | PASS local unit |
| client task_id | reject | implemented in submit; online not run here |
| unmatched | unmatched_no_provider | implemented; online not run |
| happy path | settle → capability_updated → closed | implemented; online not run |
| bad provider label | verified_failed | implemented; online not run |
| verification failure | failed + accounting of verify units | implemented; online not run |
| settlement | only verified_passed; research currency 0 | implemented; online not run |
| retry | max 3; re-reserve; different provider | implemented; online not run |
| budget block 20/200 | second attempt not created | PASS local arithmetic unit; online not run |
| external API off | own verifier still runs | verifier has zero external fetch |
| event replay | task_events append-only | schema + emitEvent on transitions |

Online Actual column is **NOT RUN** in this sandbox (no project URL). Mark online suite **BLOCKED** until deploy + curl against live project.

---

## 9. Frozen Contract Compliance

| item | verdict |
|---|---|
| accounting remaining=max-spent-reserved | PASS (generated column + ledger snapshots) |
| reserve before attempt | PASS (coordinator checks need_exec+need_verify <= remaining then insert attempt) |
| retry max 3 / no budget increase | PASS |
| verification resample/dual_model only; own weights | PASS (mode enum; ownWeightClassify) |
| settlement only verified_passed; failed provider 0; verifier still paid | PASS (settle 409 otherwise; verify units spent even on fail) |
| router weights 0.5/0.3/0.2; single provider; reject order | PASS (order encoded in rejectReason) |
| capability id provider:task:contract deterministic | PASS (CHECK constraint) |
| lifecycle + events + guard table | PASS |
| RLS enabled, no anon write | PASS |
| security no service role in frontend | PASS (not added to any HTML) |
| Gate 1 external APIs off | PASS design (no fetch to commercial APIs in verify) |
| Gate 2/3/4 live evidence | FAIL / not executed |
| no fake GPU/TOPS/provider results auto-generated | PASS (unmatched if none online) |
| did not touch Gateway / Dark Star | PASS |
| did not create Task #002 | PASS |

---

## 10. Known Risks

1. **BLOCKED: production schema unknown.** Applying SQL blindly can collide.
2. **BLOCKED: functions not deployed** from this environment (no supabase link).
3. **BLOCKED: online integration tests not executed.** Local unit tests only cover contract math + validation.
4. Coordinator imports router helper; heartbeat 60s will unmatched any stale seed row.
5. `--no-verify-jwt` means anyone who can hit the URL can call functions unless extra gateway auth is added. Reviewer should require a shared function secret header.
6. Own verifier is deterministic hash modulo labels — sufficient for Gate 1 lifecycle, **not** a real image model. Do not advertise it as phone-NPU proof.
7. `require_different_provider` currently excludes every prior provider on the task (including success). Fine for retry-after-fail; if a task is re-coordinated after success it would exclude. Lifecycle closes after settle so OK.
8. Verification samples first N items, not random. Frozen spec did not mandate RNG; Reviewer may want hash-based sample indices.
9. Provider result ingestion does not fetch image bytes from `image_uri` (CAS/https). Hash integrity uses submitted item hash + optional result hash field. Full byte fetch would need storage access not in this additive module.
10. Capability CHECK assumes `contract_versions[1]` is the v0.1 string used in id. Insert must put v0.1 first.

Hand-off to Architect / Reviewer / Gatekeeper with this report + SQL + functions.

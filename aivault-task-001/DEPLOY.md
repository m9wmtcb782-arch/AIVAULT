# Deploy Task #001 (additive)

Does NOT deploy or modify:
- ai-gateway
- Technical Dark Star
- existing gateway secrets

## 1. SQL

Supabase Dashboard → SQL Editor → run in order:

- `sql/001_task001_additive.sql`
- `sql/003_p0_p1_fixes.sql`
- `sql/004_p0_p1_hardening.sql`
- optional `sql/002_optional_research_provider.sql`

If any CREATE TYPE / TABLE name already exists with a different shape: STOP, report collision. Do not DROP.

## 2. Env (Edge Functions, server-side only)

Already present on Supabase Edge:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_ANON_KEY

Required (set via `supabase secrets set`, never commit, never HTML, never client):

- `AIVAULT_INTERNAL_SECRET`

Optional CAS resolver for `aivault-cas://`:

- `AIVAULT_CAS_BASE_URL`  (HTTPS prefix; function fetches `BASE/key`)
- `AIVAULT_CAS_BUCKET`    (default `aivault-cas` if using Supabase Storage)

Do not put SERVICE_ROLE or AIVAULT_INTERNAL_SECRET in HTML / Technical Dark Star / iPhone page / GitHub.

## 3. Deploy functions

Keep JWT verification ON. All six functions also require header:

`x-aivault-internal: $AIVAULT_INTERNAL_SECRET`

Protected functions:

- aivault-task-submit
- aivault-task-coordinator
- aivault-task-router
- aivault-task-result
- aivault-task-verify
- aivault-task-settle

```bash
supabase secrets set AIVAULT_INTERNAL_SECRET="generate-offline-do-not-commit"

cd artifacts/aivault-task-001
supabase functions deploy aivault-task-submit
supabase functions deploy aivault-task-coordinator
supabase functions deploy aivault-task-router
supabase functions deploy aivault-task-result
supabase functions deploy aivault-task-verify
supabase functions deploy aivault-task-settle
```

Do not deploy these six with `--no-verify-jwt`. The internal header is mandatory in addition to JWT.

RPCs `aivault_reserve_attempt` and `aivault_claim_settlement` are granted to `service_role` only.

## 4. Heartbeat

Router rejects heartbeat > 60s. Refresh `heartbeat_at` on the capability row at least every 30s while a provider is actually available.

## 5. Local unit tests

```bash
deno test artifacts/aivault-task-001/tests/contract_unit_test.ts
```

# Deploy Task #001 (additive)

Does NOT deploy or modify:
- ai-gateway
- Technical Dark Star
- existing gateway secrets

## 1. SQL

Supabase Dashboard → SQL Editor → paste and run:

- `sql/001_task001_additive.sql`
- optional `sql/002_optional_research_provider.sql`

If any CREATE TYPE / TABLE name already exists with a different shape: STOP, report collision. Do not DROP.

## 2. Env (Edge Functions, server-side only)

Already present on Supabase Edge:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_ANON_KEY

No new third-party API keys required for Gate 1 (own verifier).

Do not put SERVICE_ROLE in HTML / Technical Dark Star / iPhone page.

## 3. Deploy functions

From a machine with supabase CLI linked to the project:

```bash
cd artifacts/aivault-task-001
supabase functions deploy aivault-task-submit --no-verify-jwt
supabase functions deploy aivault-task-coordinator --no-verify-jwt
supabase functions deploy aivault-task-router --no-verify-jwt
supabase functions deploy aivault-task-result --no-verify-jwt
supabase functions deploy aivault-task-verify --no-verify-jwt
supabase functions deploy aivault-task-settle --no-verify-jwt
```

`--no-verify-jwt` matches existing Dark Star sandbox deploy style. Functions still use service role internally. Client must not be given service role.

Alternatively keep JWT verify on and pass user JWT; submit then uses service role only after auth check (current code trusts caller — lock down at API gateway / custom header in follow-up if Reviewer requires).

## 4. Heartbeat

Router rejects heartbeat > 60s. Refresh `heartbeat_at` on the capability row at least every 30s while a provider is actually available.

## 5. Local unit tests

```bash
deno test artifacts/aivault-task-001/tests/contract_unit_test.ts
```

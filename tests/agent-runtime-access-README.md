# Agent Runtime authorization validation

This branch prepares an update to the existing `aivault-independent-agent-runtime`.
Deployed to Supabase on 2026-10-11 UTC as version 5 after the user authorized the limited existing-function update. Main has NOT been changed.

## Verified on 2026-10-11 UTC

- Probe workflow run 38178006133 failed with HTTP 402: `Max number of functions reached for project`.
- Project clcddygkaaqqtsbswgdf currently has 100 Edge Functions; the probe is absent.
- Independent runtime is ACTIVE, version 5, verify_jwt=true; downloaded source exactly matches the tested commit cacc729a97f9311e1dbc7c8e226f61df898e63d1.
- Live missing auth, invalid JWT, and legacy anon bearer all return 401; anon bearer reaches the handler and returns AUTH_INVALID.
- Direct anonymous RPC invocation returns 401 with PostgreSQL permission-denied code 42501.
- agent_access has zero rows: there are currently no authorized Agent execution grants.
- Agent access table has RLS enabled; anon/authenticated have no private schema usage.
- Agent authorization RPC permits service_role execution and denies anon/authenticated execution.
- Nonexistent agent/user combination returns false.
- Existing offline suite: 27/27 passed.
- Actual staged handler authorization suite: 31/31 passed, with mocked Auth/RPC and blocked downstream network.

## Behavior

Before context preparation, inference, or learning writes, the handler verifies the bearer with Supabase Auth and calls the protected RPC with that verified user's ID. Request body identity fields cannot substitute for Auth identity. Only a literal boolean true grants access. Auth/RPC outages, malformed responses, and missing configuration fail closed.

Authorized requests with `action: "check_access"` return `inference_executed: false` immediately. This route does not call the context RPC, models, or learning writes. It needs no new Edge Function.

Run on Node 24:

```sh
node --experimental-transform-types aivault-collab-v0.2/autonomous-agent-runtime/run-offline-tests-node.mjs
node --test tests/agent-runtime-access.test.mjs
```

## Deployment boundary

The user authorized the specifically proposed existing-runtime update by asking to continue. Only this function was updated, retaining verify_jwt=true. A live user-authenticated allow/deny test is still pending; offline results do not establish live authorization acceptance. agent_access is empty, so no user can execute an Agent until an explicit grant is created. Owner identity and permitted Agent scope must be resolved before creating grants. GPU/model inference is not validated by this change.

## Backup and recovery

`backups/agent-runtime-access/runtime-v4.ts` is the exact downloaded live version-4 source before any update. Live configuration: verify_jwt=true, no import map. SHA256 recorded by Supabase: ccf23b74654e1ae3c9946cc2b8b920b2d9434d8aa36791ac5df5d0ddb6f93f8b.

When an existing-function update is authorized, deploy only the independent runtime, retaining verify_jwt=true. Validate the check_access route with a legitimate Supabase Auth session for denied and permitted agents, without any inference. Roll back by redeploying the saved v4 source with the same configuration if required. Do not run task execution merely to test authorization. Do not modify other functions or frontend files.

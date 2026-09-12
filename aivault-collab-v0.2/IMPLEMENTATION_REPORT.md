# AIVAULT Agent Collaboration Pool v0.2

Additive collaboration core. Not Production. No deploy.

Repo: `m9wmtcb782-arch/AIVAULT`

Did not modify: AI Gateway, Technical Dark Star core, Compute Mesh core, Task #001 Frozen Contract files.

## 1. Commit

See GitHub `feat(collaboration): build agent collaboration core v0.2` on `main`.

## 2. Files

Modified

- `aivault-agent-collaboration.html` — same three-column UI; version badge v0.2; added Actions / Events / Decision / Resume / Assign; script points to v0.2

Added

- `aivault-collab-v0.2/app.js` — engine + UI bind. Module blocks: CONST / UTIL / STORE / EVENTS / AGENTS / TASKS / MESSAGES / ACTIONS / CODE / REVIEWS / TESTS / DECISIONS / GATES / LEARNING / OWNER / ADAPTER / UI
- `aivault-collab-v0.2/sql/005_agent_collaboration.sql` — additive tables + seed + RLS
- `aivault-collab-v0.2/tests/collab_core_test.js` — Node Tests 1–15
- `aivault-collab-v0.2/IMPLEMENTATION_REPORT.md`

Left in place

- `aivault-collab-v0.1/*` — not deleted

## 3. SQL

`aivault-collab-v0.2/sql/005_agent_collaboration.sql`

Tables:

- agent_registry
- agent_tasks
- agent_task_members
- agent_subtasks
- agent_messages
- agent_reviews
- agent_actions
- agent_code_refs
- agent_test_results
- agent_decisions
- agent_learning_candidates
- agent_task_gates
- agent_events

PK / FK / created_at / indexes / check constraints present.

Authenticated RLS ALL. Anon has no policy. No service_role in client.

SQL is not applied to any live project in this workspace.

## 4. Done

- Extensible Agent Registry (seed 5; add Agent #006+ via UI / `addAgent`)
- Task engine with required fields and status set
- Subtask `#parent-A` naming
- Conversation Pool as work records
- Message schema + types including REVIEW_REQUEST / QUESTION / ANSWER / SYSTEM
- @Agent resolved from Registry
- Agent Action records: WAITING / ASSIGNED / READY / RUNNING / BLOCKED only
- Code Reference with View Code / View Diff / View Commit; missing hash = NOT AVAILABLE
- Review engine PENDING → PASS | NEED_FIX | REJECT
- Test engine; PASS only with explicit owner record
- Decision records; Owner-only production stays Owner
- Gates 1–4 Architecture / Implementation / Verification / Production
- Owner controls
- Event log for replay
- Learning candidates, promoted=false
- Task #001 contract `task.batch.image.classify.v0.1` labeled WAITING FOR LIVE EXECUTION
- Persistence layers: MemoryAdapter + LocalAdapter. Supabase adapter stub only
- `node --check` 0
- Acceptance Tests 1–15 PASS in Node

## 5. Not connected

- Supabase live REST
- Gemini / Grok / ChatGPT / Dark Star API
- Live test runner
- Production deploy
- Gateway / Secret Broker
- Dark Star capability promotion

Banner stays: LOCAL DEMO / SUPABASE NOT CONNECTED

## 6. Tests

Command:

```
node --check aivault-collab-v0.2/app.js
node aivault-collab-v0.2/tests/collab_core_test.js
```

Result:

- syntax check exit 0
- Test 1 create Task PASS
- Test 2 Assign Grok PASS
- Test 3 Assign Dark Star PASS
- Test 4 Grok Message → Pool PASS (owner_proxy=true)
- Test 5 Dark Star Reply → Pool PASS
- Test 6 @ChatGPT Review PASS
- Test 7 Review → NEED_FIX PASS
- Test 8 Grok → FIX PASS
- Test 9 Dark Star → TEST PASS (status NOT_RUN, not auto PASS)
- Test 10 Test → PASS PASS (explicit allow_owner_pass)
- Test 11 Architect → Review PASS
- Test 12 Gate → WAITING PASS
- Test 13 Owner → Approve Gate PASS
- Test 14 Events traceable PASS
- Test 15 Reload persistence PASS
- RESULT 15/15

Headed browser click-through was not run in this sandbox.

## 7. Known issues

- localStorage is demo persistence only. Not the final store.
- Connect button does not load live rows. Returns NOT CONNECTED.
- Agent messages posted as an agent are Owner proxy records.
- Test PASS is an Owner-recorded work record, not a live execution result.
- Seed code refs have commit_hash = null → UI shows NOT AVAILABLE.
- Task #001 remains BLOCKED / WAITING FOR LIVE EXECUTION.
- Applying SQL 005 against an existing v0.1.1 table set may hit CHECK constraint name collisions; apply on a clean test project or review information_schema first.

READY FOR ARCHITECT REVIEW

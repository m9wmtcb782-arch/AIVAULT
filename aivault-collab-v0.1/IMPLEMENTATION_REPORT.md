# AIVAULT Agent Collaboration Pool v0.1.1

Additive local-first collaboration UI + schema. Not Production.

Did not modify: AI Gateway, Technical Dark Star core, Task #001 Frozen Contract, Compute Mesh core, other existing HTML pages.

Repo: `m9wmtcb782-arch/AIVAULT`

## Files

- `aivault-agent-collaboration.html` — UI kept (Task List, Agent Status, Pool, Message Type, @Agent, Code Reference, Review, Subtask, Test Result, Gate, Owner Controls, Learning Candidate, Agent Registry, responsive)
- `aivault-collab-v0.1/collab-app.js` — reformatted; New Task `progress_note` is a closed single-line string; `node --check` = 0
- `aivault-collab-v0.1/sql/005_agent_collaboration.sql` — additive tables (not applied)
- `aivault-collab-v0.1/sql/001_collab_additive.sql` — left in place

## Persistence

localStorage key `aivault.collab.v011.demo`.

Banner: LOCAL DEMO / SUPABASE NOT CONNECTED.

Connect button does not write to Supabase.

## REAL in this commit

- JS parses
- New Task / select / persist in local demo store
- Add Agent to registry (not capped at 5)
- Owner message into pool
- Review request + Owner-recorded verdict (labeled not live agent)
- Code ref View Code / View Commit links
- Learning Candidate rows (promoted=false, not written to Dark Star)
- Task #001 labeled WAITING FOR LIVE EXECUTION

## DEMO / NOT CONNECTED

- No live agent replies
- No auto agent completion claims
- No Gateway call
- No production deploy
- SQL 005 not applied

## Tests

- TEST 1: `node --check aivault-collab-v0.1/collab-app.js` exit 0
- TEST 2-8: handler functions present; headed browser click-through not executed in this sandbox

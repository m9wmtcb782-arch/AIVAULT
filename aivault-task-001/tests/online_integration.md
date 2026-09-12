# Task #001 Online Integration Tests

Base: `$SUPABASE_URL/functions/v1`
Auth: `Authorization: Bearer $SERVICE_ROLE` (server only; never frontend)

Helper hash: `sha256:` + 64 hex
Labels must be lexicographically sorted unique: `["cat","dog"]`

Own-weight labels for happy path: generate items whose hash maps to intended labels via `ownWeightClassify`.

## Test matrix

| # | test | expected | how |
|---|---|---|---|
| 1 | contract reject bad hash | 400 `content_hash_invalid` | POST submit invalid hash |
| 2 | contract reject unsorted labels | 400 `allowed_labels_not_canonical` | labels `["dog","cat"]` |
| 3 | client supplies task_id | 400 `client_must_not_supply_system_fields` | body.task_id set |
| 4 | unmatched | state `unmatched_no_provider` | no online capability / stale heartbeat |
| 5 | happy path settle | `closed` after settle; provider credit <= accepted; currency_minor=0 | seed provider, submit, coord, result matching own-weight, verify, settle |
| 6 | bad provider label | `verified_failed`, provider credit 0 if not settled | result label not in allowed |
| 7 | verification failure | `verified_failed` then queued or blocked | disagree with own model |
| 8 | settlement only passed | settle on failed → 409 | POST settle while verified_failed |
| 9 | retry | second attempt new reserve | fail first, remaining enough |
| 10 | budget block | Frozen example 20/200; first 180; second 160 blocked `settlement_blocked` | MUST |
| 11 | external API off | verify still works | verify uses `aivault.own.system_model.v0.1` only |
| 12 | event replay | events ordered submitted→… | SELECT aivault_task_events ORDER BY at |

## Frozen budget script (must)

```
items=20 budget=200
attempt1 need_exec=160 need_verify=20 used=180 remaining=20
attempt2 need_exec=160
160 > 20 → MUST NOT insert aivault_task_attempts row #2
state = settlement_blocked
```

Set `resample_fraction` so `ceil(20*frac)*2 = 20` → frac=0.5 if units/item=2.

## Curl skeleton

```bash
curl -s "$SUPABASE_URL/functions/v1/aivault-task-submit" \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "apikey: $ANON_OR_SERVICE" \
  -H "Content-Type: application/json" \
  -d '{"payer_id":"research","items":[...]}'
```

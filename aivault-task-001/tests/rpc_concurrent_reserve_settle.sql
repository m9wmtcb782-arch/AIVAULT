-- Deterministic RPC tests for P0 reserve + settlement.
-- Prerequisite: sql/001_task001_additive.sql applied.
-- These two calls are serialized the same way concurrent coordinators
-- are serialized by SELECT ... FOR UPDATE inside the functions.

BEGIN;

-- A. Concurrent reserve: budget 200, each request needs 180.
-- After lock serialization only one attempt exists; spent+reserved <= 200.
DELETE FROM aivault_task_settlements WHERE task_id IN (
  SELECT task_id FROM aivault_tasks WHERE payer_id = 'rpc-test-reserve'
);
DELETE FROM aivault_task_attempts WHERE task_id IN (
  SELECT task_id FROM aivault_tasks WHERE payer_id = 'rpc-test-reserve'
);
DELETE FROM aivault_task_events WHERE task_id IN (
  SELECT task_id FROM aivault_tasks WHERE payer_id = 'rpc-test-reserve'
);
DELETE FROM aivault_task_ledger WHERE task_id IN (
  SELECT task_id FROM aivault_tasks WHERE payer_id = 'rpc-test-reserve'
);
DELETE FROM aivault_tasks WHERE payer_id = 'rpc-test-reserve';

INSERT INTO aivault_tasks (
  payer_id, state, items, item_count, allowed_labels,
  max_compute_units, spent, reserved, reserved_exec, reserved_verify,
  max_attempts, attempt_count, latency_budget_ms, deadline_at
) VALUES (
  'rpc-test-reserve', 'queued',
  '[{"item_id":"1","image_uri":"https://example.com/a.jpg","content_hash":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","allowed_labels":["cat","dog"]}]'::jsonb,
  20, '["cat","dog"]'::jsonb,
  200, 0, 0, 0, 0,
  3, 0, 3600000, now() + interval '1 hour'
);

DO $$
DECLARE
  tid uuid;
  r1 jsonb;
  r2 jsonb;
  attempts integer;
  spent_reserved integer;
  maxu integer;
BEGIN
  SELECT task_id INTO tid FROM aivault_tasks WHERE payer_id = 'rpc-test-reserve';

  r1 := aivault_reserve_attempt(tid, 'p-a', 'p-a:batch.image.classify:task.batch.image.classify.v0.1', 180, 160, 20);
  r2 := aivault_reserve_attempt(tid, 'p-b', 'p-b:batch.image.classify:task.batch.image.classify.v0.1', 180, 160, 20);

  IF (r1->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'test A first reserve must succeed: %', r1;
  END IF;
  IF (r2->>'ok')::boolean IS TRUE THEN
    RAISE EXCEPTION 'test A second reserve must fail: %', r2;
  END IF;

  SELECT count(*) INTO attempts FROM aivault_task_attempts WHERE task_id = tid;
  IF attempts <> 1 THEN
    RAISE EXCEPTION 'test A must have exactly 1 attempt, got %', attempts;
  END IF;

  SELECT spent + reserved, max_compute_units INTO spent_reserved, maxu
  FROM aivault_tasks WHERE task_id = tid;
  IF spent_reserved > maxu THEN
    RAISE EXCEPTION 'test A overspend spent+reserved=% max=%', spent_reserved, maxu;
  END IF;
END $$;

-- B. Concurrent settlement: two claims, one settlement row.
DELETE FROM aivault_task_settlements WHERE task_id IN (
  SELECT task_id FROM aivault_tasks WHERE payer_id = 'rpc-test-settle'
);
DELETE FROM aivault_task_events WHERE task_id IN (
  SELECT task_id FROM aivault_tasks WHERE payer_id = 'rpc-test-settle'
);
DELETE FROM aivault_tasks WHERE payer_id = 'rpc-test-settle';

INSERT INTO aivault_tasks (
  payer_id, state, items, item_count, allowed_labels,
  max_compute_units, spent, reserved, reserved_exec, reserved_verify,
  max_attempts, attempt_count, latency_budget_ms, deadline_at
) VALUES (
  'rpc-test-settle', 'verified_passed',
  '[{"item_id":"1","image_uri":"https://example.com/a.jpg","content_hash":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","allowed_labels":["cat","dog"]}]'::jsonb,
  1, '["cat","dog"]'::jsonb,
  10, 10, 0, 0, 0,
  3, 1, 3600000, now() + interval '1 hour'
);

DO $$
DECLARE
  tid uuid;
  c1 jsonb;
  c2 jsonb;
  n integer;
BEGIN
  SELECT task_id INTO tid FROM aivault_tasks WHERE payer_id = 'rpc-test-settle';
  c1 := aivault_claim_settlement(tid, 1, 1, 1, 8, 2, 10, 8, 2);
  c2 := aivault_claim_settlement(tid, 1, 1, 1, 8, 2, 10, 8, 2);

  IF (c1->>'ok')::boolean IS NOT TRUE OR (c1->>'duplicate')::boolean IS TRUE THEN
    RAISE EXCEPTION 'test B first claim must insert: %', c1;
  END IF;
  IF (c2->>'ok')::boolean IS NOT TRUE OR (c2->>'duplicate')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'test B second claim must be duplicate: %', c2;
  END IF;

  SELECT count(*) INTO n FROM aivault_task_settlements WHERE task_id = tid AND attempt = 1;
  IF n <> 1 THEN
    RAISE EXCEPTION 'test B must have exactly 1 settlement, got %', n;
  END IF;
END $$;

ROLLBACK;

-- Task #001 P0/P1 hardening (additive). Run after 003_p0_p1_fixes.sql.
-- No DROP TABLE / DROP SCHEMA. Replaces reserve + settlement RPCs only.

-- P1-2: latency_budget_ms required; deadline is created_at + latency_budget_ms at submit time.
UPDATE aivault_tasks
SET latency_budget_ms = GREATEST(
  1,
  LEAST(
    86400000,
    FLOOR(EXTRACT(EPOCH FROM (deadline_at - created_at)) * 1000)::integer
  )
)
WHERE latency_budget_ms IS NULL;

ALTER TABLE aivault_tasks
  ALTER COLUMN latency_budget_ms SET NOT NULL;

ALTER TABLE aivault_tasks
  DROP CONSTRAINT IF EXISTS aivault_tasks_latency_chk;
ALTER TABLE aivault_tasks
  ADD CONSTRAINT aivault_tasks_latency_chk
  CHECK (latency_budget_ms BETWEEN 1 AND 86400000);

-- P0-2: settlement uniqueness (idempotent if 003 already created it)
CREATE UNIQUE INDEX IF NOT EXISTS uq_aivault_task_settlements_task_attempt
  ON aivault_task_settlements (task_id, attempt);

-- P0-1: atomic reserve under row lock.
-- spent + reserved <= max_compute_units is enforced by:
--   1. FOR UPDATE on the task row
--   2. remaining check before INSERT
--   3. UPDATE ... WHERE spent + reserved + need <= max
--   4. table CHECK aivault_tasks_budget_invariant
-- Failure (insufficient / max_attempts) does NOT insert attempt; sets settlement_blocked
-- in the same transaction.
CREATE OR REPLACE FUNCTION aivault_reserve_attempt(
  p_task_id uuid,
  p_provider_id text,
  p_capability_id text,
  p_quoted integer,
  p_need_exec integer,
  p_need_verify integer
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  t aivault_tasks%ROWTYPE;
  need integer;
  att aivault_task_attempts%ROWTYPE;
  next_attempt integer;
  remaining integer;
BEGIN
  IF p_need_exec < 0 OR p_need_verify < 0 THEN
    RAISE EXCEPTION 'invalid_need';
  END IF;
  need := p_need_exec + p_need_verify;

  SELECT * INTO t FROM aivault_tasks WHERE task_id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'task_not_found');
  END IF;

  IF t.state IS DISTINCT FROM 'queued' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_state', 'state', t.state::text);
  END IF;

  remaining := t.max_compute_units - t.spent - t.reserved;

  IF t.attempt_count >= t.max_attempts THEN
    PERFORM aivault_assert_transition('queued', 'settlement_blocked');
    UPDATE aivault_tasks
    SET state = 'settlement_blocked', updated_at = now()
    WHERE task_id = p_task_id AND state = 'queued';
    INSERT INTO aivault_task_events (task_id, from_state, to_state, actor, reason_code, payload)
    VALUES (p_task_id, 'queued', 'settlement_blocked', 'coordinator', 'max_attempts', '{}'::jsonb);
    RETURN jsonb_build_object('ok', false, 'reason', 'max_attempts', 'block', true);
  END IF;

  IF remaining < need THEN
    PERFORM aivault_assert_transition('queued', 'settlement_blocked');
    UPDATE aivault_tasks
    SET state = 'settlement_blocked', updated_at = now()
    WHERE task_id = p_task_id AND state = 'queued';
    INSERT INTO aivault_task_events (task_id, from_state, to_state, actor, reason_code, payload)
    VALUES (
      p_task_id, 'queued', 'settlement_blocked', 'coordinator', 'insufficient_remaining',
      jsonb_build_object('remaining', remaining, 'need', need)
    );
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_remaining',
      'block', true,
      'remaining', remaining,
      'need_exec', p_need_exec,
      'need_verify', p_need_verify
    );
  END IF;

  next_attempt := t.attempt_count + 1;

  INSERT INTO aivault_task_attempts (
    task_id, attempt, provider_id, capability_id, state,
    quoted_estimate, need_exec, need_verify, reserved_exec, reserved_verify
  ) VALUES (
    p_task_id, next_attempt, p_provider_id, p_capability_id, 'matched',
    p_quoted, p_need_exec, p_need_verify, p_need_exec, p_need_verify
  )
  RETURNING * INTO att;

  UPDATE aivault_tasks
  SET reserved = reserved + need,
      reserved_exec = reserved_exec + p_need_exec,
      reserved_verify = reserved_verify + p_need_verify,
      attempt_count = next_attempt,
      state = 'matched',
      updated_at = now()
  WHERE task_id = p_task_id
    AND state = 'queued'
    AND spent + reserved + need <= max_compute_units;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reserve_race_aborted';
  END IF;

  INSERT INTO aivault_task_events (task_id, from_state, to_state, actor, reason_code, attempt, payload)
  VALUES (
    p_task_id, 'queued', 'matched', 'coordinator', 'matched', next_attempt,
    jsonb_build_object('need_exec', p_need_exec, 'need_verify', p_need_verify)
  );

  INSERT INTO aivault_task_ledger (task_id, attempt, spent, reserved, remaining, reserved_exec, reserved_verify, note)
  SELECT task_id, next_attempt, spent, reserved, remaining, reserved_exec, reserved_verify, 'atomic_reserve'
  FROM aivault_tasks WHERE task_id = p_task_id;

  RETURN jsonb_build_object('ok', true, 'attempt', to_jsonb(att), 'need', need);
END;
$$;

-- P0-2: settlement claim + verified_passed → settled in one lock.
-- Unique (task_id, attempt) + unique_violation handler.
-- Duplicate returns existing row and does not write credits again.
CREATE OR REPLACE FUNCTION aivault_claim_settlement(
  p_task_id uuid,
  p_attempt integer,
  p_passed_items integer,
  p_sampled_items integer,
  p_provider_credit integer,
  p_verifier_credit integer,
  p_payer_debit integer,
  p_accepted_provider integer,
  p_verification_units integer
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  t aivault_tasks%ROWTYPE;
  s aivault_task_settlements%ROWTYPE;
BEGIN
  SELECT * INTO t FROM aivault_tasks WHERE task_id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'task_not_found');
  END IF;

  SELECT * INTO s FROM aivault_task_settlements
  WHERE task_id = p_task_id AND attempt = p_attempt;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'settlement', to_jsonb(s), 'state', t.state::text);
  END IF;

  IF t.state IS DISTINCT FROM 'verified_passed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'settlement_only_on_verified_passed', 'state', t.state::text);
  END IF;

  BEGIN
    INSERT INTO aivault_task_settlements (
      task_id, attempt, status, passed_items, sampled_items,
      provider_credit_units, verifier_credit_units, payer_debit_units,
      accepted_provider_units, verification_units, currency_minor
    ) VALUES (
      p_task_id, p_attempt, 'settled', p_passed_items, p_sampled_items,
      p_provider_credit, p_verifier_credit, p_payer_debit,
      p_accepted_provider, p_verification_units, 0
    )
    RETURNING * INTO s;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO s FROM aivault_task_settlements WHERE task_id = p_task_id AND attempt = p_attempt;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'settlement', to_jsonb(s));
  END;

  PERFORM aivault_assert_transition('verified_passed', 'settled');
  UPDATE aivault_tasks
  SET state = 'settled', updated_at = now()
  WHERE task_id = p_task_id AND state = 'verified_passed';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'settlement_state_race';
  END IF;

  INSERT INTO aivault_task_events (task_id, from_state, to_state, actor, reason_code, attempt, payload)
  VALUES (p_task_id, 'verified_passed', 'settled', 'settle', 'settled', p_attempt, '{}'::jsonb);

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'settlement', to_jsonb(s), 'state', 'settled');
END;
$$;

REVOKE ALL ON FUNCTION aivault_reserve_attempt(uuid, text, text, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION aivault_claim_settlement(uuid, integer, integer, integer, integer, integer, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION aivault_reserve_attempt(uuid, text, text, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION aivault_claim_settlement(uuid, integer, integer, integer, integer, integer, integer, integer, integer) TO service_role;

-- Task #001 P0/P1 additive fixes. No DROP TABLE / SCHEMA.
-- Safe to run after 001_task001_additive.sql

ALTER TABLE aivault_tasks
  ADD COLUMN IF NOT EXISTS latency_budget_ms integer;

ALTER TABLE aivault_tasks
  DROP CONSTRAINT IF EXISTS aivault_tasks_latency_chk;
ALTER TABLE aivault_tasks
  ADD CONSTRAINT aivault_tasks_latency_chk
  CHECK (latency_budget_ms IS NULL OR (latency_budget_ms BETWEEN 1 AND 86400000));

ALTER TABLE aivault_tasks
  DROP CONSTRAINT IF EXISTS aivault_tasks_payer_nonempty;
ALTER TABLE aivault_tasks
  ADD CONSTRAINT aivault_tasks_payer_nonempty
  CHECK (length(btrim(payer_id)) > 0);

ALTER TABLE aivault_tasks
  DROP CONSTRAINT IF EXISTS aivault_tasks_budget_invariant;
ALTER TABLE aivault_tasks
  ADD CONSTRAINT aivault_tasks_budget_invariant
  CHECK (spent + reserved <= max_compute_units);

CREATE UNIQUE INDEX IF NOT EXISTS uq_aivault_task_settlements_task_attempt
  ON aivault_task_settlements (task_id, attempt);

ALTER TABLE aivault_compute_capabilities
  DROP CONSTRAINT IF EXISTS aivault_cap_verification_level_chk;
ALTER TABLE aivault_compute_capabilities
  ADD CONSTRAINT aivault_cap_verification_level_chk
  CHECK (verification_level IN ('resample', 'dual_model', 'human'));

UPDATE aivault_compute_capabilities
SET verification_level = 'resample'
WHERE verification_level IS NULL
   OR verification_level NOT IN ('resample', 'dual_model', 'human');

ALTER TABLE aivault_compute_capabilities
  ALTER COLUMN verification_level SET DEFAULT 'resample';

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

  IF t.attempt_count >= t.max_attempts THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'max_attempts', 'block', true);
  END IF;

  IF (t.max_compute_units - t.spent - t.reserved) < need THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_remaining',
      'block', true,
      'remaining', t.max_compute_units - t.spent - t.reserved,
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
      reserved_exec = p_need_exec,
      reserved_verify = p_need_verify,
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
  VALUES (p_task_id, 'queued', 'matched', 'coordinator', 'matched', next_attempt,
          jsonb_build_object('need_exec', p_need_exec, 'need_verify', p_need_verify));

  INSERT INTO aivault_task_ledger (task_id, attempt, spent, reserved, remaining, reserved_exec, reserved_verify, note)
  SELECT task_id, next_attempt, spent, reserved, remaining, reserved_exec, reserved_verify, 'atomic_reserve'
  FROM aivault_tasks WHERE task_id = p_task_id;

  RETURN jsonb_build_object('ok', true, 'attempt', to_jsonb(att), 'need', need);
END;
$$;

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

  IF t.state IS DISTINCT FROM 'verified_passed' THEN
    SELECT * INTO s FROM aivault_task_settlements WHERE task_id = p_task_id AND attempt = p_attempt;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'settlement', to_jsonb(s));
    END IF;
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

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'settlement', to_jsonb(s));
END;
$$;

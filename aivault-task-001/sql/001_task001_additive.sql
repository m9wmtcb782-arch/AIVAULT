-- AIVAULT Task #001 additive migration
-- Contract: task.batch.image.classify.v0.1
-- Router: router.v0.1
-- SAFE: no DROP TABLE / DROP FUNCTION / DROP SCHEMA
-- Additive only. Do not run if collision review is unresolved.

-- ========== ENUMS (create only if missing) ==========
DO $$ BEGIN
  CREATE TYPE aivault_task_state AS ENUM (
    'submitted',
    'contract_validated',
    'queued',
    'matched',
    'accepted',
    'executing',
    'result_received',
    'verifying',
    'verified_passed',
    'verified_failed',
    'waived',
    'settled',
    'settlement_blocked',
    'capability_updated',
    'closed',
    'rejected_invalid_contract',
    'unmatched_no_provider',
    'accept_timeout',
    'exec_timeout',
    'exec_failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE aivault_trust_level AS ENUM ('untrusted', 'observed', 'trusted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE aivault_capability_tier AS ENUM ('research', 'limited', 'production', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE aivault_verification_mode AS ENUM ('resample', 'dual_model');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ========== TABLES ==========
CREATE TABLE IF NOT EXISTS aivault_tasks (
  task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL DEFAULT 'batch.image.classify',
  contract_version text NOT NULL DEFAULT 'task.batch.image.classify.v0.1',
  router_version text NOT NULL DEFAULT 'router.v0.1',
  payer_id text NOT NULL,
  state aivault_task_state NOT NULL DEFAULT 'submitted',
  items jsonb NOT NULL,
  item_count integer NOT NULL,
  allowed_labels jsonb NOT NULL,
  max_compute_units integer NOT NULL,
  spent integer NOT NULL DEFAULT 0,
  reserved integer NOT NULL DEFAULT 0,
  remaining integer GENERATED ALWAYS AS (max_compute_units - spent - reserved) STORED,
  reserved_exec integer NOT NULL DEFAULT 0,
  reserved_verify integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  attempt_count integer NOT NULL DEFAULT 0,
  require_different_provider boolean NOT NULL DEFAULT true,
  verification_mode aivault_verification_mode NOT NULL DEFAULT 'resample',
  resample_fraction numeric NOT NULL DEFAULT 0.10,
  verification_compute_units_per_item integer NOT NULL DEFAULT 2,
  min_confidence numeric NOT NULL DEFAULT 0,
  resample_agree_ratio_threshold numeric NOT NULL DEFAULT 0.95,
  latency_budget_ms integer NOT NULL,
  deadline_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  research_currency boolean NOT NULL DEFAULT true,
  max_currency_minor bigint NOT NULL DEFAULT 0,
  input_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT aivault_tasks_item_count_chk CHECK (item_count BETWEEN 1 AND 10000),
  CONSTRAINT aivault_tasks_budget_chk CHECK (max_compute_units >= item_count * 10),
  CONSTRAINT aivault_tasks_spent_chk CHECK (spent >= 0),
  CONSTRAINT aivault_tasks_reserved_chk CHECK (reserved >= 0),
  CONSTRAINT aivault_tasks_max_attempts_chk CHECK (max_attempts = 3),
  CONSTRAINT aivault_tasks_payer_nonempty CHECK (length(btrim(payer_id)) > 0),
  CONSTRAINT aivault_tasks_latency_chk CHECK (latency_budget_ms BETWEEN 1 AND 86400000),
  CONSTRAINT aivault_tasks_budget_invariant CHECK (spent + reserved <= max_compute_units)
);

CREATE INDEX IF NOT EXISTS idx_aivault_tasks_state ON aivault_tasks(state);
CREATE INDEX IF NOT EXISTS idx_aivault_tasks_payer ON aivault_tasks(payer_id);
CREATE INDEX IF NOT EXISTS idx_aivault_tasks_created ON aivault_tasks(created_at);

CREATE TABLE IF NOT EXISTS aivault_task_attempts (
  attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES aivault_tasks(task_id),
  attempt integer NOT NULL,
  provider_id text,
  capability_id text,
  state aivault_task_state NOT NULL,
  quoted_estimate integer,
  need_exec integer NOT NULL DEFAULT 0,
  need_verify integer NOT NULL DEFAULT 0,
  reserved_exec integer NOT NULL DEFAULT 0,
  reserved_verify integer NOT NULL DEFAULT 0,
  claimed_compute_units integer,
  accepted_compute_units integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  failure_reason text,
  UNIQUE (task_id, attempt)
);

CREATE INDEX IF NOT EXISTS idx_aivault_task_attempts_task ON aivault_task_attempts(task_id);

CREATE TABLE IF NOT EXISTS aivault_task_events (
  event_id bigserial PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES aivault_tasks(task_id),
  from_state aivault_task_state,
  to_state aivault_task_state NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  reason_code text,
  attempt integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_aivault_task_events_task ON aivault_task_events(task_id, at);

CREATE TABLE IF NOT EXISTS aivault_task_ledger (
  ledger_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES aivault_tasks(task_id),
  attempt integer,
  spent integer NOT NULL DEFAULT 0,
  reserved integer NOT NULL DEFAULT 0,
  remaining integer NOT NULL DEFAULT 0,
  reserved_exec integer NOT NULL DEFAULT 0,
  reserved_verify integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aivault_task_ledger_events (
  id bigserial PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES aivault_tasks(task_id),
  event_type text NOT NULL,
  delta_spent integer NOT NULL DEFAULT 0,
  delta_reserved integer NOT NULL DEFAULT 0,
  actor text NOT NULL,
  reason_code text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aivault_compute_capabilities (
  capability_id text PRIMARY KEY,
  provider_id text NOT NULL,
  task_type text NOT NULL,
  contract_versions text[] NOT NULL,
  device_class text,
  runtime text,
  supported_models text[] NOT NULL DEFAULT '{}',
  memory_mb integer,
  advertised_latency_p50 numeric,
  advertised_latency_p95 numeric,
  observed_latency_p50 numeric,
  observed_latency_p95 numeric,
  observed_availability numeric,
  observed_agree_ratio numeric,
  observed_unit_cost numeric,
  sample_n integer NOT NULL DEFAULT 0,
  window integer NOT NULL DEFAULT 100,
  verification_level text NOT NULL DEFAULT 'resample',
  trust_level aivault_trust_level NOT NULL DEFAULT 'untrusted',
  capability_tier aivault_capability_tier NOT NULL DEFAULT 'research',
  price_per_compute_unit numeric NOT NULL DEFAULT 0,
  online boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  heartbeat_at timestamptz,
  reward_units_per_item integer NOT NULL DEFAULT 8,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aivault_cap_id_deterministic CHECK (
    capability_id = provider_id || ':' || task_type || ':' || contract_versions[1]
  ),
  CONSTRAINT aivault_cap_verification_level_chk CHECK (
    verification_level IN ('resample', 'dual_model', 'human')
  )
);

CREATE INDEX IF NOT EXISTS idx_aivault_cap_provider ON aivault_compute_capabilities(provider_id);
CREATE INDEX IF NOT EXISTS idx_aivault_cap_online ON aivault_compute_capabilities(online, task_type);

CREATE TABLE IF NOT EXISTS aivault_task_results (
  result_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES aivault_tasks(task_id),
  execution_id text NOT NULL,
  attempt integer NOT NULL,
  provider_id text NOT NULL,
  started_at timestamptz,
  finished_at timestamptz,
  model_id text,
  model_version text,
  runtime text,
  device_class text,
  input_hash text,
  items jsonb NOT NULL,
  output_hash text,
  compute_units_claimed integer NOT NULL,
  compute_units_accepted integer NOT NULL,
  execution_cost_minor bigint NOT NULL DEFAULT 0,
  verification_status text,
  verification_score numeric,
  verification_compute_units integer DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0,
  failure_reason text,
  capability_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aivault_results_accepted_le_claimed CHECK (compute_units_accepted <= compute_units_claimed)
);

CREATE INDEX IF NOT EXISTS idx_aivault_results_task ON aivault_task_results(task_id, attempt);

CREATE TABLE IF NOT EXISTS aivault_task_verifications (
  verification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES aivault_tasks(task_id),
  attempt integer NOT NULL,
  mode aivault_verification_mode NOT NULL,
  sample_count integer NOT NULL,
  sampled_item_ids jsonb NOT NULL,
  content_hash_match boolean,
  schema_valid boolean,
  label_in_allowed boolean,
  min_confidence_ok boolean,
  resample_agree_ratio numeric,
  verification_status text NOT NULL,
  verification_compute_units integer NOT NULL,
  verifier_model text NOT NULL DEFAULT 'aivault.own.system_model.v0.1',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aivault_task_settlements (
  settlement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES aivault_tasks(task_id),
  attempt integer NOT NULL,
  UNIQUE (task_id, attempt),
  status text NOT NULL,
  passed_items integer NOT NULL DEFAULT 0,
  sampled_items integer NOT NULL DEFAULT 0,
  provider_credit_units integer NOT NULL DEFAULT 0,
  verifier_credit_units integer NOT NULL DEFAULT 0,
  payer_debit_units integer NOT NULL DEFAULT 0,
  accepted_provider_units integer NOT NULL DEFAULT 0,
  verification_units integer NOT NULL DEFAULT 0,
  currency_minor bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aivault_capability_result_window (
  id bigserial PRIMARY KEY,
  capability_id text NOT NULL REFERENCES aivault_compute_capabilities(capability_id),
  task_id uuid NOT NULL,
  agree_ratio numeric,
  p95_ms numeric,
  available boolean,
  unit_cost numeric,
  hash_mismatch boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Legal transitions
CREATE TABLE IF NOT EXISTS aivault_task_transition_guard (
  from_state aivault_task_state NOT NULL,
  to_state aivault_task_state NOT NULL,
  PRIMARY KEY (from_state, to_state)
);

INSERT INTO aivault_task_transition_guard (from_state, to_state) VALUES
  ('submitted', 'contract_validated'),
  ('submitted', 'rejected_invalid_contract'),
  ('contract_validated', 'queued'),
  ('queued', 'matched'),
  ('queued', 'unmatched_no_provider'),
  ('queued', 'settlement_blocked'),
  ('matched', 'accepted'),
  ('matched', 'accept_timeout'),
  ('accepted', 'executing'),
  ('executing', 'result_received'),
  ('executing', 'exec_timeout'),
  ('executing', 'exec_failed'),
  ('result_received', 'verifying'),
  ('verifying', 'verified_passed'),
  ('verifying', 'verified_failed'),
  ('verifying', 'waived'),
  ('verified_passed', 'settled'),
  ('verified_failed', 'queued'),
  ('verified_failed', 'settlement_blocked'),
  ('verified_failed', 'closed'),
  ('accept_timeout', 'queued'),
  ('accept_timeout', 'settlement_blocked'),
  ('accept_timeout', 'closed'),
  ('exec_timeout', 'queued'),
  ('exec_timeout', 'settlement_blocked'),
  ('exec_timeout', 'closed'),
  ('exec_failed', 'queued'),
  ('exec_failed', 'settlement_blocked'),
  ('exec_failed', 'closed'),
  ('settled', 'capability_updated'),
  ('capability_updated', 'closed'),
  ('settlement_blocked', 'closed'),
  ('unmatched_no_provider', 'closed'),
  ('rejected_invalid_contract', 'closed'),
  ('waived', 'settled'),
  ('waived', 'closed')
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE aivault_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_task_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_task_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_task_ledger_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_compute_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_task_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_task_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_task_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_capability_result_window ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_task_transition_guard ENABLE ROW LEVEL SECURITY;

-- No anonymous write. Authenticated read of own payer tasks only.
DROP POLICY IF EXISTS aivault_tasks_select_own ON aivault_tasks;
CREATE POLICY aivault_tasks_select_own ON aivault_tasks
  FOR SELECT TO authenticated
  USING (payer_id = auth.uid()::text);

DROP POLICY IF EXISTS aivault_cap_select_online ON aivault_compute_capabilities;
CREATE POLICY aivault_cap_select_online ON aivault_compute_capabilities
  FOR SELECT TO authenticated
  USING (true);

-- service role bypasses RLS by default in Supabase.

-- Transition helper
CREATE OR REPLACE FUNCTION aivault_assert_transition(p_from aivault_task_state, p_to aivault_task_state)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM aivault_task_transition_guard g
    WHERE g.from_state = p_from AND g.to_state = p_to
  ) THEN
    RAISE EXCEPTION 'illegal_transition:%->%', p_from, p_to;
  END IF;
END;
$$;

-- ========== P0 RPC (must live in this file) ==========
CREATE UNIQUE INDEX IF NOT EXISTS uq_aivault_task_settlements_task_attempt
  ON aivault_task_settlements (task_id, attempt);

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

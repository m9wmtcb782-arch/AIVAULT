-- AIVAULT Worker state + claim/lease v0.2.2
-- Additive. No DROP TABLE. No second task table. No provider name.
-- Does not modify Technical Dark Star core, AI Gateway, or Compute Mesh files.
-- NOT APPLIED. Live apply still requires Owner SQL Editor.

ALTER TABLE agent_registry
  ADD COLUMN IF NOT EXISTS model_version_id text,
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS last_heartbeat timestamptz,
  ADD COLUMN IF NOT EXISTS lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE agent_subtasks
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS model_version_id text,
  ADD COLUMN IF NOT EXISTS claimed_by text,
  ADD COLUMN IF NOT EXISTS lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS result_status text;

DO $$ BEGIN
  ALTER TABLE agent_subtasks
    ADD CONSTRAINT agent_subtasks_status_chk
    CHECK (status IN ('DRAFT', 'READY', 'CLAIMED', 'DONE'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_subtasks_ready
  ON agent_subtasks(role, status, created_at);

CREATE OR REPLACE FUNCTION agent_worker_heartbeat(
  p_worker_id text,
  p_device_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE agent_registry
  SET last_heartbeat = now(),
      device_id = COALESCE(p_device_id, device_id),
      connection_status = 'connected',
      status = CASE WHEN status = 'OFFLINE' THEN 'WAITING' ELSE status END,
      updated_at = now()
  WHERE agent_id = p_worker_id
    AND role IN ('extract', 'verify');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'worker not found or role not extract/verify';
  END IF;
  RETURN jsonb_build_object('worker_id', p_worker_id, 'heartbeat', now());
END;
$$;

CREATE OR REPLACE FUNCTION agent_claim_subtask(
  p_worker_id text,
  p_lease_seconds integer DEFAULT 30
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w agent_registry%ROWTYPE;
  s agent_subtasks%ROWTYPE;
  lease_for interval;
BEGIN
  SELECT * INTO w
  FROM agent_registry
  WHERE agent_id = p_worker_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'worker not found';
  END IF;
  IF w.role NOT IN ('extract', 'verify') THEN
    RAISE EXCEPTION 'role not allowed';
  END IF;
  IF w.model_version_id IS NULL THEN
    RAISE EXCEPTION 'model_version_id required';
  END IF;
  IF w.last_heartbeat IS NULL
     OR w.last_heartbeat < now() - interval '45 seconds' THEN
    RAISE EXCEPTION 'heartbeat stale';
  END IF;

  lease_for := make_interval(secs => LEAST(GREATEST(COALESCE(p_lease_seconds, 30), 1), 30));

  SELECT * INTO s
  FROM agent_subtasks
  WHERE status = 'READY'
    AND role = w.role
    AND (model_version_id IS NULL OR model_version_id = w.model_version_id)
    AND (lease_until IS NULL OR lease_until < now())
    AND (
      w.role <> 'verify'
      OR EXISTS (
        SELECT 1
        FROM agent_subtasks e
        WHERE e.parent_task_id = agent_subtasks.parent_task_id
          AND e.role = 'extract'
          AND e.status = 'DONE'
          AND e.result_status = 'accepted'
      )
    )
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed', false);
  END IF;

  UPDATE agent_subtasks
  SET status = 'CLAIMED',
      claimed_by = w.agent_id,
      assigned_agent = w.agent_id,
      attempt = attempt + 1,
      lease_until = now() + lease_for,
      idempotency_key = subtask_id || ':' || (attempt + 1)::text,
      result_status = NULL,
      updated_at = now()
  WHERE subtask_id = s.subtask_id
    AND status = 'READY'
  RETURNING * INTO s;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed', false);
  END IF;

  UPDATE agent_registry
  SET status = 'WORKING',
      current_task_id = s.parent_task_id,
      lease_until = s.lease_until,
      attempt = attempt + 1,
      idempotency_key = s.idempotency_key,
      updated_at = now()
  WHERE agent_id = w.agent_id;

  RETURN jsonb_build_object(
    'claimed', true,
    'subtask_id', s.subtask_id,
    'parent_task_id', s.parent_task_id,
    'role', s.role,
    'attempt', s.attempt,
    'idempotency_key', s.idempotency_key,
    'lease_until', s.lease_until,
    'worker_id', w.agent_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION agent_submit_subtask_result(
  p_worker_id text,
  p_subtask_id text,
  p_idempotency_key text,
  p_result text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w agent_registry%ROWTYPE;
  s agent_subtasks%ROWTYPE;
BEGIN
  SELECT * INTO w FROM agent_registry WHERE agent_id = p_worker_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'worker not found';
  END IF;
  IF w.last_heartbeat IS NULL
     OR w.last_heartbeat < now() - interval '45 seconds' THEN
    RAISE EXCEPTION 'dead worker result rejected';
  END IF;

  SELECT * INTO s
  FROM agent_subtasks
  WHERE subtask_id = p_subtask_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subtask not found';
  END IF;
  IF s.status <> 'CLAIMED' OR s.claimed_by IS DISTINCT FROM p_worker_id THEN
    RAISE EXCEPTION 'not claim holder';
  END IF;
  IF s.lease_until IS NULL OR s.lease_until < now() THEN
    RAISE EXCEPTION 'lease expired';
  END IF;
  IF s.idempotency_key IS DISTINCT FROM p_idempotency_key THEN
    RAISE EXCEPTION 'idempotency mismatch';
  END IF;

  UPDATE agent_subtasks
  SET status = 'DONE',
      result = p_result,
      result_status = 'accepted',
      lease_until = NULL,
      updated_at = now()
  WHERE subtask_id = p_subtask_id
    AND status = 'CLAIMED'
    AND claimed_by = p_worker_id;

  UPDATE agent_registry
  SET status = 'WAITING',
      current_task_id = NULL,
      lease_until = NULL,
      updated_at = now()
  WHERE agent_id = p_worker_id;

  RETURN jsonb_build_object(
    'accepted', true,
    'subtask_id', p_subtask_id,
    'idempotency_key', p_idempotency_key
  );
END;
$$;

-- Caller is the Dark Star control loop via agent_darkstar_tick().
-- pg_cron on this project is NOT VERIFIED. No second scheduler is created here.
CREATE OR REPLACE FUNCTION agent_expire_leases()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
  m integer;
BEGIN
  UPDATE agent_subtasks
  SET status = 'READY',
      claimed_by = NULL,
      assigned_agent = NULL,
      lease_until = NULL,
      result_status = 'expired',
      result = NULL,
      updated_at = now()
  WHERE status = 'CLAIMED'
    AND lease_until IS NOT NULL
    AND lease_until < now()
    AND COALESCE(result_status, '') <> 'accepted';
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE agent_registry
  SET status = 'OFFLINE',
      connection_status = 'not_connected',
      lease_until = NULL,
      current_task_id = NULL,
      updated_at = now()
  WHERE role IN ('extract', 'verify')
    AND status = 'WORKING'
    AND (last_heartbeat IS NULL OR last_heartbeat < now() - interval '45 seconds');
  GET DIAGNOSTICS m = ROW_COUNT;

  RETURN jsonb_build_object('released', n, 'workers_offline', m);
END;
$$;

REVOKE ALL ON FUNCTION agent_worker_heartbeat(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION agent_claim_subtask(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION agent_submit_subtask_result(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION agent_expire_leases() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION agent_worker_heartbeat(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION agent_claim_subtask(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION agent_submit_subtask_result(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION agent_expire_leases() TO authenticated;

INSERT INTO agent_registry (
  agent_id, display_name, role, capability, abilities, status, connection_status, model_version_id
) VALUES
  ('Worker-001', 'Worker-001', 'extract', 'extract', 'extract', 'WAITING', 'not_connected', 'mv-phase1'),
  ('Worker-002', 'Worker-002', 'extract', 'extract', 'extract', 'WAITING', 'not_connected', 'mv-phase1'),
  ('Worker-003', 'Worker-003', 'verify', 'verify', 'verify', 'WAITING', 'not_connected', 'mv-phase1')
ON CONFLICT (agent_id) DO UPDATE
SET role = EXCLUDED.role,
    model_version_id = EXCLUDED.model_version_id,
    updated_at = now();

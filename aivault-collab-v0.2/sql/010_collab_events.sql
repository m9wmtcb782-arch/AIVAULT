-- 010 collab events + scalable pool + simulated lifecycle. NOT a second worker system.
-- Does not DROP, ALTER, or rewrite public.agent_events.

CREATE TABLE IF NOT EXISTS collab_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text,
  event_type text NOT NULL,
  actor_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agent_registry
  ADD COLUMN IF NOT EXISTS is_simulated boolean NOT NULL DEFAULT false;

ALTER TABLE model_registry
  ADD COLUMN IF NOT EXISTS is_simulated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_health_at timestamptz,
  ADD COLUMN IF NOT EXISTS health_result text;

ALTER TABLE model_registry DROP CONSTRAINT IF EXISTS model_registry_availability_chk;
ALTER TABLE model_registry
  ADD CONSTRAINT model_registry_availability_chk
  CHECK (availability IN ('AVAILABLE', 'PLANNED', 'SIMULATED'));

INSERT INTO model_registry (model_id, model_version_id, capabilities, availability, is_simulated)
VALUES
  ('sim-extract', 'sim-extract-v0', 'extract', 'SIMULATED', true),
  ('sim-verify', 'sim-verify-v0', 'verify', 'SIMULATED', true)
ON CONFLICT (model_id) DO UPDATE
SET availability = EXCLUDED.availability,
    is_simulated = EXCLUDED.is_simulated;

INSERT INTO agent_registry (
  agent_id, display_name, role, capability, abilities, capabilities,
  status, connection_status, model_id, model_version_id, is_simulated
)
SELECT
  'Worker-' || lpad(n::text, 4, '0'),
  'Worker-' || lpad(n::text, 4, '0'),
  s.role, s.capability, s.capability, s.capability,
  'WAITING', 'not_connected', s.model_id, s.model_version_id, false
FROM generate_series(101, 1000) AS n
JOIN (
  SELECT 101 AS lo, 500 AS hi, 'extract' AS role, 'extract' AS capability, 'planned-extract' AS model_id, 'planned-extract-v0' AS model_version_id
  UNION ALL SELECT 501, 700, 'reasoning', 'reasoning', 'planned-reasoning', 'planned-reasoning-v0'
  UNION ALL SELECT 701, 850, 'coding', 'coding', 'planned-coding', 'planned-coding-v0'
  UNION ALL SELECT 851, 950, 'vision', 'vision', 'planned-vision', 'planned-vision-v0'
  UNION ALL SELECT 951, 1000, 'verify', 'verify', 'planned-verify', 'planned-verify-v0'
) s ON n BETWEEN s.lo AND s.hi
ON CONFLICT (agent_id) DO UPDATE
SET role = EXCLUDED.role,
    model_id = EXCLUDED.model_id,
    model_version_id = EXCLUDED.model_version_id,
    capabilities = EXCLUDED.capabilities,
    updated_at = now()
WHERE agent_registry.role IS DISTINCT FROM EXCLUDED.role
   OR agent_registry.model_id IS DISTINCT FROM EXCLUDED.model_id;

INSERT INTO agent_registry (
  agent_id, display_name, role, capability, abilities, capabilities,
  status, connection_status, model_id, model_version_id, is_simulated
) VALUES
  ('Worker-sim-001', 'Worker-sim-001', 'extract', 'extract', 'extract', 'extract', 'WAITING', 'not_connected', 'sim-extract', 'sim-extract-v0', true),
  ('Worker-sim-002', 'Worker-sim-002', 'extract', 'extract', 'extract', 'extract', 'WAITING', 'not_connected', 'sim-extract', 'sim-extract-v0', true),
  ('Worker-sim-003', 'Worker-sim-003', 'verify', 'verify', 'verify', 'verify', 'WAITING', 'not_connected', 'sim-verify', 'sim-verify-v0', true)
ON CONFLICT (agent_id) DO UPDATE
SET role = EXCLUDED.role,
    model_id = EXCLUDED.model_id,
    model_version_id = EXCLUDED.model_version_id,
    is_simulated = true,
    updated_at = now();

CREATE OR REPLACE FUNCTION agent_model_health_check(p_model_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m model_registry%ROWTYPE;
  result text;
BEGIN
  SELECT * INTO m FROM model_registry WHERE model_id = p_model_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'model not found';
  END IF;
  result := CASE WHEN m.availability = 'AVAILABLE' THEN 'available' ELSE 'not_available' END;
  UPDATE model_registry
  SET last_health_at = now(),
      health_result = result
  WHERE model_id = p_model_id;
  RETURN jsonb_build_object(
    'model_id', p_model_id,
    'availability', m.availability,
    'health_result', result,
    'changed_to_available', false
  );
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
  model_state text;
  model_sim boolean;
BEGIN
  SELECT * INTO w FROM agent_registry WHERE agent_id = p_worker_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'worker not found';
  END IF;
  IF w.last_heartbeat IS NULL OR w.last_heartbeat < now() - interval '45 seconds' THEN
    RAISE EXCEPTION 'heartbeat stale';
  END IF;
  SELECT availability, is_simulated INTO model_state, model_sim
  FROM model_registry WHERE model_id = w.model_id;
  IF model_state = 'AVAILABLE' THEN
    NULL;
  ELSIF model_state = 'SIMULATED' AND w.is_simulated AND COALESCE(model_sim, false) THEN
    NULL;
  ELSE
    RETURN jsonb_build_object('claimed', false, 'reason', 'model_not_available');
  END IF;

  lease_for := make_interval(secs => LEAST(GREATEST(COALESCE(p_lease_seconds, 30), 1), 30));

  SELECT * INTO s
  FROM agent_subtasks
  WHERE status = 'READY'
    AND role = w.role
    AND (capability IS NULL OR capability = w.capabilities)
    AND (model_version_id IS NULL OR model_version_id = w.model_version_id)
    AND (lease_until IS NULL OR lease_until < now())
    AND (
      w.role <> 'verify'
      OR EXISTS (
        SELECT 1 FROM agent_subtasks e
        WHERE e.parent_task_id = agent_subtasks.parent_task_id
          AND e.status = 'DONE'
          AND e.result_status = 'accepted'
          AND e.role <> 'verify'
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

CREATE OR REPLACE FUNCTION agent_darkstar_create_cycle(
  p_task_id text,
  p_title text,
  p_description text,
  p_role text DEFAULT 'extract',
  p_capability text DEFAULT 'extract'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  work_id text;
  verify_id text;
BEGIN
  IF p_task_id IS NULL OR p_title IS NULL THEN
    RAISE EXCEPTION 'task_id and title required';
  END IF;
  INSERT INTO agent_tasks (
    task_id, title, name, description, owner_id, status, priority, created_by
  ) VALUES (
    p_task_id, p_title, p_title, COALESCE(p_description, ''), 'owner', 'READY', 'NORMAL', 'darkstar'
  );
  work_id := p_task_id || '-' || p_role;
  verify_id := p_task_id || '-verify';
  INSERT INTO agent_subtasks (
    subtask_id, parent_task_id, status, description, role, capability, model_version_id
  ) VALUES
    (work_id, p_task_id, 'READY', COALESCE(p_description, ''), p_role, p_capability, NULL),
    (verify_id, p_task_id, 'DRAFT', 'depends:' || work_id, 'verify', 'verify', NULL);
  INSERT INTO collab_events (task_id, event_type, actor_id, payload)
  VALUES (
    p_task_id, 'TASK_CREATED', 'darkstar',
    jsonb_build_object('work_id', work_id, 'verify_id', verify_id, 'role', p_role, 'capability', p_capability)
  );
  RETURN jsonb_build_object('task_id', p_task_id, 'work_id', work_id, 'verify_id', verify_id, 'dispatcher', 'darkstar');
END;
$$;

CREATE OR REPLACE FUNCTION agent_darkstar_merge(p_task_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v agent_subtasks%ROWTYPE;
BEGIN
  SELECT * INTO v
  FROM agent_subtasks
  WHERE parent_task_id = p_task_id
    AND role = 'verify'
    AND status = 'DONE'
    AND result_status = 'accepted'
  ORDER BY updated_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('merged', false, 'reason', 'verify not accepted');
  END IF;
  UPDATE agent_tasks
  SET status = 'COMPLETED', progress = 'merged', progress_note = v.result, updated_at = now(), last_activity_at = now()
  WHERE task_id = p_task_id;
  INSERT INTO collab_events (task_id, event_type, actor_id, payload)
  VALUES (p_task_id, 'TASK_STATUS', 'darkstar', jsonb_build_object('status', 'COMPLETED', 'verify_id', v.subtask_id));
  RETURN jsonb_build_object('merged', true, 'task_id', p_task_id, 'verify_id', v.subtask_id, 'result', v.result);
END;
$$;

CREATE OR REPLACE FUNCTION agent_darkstar_create_cycle(p_task_id text, p_title text, p_description text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN agent_darkstar_create_cycle(p_task_id, p_title, p_description, 'extract', 'extract');
END;
$$;

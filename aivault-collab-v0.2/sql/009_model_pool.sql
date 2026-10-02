-- Multi-model worker pool foundation. NOT APPLIED.
-- No second worker table. No second dispatcher. No fake AVAILABLE model.
-- No provider name. mv-phase1 is not treated as the only model.

CREATE TABLE IF NOT EXISTS model_registry (
  model_id text PRIMARY KEY,
  model_version_id text NOT NULL,
  capabilities text NOT NULL,
  availability text NOT NULL DEFAULT 'PLANNED',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_registry_availability_chk CHECK (availability IN ('AVAILABLE', 'PLANNED'))
);

INSERT INTO model_registry (model_id, model_version_id, capabilities, availability)
VALUES
  ('planned-extract', 'planned-extract-v0', 'extract', 'PLANNED'),
  ('planned-reasoning', 'planned-reasoning-v0', 'reasoning', 'PLANNED'),
  ('planned-coding', 'planned-coding-v0', 'coding', 'PLANNED'),
  ('planned-vision', 'planned-vision-v0', 'vision', 'PLANNED'),
  ('planned-verify', 'planned-verify-v0', 'verify', 'PLANNED')
ON CONFLICT (model_id) DO UPDATE
SET model_version_id = EXCLUDED.model_version_id,
    capabilities = EXCLUDED.capabilities,
    availability = EXCLUDED.availability;

ALTER TABLE agent_registry
  ADD COLUMN IF NOT EXISTS model_id text,
  ADD COLUMN IF NOT EXISTS capabilities text;

ALTER TABLE agent_subtasks
  ADD COLUMN IF NOT EXISTS capability text;

INSERT INTO agent_registry (
  agent_id, display_name, role, capability, abilities, capabilities,
  status, connection_status, model_id, model_version_id
)
SELECT
  'Worker-' || lpad(n::text, 3, '0'),
  'Worker-' || lpad(n::text, 3, '0'),
  s.role,
  s.capability,
  s.capability,
  s.capability,
  'WAITING',
  'not_connected',
  s.model_id,
  s.model_version_id
FROM generate_series(1, 100) AS n
JOIN (
  SELECT 1 AS lo, 40 AS hi, 'extract' AS role, 'extract' AS capability,
         'planned-extract' AS model_id, 'planned-extract-v0' AS model_version_id
  UNION ALL SELECT 41, 60, 'reasoning', 'reasoning', 'planned-reasoning', 'planned-reasoning-v0'
  UNION ALL SELECT 61, 75, 'coding', 'coding', 'planned-coding', 'planned-coding-v0'
  UNION ALL SELECT 76, 85, 'vision', 'vision', 'planned-vision', 'planned-vision-v0'
  UNION ALL SELECT 86, 100, 'verify', 'verify', 'planned-verify', 'planned-verify-v0'
) s ON n BETWEEN s.lo AND s.hi
ON CONFLICT (agent_id) DO UPDATE
SET role = EXCLUDED.role,
    capability = EXCLUDED.capability,
    abilities = EXCLUDED.abilities,
    capabilities = EXCLUDED.capabilities,
    model_id = EXCLUDED.model_id,
    model_version_id = EXCLUDED.model_version_id,
    updated_at = now()
WHERE agent_registry.role IS DISTINCT FROM EXCLUDED.role
   OR agent_registry.model_id IS DISTINCT FROM EXCLUDED.model_id
   OR agent_registry.model_version_id IS DISTINCT FROM EXCLUDED.model_version_id
   OR agent_registry.capabilities IS DISTINCT FROM EXCLUDED.capabilities;

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
BEGIN
  SELECT * INTO w FROM agent_registry WHERE agent_id = p_worker_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'worker not found';
  END IF;
  IF w.last_heartbeat IS NULL OR w.last_heartbeat < now() - interval '45 seconds' THEN
    RAISE EXCEPTION 'heartbeat stale';
  END IF;
  SELECT availability INTO model_state FROM model_registry WHERE model_id = w.model_id;
  IF model_state IS DISTINCT FROM 'AVAILABLE' THEN
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
    'capability', s.capability,
    'model_id', w.model_id,
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

  INSERT INTO agent_events (task_id, event_type, actor_id, payload)
  VALUES (
    p_task_id, 'TASK_CREATED', 'darkstar',
    jsonb_build_object('work_id', work_id, 'verify_id', verify_id, 'role', p_role, 'capability', p_capability)
  );

  RETURN jsonb_build_object(
    'task_id', p_task_id,
    'work_id', work_id,
    'verify_id', verify_id,
    'dispatcher', 'darkstar'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION agent_claim_subtask(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION agent_darkstar_create_cycle(text, text, text, text, text) TO authenticated;

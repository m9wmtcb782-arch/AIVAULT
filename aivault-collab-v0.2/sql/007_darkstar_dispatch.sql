-- AIVAULT Dark Star dispatch source v0.2.2
-- Uses agent_tasks, agent_subtasks, agent_registry only.
-- darkstar is the dispatcher, not a Worker.
-- NOT APPLIED. Does not create a scheduler. pg_cron is NOT VERIFIED.

CREATE OR REPLACE FUNCTION agent_darkstar_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired jsonb;
  n integer;
BEGIN
  expired := agent_expire_leases();

  UPDATE agent_subtasks v
  SET status = 'READY',
      updated_at = now()
  WHERE v.role = 'verify'
    AND v.status = 'DRAFT'
    AND EXISTS (
      SELECT 1
      FROM agent_subtasks e
      WHERE e.parent_task_id = v.parent_task_id
        AND e.role = 'extract'
        AND e.status = 'DONE'
        AND e.result_status = 'accepted'
    );
  GET DIAGNOSTICS n = ROW_COUNT;

  RETURN jsonb_build_object('expire', expired, 'verify_ready', n);
END;
$$;

CREATE OR REPLACE FUNCTION agent_darkstar_create_cycle(
  p_task_id text,
  p_title text,
  p_description text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  extract_id text;
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

  extract_id := p_task_id || '-extract';
  verify_id := p_task_id || '-verify';

  INSERT INTO agent_subtasks (
    subtask_id, parent_task_id, status, description, role, model_version_id
  ) VALUES
    (extract_id, p_task_id, 'READY', COALESCE(p_description, ''), 'extract', 'mv-phase1'),
    (verify_id, p_task_id, 'DRAFT', 'depends:' || extract_id, 'verify', 'mv-phase1');

  INSERT INTO agent_events (task_id, event_type, actor_id, payload)
  VALUES (
    p_task_id,
    'TASK_CREATED',
    'darkstar',
    jsonb_build_object('extract_id', extract_id, 'verify_id', verify_id)
  );

  RETURN jsonb_build_object(
    'task_id', p_task_id,
    'extract_id', extract_id,
    'verify_id', verify_id,
    'dispatcher', 'darkstar'
  );
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
  SET status = 'COMPLETED',
      progress = 'merged',
      progress_note = v.result,
      updated_at = now(),
      last_activity_at = now()
  WHERE task_id = p_task_id;

  INSERT INTO agent_events (task_id, event_type, actor_id, payload)
  VALUES (
    p_task_id,
    'TASK_STATUS',
    'darkstar',
    jsonb_build_object('status', 'COMPLETED', 'verify_id', v.subtask_id)
  );

  RETURN jsonb_build_object(
    'merged', true,
    'task_id', p_task_id,
    'verify_id', v.subtask_id,
    'result', v.result
  );
END;
$$;

REVOKE ALL ON FUNCTION agent_darkstar_tick() FROM PUBLIC;
REVOKE ALL ON FUNCTION agent_darkstar_create_cycle(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION agent_darkstar_merge(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION agent_darkstar_tick() TO authenticated;
GRANT EXECUTE ON FUNCTION agent_darkstar_create_cycle(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION agent_darkstar_merge(text) TO authenticated;

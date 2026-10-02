-- 011 agent modules. Does not touch agent_events.
-- Reuses agent_messages. Does not create a second memory engine.

CREATE TABLE IF NOT EXISTS agent_modules (
  agent_id text PRIMARY KEY,
  display_name text NOT NULL,
  memory_namespace text NOT NULL UNIQUE,
  context_definition text NOT NULL,
  status text NOT NULL DEFAULT 'registered',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_module_capabilities (
  agent_id text NOT NULL REFERENCES agent_modules(agent_id),
  capability text NOT NULL,
  PRIMARY KEY (agent_id, capability)
);

ALTER TABLE agent_messages
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS correlation_id text;

INSERT INTO agent_registry (
  agent_id, display_name, role, capability, abilities, status, connection_status
) VALUES
  ('technical-dark-star', 'Technical Dark Star', 'coordinator', 'coordinate', 'coordinate', 'WAITING', 'not_connected'),
  ('dawn-light', '曙光 / Dawn Light', 'visual-agent', 'visual', 'visual', 'WAITING', 'not_connected')
ON CONFLICT (agent_id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    updated_at = now();

INSERT INTO agent_modules (agent_id, display_name, memory_namespace, context_definition)
VALUES
  ('technical-dark-star', 'Technical Dark Star', 'technical-dark-star', 'Coordinator. Does not share memory namespace.'),
  ('dawn-light', '曙光 / Dawn Light', 'dawn-light', 'Independent visual agent. Conversation plus visual capabilities. Not a Dark Star persona.')
ON CONFLICT (agent_id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    memory_namespace = EXCLUDED.memory_namespace,
    context_definition = EXCLUDED.context_definition;

INSERT INTO agent_module_capabilities (agent_id, capability) VALUES
  ('technical-dark-star', 'coordinate'),
  ('technical-dark-star', 'conversation'),
  ('dawn-light', 'conversation'),
  ('dawn-light', 'vision'),
  ('dawn-light', 'image'),
  ('dawn-light', 'video'),
  ('dawn-light', '3d'),
  ('dawn-light', 'visual-reasoning'),
  ('dawn-light', 'visual-generation'),
  ('dawn-light', 'visual-transformation')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION agent_module_send_message(
  p_task_id text,
  p_from text,
  p_to text,
  p_type text,
  p_content text,
  p_correlation_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mid uuid;
BEGIN
  IF p_type NOT IN ('MESSAGE','QUESTION','ANSWER','SYSTEM') THEN
    RAISE EXCEPTION 'message type not allowed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM agent_modules WHERE agent_id = p_from)
     OR NOT EXISTS (SELECT 1 FROM agent_modules WHERE agent_id = p_to) THEN
    RAISE EXCEPTION 'agent module not registered';
  END IF;
  INSERT INTO agent_messages (
    task_id, sender_agent_id, receiver_agent_id, message_type, content, status, correlation_id, metadata
  ) VALUES (
    p_task_id, p_from, p_to, p_type, p_content, 'recorded', p_correlation_id,
    jsonb_build_object('source', 'agent_module')
  ) RETURNING message_id INTO mid;
  RETURN jsonb_build_object('message_id', mid, 'from', p_from, 'to', p_to, 'status', 'recorded');
END;
$$;

CREATE OR REPLACE FUNCTION agent_module_handoff(
  p_task_id text,
  p_title text,
  p_content text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sent jsonb;
BEGIN
  INSERT INTO agent_tasks (task_id, title, name, description, owner_id, status, priority, created_by)
  VALUES (p_task_id, p_title, p_title, p_content, 'owner', 'READY', 'NORMAL', 'technical-dark-star')
  ON CONFLICT (task_id) DO NOTHING;
  sent := agent_module_send_message(p_task_id, 'technical-dark-star', 'dawn-light', 'MESSAGE', p_content, p_task_id);
  RETURN jsonb_build_object('task_id', p_task_id, 'message', sent, 'model_status', 'PLANNED', 'executed', false);
END;
$$;

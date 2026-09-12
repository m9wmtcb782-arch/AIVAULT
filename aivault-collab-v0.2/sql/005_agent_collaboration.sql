-- AIVAULT Agent Collaboration Pool v0.2
-- Additive engine schema. No DROP TABLE / DROP SCHEMA / DROP FUNCTION.
-- Does not modify Task #001 Frozen Contract tables, AI Gateway, Compute Mesh, or Technical Dark Star.
--
-- Apply only on Owner-designated TEST project after information_schema check.
-- Do not apply to production without Owner written approval.

CREATE TABLE IF NOT EXISTS agent_registry (
  agent_id text PRIMARY KEY,
  display_name text NOT NULL,
  role text NOT NULL,
  capability text NOT NULL DEFAULT '',
  abilities text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'WAITING',
  connection_status text NOT NULL DEFAULT 'not_connected',
  current_task_id text,
  current_action text,
  color text,
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_registry_status_chk CHECK (
    status IN ('OFFLINE', 'WAITING', 'ASSIGNED', 'READY', 'WORKING', 'REVIEWING', 'RESEARCHING', 'TESTING', 'BLOCKED')
  ),
  CONSTRAINT agent_registry_conn_chk CHECK (
    connection_status IN ('connected', 'waiting', 'not_connected')
  )
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  task_id text PRIMARY KEY,
  parent_task_id text REFERENCES agent_tasks(task_id),
  title text,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  owner_id text NOT NULL DEFAULT 'owner',
  status text NOT NULL DEFAULT 'DRAFT',
  priority text NOT NULL DEFAULT 'NORMAL',
  current_gate text,
  progress text NOT NULL DEFAULT '',
  progress_note text,
  contract_id text,
  created_by text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_tasks_status_chk CHECK (
    status IN (
      'DRAFT', 'READY', 'RUNNING', 'WAITING', 'REVIEW', 'FIXING',
      'TESTING', 'GATE', 'COMPLETED', 'BLOCKED', 'PAUSED'
    )
  ),
  CONSTRAINT agent_tasks_priority_chk CHECK (
    priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_parent ON agent_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);

CREATE TABLE IF NOT EXISTS agent_task_members (
  task_id text NOT NULL REFERENCES agent_tasks(task_id),
  agent_id text NOT NULL REFERENCES agent_registry(agent_id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, agent_id)
);

CREATE TABLE IF NOT EXISTS agent_subtasks (
  subtask_id text PRIMARY KEY,
  parent_task_id text NOT NULL REFERENCES agent_tasks(task_id),
  assigned_agent text,
  status text NOT NULL DEFAULT 'DRAFT',
  description text NOT NULL DEFAULT '',
  result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_subtasks_parent ON agent_subtasks(parent_task_id);

CREATE TABLE IF NOT EXISTS agent_messages (
  message_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES agent_tasks(task_id),
  sender_agent_id text NOT NULL,
  receiver_agent_id text,
  message_type text NOT NULL DEFAULT 'MESSAGE',
  content text NOT NULL,
  reply_to uuid,
  status text NOT NULL DEFAULT 'posted',
  action text,
  evidence text,
  decision_id text,
  review_id text,
  test_id text,
  code_ref_id text,
  gate_id text,
  mentions text[] NOT NULL DEFAULT '{}',
  owner_proxy boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_messages_type_chk CHECK (
    message_type IN (
      'MESSAGE', 'CODE', 'REVIEW_REQUEST', 'REVIEW', 'FIX', 'TEST',
      'PASS', 'FAIL', 'WARNING', 'QUESTION', 'ANSWER', 'DECISION',
      'GATE', 'OWNER', 'SYSTEM'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_task ON agent_messages(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_messages_sender ON agent_messages(sender_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_receiver ON agent_messages(receiver_agent_id);

DO $$ BEGIN
  ALTER TABLE agent_messages
    ADD CONSTRAINT agent_messages_reply_fk
    FOREIGN KEY (reply_to) REFERENCES agent_messages(message_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS agent_reviews (
  review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES agent_tasks(task_id),
  reviewer_agent_id text,
  target_agent_id text,
  status text NOT NULL DEFAULT 'PENDING',
  findings text,
  required_changes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  finding_id text,
  requested_by text,
  CONSTRAINT agent_reviews_status_chk CHECK (
    status IN ('PENDING', 'PASS', 'NEED_FIX', 'REJECT')
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_reviews_task ON agent_reviews(task_id);

CREATE TABLE IF NOT EXISTS agent_actions (
  action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES agent_tasks(task_id),
  agent_id text NOT NULL,
  action_type text NOT NULL,
  input text,
  output text,
  status text NOT NULL DEFAULT 'WAITING',
  started_at timestamptz,
  completed_at timestamptz,
  evidence text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_actions_type_chk CHECK (
    action_type IN ('RESEARCH', 'CODE', 'TEST', 'REVIEW', 'FIX', 'ANALYZE', 'VERIFY', 'DECIDE', 'ASSIGN')
  ),
  CONSTRAINT agent_actions_status_chk CHECK (
    status IN ('WAITING', 'ASSIGNED', 'READY', 'RUNNING', 'BLOCKED')
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_task ON agent_actions(task_id, created_at);

CREATE TABLE IF NOT EXISTS agent_code_refs (
  code_ref_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES agent_tasks(task_id),
  agent_id text,
  repository text NOT NULL DEFAULT 'm9wmtcb782-arch/AIVAULT',
  branch text NOT NULL DEFAULT 'main',
  file_path text NOT NULL,
  commit_hash text,
  diff_url text,
  message_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_code_refs_task ON agent_code_refs(task_id);

CREATE TABLE IF NOT EXISTS agent_test_results (
  test_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES agent_tasks(task_id),
  agent_id text,
  test_type text,
  command text,
  result text,
  status text NOT NULL DEFAULT 'NOT_RUN',
  evidence text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_test_status_chk CHECK (
    status IN ('NOT_RUN', 'RUNNING', 'PASS', 'FAIL', 'BLOCKED')
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_test_results_task ON agent_test_results(task_id);

CREATE TABLE IF NOT EXISTS agent_decisions (
  decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES agent_tasks(task_id),
  agent_id text NOT NULL,
  decision_type text NOT NULL,
  proposal text,
  alternatives text,
  reason text,
  evidence text,
  owner_only boolean NOT NULL DEFAULT false,
  approved boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_task ON agent_decisions(task_id);

CREATE TABLE IF NOT EXISTS agent_learning_candidates (
  candidate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES agent_tasks(task_id),
  message_id uuid,
  source_agent_id text NOT NULL,
  problem text,
  proposals text,
  debate text,
  counter_arguments text,
  chosen_solution text,
  reason text,
  code_changes text,
  tests text,
  errors text,
  corrections text,
  architect_decision text,
  evidence text,
  verification_status text NOT NULL DEFAULT 'candidate',
  promoted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_learning_promoted_chk CHECK (promoted = false OR verification_status = 'verified')
);

CREATE TABLE IF NOT EXISTS agent_task_gates (
  task_id text NOT NULL REFERENCES agent_tasks(task_id),
  gate_key text NOT NULL,
  state text NOT NULL DEFAULT 'NOT_STARTED',
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, gate_key),
  CONSTRAINT agent_task_gates_state_chk CHECK (
    state IN ('NOT_STARTED', 'WAITING', 'PASS', 'FAIL', 'BLOCKED')
  )
);

CREATE TABLE IF NOT EXISTS agent_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text,
  event_type text NOT NULL,
  actor_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_events_type_chk CHECK (
    event_type IN (
      'TASK_CREATED', 'AGENT_ASSIGNED', 'MESSAGE_POSTED',
      'ACTION_CREATED', 'ACTION_COMPLETED', 'CODE_SUBMITTED',
      'REVIEW_REQUESTED', 'REVIEW_COMPLETED', 'FIX_REQUESTED',
      'TEST_STARTED', 'TEST_COMPLETED', 'DECISION_CREATED',
      'GATE_CHANGED', 'OWNER_APPROVED', 'SUBTASK_CREATED',
      'LEARNING_CANDIDATE', 'TASK_STATUS'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_events_task ON agent_events(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_events_type ON agent_events(event_type, created_at);

ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_code_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_learning_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY agent_registry_auth_all ON agent_registry FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY agent_tasks_auth_all ON agent_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY agent_task_members_auth_all ON agent_task_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY agent_subtasks_auth_all ON agent_subtasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY agent_messages_auth_all ON agent_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY agent_reviews_auth_all ON agent_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY agent_actions_auth_all ON agent_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY agent_code_refs_auth_all ON agent_code_refs FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY agent_test_results_auth_all ON agent_test_results FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY agent_decisions_auth_all ON agent_decisions FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY agent_learning_candidates_auth_all ON agent_learning_candidates FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY agent_task_gates_auth_all ON agent_task_gates FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY agent_events_auth_all ON agent_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO agent_registry (agent_id, display_name, role, capability, abilities, status, connection_status, color)
VALUES
  ('chatgpt', 'ChatGPT', 'Architect', 'architecture / review / gate', 'architecture,review,gate', 'WAITING', 'not_connected', '#5ec8ff'),
  ('grok', 'Grok', 'Builder', 'coding / implementation', 'coding,implementation', 'WAITING', 'not_connected', '#e0b14a'),
  ('gemini', 'Gemini', 'Researcher', 'research / analysis', 'research,analysis', 'WAITING', 'not_connected', '#8b7dff'),
  ('darkstar', 'Technical Dark Star', 'Engineer', 'engineering / testing / learning', 'engineering,testing,learning', 'WAITING', 'not_connected', '#3dcc8a'),
  ('auditor', 'Auditor', 'Auditor', 'security / compliance / risk', 'security,compliance,risk', 'WAITING', 'not_connected', '#e85d5d')
ON CONFLICT (agent_id) DO NOTHING;

INSERT INTO agent_tasks (
  task_id, parent_task_id, title, name, description, owner_id, status, priority,
  current_gate, progress, progress_note, contract_id, created_by
) VALUES (
  'task-001',
  NULL,
  'Image Classification Frozen Contract v0.1',
  'Image Classification Frozen Contract v0.1',
  'First live contract task.task.batch.image.classify.v0.1. Code exists in repo. Online integration not run.',
  'owner',
  'BLOCKED',
  'HIGH',
  'g2_implementation',
  'WAITING FOR LIVE EXECUTION',
  'WAITING FOR LIVE EXECUTION. Not complete. No fake progress.',
  'task.batch.image.classify.v0.1',
  'owner'
)
ON CONFLICT (task_id) DO NOTHING;

INSERT INTO agent_tasks (
  task_id, parent_task_id, title, name, description, owner_id, status, priority,
  current_gate, progress, progress_note, contract_id, created_by
) VALUES
  ('task-001-A', 'task-001', 'Concurrent Reserve Test', 'Concurrent Reserve Test',
   'Planned concurrent reserve verification.', 'owner', 'DRAFT', 'HIGH',
   'g3_verification', 'WAITING FOR LIVE EXECUTION', 'Planned. WAITING FOR LIVE EXECUTION.',
   'task.batch.image.classify.v0.1', 'owner'),
  ('task-001-B', 'task-001', 'Timeout Release Test', 'Timeout Release Test',
   'Planned timeout release verification.', 'owner', 'DRAFT', 'HIGH',
   'g3_verification', 'WAITING FOR LIVE EXECUTION', 'Planned. WAITING FOR LIVE EXECUTION.',
   'task.batch.image.classify.v0.1', 'owner'),
  ('task-001-C', 'task-001', 'Security Review', 'Security Review',
   'Planned auditor review. No live review posted.', 'owner', 'DRAFT', 'HIGH',
   'g1_architecture', 'WAITING FOR LIVE EXECUTION', 'Planned. No live auditor review.',
   'task.batch.image.classify.v0.1', 'owner')
ON CONFLICT (task_id) DO NOTHING;

INSERT INTO agent_task_members (task_id, agent_id) VALUES
  ('task-001', 'chatgpt'),
  ('task-001', 'grok'),
  ('task-001', 'gemini'),
  ('task-001', 'darkstar'),
  ('task-001', 'auditor'),
  ('task-001-A', 'grok'),
  ('task-001-B', 'darkstar'),
  ('task-001-C', 'auditor')
ON CONFLICT (task_id, agent_id) DO NOTHING;

INSERT INTO agent_task_gates (task_id, gate_key, state, note) VALUES
  ('task-001', 'g1_architecture', 'WAITING', 'Architecture review not live-closed'),
  ('task-001', 'g2_implementation', 'WAITING', 'Implementation present in repo; not live-verified'),
  ('task-001', 'g3_verification', 'BLOCKED', 'WAITING FOR LIVE EXECUTION'),
  ('task-001', 'g4_production', 'BLOCKED', 'Owner-only. Not approved. Not deployed.')
ON CONFLICT (task_id, gate_key) DO NOTHING;

INSERT INTO agent_code_refs (task_id, agent_id, repository, branch, file_path, commit_hash, created_at)
SELECT 'task-001', 'owner', 'm9wmtcb782-arch/AIVAULT', 'main', x.file_path, NULL, now()
FROM (VALUES
  ('aivault-task-001/sql/001_task001_additive.sql'),
  ('aivault-task-001/supabase/functions/aivault-task-coordinator/index.ts'),
  ('aivault-task-001/IMPLEMENTATION_REPORT.md')
) AS x(file_path)
WHERE NOT EXISTS (
  SELECT 1 FROM agent_code_refs r
  WHERE r.task_id = 'task-001' AND r.file_path = x.file_path
);

INSERT INTO agent_test_results (task_id, agent_id, test_type, command, result, status, evidence)
SELECT 'task-001', 'owner', 'online_integration', 'POST /functions/v1/aivault-task-submit',
       'NOT_RUN', 'BLOCKED', 'WAITING FOR LIVE EXECUTION. No live runner in this workspace.'
WHERE NOT EXISTS (
  SELECT 1 FROM agent_test_results t
  WHERE t.task_id = 'task-001' AND t.test_type = 'online_integration'
);

-- Pool starts empty. Do not invent agent dialogue.
-- Actions stay WAITING/ASSIGNED/READY. Do not seed COMPLETED.

-- AIVAULT Agent Collaboration Pool v0.1.1
-- Additive engine schema. No DROP TABLE / DROP SCHEMA / DROP FUNCTION.
-- Does not modify Task #001 Frozen Contract tables, AI Gateway, Compute Mesh, or Technical Dark Star.
--
-- Apply only on Owner-designated TEST project after information_schema check.
-- Do not apply to production AI Gateway project without Owner written approval.
--
-- Requested tables (public):
--   agent_registry, agent_tasks, agent_messages, agent_reviews,
--   agent_actions, agent_code_refs, agent_test_results,
--   agent_decisions, agent_learning_candidates
-- Supporting: agent_task_members, agent_task_gates

CREATE TABLE IF NOT EXISTS agent_registry (
  agent_id text PRIMARY KEY,
  display_name text NOT NULL,
  role text NOT NULL,
  capability text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'waiting',
  connection_status text NOT NULL DEFAULT 'not_connected',
  current_task_id text,
  current_action text,
  color text,
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_registry_status_chk CHECK (
    status IN ('offline', 'waiting', 'working', 'reviewing', 'researching', 'testing')
  ),
  CONSTRAINT agent_registry_conn_chk CHECK (
    connection_status IN ('connected', 'waiting', 'not_connected')
  )
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  task_id text PRIMARY KEY,
  parent_task_id text REFERENCES agent_tasks(task_id),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  current_gate text,
  progress_note text,
  contract_id text,
  created_by text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_tasks_status_chk CHECK (
    status IN ('draft', 'open', 'working', 'paused', 'review', 'blocked', 'closed')
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_parent ON agent_tasks(parent_task_id);

CREATE TABLE IF NOT EXISTS agent_task_members (
  task_id text NOT NULL REFERENCES agent_tasks(task_id),
  agent_id text NOT NULL REFERENCES agent_registry(agent_id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, agent_id)
);

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
  decision text,
  evidence text,
  code_ref text,
  review_ref text,
  test_ref text,
  gate_ref text,
  mentions text[] NOT NULL DEFAULT '{}',
  owner_proxy boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_messages_type_chk CHECK (
    message_type IN (
      'MESSAGE', 'CODE', 'REVIEW', 'FIX', 'TEST', 'PASS', 'FAIL',
      'WARNING', 'DECISION', 'GATE', 'OWNER'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_task ON agent_messages(task_id, created_at);

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
  status text NOT NULL DEFAULT 'requested',
  findings text,
  required_changes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  finding_id text,
  requested_by text,
  CONSTRAINT agent_reviews_status_chk CHECK (
    status IN ('requested', 'review', 'pass', 'need_fix', 'reject')
  )
);

CREATE TABLE IF NOT EXISTS agent_actions (
  action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES agent_tasks(task_id),
  actor_id text NOT NULL,
  action_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_task ON agent_actions(task_id, created_at);

CREATE TABLE IF NOT EXISTS agent_code_refs (
  ref_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES agent_tasks(task_id),
  message_id uuid,
  file_path text NOT NULL,
  commit_sha text,
  repo text NOT NULL DEFAULT 'm9wmtcb782-arch/AIVAULT',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_test_results (
  test_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES agent_tasks(task_id),
  suite text NOT NULL,
  result text NOT NULL,
  detail text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_decisions (
  decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES agent_tasks(task_id),
  decision_type text NOT NULL,
  actor_id text NOT NULL,
  owner_required boolean NOT NULL DEFAULT true,
  approved boolean,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_learning_candidates (
  candidate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES agent_tasks(task_id),
  message_id uuid,
  source_agent_id text NOT NULL,
  problem text,
  proposals text,
  debate text,
  chosen_solution text,
  reason text,
  code_changes text,
  tests text,
  errors text,
  corrections text,
  architect_decision text,
  summary text,
  verification_status text NOT NULL DEFAULT 'candidate',
  promoted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_task_gates (
  task_id text NOT NULL REFERENCES agent_tasks(task_id),
  gate_key text NOT NULL,
  state text NOT NULL DEFAULT 'not_started',
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, gate_key),
  CONSTRAINT agent_task_gates_state_chk CHECK (
    state IN ('not_started', 'waiting', 'pass', 'fail', 'blocked')
  )
);

ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_code_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_learning_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task_gates ENABLE ROW LEVEL SECURITY;

-- Authenticated Owner/session can read and write collaboration tables.
-- Anon has no policy → denied. Service role bypasses RLS (server only).
DO $$ BEGIN
  CREATE POLICY agent_registry_auth_all ON agent_registry
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY agent_tasks_auth_all ON agent_tasks
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY agent_task_members_auth_all ON agent_task_members
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY agent_messages_auth_all ON agent_messages
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY agent_reviews_auth_all ON agent_reviews
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY agent_actions_auth_all ON agent_actions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY agent_code_refs_auth_all ON agent_code_refs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY agent_test_results_auth_all ON agent_test_results
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY agent_decisions_auth_all ON agent_decisions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY agent_learning_candidates_auth_all ON agent_learning_candidates
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY agent_task_gates_auth_all ON agent_task_gates
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO agent_registry (
  agent_id, display_name, role, capability, status, connection_status, color
) VALUES
  ('chatgpt', 'ChatGPT', 'architect', 'architecture / review / gate', 'waiting', 'not_connected', '#5ec8ff'),
  ('grok', 'Grok', 'builder', 'implementation / coding', 'waiting', 'not_connected', '#e0b14a'),
  ('gemini', 'Gemini', 'researcher', 'research / analysis', 'waiting', 'not_connected', '#8b7dff'),
  ('darkstar', 'Technical Dark Star', 'engineer', 'engineering / testing / learning', 'waiting', 'not_connected', '#3dcc8a'),
  ('auditor', 'Auditor', 'auditor', 'security / compliance / risk', 'waiting', 'not_connected', '#e85d5d')
ON CONFLICT (agent_id) DO NOTHING;

INSERT INTO agent_tasks (
  task_id, parent_task_id, name, status, current_gate, progress_note, contract_id, created_by
) VALUES (
  'task-001',
  NULL,
  'Image Classification — Frozen Contract v0.1',
  'blocked',
  'gate2',
  'WAITING FOR LIVE EXECUTION. Code exists in repo. Online integration not run. Not complete.',
  'task.batch.image.classify.v0.1',
  'owner'
)
ON CONFLICT (task_id) DO NOTHING;

INSERT INTO agent_tasks (
  task_id, parent_task_id, name, status, current_gate, progress_note, contract_id, created_by
) VALUES
  ('task-001-A', 'task-001', 'Concurrent Reserve Test', 'draft', 'gate2',
   'Planned. WAITING FOR LIVE EXECUTION.', 'task.batch.image.classify.v0.1', 'owner'),
  ('task-001-B', 'task-001', 'Timeout Release Test', 'draft', 'gate2',
   'Planned. WAITING FOR LIVE EXECUTION.', 'task.batch.image.classify.v0.1', 'owner'),
  ('task-001-C', 'task-001', 'Security Review', 'draft', 'gate2',
   'Planned. Auditor has not posted a live review.', 'task.batch.image.classify.v0.1', 'owner')
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
  ('task-001', 'contract', 'waiting', 'Frozen contract file present; online path not run'),
  ('task-001', 'coordinator', 'waiting', 'RPC code in repo; not deployed'),
  ('task-001', 'router', 'waiting', 'router.v0.1 code present; not deployed'),
  ('task-001', 'reserve', 'waiting', 'aivault_reserve_attempt in SQL; no live race'),
  ('task-001', 'execution', 'not_started', 'WAITING FOR LIVE EXECUTION'),
  ('task-001', 'verification', 'not_started', 'WAITING FOR LIVE EXECUTION'),
  ('task-001', 'settlement', 'waiting', 'claim RPC in SQL; no live race'),
  ('task-001', 'gate1', 'waiting', 'code review only'),
  ('task-001', 'gate2', 'blocked', 'online tests not executed'),
  ('task-001', 'gate3', 'not_started', NULL),
  ('task-001', 'production', 'blocked', 'Owner-only; not approved; not deployed')
ON CONFLICT (task_id, gate_key) DO NOTHING;

INSERT INTO agent_code_refs (task_id, message_id, file_path, commit_sha, repo, created_by)
SELECT 'task-001', NULL, x.file_path, '3892d482549357083ef811ad1baa26c36d7d4556', 'm9wmtcb782-arch/AIVAULT', 'owner'
FROM (VALUES
  ('aivault-task-001/sql/001_task001_additive.sql'),
  ('aivault-task-001/supabase/functions/aivault-task-coordinator/index.ts'),
  ('aivault-task-001/IMPLEMENTATION_REPORT.md')
) AS x(file_path)
WHERE NOT EXISTS (
  SELECT 1 FROM agent_code_refs r
  WHERE r.task_id = 'task-001' AND r.file_path = x.file_path AND r.message_id IS NULL
);

INSERT INTO agent_test_results (task_id, suite, result, detail, created_by)
SELECT 'task-001', 'online_integration', 'BLOCKED',
       'WAITING FOR LIVE EXECUTION. Prior probe: POST /functions/v1/aivault-task-submit → 404 NOT_FOUND.',
       'owner'
WHERE NOT EXISTS (
  SELECT 1 FROM agent_test_results t
  WHERE t.task_id = 'task-001' AND t.suite = 'online_integration'
);

-- No seed rows in agent_messages.
-- Collaboration pool starts empty. Do not invent agent dialogue.

-- AIVAULT Multi-Agent Collaboration Pool v0.1
-- Additive only. No DROP TABLE / DROP SCHEMA / DROP FUNCTION.
-- Does not modify Task #001 Frozen Contract tables, AI Gateway, Compute Mesh, or Technical Dark Star.
--
-- Apply only on Owner-designated TEST project after information_schema check.
-- Do not apply to production AI Gateway project without Owner written approval.

DO $$ BEGIN
  CREATE TYPE aivault_collab_task_status AS ENUM (
    'draft', 'open', 'working', 'paused', 'review', 'blocked', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE aivault_collab_agent_status AS ENUM (
    'offline', 'waiting', 'working', 'reviewing', 'researching', 'testing'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE aivault_collab_message_type AS ENUM (
    'MESSAGE', 'CODE', 'REVIEW', 'FIX', 'TEST', 'PASS', 'FAIL',
    'WARNING', 'DECISION', 'GATE', 'OWNER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE aivault_collab_review_verdict AS ENUM (
    'requested', 'pass', 'need_fix', 'reject'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE aivault_collab_gate_state AS ENUM (
    'not_started', 'waiting', 'pass', 'fail', 'blocked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS aivault_agent_registry (
  agent_id text PRIMARY KEY,
  display_name text NOT NULL,
  role text NOT NULL,
  capability text NOT NULL,
  status aivault_collab_agent_status NOT NULL DEFAULT 'waiting',
  current_task_id text,
  current_action text,
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aivault_agent_tasks (
  task_id text PRIMARY KEY,
  parent_task_id text REFERENCES aivault_agent_tasks(task_id),
  name text NOT NULL,
  status aivault_collab_task_status NOT NULL DEFAULT 'draft',
  current_gate text,
  progress_note text,
  created_by text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aivault_agent_tasks_parent
  ON aivault_agent_tasks(parent_task_id);

CREATE TABLE IF NOT EXISTS aivault_agent_task_members (
  task_id text NOT NULL REFERENCES aivault_agent_tasks(task_id),
  agent_id text NOT NULL REFERENCES aivault_agent_registry(agent_id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, agent_id)
);

CREATE TABLE IF NOT EXISTS aivault_agent_messages (
  message_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES aivault_agent_tasks(task_id),
  sender_agent_id text NOT NULL,
  receiver_agent_id text,
  mentions text[] NOT NULL DEFAULT '{}',
  message_type aivault_collab_message_type NOT NULL DEFAULT 'MESSAGE',
  content text NOT NULL,
  reply_to uuid,
  status text NOT NULL DEFAULT 'posted',
  owner_proxy boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aivault_agent_messages_task
  ON aivault_agent_messages(task_id, created_at);

DO $$ BEGIN
  ALTER TABLE aivault_agent_messages
    ADD CONSTRAINT aivault_agent_messages_reply_fk
    FOREIGN KEY (reply_to) REFERENCES aivault_agent_messages(message_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS aivault_agent_reviews (
  review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES aivault_agent_tasks(task_id),
  finding_id text,
  requested_by text NOT NULL,
  assigned_to text,
  verdict aivault_collab_review_verdict NOT NULL DEFAULT 'requested',
  summary text NOT NULL,
  message_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aivault_agent_actions (
  action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES aivault_agent_tasks(task_id),
  actor_id text NOT NULL,
  action_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aivault_agent_actions_task
  ON aivault_agent_actions(task_id, created_at);

CREATE TABLE IF NOT EXISTS aivault_agent_code_refs (
  ref_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES aivault_agent_tasks(task_id),
  message_id uuid,
  file_path text NOT NULL,
  commit_sha text,
  repo text NOT NULL DEFAULT 'm9wmtcb782-arch/AIVAULT',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aivault_agent_test_results (
  test_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES aivault_agent_tasks(task_id),
  suite text NOT NULL,
  result text NOT NULL,
  detail text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aivault_agent_decisions (
  decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES aivault_agent_tasks(task_id),
  decision_type text NOT NULL,
  actor_id text NOT NULL,
  owner_required boolean NOT NULL DEFAULT true,
  approved boolean,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aivault_agent_learning_candidates (
  candidate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES aivault_agent_tasks(task_id),
  message_id uuid,
  source_agent_id text NOT NULL,
  summary text NOT NULL,
  verification_status text NOT NULL DEFAULT 'candidate',
  promoted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aivault_agent_task_gates (
  task_id text NOT NULL REFERENCES aivault_agent_tasks(task_id),
  gate_key text NOT NULL,
  state aivault_collab_gate_state NOT NULL DEFAULT 'not_started',
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, gate_key)
);

ALTER TABLE aivault_agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_agent_task_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_agent_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_agent_code_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_agent_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_agent_learning_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE aivault_agent_task_gates ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies in v0.1.
-- Result: public roles cannot read or write these tables.
-- Service role bypasses RLS (server only). Do not put service role in HTML.

INSERT INTO aivault_agent_registry (agent_id, display_name, role, capability, status) VALUES
  ('chatgpt', 'ChatGPT', 'architect', 'architecture / review / gate', 'waiting'),
  ('grok', 'Grok', 'builder', 'implementation / coding', 'waiting'),
  ('gemini', 'Gemini', 'researcher', 'research / analysis', 'waiting'),
  ('darkstar', 'Technical Dark Star', 'engineer', 'engineering / testing / learning', 'waiting'),
  ('auditor', 'Auditor', 'auditor', 'security / compliance / risk', 'waiting')
ON CONFLICT (agent_id) DO NOTHING;

INSERT INTO aivault_agent_tasks (
  task_id, parent_task_id, name, status, current_gate, progress_note, created_by
) VALUES (
  'task-001',
  NULL,
  'Image Classification — Frozen Contract v0.1',
  'blocked',
  'gate2',
  'Reference task only. Code exists in repo. Online integration BLOCKED. Not a live run.',
  'owner'
)
ON CONFLICT (task_id) DO NOTHING;

INSERT INTO aivault_agent_tasks (
  task_id, parent_task_id, name, status, current_gate, progress_note, created_by
) VALUES
  ('task-001-A', 'task-001', 'Concurrent Reserve Test', 'draft', 'gate2',
   'Planned. Not executed against live Postgres.', 'owner'),
  ('task-001-B', 'task-001', 'Timeout Release Test', 'draft', 'gate2',
   'Planned. Not executed against live Postgres.', 'owner'),
  ('task-001-C', 'task-001', 'Security Review', 'draft', 'gate2',
   'Planned. Auditor has not posted a live review.', 'owner')
ON CONFLICT (task_id) DO NOTHING;

INSERT INTO aivault_agent_task_members (task_id, agent_id) VALUES
  ('task-001', 'chatgpt'),
  ('task-001', 'grok'),
  ('task-001', 'gemini'),
  ('task-001', 'darkstar'),
  ('task-001', 'auditor'),
  ('task-001-A', 'grok'),
  ('task-001-B', 'darkstar'),
  ('task-001-C', 'auditor')
ON CONFLICT (task_id, agent_id) DO NOTHING;

INSERT INTO aivault_agent_task_gates (task_id, gate_key, state, note) VALUES
  ('task-001', 'contract', 'waiting', 'Frozen contract file present; online path not run'),
  ('task-001', 'coordinator', 'waiting', 'RPC code in repo; not deployed'),
  ('task-001', 'router', 'waiting', 'router.v0.1 code present; not deployed'),
  ('task-001', 'reserve', 'waiting', 'aivault_reserve_attempt in SQL; no live race'),
  ('task-001', 'execution', 'not_started', NULL),
  ('task-001', 'verification', 'not_started', NULL),
  ('task-001', 'settlement', 'waiting', 'claim RPC in SQL; no live race'),
  ('task-001', 'gate1', 'waiting', 'code review only'),
  ('task-001', 'gate2', 'blocked', 'online tests not executed'),
  ('task-001', 'gate3', 'not_started', NULL),
  ('task-001', 'production', 'blocked', 'Owner-only; not approved; not deployed')
ON CONFLICT (task_id, gate_key) DO NOTHING;

INSERT INTO aivault_agent_code_refs (task_id, message_id, file_path, commit_sha, repo, created_by)
SELECT 'task-001', NULL, x.file_path, '3892d482549357083ef811ad1baa26c36d7d4556', 'm9wmtcb782-arch/AIVAULT', 'owner'
FROM (VALUES
  ('aivault-task-001/sql/001_task001_additive.sql'),
  ('aivault-task-001/supabase/functions/aivault-task-coordinator/index.ts'),
  ('aivault-task-001/IMPLEMENTATION_REPORT.md')
) AS x(file_path)
WHERE NOT EXISTS (
  SELECT 1 FROM aivault_agent_code_refs r
  WHERE r.task_id = 'task-001' AND r.file_path = x.file_path AND r.message_id IS NULL
);

INSERT INTO aivault_agent_test_results (task_id, suite, result, detail, created_by)
SELECT 'task-001', 'online_integration', 'BLOCKED',
       'POST /functions/v1/aivault-task-submit returned 404 NOT_FOUND. No test-project credentials in builder environment.',
       'owner'
WHERE NOT EXISTS (
  SELECT 1 FROM aivault_agent_test_results t
  WHERE t.task_id = 'task-001' AND t.suite = 'online_integration'
);

-- Intentionally no seed rows in aivault_agent_messages.
-- Collaboration pool starts empty. Do not invent agent dialogue.

-- 100 Worker instance seed. NOT APPLIED.
-- Same model_version_id. Not 100 models. Not a second registry.
-- Idempotent: agent_id is primary key. Re-run does not duplicate.
-- Worker-001..090 extract, Worker-091..100 verify.
-- device_id stays null until a node_id is written later.

INSERT INTO agent_registry (
  agent_id, display_name, role, capability, abilities, status, connection_status, model_version_id
)
SELECT
  'Worker-' || lpad(n::text, 3, '0'),
  'Worker-' || lpad(n::text, 3, '0'),
  CASE WHEN n <= 90 THEN 'extract' ELSE 'verify' END,
  CASE WHEN n <= 90 THEN 'extract' ELSE 'verify' END,
  CASE WHEN n <= 90 THEN 'extract' ELSE 'verify' END,
  'WAITING',
  'not_connected',
  'mv-phase1'
FROM generate_series(1, 100) AS n
ON CONFLICT (agent_id) DO UPDATE
SET role = EXCLUDED.role,
    model_version_id = EXCLUDED.model_version_id,
    updated_at = now()
WHERE agent_registry.role IS DISTINCT FROM EXCLUDED.role
   OR agent_registry.model_version_id IS DISTINCT FROM EXCLUDED.model_version_id;

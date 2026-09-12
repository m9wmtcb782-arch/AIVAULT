-- OPTIONAL research provider row.
-- Not a fake GPU / fake TOPS claim.
-- Device class = server. Online heartbeat must be refreshed < 60s or router rejects.
-- Insert only if you have a real execution path that can POST results.

INSERT INTO aivault_compute_capabilities (
  capability_id,
  provider_id,
  task_type,
  contract_versions,
  device_class,
  runtime,
  supported_models,
  memory_mb,
  advertised_latency_p50,
  advertised_latency_p95,
  sample_n,
  verification_level,
  trust_level,
  capability_tier,
  price_per_compute_unit,
  online,
  last_seen_at,
  heartbeat_at,
  reward_units_per_item
) VALUES (
  'research-server-001:batch.image.classify:task.batch.image.classify.v0.1',
  'research-server-001',
  'batch.image.classify',
  ARRAY['task.batch.image.classify.v0.1'],
  'server',
  'cpu',
  ARRAY['aivault.own.system_model.v0.1'],
  512,
  100,
  400,
  0,
  'own_weight',
  'untrusted',
  'research',
  0,
  true,
  now(),
  now(),
  8
)
ON CONFLICT (capability_id) DO UPDATE SET
  online = EXCLUDED.online,
  heartbeat_at = EXCLUDED.heartbeat_at,
  last_seen_at = EXCLUDED.last_seen_at;

/**
 * Dual-base heartbeat skeleton for base-001.
 * No hardcoded provider, model, or fixed Q&A.
 * technical-dark-star is the controller; tasks are opaque.
 */
export const HEARTBEAT_INTERVAL_SEC = 600;

export function makeHeartbeat({ base_id = 'base-001', agent_id = 'technical-dark-star', instance_id = 'base-001:technical-dark-star', now = () => new Date().toISOString() }) {
  return {
    kind: 'heartbeat',
    base_id,
    agent_id,
    instance_id,
    ts: now(),
    status: 'alive',
    note: 'periodic liveness; not a fixed answer'
  };
}

export function isGeneralTask(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const locked = new Set(['fixed_qa', 'scripted_reply']);
  return typeof payload.kind === 'string' && !locked.has(payload.kind);
}

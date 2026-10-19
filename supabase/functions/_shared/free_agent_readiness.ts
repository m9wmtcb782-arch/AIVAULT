// AIVAULT free-resource rollout readiness: no outbound traffic.
// Registered agents do not imply running processes.
export type AgentReadiness = {
  id: string;
  heartbeatAtMs: number | null;
  authenticatedRuntime: boolean;
  authorizedWebSearch: boolean;
  policyAccepted: boolean;
};
export type ReadinessReport = {
  registered: number;
  ready: number;
  blocked: number;
  readyIds: string[];
  rolloutBatches: string[][];
};
export function planRollout(
  agents: readonly AgentReadiness[],
  nowMs: number,
  batchSize = 10,
  maxReady = 2000,
): ReadinessReport {
  if (!Number.isFinite(nowMs) || !Number.isSafeInteger(batchSize) ||
      batchSize < 1 || batchSize > 50 || !Number.isSafeInteger(maxReady) ||
      maxReady < 1 || maxReady > 300000) {
    return { registered: agents.length, ready: 0, blocked: agents.length, readyIds: [], rolloutBatches: [] };
  }
  const unique = new Set<string>();
  const readyIds: string[] = [];
  for (const a of agents) {
    if (!a.id || unique.has(a.id)) continue;
    unique.add(a.id);
    if (readyIds.length >= maxReady) continue;
    if (!a.authenticatedRuntime || !a.authorizedWebSearch ||
        !a.policyAccepted || a.heartbeatAtMs === null ||
        !Number.isFinite(a.heartbeatAtMs) ||
        a.heartbeatAtMs > nowMs || nowMs - a.heartbeatAtMs > 120000) continue;
    readyIds.push(a.id);
  }
  const rolloutBatches: string[][] = [];
  for (let i = 0; i < readyIds.length; i += batchSize) {
    rolloutBatches.push(readyIds.slice(i, i + batchSize));
  }
  return { registered: agents.length, ready: readyIds.length,
    blocked: agents.length - readyIds.length, readyIds, rolloutBatches };
}
// Dispatching requires authenticated worker leases, audit logs, legal provider
// search adapter and explicit activation. This module only plans batches.

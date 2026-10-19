// AIVAULT free resource discovery dispatcher: pure planning, no network calls.
// Registered agent rows are NOT proof of online workers.
export type DiscoveryWorker = {
  agentId: string;
  onlineVerified: boolean;
  webCapabilityVerified: boolean;
  lastHeartbeatMs: number;
};
export type DiscoveryJob = {
  id: string;
  region: string;
  query: string;
};
export type Assignment = {
  agentId: string;
  jobId: string;
  region: string;
  query: string;
};
export function planFreeDiscovery(
  workers: readonly DiscoveryWorker[],
  jobs: readonly DiscoveryJob[],
  nowMs: number,
  maxConcurrent = 10,
  heartbeatTtlMs = 120000,
): Assignment[] {
  if (!Number.isFinite(nowMs) || !Number.isSafeInteger(maxConcurrent) ||
      maxConcurrent < 1 || maxConcurrent > 50 ||
      !Number.isSafeInteger(heartbeatTtlMs) || heartbeatTtlMs < 1) return [];
  const eligible = workers.filter(w =>
    !!w.agentId && w.onlineVerified && w.webCapabilityVerified &&
    Number.isFinite(w.lastHeartbeatMs) &&
    w.lastHeartbeatMs <= nowMs &&
    nowMs - w.lastHeartbeatMs <= heartbeatTtlMs);
  const uniqueAgents = new Set<string>();
  const uniqueJobs = new Set<string>();
  const result: Assignment[] = [];
  for (const job of jobs) {
    if (result.length >= maxConcurrent) break;
    if (!job.id || !job.region || !job.query.trim() || uniqueJobs.has(job.id)) continue;
    const worker = eligible.find(w => !uniqueAgents.has(w.agentId));
    if (!worker) break;
    uniqueJobs.add(job.id);
    uniqueAgents.add(worker.agentId);
    result.push({ agentId: worker.agentId, jobId: job.id, region: job.region, query: job.query });
  }
  return result;
}
// This does not start workers, access websites, register accounts, or claim quota.
// Production dispatcher needs persisted leases, authenticated workers, rate limits,
// explicit authorization, audit logs, and idempotent job completion.

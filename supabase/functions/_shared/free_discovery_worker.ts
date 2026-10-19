// AIVAULT global free-resource search worker: gated runtime interface.
// This file does not execute searches until a separately authorized runner is wired.
export type SearchJob = {
  id: string;
  region: string;
  query: string;
  assignedAgentId: string;
};
export type SearchHit = { title: string; url: string; snippet: string };
export type SearchResult = {
  jobId: string;
  agentId: string;
  status: "DISCOVERED" | "NO_RESULTS" | "BLOCKED";
  candidates: SearchHit[];
  reason?: string;
};
export type AuthorizedSearchAdapter = {
  // Must enforce provider terms, safe-search, host allowlists and outbound rate limits.
  search(query: string, region: string, maxResults: number): Promise<SearchHit[]>;
};
export type SearchPolicy = {
  enabled: boolean;
  maxResults: number;
  approvedAgentIds: ReadonlySet<string>;
  approvedRegions: ReadonlySet<string>;
};
export async function runFreeDiscoveryJob(
  job: SearchJob,
  policy: SearchPolicy,
  adapter: AuthorizedSearchAdapter,
): Promise<SearchResult> {
  const blocked = (reason: string): SearchResult => ({
    jobId: job.id, agentId: job.assignedAgentId,
    status: "BLOCKED", candidates: [], reason,
  });
  if (!policy.enabled) return blocked("DISCOVERY_DISABLED");
  if (!job.id || !job.assignedAgentId ||
      !policy.approvedAgentIds.has(job.assignedAgentId) ||
      !policy.approvedRegions.has(job.region) ||
      !Number.isSafeInteger(policy.maxResults) ||
      policy.maxResults < 1 || policy.maxResults > 10 ||
      typeof job.query !== "string" ||
      job.query.length < 5 || job.query.length > 200) {
    return blocked("POLICY_DENIED");
  }
  // No registration, billing, credential requests or paid endpoint calls.
  const query = job.query + " free AI API official documentation no credit card";
  try {
    const hits = await adapter.search(query, job.region, policy.maxResults);
    const candidates: SearchHit[] = [];
    const seen = new Set<string>();
    if (!Array.isArray(hits)) return blocked("SEARCH_RESPONSE_INVALID");
    for (const hit of hits.slice(0, policy.maxResults)) {
      try {
        if (!hit || typeof hit.url !== "string" ||
            typeof hit.title !== "string" || typeof hit.snippet !== "string") continue;
        const url = new URL(hit.url);
        if (url.protocol !== "https:" || url.username || url.password ||
            !url.hostname || seen.has(url.href)) continue;
        seen.add(url.href);
        candidates.push({
          title: hit.title.slice(0, 200),
          url: url.href,
          snippet: hit.snippet.slice(0, 600),
        });
      } catch { /* reject malformed search results */ }
    }
    return {
      jobId: job.id, agentId: job.assignedAgentId,
      status: candidates.length ? "DISCOVERED" : "NO_RESULTS",
      candidates,
    };
  } catch {
    return blocked("SEARCH_ADAPTER_ERROR");
  }
}
// DISCOVERED is not verified free capacity. Human/terms verification required.
// The adapter is deliberately not implemented; no external provider is invoked.

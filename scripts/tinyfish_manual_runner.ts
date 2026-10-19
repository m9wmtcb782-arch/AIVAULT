// GitHub Actions only. One explicitly approved TinyFish discovery job per dispatch.
import { runTinyFishJob, type DiscoveryJob } from "../supabase/functions/_shared/tinyfish_trusted_runner.ts";
import { triageCandidates, type Candidate } from "../supabase/functions/_shared/tinyfish_resource_triage.ts";
const required = (name: string): string => {
  const value = Deno.env.get(name) ?? "";
  if (!value) throw Error("MISSING_" + name);
  return value;
};
const region = required("JOB_REGION");
if (!["TW", "US", "JP"].includes(region)) throw Error("REGION_DENIED");
const job: DiscoveryJob = {
  id: "manual-" + crypto.randomUUID(),
  assignedAgentId: required("JOB_WORKER"),
  region: region as DiscoveryJob["region"],
  query: required("JOB_QUERY"),
};
const outcome = await runTinyFishJob(job, {
  endpoint: "https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/free-discovery-search",
  supabaseJwt: required("AIVAULT_SUPABASE_JWT"),
  runnerSecret: required("AIVAULT_DISCOVERY_RUNNER_SECRET"),
});
const data = outcome.body && typeof outcome.body === "object" ? outcome.body as Record<string, unknown> : {};
// Never print tokens or raw provider payloads to workflow logs.
console.log(JSON.stringify({ jobId: outcome.jobId, httpStatus: outcome.httpStatus, status: data.status ?? null, candidateCount: Array.isArray(data.candidates) ? data.candidates.length : 0 }));
if (outcome.httpStatus !== 200 || !["DISCOVERED", "NO_RESULTS"].includes(String(data.status))) Deno.exit(1);


const candidates = Array.isArray(data.candidates) ? data.candidates.slice(0, 5).flatMap((hit: unknown) => {
  if (!hit || typeof hit !== "object") return [];
  const h = hit as Record<string, unknown>;
  if (typeof h.url !== "string" || !h.url.startsWith("https://")) return [];
  return [{ title: String(h.title ?? "").slice(0, 200), url: h.url.slice(0, 2000),
    snippet: String(h.snippet ?? "").slice(0, 600) }];
}) : [];
const triaged = triageCandidates(candidates as Candidate[]);
const triageCounts = { officialDocs: triaged.filter(x => x.classification === "OFFICIAL_DOCS").length,
  thirdPartyLeads: triaged.filter(x => x.classification === "THIRD_PARTY_LEAD").length,
  rejected: triaged.filter(x => x.classification === "REJECTED").length };
console.log(JSON.stringify({ triageCounts, verifiedFreeCapacity: false }));
await Deno.mkdir("tinyfish-evidence", { recursive: true });
await Deno.writeTextFile("tinyfish-evidence/search.json", JSON.stringify({
  jobId: outcome.jobId, agentId: job.assignedAgentId, region: job.region,
  status: data.status, verifiedFreeCapacity: false, candidates, triage: triaged, triageCounts,
}, null, 2));

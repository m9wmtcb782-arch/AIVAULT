// AIVAULT TinyFish trusted runner: server-side only. Never import in a browser.
// Caller must supply credentials from a server secret manager, never from a job.
export type DiscoveryJob = {
  id: string;
  query: string;
  region: "TW" | "US" | "JP";
  assignedAgentId: string;
};
export type RunnerConfig = {
  endpoint: string;
  supabaseJwt: string;
  runnerSecret: string;
};
export type RunnerResult = {
  jobId: string;
  httpStatus: number;
  body: unknown;
};
const validJob = (j: DiscoveryJob) =>
  /^Worker-0[12][0-9]{2}$/.test(j.assignedAgentId) &&
  Number(j.assignedAgentId.slice(7)) >= 101 &&
  Number(j.assignedAgentId.slice(7)) <= 200 &&
  /^[a-zA-Z0-9_-]{1,80}$/.test(j.id) &&
  j.query.length >= 5 && j.query.length <= 200 &&
  ["TW", "US", "JP"].includes(j.region);
export async function runTinyFishJob(
  job: DiscoveryJob,
  config: RunnerConfig,
  fetcher: typeof fetch = fetch,
): Promise<RunnerResult> {
  if (!validJob(job)) throw Error("RUNNER_JOB_DENIED");
  if (config.endpoint !== "https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/free-discovery-search" ||
      !config.supabaseJwt || config.runnerSecret.length < 32) {
    throw Error("RUNNER_NOT_CONFIGURED");
  }
  const response = await fetcher(config.endpoint, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + config.supabaseJwt,
      "apikey": config.supabaseJwt,
      "x-aivault-runner-secret": config.runnerSecret,
      "content-type": "application/json",
    },
    body: JSON.stringify(job),
    redirect: "error",
    signal: AbortSignal.timeout(12000),
  });
  const raw = await response.text();
  if (raw.length > 65536) throw Error("RUNNER_RESPONSE_TOO_LARGE");
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw Error("RUNNER_INVALID_RESPONSE"); }
  return { jobId: job.id, httpStatus: response.status, body };
}

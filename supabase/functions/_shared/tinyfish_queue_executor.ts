// Server-only queue executor for AIVAULT TinyFish discovery.
// Processes at most one job per invocation; no timers or unbounded retries.
// The shared database lease in free-discovery-search is the authoritative 5/min gate.
import { runTinyFishJob, type DiscoveryJob, type RunnerConfig } from "./tinyfish_trusted_runner.ts";
export type QueueItem = DiscoveryJob & { attempts: number };
export type QueueOutcome = { action: "COMPLETE" | "DEFER" | "REJECT"; status: number; result?: unknown };
export async function processDiscoveryQueueItem(
  item: QueueItem,
  config: RunnerConfig,
  fetcher: typeof fetch = fetch,
): Promise<QueueOutcome> {
  if (!Number.isSafeInteger(item.attempts) || item.attempts < 0 || item.attempts > 2)
    return { action: "REJECT", status: 400 };
  try {
    const result = await runTinyFishJob(item, config, fetcher);
    if (result.httpStatus === 429 || result.httpStatus >= 500)
      return { action: "DEFER", status: result.httpStatus };
    if (result.httpStatus !== 200)
      return { action: "REJECT", status: result.httpStatus };
    const body = result.body;
    if (!body || typeof body !== "object" || !("status" in body))
      return { action: "REJECT", status: 502 };
    const status = (body as { status: unknown }).status;
    if (status === "BLOCKED") return { action: "REJECT", status: 422, result: body };
    if (status !== "DISCOVERED" && status !== "NO_RESULTS")
      return { action: "REJECT", status: 502 };
    return { action: "COMPLETE", status: 200, result: body };
  } catch {
    return { action: "DEFER", status: 503 };
  }
}

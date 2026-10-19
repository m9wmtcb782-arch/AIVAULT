// Isolated TinyFish discovery endpoint. NOT DEPLOYED.
// No browser credentials, no public agent access, no paid providers.
import { runFreeDiscoveryJob, type SearchJob } from "../_shared/free_discovery_worker.ts";
import { createTinyFishServerAdapter } from "../_shared/tinyfish_search_adapter.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
const env = (key: string) => Deno.env.get(key) ?? "";
const authorized = async (req: Request, secret: string): Promise<boolean> => {
  if (!secret || secret.length < 32) return false;
  const bearer = req.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ")) return false;
  const supplied = bearer.slice(7);
  if (supplied.length !== secret.length) return false;
  const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([digest(supplied), digest(secret)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!(await authorized(req, env("AIVAULT_DISCOVERY_RUNNER_SECRET")))) {
    return json({ error: "UNAUTHORIZED" }, 401);
  }
  // Both switches must be explicitly enabled; default is off.
  if (env("AIVAULT_DISCOVERY_ENABLED") !== "true" ||
      env("AIVAULT_TINYFISH_ENABLED") !== "true" ||
      env("AIVAULT_TINYFISH_TERMS_APPROVED") !== "true") {
    return json({ error: "DISCOVERY_DISABLED" }, 503);
  }
  // Never buffer unbounded caller input, even without Content-Length.
  const lengthHeader = req.headers.get("content-length");
  if (lengthHeader !== null && (!/^\\d+$/.test(lengthHeader) || Number(lengthHeader) > 8192)) {
    return json({ error: "REQUEST_TOO_LARGE" }, 413);
  }
  if (!req.body) return json({ error: "INVALID_JSON" }, 400);
  let job: SearchJob;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 8192) return json({ error: "REQUEST_TOO_LARGE" }, 413);
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error("bad job");
    const value = parsed as Record<string, unknown>;
    if (typeof value.id !== "string" || typeof value.query !== "string" ||
        typeof value.region !== "string" || typeof value.assignedAgentId !== "string") {
      throw Error("invalid fields");
    }
    job = { id: value.id, query: value.query, region: value.region,
      assignedAgentId: value.assignedAgentId };
  } catch { return json({ error: "INVALID_JSON" }, 400); }
  finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const approvedAgentIds = new Set(env("AIVAULT_DISCOVERY_APPROVED_AGENT_IDS").split(",").map(x => x.trim()).filter(Boolean));
  const approvedRegions = new Set(env("AIVAULT_DISCOVERY_APPROVED_REGIONS").split(",").map(x => x.trim()).filter(Boolean));
  try {
    const adapter = createTinyFishServerAdapter({
      enabled: true,
      apiKey: env("TINYFISH_API_KEY"),
      endpoint: "https://api.search.tinyfish.ai/",
      maxRequestsPerMinute: 5,
      termsApproved: true,
    }, env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
    const result = await runFreeDiscoveryJob(job, {
      enabled: true, maxResults: 5, approvedAgentIds, approvedRegions,
    }, adapter);
    return json(result);
  } catch { return json({ error: "SEARCH_NOT_CONFIGURED" }, 503); }
});

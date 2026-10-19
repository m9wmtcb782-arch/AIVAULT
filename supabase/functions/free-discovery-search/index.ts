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
  const length = Number(req.headers.get("content-length") || 0);
  if (length > 8192) return json({ error: "REQUEST_TOO_LARGE" }, 413);
  let job: SearchJob;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 8192) return json({ error: "REQUEST_TOO_LARGE" }, 413);
    job = JSON.parse(raw);
    if (!job || typeof job !== "object" || Array.isArray(job)) throw Error("bad job");
  } catch { return json({ error: "INVALID_JSON" }, 400); }
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

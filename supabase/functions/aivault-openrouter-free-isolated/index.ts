// Isolated OpenRouter adapter entrypoint. Not wired into production routing.
// No paid-model fallback. Disabled by default. No user-supplied prompt egress.
import { createApprovedPublicTask, type PublicTaskId } from "../_shared/aivault_public_task_allowlist.ts";
import { runOpenRouterFreeInference } from "../_shared/openrouter_free_inference.ts";

const json = (status: number, value: unknown) => new Response(JSON.stringify(value), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
const allowedIds = new Set<PublicTaskId>(["PUBLIC_CONNECTIVITY_CHECK", "PUBLIC_GENERAL_KNOWLEDGE"]);
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  // This route must not become a public proxy. Require trusted internal authorization.
  const expected = Deno.env.get("AIVAULT_OPENROUTER_INTERNAL_TOKEN");
  const supplied = req.headers.get("x-aivault-openrouter-token");
  if (!expected || !supplied || supplied !== expected) return json(403, { ok: false, error: "FORBIDDEN" });
  if (Deno.env.get("AIVAULT_OPENROUTER_FREE_ENABLED") !== "true")
    return json(503, { ok: false, error: "FREE_INFERENCE_DISABLED" });
  let body: unknown;
  try {
    if (Number(req.headers.get("content-length") || 0) > 1024) return json(413, { ok: false, error: "REQUEST_TOO_LARGE" });
    const raw = await req.text();
    if (raw.length > 1024) return json(413, { ok: false, error: "REQUEST_TOO_LARGE" });
    body = JSON.parse(raw);
  } catch { return json(400, { ok: false, error: "INVALID_JSON" }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { ok: false, error: "INVALID_REQUEST" });
  const taskId = (body as Record<string, unknown>).taskId;
  if (typeof taskId !== "string" || !allowedIds.has(taskId as PublicTaskId))
    return json(400, { ok: false, error: "UNAPPROVED_PUBLIC_TASK" });
  const task = createApprovedPublicTask(taskId as PublicTaskId);
  const apiKey = Deno.env.get("OPENROUTER_API_KEY") || "";
  if (!apiKey) return json(503, { ok: false, error: "OPENROUTER_KEY_NOT_CONFIGURED" });
  try {
    const result = await runOpenRouterFreeInference(
      { prompt: task.prompt, model: "openrouter/free" },
      { apiKey, enabled: true, authorized: true, egress: task.egress },
    );
    return json(200, { ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const safe = /^(FREE_|INVALID_|UNEXPECTED_|NONZERO_|RESPONSE_|EMPTY_|EGRESS_|UNAPPROVED_|MISSING_|DESTINATION_)/.test(message)
      ? message : "PROVIDER_REQUEST_FAILED";
    return json(502, { ok: false, error: safe });
  }
});

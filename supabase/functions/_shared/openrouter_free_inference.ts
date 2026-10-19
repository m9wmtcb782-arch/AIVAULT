import { authorizeExternalEgress, type EgressRequest } from "./aivault_external_egress.ts";
import { createApprovedPublicTask } from "./aivault_public_task_allowlist.ts";
// Isolated OpenRouter free-only adapter. No production route or automatic execution.
// Caller must explicitly authorize a controlled test; never fall back to paid models.
export type FreeInferenceRequest = { prompt: string; model: string };
export type FreeInferenceResult = { text: string; model: string; usage: unknown; zeroCostVerified: boolean };
export function validateFreeRequest(input: FreeInferenceRequest): void {
 if (!input || typeof input.prompt !== "string" || input.prompt.length < 1 || input.prompt.length > 2000)
  throw Error("INVALID_PROMPT");
 // Only the provider's explicitly free router is accepted; no caller-selected paid model.
 if (input.model !== "openrouter/free") throw Error("FREE_MODEL_ONLY");
}
export async function runOpenRouterFreeInference(
 input: FreeInferenceRequest,
 options: { apiKey: string; enabled: boolean; authorized: boolean; egress: EgressRequest; fetcher?: typeof fetch }
): Promise<FreeInferenceResult> {
 validateFreeRequest(input);
 const publicPrompts = [createApprovedPublicTask("PUBLIC_CONNECTIVITY_CHECK").prompt, createApprovedPublicTask("PUBLIC_GENERAL_KNOWLEDGE").prompt];
 if (!publicPrompts.includes(input.prompt)) throw Error("UNAPPROVED_PUBLIC_TASK");
 const egress = authorizeExternalEgress(options.egress);
 if (!egress.allowed || options.egress?.payload !== input.prompt) throw Error("EGRESS_DENIED");
 if (!options?.enabled || !options?.authorized) throw Error("FREE_INFERENCE_DISABLED");
 if (!options.apiKey) throw Error("MISSING_OPENROUTER_KEY");
 const fetcher = options.fetcher ?? fetch;
 const response = await fetcher("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST", redirect: "error", signal: AbortSignal.timeout(12000),
  headers: { authorization: "Bearer " + options.apiKey, "content-type": "application/json" },
  body: JSON.stringify({ model: "openrouter/free", messages: [{ role: "user", content: input.prompt }],
   max_tokens: 128, stream: false })
 });
 if (response.redirected || (response.url && response.url !== "https://openrouter.ai/api/v1/chat/completions"))
  throw Error("DESTINATION_MISMATCH");
 if (!response.ok) throw Error("FREE_PROVIDER_UNAVAILABLE_" + response.status);
 const contentType = response.headers.get("content-type") ?? "";
 if (!/^application\/json(?:;|$)/i.test(contentType)) throw Error("INVALID_PROVIDER_CONTENT_TYPE");
 const declared = Number(response.headers.get("content-length") ?? 0);
 if (!Number.isSafeInteger(declared) || declared < 0 || declared > 65536) throw Error("RESPONSE_TOO_LARGE");
 const reader = response.body?.getReader();
 if (!reader) throw Error("EMPTY_RESPONSE");
 const chunks: Uint8Array[] = []; let total = 0;
 try {
  while (true) { const part = await reader.read(); if (part.done) break;
   total += part.value.byteLength; if (total > 65536) throw Error("RESPONSE_TOO_LARGE");
   chunks.push(part.value); }
 } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
 const bytes = new Uint8Array(total); let pos = 0;
 for (const chunk of chunks) { bytes.set(chunk,pos); pos += chunk.byteLength; }
 let data: unknown;
 try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw Error("INVALID_PROVIDER_JSON"); }
 if (!data || typeof data !== "object") throw Error("INVALID_PROVIDER_RESPONSE");
 const parsed = data as Record<string, unknown>;
 // A free-only request is not proof that the provider honored the requested model.
 // Reject any explicitly reported different model; never silently accept a fallback.
 if (typeof parsed.model !== "string" || parsed.model !== "openrouter/free" && !parsed.model.endsWith(":free")) throw Error("UNEXPECTED_PROVIDER_MODEL");
 const choices = parsed.choices;
 const choice = Array.isArray(choices) ? choices[0] : null;
 const message = choice && typeof choice === "object" ? (choice as Record<string,unknown>).message : null;
 const text = message && typeof message === "object" ? (message as Record<string,unknown>).content : null;
 if (typeof text !== "string") throw Error("INVALID_PROVIDER_RESPONSE");
 const usage = parsed.usage && typeof parsed.usage === "object" ? parsed.usage as Record<string, unknown> : null;
 const reportedCost = usage?.cost;
 if (reportedCost !== undefined && reportedCost !== null &&
     !(reportedCost === 0 || reportedCost === "0" || reportedCost === "0.0" || reportedCost === "0.00"))
  throw Error("NONZERO_OR_INVALID_COST_REPORTED");
 // No cost field is not proof of zero billing; account-side billing still requires independent verification.
 return { text: text.slice(0,10000), model: String(parsed.model ?? "unknown"), usage: parsed.usage ?? null,
  zeroCostVerified: reportedCost === 0 || reportedCost === "0" || reportedCost === "0.0" || reportedCost === "0.00" };
}

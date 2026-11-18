// deno test --allow-env --allow-read --allow-net=none tests/ai-gateway/thinking.test.ts
// Offline: Deno.serve is captured and fetch is mocked; no real provider call.
let handler: ((req: Request) => Promise<Response>) | null = null;
(Deno as any).serve = (h: any) => { handler = typeof h === "function" ? h : h.handler; return { finished: Promise.resolve() }; };
Deno.env.set("GEMINI_API_KEY", "test-key-not-real");
Deno.env.set("SUPABASE_URL", "http://127.0.0.1:9");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "x");

const geminiBodies: any[] = [];
let geminiMode: "ok" | "reject-thinking" = "ok";
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(input?.url ?? input);
  if (url.includes("generativelanguage.googleapis.com")) {
    const body = JSON.parse(String(init?.body || "{}"));
    geminiBodies.push(body);
    if (geminiMode === "reject-thinking" && body.generationConfig?.thinkingConfig) {
      return new Response(JSON.stringify({ error: { message: "Invalid thinking config" } }), { status: 400 });
    }
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "答案" }] }, finishReason: "MAX_TOKENS" }] }), { status: 200 });
  }
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

const mod = await import("../../supabase/functions/ai-gateway/index.ts");
const eq = (a: unknown, b: unknown, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };

Deno.test("parseThinkingOptions: absent → null (defaults unchanged)", () => {
  eq(mod.parseThinkingOptions({ messages: [] }), null);
  eq(mod.parseThinkingOptions(null), null);
  eq(mod.parseThinkingOptions({ thinking: { level: "bogus" } }), null);
});
Deno.test("parseThinkingOptions: level / budget forms", () => {
  eq(mod.parseThinkingOptions({ thinking: { level: "LOW" } }), { level: "low" });
  eq(mod.parseThinkingOptions({ thinking_level: "minimal" }), { level: "minimal" });
  eq(mod.parseThinkingOptions({ thinking: { budget: 512.7 } }), { budget: 512 });
  eq(mod.parseThinkingOptions({ thinking_budget: 99999 }), { budget: 32768 });
  eq(mod.parseThinkingOptions({ thinking_budget: -5 }), { budget: -1 });
  eq(mod.parseThinkingOptions({ thinking: { level: "low", budget: 100 } }), { level: "low" }, "level wins, never both");
});
Deno.test("thinkingConfigCandidates ends with no-thinking fallback", () => {
  eq(mod.thinkingConfigCandidates(null), [null]);
  eq(mod.thinkingConfigCandidates({ level: "low" }), [{ thinkingLevel: "low" }, { thinkingLevel: "LOW" }, null]);
  eq(mod.thinkingConfigCandidates({ budget: 0 }), [{ thinkingBudget: 0 }, null]);
});
Deno.test("extractGeminiFinishReason", () => {
  eq(mod.extractGeminiFinishReason({ candidates: [{ finishReason: "STOP" }] }), "STOP");
  eq(mod.extractGeminiFinishReason({}), null);
});

async function ask(extra: Record<string, unknown>) {
  geminiBodies.length = 0;
  const res = await handler!(new Request("http://localhost/ai-gateway", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "gemini", allowed_providers: ["gemini"], capability: "chat", messages: [{ role: "user", content: "測試" }], max_tokens: 100, ...extra }),
  }));
  return { status: res.status, data: await res.json() };
}
Deno.test("handler: no thinking field → payload has no thinkingConfig; finish_reason returned", async () => {
  geminiMode = "ok";
  const { data } = await ask({});
  eq(data.success, true, "success");
  eq(geminiBodies.length >= 1, true);
  eq("thinkingConfig" in (geminiBodies[0].generationConfig || {}), false, "no thinkingConfig by default");
  eq(data.finish_reason, "MAX_TOKENS");
  eq(data.thinking_applied, null);
});
Deno.test("handler: thinking low → thinkingConfig.thinkingLevel sent", async () => {
  geminiMode = "ok";
  const { data } = await ask({ thinking: { level: "low" } });
  eq(geminiBodies[0].generationConfig.thinkingConfig, { thinkingLevel: "low" });
  eq(geminiBodies[0].generationConfig.maxOutputTokens, 100);
  eq(data.thinking_applied, { thinkingLevel: "low" });
});
Deno.test("handler: model rejects thinking (400) → retried without it, still succeeds", async () => {
  geminiMode = "reject-thinking";
  const { data } = await ask({ thinking: { level: "low" } });
  eq(data.success, true);
  eq(geminiBodies.slice(0, 3).map((b) => b.generationConfig.thinkingConfig ?? null), [{ thinkingLevel: "low" }, { thinkingLevel: "LOW" }, null]);
  eq(data.thinking_applied, null);
  geminiMode = "ok";
});
void realFetch;

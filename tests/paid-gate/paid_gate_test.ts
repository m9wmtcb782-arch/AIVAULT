// pg1 offline test: no network. fetch and env are stubbed; fake keys are set.
// Run: deno test -A tests/paid-gate/paid_gate_test.ts
const PAID = /api\.x\.ai|magichour\.ai|api\.openai\.com|elevenlabs\.io|texttospeech\.googleapis\.com|fish\.audio/;
const env: Record<string, string> = {
  SUPABASE_URL: "https://stub.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "sr", SUPABASE_ANON_KEY: "anon",
  XAI_API_KEY: "fake-xai", GROK_API_KEY: "fake-grok", GROQ_API_KEY: "fake-groq", GEMINI_API_KEY: "fake-gem",
  MAGIC_HOUR_API_KEY: "fake-mh", OPENAI_API_KEY: "fake-oa", ELEVENLABS_API_KEY: "fake-el",
  GOOGLE_TTS_API_KEY: "fake-gt", FISH_API_KEY: "fake-fish", PAID_API_ALLOW: "",
};
Deno.env.get = (k: string) => env[k];
const hits: string[] = [];
globalThis.fetch = ((input: any, init?: any) => {
  const url = typeof input === "string" ? input : input.url ?? String(input);
  hits.push(url);
  return Promise.resolve(new Response(JSON.stringify({ error: "stub" }), { status: 503, headers: { "content-type": "application/json" } }));
}) as typeof fetch;
let handler: ((r: Request) => Promise<Response>) | null = null;
let last: any = null;
(Deno as any).serve = (a: any, b?: any) => { last = typeof a === "function" ? a : b; return { finished: Promise.resolve() }; };
const paidHits = () => hits.filter((u) => PAID.test(u));
const reset = () => { hits.length = 0; };
const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };

const { paidAllowed } = await import("../../supabase/functions/_shared/paid_gate.ts");

Deno.test("paidAllowed: default deny with keys present; allow list; kill switch", () => {
  env.PAID_API_ALLOW = ""; assert(!paidAllowed("gateway_grok_explicit"), "should deny");
  env.PAID_API_ALLOW = "fish_tts, gateway_grok_explicit"; assert(paidAllowed("gateway_grok_explicit"), "should allow");
  env.PAID_API_KILL = "1"; assert(!paidAllowed("gateway_grok_explicit"), "kill should deny"); delete env.PAID_API_KILL;
  env.PAID_API_ALLOW = "";
});

Deno.test("yinxu llm(): zero paid-host fetches (skipGemini and default)", async () => {
  const { llm } = await import("../../supabase/functions/dark-star-ebook-ingest/yinxu.ts");
  for (const o of [{ skipGemini: true }, {}]) {
    reset(); await llm("s", "u", o).catch(() => {});
    assert(hits.length > 0, "llm made no calls"); assert(paidHits().length === 0, "paid hit: " + paidHits());
    const gw = hits.find((u) => u.includes("/functions/v1/ai-gateway")); assert(!!gw, "gateway fallback expected");
  }
});

async function gw(body: unknown) {
  if (!handler) { await import("../../supabase/functions/ai-gateway/index.ts"); handler = last; }
  reset();
  const r = await handler!(new Request("https://stub.supabase.co/functions/v1/ai-gateway", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer sr", apikey: "sr" }, body: JSON.stringify(body) }));
  return { status: r.status, j: await r.json().catch(() => ({})) };
}
Deno.test("ai-gateway default / gemini / groq order: zero paid-host fetches", async () => {
  env.PAID_API_ALLOW = "";
  for (const b of [{ message: "hi" }, { provider: "gemini", message: "hi" }, { provider: "groq", message: "hi" }]) {
    const { status, j } = await gw(b);
    assert(paidHits().length === 0, `paid hit for ${JSON.stringify(b)}: ${paidHits()}`);
    console.log("  gateway", JSON.stringify(b), "->", status, String(j.error || ""), "hosts:", [...new Set(hits.map((u) => new URL(u).host))].join(","));
  }
});
Deno.test("ai-gateway explicit grok: 403 without flag, reaches api.x.ai with flag (stubbed)", async () => {
  env.PAID_API_ALLOW = "";
  let r = await gw({ provider: "grok", message: "hi" });
  assert(r.status === 403 && r.j.error === "PAID_PROVIDER_NOT_AUTHORIZED", "expected 403, got " + r.status + " " + r.j.error);
  assert(paidHits().length === 0, "paid hit without flag");
  env.PAID_API_ALLOW = "gateway_grok_explicit";
  r = await gw({ provider: "grok", message: "hi" });
  assert(hits.some((u) => u.includes("api.x.ai")), "with flag, grok should be attempted (stub)");
  console.log("  explicit grok with flag ->", r.status, "x.ai attempted (stubbed):", hits.filter((u) => u.includes("api.x.ai")).length);
  env.PAID_API_ALLOW = "";
});

let tts: any = null;
async function ttsCall(body: unknown) {
  if (!tts) { await import("../../supabase/functions/aivault-tts/index.ts"); tts = last; }
  reset();
  const r = await tts(new Request("https://stub.supabase.co/functions/v1/aivault-tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  return { status: r.status, j: await r.json().catch(() => ({})) };
}
Deno.test("aivault-tts auto and explicit paid providers: zero paid-host fetches without flag", async () => {
  env.PAID_API_ALLOW = "";
  for (const b of [{ text: "你好" }, { text: "你好", provider: "auto" }, { text: "你好", provider: "openai" }, { text: "你好", provider: "elevenlabs" }, { text: "你好", provider: "google" }]) {
    const { status, j } = await ttsCall(b);
    assert(paidHits().length === 0, `paid hit ${JSON.stringify(b)}: ${paidHits()}`);
    console.log("  tts", JSON.stringify(b), "->", status, j.provider ?? j.data?.provider ?? "", j.fallback ?? j.data?.fallback ?? "");
  }
  env.PAID_API_ALLOW = "tts_openai";
  await ttsCall({ text: "你好", provider: "openai" });
  assert(hits.some((u) => u.includes("api.openai.com")), "with tts_openai flag, explicit openai should be attempted (stub)");
  env.PAID_API_ALLOW = "";
});

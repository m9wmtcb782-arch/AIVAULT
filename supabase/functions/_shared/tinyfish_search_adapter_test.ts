import { createTinyFishSearchAdapter } from "./tinyfish_search_adapter.ts";
import { createTinyFishQuotaLease } from "./tinyfish_quota_lease.ts";

const base = {
  enabled: true,
  apiKey: "dummy-test-key",
  endpoint: "https://api.search.tinyfish.ai/",
  maxRequestsPerMinute: 5,
  termsApproved: true,
};

Deno.test("disabled lease prevents outbound search", async () => {
  let calls = 0;
  const adapter = createTinyFishSearchAdapter({
    ...base, acquireQuotaLease: async () => false,
  }, async () => { calls++; throw Error("must not fetch"); });
  let rejected = false;
  try { await adapter.search("free inference API", "tw", 2); } catch (e) {
    rejected = String(e).includes("TINYFISH_QUOTA_EXHAUSTED");
  }
  if (!rejected || calls !== 0) throw Error("fail closed failed");
});

Deno.test("granted lease uses GET with X-API-Key", async () => {
  let calls = 0;
  const adapter = createTinyFishSearchAdapter({
    ...base, acquireQuotaLease: async () => true,
  }, async (input, init) => {
    calls++;
    const url = new URL(String(input));
    if (url.hostname !== "api.search.tinyfish.ai" ||
        url.searchParams.get("query") !== "free inference API" ||
        url.searchParams.get("location") !== "TW" ||
        init?.method !== "GET" ||
        new Headers(init.headers).get("X-API-Key") !== "dummy-test-key") {
      throw Error("request contract mismatch");
    }
    return new Response(JSON.stringify({ results: [
      { title: "Example", url: "https://example.org/docs", snippet: "sample" },
    ] }), { status: 200 });
  });
  const hits = await adapter.search("free inference API", "tw", 2);
  if (calls !== 1 || hits.length !== 1 || hits[0].url !== "https://example.org/docs") {
    throw Error("response parsing failed");
  }
});

Deno.test("quota RPC refuses non-true responses", async () => {
  const lease = createTinyFishQuotaLease("https://example.supabase.co", "dummy", async () =>
    new Response("false", { status: 200, headers: { "Content-Type": "application/json" } }));
  if (await lease("tinyfish_search")) throw Error("false lease accepted");
});

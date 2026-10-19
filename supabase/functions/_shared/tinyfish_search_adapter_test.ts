import { createTinyFishSearchAdapter, createTinyFishServerAdapter } from "./tinyfish_search_adapter.ts";
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

Deno.test("HTTP 429 does not trigger retry or a second lease", async () => {
  let leases = 0;
  let requests = 0;
  const adapter = createTinyFishSearchAdapter({
    ...base, acquireQuotaLease: async () => { leases++; return true; },
  }, async () => {
    requests++;
    return new Response("rate limited", { status: 429 });
  });
  let rejected = false;
  try { await adapter.search("free inference API", "tw", 2); } catch (e) {
    rejected = String(e).includes("SEARCH_HTTP_429");
  }
  if (!rejected || leases !== 1 || requests !== 1) throw Error("unexpected retry");
});

Deno.test("invalid search input consumes no lease", async () => {
  let leases = 0;
  const adapter = createTinyFishSearchAdapter({
    ...base, acquireQuotaLease: async () => { leases++; return true; },
  }, async () => { throw Error("unexpected network"); });
  let rejected = false;
  try { await adapter.search("bad", "tw", 2); } catch (e) {
    rejected = String(e).includes("INVALID_SEARCH_REQUEST");
  }
  if (!rejected || leases !== 0) throw Error("invalid request consumed quota");
});

Deno.test("server factory routes RPC before search", async () => {
  const sequence: string[] = [];
  const adapter = createTinyFishServerAdapter(
    base, "https://example.supabase.co", "dummy-service-key",
    async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname === "example.supabase.co") {
        sequence.push("lease");
        if (url.pathname !== "/rest/v1/rpc/aivault_tinyfish_acquire_lease" ||
            init?.method !== "POST") throw Error("wrong RPC");
        return new Response("true", { status: 200, headers: { "Content-Type": "application/json" } });
      }
      sequence.push("search");
      return new Response('{"results":[]}', { status: 200 });
    },
  );
  const hits = await adapter.search("free inference API", "tw", 2);
  if (hits.length !== 0 || sequence.join(",") !== "lease,search") {
    throw Error("quota must precede search");
  }
});

Deno.test("server factory denies search if RPC is unavailable", async () => {
  let externalSearches = 0;
  const adapter = createTinyFishServerAdapter(
    base, "https://example.supabase.co", "dummy-service-key",
    async (input) => {
      if (new URL(String(input)).hostname === "example.supabase.co") {
        return new Response("unavailable", { status: 503 });
      }
      externalSearches++;
      throw Error("search must not be sent");
    },
  );
  let blocked = false;
  try { await adapter.search("free inference API", "tw", 2); } catch (e) {
    blocked = String(e).includes("TINYFISH_QUOTA_EXHAUSTED");
  }
  if (!blocked || externalSearches !== 0) throw Error("RPC outage not fail closed");
});

Deno.test("concurrent calls require distinct quota leases", async () => {
  let granted = 0;
  let searched = 0;
  const adapter = createTinyFishSearchAdapter({
    ...base,
    acquireQuotaLease: async () => {
      // Simulate a shared atomic quota counter with asynchronous contention.
      await Promise.resolve();
      return ++granted <= 5;
    },
  }, async () => {
    searched++;
    return new Response('{"results":[]}', { status: 200 });
  });
  const outcomes = await Promise.allSettled(
    Array.from({ length: 20 }, () => adapter.search("free inference API", "tw", 2)),
  );
  const successes = outcomes.filter((x) => x.status === "fulfilled").length;
  if (successes !== 5 || searched !== 5 || granted !== 20) {
    throw Error("concurrent lease gating failed");
  }
});

Deno.test("malformed endpoint fails before any network activity", () => {
  let calls = 0;
  let rejected = false;
  try {
    createTinyFishSearchAdapter({
      ...base, endpoint: "not a URL", acquireQuotaLease: async () => true,
    }, async () => { calls++; throw Error("must not fetch"); });
  } catch (e) {
    rejected = String(e).includes("TINYFISH_ENDPOINT_NOT_ALLOWED");
  }
  if (!rejected || calls !== 0) throw Error("malformed endpoint not rejected");
});

Deno.test("runtime non-string query is rejected without quota", async () => {
  let leases = 0;
  const adapter = createTinyFishSearchAdapter({
    ...base, acquireQuotaLease: async () => { leases++; return true; },
  }, async () => { throw Error("must not fetch"); });
  let rejected = false;
  try {
    await adapter.search(null as unknown as string, "tw", 2);
  } catch (e) {
    rejected = String(e).includes("INVALID_SEARCH_REQUEST");
  }
  if (!rejected || leases !== 0) throw Error("non-string input consumed quota");
});

Deno.test("quota configuration below shared DB cap is rejected", () => {
  let rejected = false;
  try {
    createTinyFishSearchAdapter({
      ...base, maxRequestsPerMinute: 1,
      acquireQuotaLease: async () => true,
    });
  } catch (e) {
    rejected = String(e).includes("TINYFISH_RATE_LIMIT_INVALID");
  }
  if (!rejected) throw Error("local quota mismatch was accepted");
});

Deno.test("nonstandard HTTPS port is rejected", () => {
  let rejected = false;
  try {
    createTinyFishSearchAdapter({
      ...base, endpoint: "https://api.search.tinyfish.ai:8443/",
      acquireQuotaLease: async () => true,
    });
  } catch (e) {
    rejected = String(e).includes("TINYFISH_ENDPOINT_NOT_ALLOWED");
  }
  if (!rejected) throw Error("custom port accepted");
});

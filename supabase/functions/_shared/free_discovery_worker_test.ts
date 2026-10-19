import { runFreeDiscoveryJob } from "./free_discovery_worker.ts";

const job = { id: "job-1", region: "tw", query: "free inference", assignedAgentId: "worker-1" };
const policy = {
  enabled: true,
  maxResults: 3,
  approvedAgentIds: new Set(["worker-1"]),
  approvedRegions: new Set(["tw"]),
};

Deno.test("discovery disabled never calls search", async () => {
  let calls = 0;
  const result = await runFreeDiscoveryJob(job, { ...policy, enabled: false }, {
    search: async () => { calls++; throw Error("must not search"); },
  });
  if (result.status !== "BLOCKED" || result.reason !== "DISCOVERY_DISABLED" || calls !== 0) {
    throw Error("disabled policy bypassed");
  }
});

Deno.test("unapproved worker never calls search", async () => {
  let calls = 0;
  const result = await runFreeDiscoveryJob({ ...job, assignedAgentId: "worker-2" }, policy, {
    search: async () => { calls++; throw Error("must not search"); },
  });
  if (result.status !== "BLOCKED" || result.reason !== "POLICY_DENIED" || calls !== 0) {
    throw Error("worker allowlist bypassed");
  }
});

Deno.test("discovery filters insecure and duplicate result links", async () => {
  const result = await runFreeDiscoveryJob(job, policy, {
    search: async (query, region, limit) => {
      if (!query.includes("no credit card") || region !== "tw" || limit !== 3) {
        throw Error("incorrect search policy");
      }
      return [
        { title: "Good", url: "https://example.org/docs", snippet: "ok" },
        { title: "Duplicate", url: "https://example.org/docs", snippet: "dup" },
        { title: "Insecure", url: "http://example.org/docs", snippet: "bad" },
      ];
    },
  });
  if (result.status !== "DISCOVERED" || result.candidates.length !== 1 ||
      result.candidates[0].url !== "https://example.org/docs") {
    throw Error("result filter bypassed");
  }
});

Deno.test("search adapter errors do not expose credentials", async () => {
  const result = await runFreeDiscoveryJob(job, policy, {
    search: async () => { throw Error("secret-test-token"); },
  });
  if (result.status !== "BLOCKED" || result.reason !== "SEARCH_ADAPTER_ERROR" ||
      JSON.stringify(result).includes("secret-test-token")) {
    throw Error("unsafe error response");
  }
});

Deno.test("malformed worker query never calls external search", async () => {
  let calls = 0;
  const result = await runFreeDiscoveryJob({ ...job, query: null as unknown as string }, policy, {
    search: async () => { calls++; throw Error("must not search"); },
  });
  if (result.status !== "BLOCKED" || calls !== 0) throw Error("invalid job not blocked");
});

Deno.test("malformed search hits are discarded", async () => {
  const result = await runFreeDiscoveryJob(job, policy, {
    search: async () => [
      null as unknown as { title: string; url: string; snippet: string },
      { title: "Invalid", url: "https://example.org", snippet: null as unknown as string },
      { title: "Valid", url: "https://example.org/valid", snippet: "verified URL format only" },
    ],
  });
  if (result.status !== "DISCOVERED" || result.candidates.length !== 1 ||
      result.candidates[0].title !== "Valid") throw Error("invalid search hit accepted");
});

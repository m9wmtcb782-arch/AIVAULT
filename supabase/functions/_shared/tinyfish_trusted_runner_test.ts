import { runTinyFishJob } from "./tinyfish_trusted_runner.ts";
import { strict as assert } from "node:assert";
const endpoint = "https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/free-discovery-search";
const config = { endpoint, supabaseJwt: "offline-jwt", runnerSecret: "x".repeat(40) };
const valid = { id: "job-1", query: "free open models", region: "TW" as const, assignedAgentId: "Worker-0101" };
let called = 0;
const mocked = (async (_url: string | URL | Request, init?: RequestInit) => {
  called++;
  assert.equal(init?.method, "POST");
  assert.equal(new Headers(init?.headers).get("x-aivault-runner-secret"), config.runnerSecret);
  return new Response(JSON.stringify({ status: "DISCOVERED", candidates: [] }), { status: 200 });
}) as typeof fetch;
const ok = await runTinyFishJob(valid, config, mocked);
assert.equal(ok.httpStatus, 200);
assert.equal(called, 1);
await runTinyFishJob({...valid, assignedAgentId:"Worker-0200"}, config, mocked);
assert.equal(called, 2);
for (const assignedAgentId of ["Worker-0001", "Worker-0100", "Worker-0201", "dark-star"]) {
  await assert.rejects(() => runTinyFishJob({ ...valid, assignedAgentId }, config, mocked), /RUNNER_JOB_DENIED/);
}
assert.equal(called, 2);
await assert.rejects(() => runTinyFishJob(valid, { ...config, runnerSecret: "" }, mocked), /RUNNER_NOT_CONFIGURED/);
assert.equal(called, 2);
console.log("TinyFish runner offline tests PASS");

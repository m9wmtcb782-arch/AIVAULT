/** Run locally with: deno test agent-runtime-v0.1.test.ts
 * NOT EXECUTED / NOT DEPLOYED. No external API calls.
 */
import { AutonomousAgentRuntime, type PlanDecision, type ToolRequest } from "./agent-runtime-v0.1.ts";
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
function request(kind: ToolRequest["kind"] = "read"): ToolRequest {
  return { id: "req-1", name: "research", kind, input: { topic: "public-market" } };
}
Deno.test("read-only tool executes then planner completes", async () => {
  let calls = 0, plans = 0;
  const runtime = new AutonomousAgentRuntime(
    { agentId: "Worker-0101", allowedTools: ["research"], maxSteps: 3 },
    { next: async (): Promise<PlanDecision> => ++plans === 1 ? { type: "tool", request: request() } : { type: "complete", summary: "done" } },
    { execute: async () => { calls++; return { ok: true, output: "mock" }; } }
  );
  runtime.authorize();
  assert((await runtime.step()).state === "OBSERVING", "read should observe");
  assert((await runtime.step()).state === "COMPLETED", "should complete");
  assert(calls === 1, "one call only");
});
Deno.test("external write waits for explicit approval", async () => {
  let calls = 0;
  const runtime = new AutonomousAgentRuntime(
    { agentId: "Worker-0102", allowedTools: ["research"], maxSteps: 2 },
    { next: async () => ({ type: "tool", request: request("external_write") }) },
    { execute: async () => { calls++; return { ok: true }; } }
  );
  runtime.authorize();
  assert((await runtime.step()).state === "APPROVAL_REQUIRED", "approval gate required");
  assert(calls === 0, "must not execute before approval");
  assert((await runtime.resolveApproval("req-1", false)).state === "OBSERVING", "denial returns observation");
  assert(calls === 0, "denied action never executes");
});
Deno.test("tool allowlist denies unknown tool", async () => {
  let calls = 0;
  const runtime = new AutonomousAgentRuntime(
    { agentId: "Worker-0103", allowedTools: [], maxSteps: 2 },
    { next: async () => ({ type: "tool", request: request() }) },
    { execute: async () => { calls++; return { ok: true }; } }
  );
  runtime.authorize();
  assert((await runtime.step()).state === "FAILED", "unknown tool fails");
  assert(calls === 0, "unknown tool never called");
});
Deno.test("step limit prevents unbounded loop", async () => {
  const runtime = new AutonomousAgentRuntime(
    { agentId: "Worker-0104", allowedTools: ["research"], maxSteps: 1 },
    { next: async () => ({ type: "tool", request: request() }) },
    { execute: async () => ({ ok: true }) }
  );
  runtime.authorize();
  await runtime.step();
  assert((await runtime.step()).state === "FAILED", "step cap must stop");
});
Deno.test("approved external write executes once", async () => {
  let calls = 0;
  const runtime = new AutonomousAgentRuntime(
    { agentId: "Worker-0105", allowedTools: ["research"], maxSteps: 2 },
    { next: async () => ({ type: "tool", request: request("external_write") }) },
    { execute: async () => { calls++; return { ok: true }; } }
  );
  runtime.authorize();
  await runtime.step();
  assert((await runtime.resolveApproval("req-1", true)).state === "OBSERVING", "approved write observed");
  assert(calls === 1, "execute once");
});

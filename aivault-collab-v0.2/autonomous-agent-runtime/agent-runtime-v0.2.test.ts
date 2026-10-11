/** Offline-only Deno tests: deno test agent-runtime-v0.2.test.ts
 * No provider calls, network requests, advertising or production DB.
 * NOT EXECUTED at commit time.
 */
import { AutonomousAgentRuntimeV2 } from "./agent-runtime-v0.2.ts";
import type { ApprovalDecision, ApprovalRequest, TrustedApprovalPrincipal } from "./approval-authority-v0.1.ts";
function assert(v: unknown, message: string) { if (!v) throw new Error(message); }
async function digest(input: Record<string, unknown>) {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), x => x.toString(16).padStart(2, "0")).join("");
}
const input = { campaign: "draft-only" };
async function fixture(options: { permission?: boolean; owner?: string } = {}) {
  let executions = 0;
  const used = new Set<string>();
  const principal: TrustedApprovalPrincipal = {
    principalId: "reviewer-1", ownerId: options.owner ?? "owner-1",
    permissions: options.permission === false ? [] : ["agent:approve:external_write"]
  };
  const runtime = new AutonomousAgentRuntimeV2(
    { agentId: "Worker-0101", allowedTools: ["mock_publish"], maxSteps: 2 },
    { next: async () => ({ type: "tool" as const, request: { id: "action-1", name: "mock_publish", kind: "external_write" as const, input } }) },
    { execute: async () => { executions++; return { ok: true }; } },
    { ownerId: "owner-1", resolvePrincipal: async () => principal,
      decisions: { consumeOnce: async id => { if (used.has(id)) return false; used.add(id); return true; } } }
  );
  runtime.authorize();
  assert((await runtime.step()).state === "APPROVAL_REQUIRED", "must wait");
  const inputDigest = await digest(input);
  const request: ApprovalRequest = {
    requestId: "action-1", agentId: "Worker-0101", ownerId: "owner-1",
    toolName: "mock_publish", kind: "external_write", inputDigest,
    expiresAt: new Date(Date.now() + 60000).toISOString()
  };
  const decision: ApprovalDecision = {
    requestId: request.requestId, agentId: request.agentId, ownerId: request.ownerId,
    toolName: request.toolName, inputDigest, approved: true, decidedAt: new Date().toISOString()
  };
  return { runtime, request, decision, executions: () => executions };
}
Deno.test("no external write without approval", async () => {
  const x = await fixture();
  assert(x.executions() === 0, "must not execute early");
});
Deno.test("authorized approval executes exactly once", async () => {
  const x = await fixture();
  assert((await x.runtime.decide(x.request, x.decision)).state === "OBSERVING", "should observe");
  assert(x.executions() === 1, "exactly one execution");
  let rejected = false;
  try { await x.runtime.decide(x.request, x.decision); } catch { rejected = true; }
  assert(rejected && x.executions() === 1, "must reject replay");
});
Deno.test("unauthorized reviewer rejected", async () => {
  const x = await fixture({ permission: false });
  let rejected = false;
  try { await x.runtime.decide(x.request, x.decision); } catch { rejected = true; }
  assert(rejected && x.executions() === 0, "must deny");
});
Deno.test("cross-owner reviewer rejected", async () => {
  const x = await fixture({ owner: "other-owner" });
  let rejected = false;
  try { await x.runtime.decide(x.request, x.decision); } catch { rejected = true; }
  assert(rejected && x.executions() === 0, "must deny cross-owner");
});
Deno.test("tampered input digest rejected", async () => {
  const x = await fixture();
  let rejected = false;
  try { await x.runtime.decide({ ...x.request, inputDigest: "wrong" }, { ...x.decision, inputDigest: "wrong" }); } catch { rejected = true; }
  assert(rejected && x.executions() === 0, "must deny tampering");
});
Deno.test("expired approval rejected", async () => {
  const x = await fixture();
  let rejected = false;
  try { await x.runtime.decide({ ...x.request, expiresAt: new Date(Date.now() - 60000).toISOString() }, x.decision); } catch { rejected = true; }
  assert(rejected && x.executions() === 0, "must deny expiry");
});
Deno.test("explicit denial never executes", async () => {
  const x = await fixture();
  const state = await x.runtime.decide(x.request, { ...x.decision, approved: false });
  assert(state.state === "OBSERVING" && x.executions() === 0, "denial must not execute");
});

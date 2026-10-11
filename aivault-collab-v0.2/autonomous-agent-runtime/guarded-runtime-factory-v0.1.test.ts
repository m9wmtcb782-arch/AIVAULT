/** Offline Deno tests for trusted tool enforcement. No external calls. */
import { createGuardedRuntime } from "./guarded-runtime-factory-v0.1.ts";
import { TrustedToolCatalog } from "./trusted-tool-catalog-v0.1.ts";
import type { ToolKind } from "./agent-runtime-v0.1.ts";
function assert(ok: unknown, message: string) { if (!ok) throw new Error(message); }
function scenario(plannerKind: ToolKind, catalogKind: ToolKind, permitted = true) {
  let calls = 0;
  const catalog = new TrustedToolCatalog([{ name: "mock_publish", kind: catalogKind, enabled: true, permittedAgentIds: permitted ? ["agent-1"] : [] }]);
  const runtime = createGuardedRuntime(
    { agentId: "agent-1", allowedTools: ["mock_publish"], maxSteps: 2 },
    { next: async () => ({ type: "tool" as const, request: { id: "action-1", name: "mock_publish", kind: plannerKind, input: { draft: "test" } } }) },
    { execute: async () => { calls++; return { ok: true }; } },
    { ownerId: "owner-1", resolvePrincipal: async () => ({ principalId: "owner-1", ownerId: "owner-1", permissions: [] }),
      decisions: { consumeOnce: async () => false } },
    catalog
  );
  runtime.authorize();
  return { runtime, calls: () => calls };
}
Deno.test("model cannot downgrade external write to read", async () => {
  const x = scenario("read", "external_write");
  const result = await x.runtime.step();
  assert(result.state === "FAILED" && x.calls() === 0, "write downgrade must be rejected");
});
Deno.test("external write requires approval before execution", async () => {
  const x = scenario("external_write", "external_write");
  const result = await x.runtime.step();
  assert(result.state === "APPROVAL_REQUIRED" && x.calls() === 0, "write must await approval");
});
Deno.test("unpermitted agent cannot call tool", async () => {
  const x = scenario("read", "read", false);
  const result = await x.runtime.step();
  assert(result.state === "FAILED" && x.calls() === 0, "unauthorized agent must fail");
});
Deno.test("approved read-only tool can execute", async () => {
  const x = scenario("read", "read");
  const result = await x.runtime.step();
  assert(result.state === "OBSERVING" && x.calls() === 1, "read should execute");
});
Deno.test("disabled tool never resolves", () => {
  const catalog = new TrustedToolCatalog([{ name: "mock_publish", kind: "read", enabled: false, permittedAgentIds: ["agent-1"] }]);
  let denied = false;
  try { catalog.resolve("agent-1", { id: "x", name: "mock_publish", kind: "read", input: {} }); }
  catch { denied = true; }
  assert(denied, "disabled tool must be denied");
});

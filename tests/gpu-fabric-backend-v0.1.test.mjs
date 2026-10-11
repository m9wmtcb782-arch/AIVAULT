import test from "node:test";
import assert from "node:assert/strict";
import {
  validateBackendAdapter,
  readBackendCapabilities,
  executeBackendOperation,
} from "../aivault-collab-v0.2/gpu-fabric-backend-v0.1.mjs";

function testAdapter(overrides = {}) {
  return {
    backend_id: "test-backend",
    runtime: "test-only",
    async getCapabilities() {
      return { device_kind: "cpu", operators: ["mul_scalar", "add_scalar"], memory_bytes: 4096 };
    },
    async execute({ operation, inputs }) {
      const scalar = operation.scalar;
      const output = inputs[0].map((value) =>
        operation.operator === "mul_scalar" ? value * scalar : value + scalar
      );
      return { execution_id: "test-exec-1", output };
    },
    async release() { return { released: true }; },
    ...overrides,
  };
}

test("validates required adapter methods without assuming hardware type", () => {
  assert.equal(validateBackendAdapter(testAdapter()).valid, true);
  assert.equal(validateBackendAdapter({ backend_id: "x", runtime: "x" }).valid, false);
});

test("reads and normalizes declared adapter capabilities", async () => {
  const caps = await readBackendCapabilities(testAdapter());
  assert.deepEqual(caps, {
    backend_id: "test-backend",
    runtime: "test-only",
    device_kind: "cpu",
    operators: ["add_scalar", "mul_scalar"],
    memory_bytes: 4096,
  });
});

test("dispatches one operation and labels the result as local-adapter execution", async () => {
  const adapter = testAdapter();
  const operation = { operator: "mul_scalar", scalar: 3 };
  const result = await executeBackendOperation(adapter, operation, [[2, -1, 4]], {
    job_id: "job-1", operation_id: "op-1", deadline_ms: 1000,
  });
  assert.equal(result.status, "EXECUTED_LOCAL_ADAPTER");
  assert.equal(result.device_kind, "cpu");
  assert.deepEqual(result.output, [6, -3, 12]);
  assert.match(result.note, /not independently attested/);
  assert.deepEqual(operation, { operator: "mul_scalar", scalar: 3 });
});

test("rejects unsupported operators and malformed backend outputs", async () => {
  await assert.rejects(
    executeBackendOperation(testAdapter(), { operator: "run_code" }, [[1]]),
    /does not support operator/,
  );
  await assert.rejects(
    executeBackendOperation(testAdapter({
      async execute() { return { output: [Infinity] }; },
    }), { operator: "add_scalar", scalar: 1 }, [[1]]),
    /invalid output/,
  );
});

test("rejects invalid capability declarations before dispatch", async () => {
  await assert.rejects(
    readBackendCapabilities(testAdapter({
      async getCapabilities() {
        return { device_kind: "magic", operators: ["add_scalar"], memory_bytes: 1024 };
      },
    })),
    /device_kind is invalid/,
  );
});

test("rejects multi-input operations until their semantics are implemented", async () => {
  await assert.rejects(
    executeBackendOperation(testAdapter(), { operator: "add_scalar", scalar: 1 }, [[1], [2]]),
    /exactly one input array/,
  );
});

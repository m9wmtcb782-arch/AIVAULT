import test from "node:test";
import assert from "node:assert/strict";
import { planGraph } from "../aivault-collab-v0.2/gpu-fabric-planner-v0.1.mjs";
import { executeLocalPlannedGraph } from "../aivault-collab-v0.2/gpu-fabric-local-runtime-v0.1.mjs";

function adapter(id, operator) {
  return {
    backend_id: id,
    runtime: "test-adapter",
    async getCapabilities() {
      return { device_kind: "cpu", operators: [operator], memory_bytes: 4096 };
    },
    async execute({ operation, inputs }) {
      const output = inputs[0].map((value) =>
        operation.operator === "mul_scalar" ? value * operation.scalar : value + operation.scalar
      );
      return { execution_id: id + "-exec", output };
    },
    async release() { return { released: true }; },
  };
}

const graph = [
  { operation_id: "op-a", operator: "mul_scalar", scalar: 3, dependency_ids: [], input_tensor_ids: ["x"], output_tensor_ids: ["h"], estimated_memory_bytes: 64 },
  { operation_id: "op-b", operator: "add_scalar", scalar: 2, dependency_ids: ["op-a"], input_tensor_ids: ["h"], output_tensor_ids: ["y"], estimated_memory_bytes: 64 },
];
const nodes = [
  { node_id: "node-a", backends: ["test-a"], supported_operators: ["mul_scalar"], available_memory_bytes: 1024 },
  { node_id: "node-b", backends: ["test-b"], supported_operators: ["add_scalar"], available_memory_bytes: 1024 },
];

test("runs a two-node planned graph through separate local adapters and checks result", async () => {
  const plan = planGraph({ operations: graph, nodes, tensorBytes: { h: 24 } });
  assert.deepEqual(plan.operations.map((op) => op.node_id), ["node-a", "node-b"]);
  const result = await executeLocalPlannedGraph({
    plan,
    operations: graph,
    inputTensors: { x: [1, 2, -1] },
    adaptersByNodeId: { "node-a": adapter("adapter-a", "mul_scalar"), "node-b": adapter("adapter-b", "add_scalar") },
    jobId: "two-adapter-check",
  });
  assert.equal(result.status, "LOCAL_ADAPTER_RUN");
  assert.deepEqual(result.output, [5, 8, -1]);
  assert.deepEqual(result.participating_node_ids, ["node-a", "node-b"]);
  assert.equal(result.transfers.length, 1);
  assert.equal(result.transfers[0].status, "IN_MEMORY_LOCAL_COPY");
  assert.match(result.note, /does not prove GPU execution/);
});

test("rejects missing adapter and invalid plans", async () => {
  const plan = planGraph({ operations: graph, nodes, tensorBytes: { h: 24 } });
  await assert.rejects(
    executeLocalPlannedGraph({ plan, operations: graph, inputTensors: { x: [1] }, adaptersByNodeId: { "node-a": adapter("a", "mul_scalar") } }),
    /missing local adapter/,
  );
  await assert.rejects(
    executeLocalPlannedGraph({ plan: { status: "COMPLETED" }, operations: graph, inputTensors: { x: [1] }, adaptersByNodeId: {} }),
    /valid PLANNED graph plan/,
  );
});

test("rejects a graph changed after planning", async () => {
  const plan = planGraph({ operations: graph, nodes, tensorBytes: { h: 24 } });
  const changed = graph.map((op) => ({ ...op }));
  changed[1].operator = "mul_scalar";
  await assert.rejects(
    executeLocalPlannedGraph({ plan, operations: changed, inputTensors: { x: [1] }, adaptersByNodeId: { "node-a": adapter("a", "mul_scalar"), "node-b": adapter("b", "add_scalar") } }),
    /does not match graph definition/,
  );
});

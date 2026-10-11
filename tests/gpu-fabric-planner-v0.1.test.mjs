import test from "node:test";
import assert from "node:assert/strict";
import { planGraph } from "../aivault-collab-v0.2/gpu-fabric-planner-v0.1.mjs";

const nodes = [
  { node_id: "node-a", backends: ["cpu-sim", "metal"], supported_operators: ["mul", "add"], available_memory_bytes: 1024 },
  { node_id: "node-b", backends: ["cpu-sim", "vulkan"], supported_operators: ["mul", "add"], available_memory_bytes: 2048 },
];

const operations = [
  { operation_id: "op-b", operator: "add", dependency_ids: ["op-a"], input_tensor_ids: ["h"], output_tensor_ids: ["y"], estimated_memory_bytes: 128 },
  { operation_id: "op-a", operator: "mul", dependency_ids: [], input_tensor_ids: ["x"], output_tensor_ids: ["h"], estimated_memory_bytes: 256 },
];

test("topologically orders an unordered graph and labels plan as PLANNED", () => {
  const plan = planGraph({ operations, nodes, tensorBytes: { h: 400 } });
  assert.deepEqual(plan.topological_order, ["op-a", "op-b"]);
  assert.equal(plan.status, "PLANNED");
  assert.ok(plan.operations.every((op) => op.status === "PLANNED"));
  assert.match(plan.note, /No node accepted work/);
});

test("prefers colocating dependent operations to avoid tensor transfer", () => {
  const plan = planGraph({ operations, nodes, tensorBytes: { h: 400 } });
  assert.equal(plan.operations[0].node_id, plan.operations[1].node_id);
  assert.equal(plan.estimated_transfer_bytes, 0);
  assert.equal(plan.estimated_transfers.length, 0);
});

test("rejects cycles and missing dependency edges", () => {
  assert.throws(() => planGraph({
    operations: [
      { operation_id: "op-a", operator: "mul", dependency_ids: ["op-b"], input_tensor_ids: ["y"], output_tensor_ids: ["h"] },
      { operation_id: "op-b", operator: "add", dependency_ids: ["op-a"], input_tensor_ids: ["h"], output_tensor_ids: ["y"] },
    ], nodes, tensorBytes: {},
  }), /dependency cycle/);
  assert.throws(() => planGraph({
    operations: [
      { operation_id: "op-a", operator: "mul", dependency_ids: [], input_tensor_ids: ["x"], output_tensor_ids: ["h"] },
      { operation_id: "op-b", operator: "add", dependency_ids: [], input_tensor_ids: ["h"], output_tensor_ids: ["y"] },
    ], nodes, tensorBytes: { h: 64 },
  }), /missing dependency edge/);
});

test("rejects nodes without the required operator or memory", () => {
  assert.throws(() => planGraph({
    operations: [{ operation_id: "op-a", operator: "attention", dependency_ids: [], input_tensor_ids: ["x"], output_tensor_ids: ["y"], estimated_memory_bytes: 999999 }],
    nodes, tensorBytes: {},
  }), /no capable node/);
});

test("records planned cross-node transfer costs when placement forces a split", () => {
  const restrictedNodes = [
    { node_id: "node-a", backends: ["metal"], supported_operators: ["mul"], available_memory_bytes: 1024 },
    { node_id: "node-b", backends: ["vulkan"], supported_operators: ["add"], available_memory_bytes: 1024 },
  ];
  const plan = planGraph({ operations, nodes: restrictedNodes, tensorBytes: { h: 400 } });
  assert.deepEqual(plan.operations.map((op) => op.node_id), ["node-a", "node-b"]);
  assert.equal(plan.estimated_transfer_bytes, 400);
  assert.deepEqual(plan.estimated_transfers, [{
    tensor_id: "h", from_node_id: "node-a", to_node_id: "node-b", estimated_bytes: 400, status: "PLANNED",
  }]);
});

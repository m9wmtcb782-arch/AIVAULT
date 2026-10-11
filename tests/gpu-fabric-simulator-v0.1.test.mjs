import test from "node:test";
import assert from "node:assert/strict";
import { runSimulatedGraph } from "../aivault-collab-v0.2/gpu-fabric-simulator-v0.1.mjs";

const graph = [
  {
    operation_id: "op-a", operator: "mul_scalar", dependency_ids: [],
    input_tensor_ids: ["x"], output_tensor_id: "h", scalar: 2,
  },
  {
    operation_id: "op-b", operator: "add_scalar", dependency_ids: ["op-a"],
    input_tensor_ids: ["h"], output_tensor_id: "y", scalar: 1,
  },
];

test("runs one dependency-linked graph across two simulated nodes", () => {
  const result = runSimulatedGraph({
    jobId: "sim-job-1",
    inputValue: [2, 3, -4],
    operations: graph,
    nodeAssignments: { "op-a": "sim-node-a", "op-b": "sim-node-b" },
  });
  assert.equal(result.status, "SIMULATED");
  assert.deepEqual(result.output_value, [5, 7, -7]);
  assert.deepEqual(result.participating_node_ids, ["sim-node-a", "sim-node-b"]);
  assert.equal(result.trace.length, 2);
  assert.equal(result.transfer_trace.length, 1);
  assert.equal(result.transfer_trace[0].tensor_id, "h");
  assert.equal(result.transfer_trace[0].from_node_id, "sim-node-a");
  assert.equal(result.transfer_trace[0].to_node_id, "sim-node-b");
  assert.ok(result.output_value_sha256.length === 64);
});

test("rejects a dependency that has not executed", () => {
  assert.throws(() => runSimulatedGraph({
    jobId: "sim-job-2", inputValue: [1],
    operations: [{ ...graph[1], dependency_ids: ["op-a"] }],
    nodeAssignments: { "op-b": "sim-node-b" },
  }), /dependency not completed/);
});

test("rejects non-allowlisted operators instead of executing remote code", () => {
  assert.throws(() => runSimulatedGraph({
    jobId: "sim-job-3", inputValue: [1],
    operations: [{ ...graph[0], operator: "run_arbitrary_code" }],
    nodeAssignments: { "op-a": "sim-node-a" },
  }), /not allowlisted/);
});

test("rejects a missing node assignment", () => {
  assert.throws(() => runSimulatedGraph({
    jobId: "sim-job-4", inputValue: [1], operations: [graph[0]], nodeAssignments: {},
  }), /missing node assignment/);
});

test("marks all simulator traces as simulated, never as GPU execution", () => {
  const result = runSimulatedGraph({
    jobId: "sim-job-5", inputValue: [3],
    operations: [
      { operation_id: "op-a", operator: "mul_scalar", dependency_ids: [], input_tensor_ids: ["x"], output_tensor_id: "h", scalar: 2 },
      { operation_id: "op-b", operator: "add_scalar", dependency_ids: ["op-a"], input_tensor_ids: ["h"], output_tensor_id: "y", scalar: 1 },
    ],
    nodeAssignments: { "op-a": "sim-node-a", "op-b": "sim-node-b" },
  });
  assert.ok(result.trace.every((entry) => entry.status === "SIMULATED"));
  assert.equal(result.status, "SIMULATED");
  assert.match(result.note, /not evidence of real GPU execution/);
});

test("matches an independently computed single-device reference", () => {
  const input = [-3, 0, 2.5, 11];
  const reference = input.map((x) => (x * 2) + 1);
  const result = runSimulatedGraph({
    jobId: "sim-reference-check",
    inputValue: input,
    operations: graph,
    nodeAssignments: { "op-a": "sim-node-a", "op-b": "sim-node-b" },
  });
  assert.deepEqual(result.output_value, reference);
  assert.equal(result.status, "SIMULATED");
});

test("rejects multi-input operations until explicit operator semantics exist", () => {
  assert.throws(() => runSimulatedGraph({
    jobId: "sim-multi-input",
    inputValue: [1, 2],
    operations: [{
      operation_id: "op-add", operator: "add_scalar", dependency_ids: [],
      input_tensor_ids: ["x", "x"], output_tensor_id: "y", scalar: 1,
    }],
    nodeAssignments: { "op-add": "sim-node-a" },
  }), /exactly one input tensor/);
});

test("rejects outputs that would overflow to non-finite values", () => {
  assert.throws(() => runSimulatedGraph({
    jobId: "sim-overflow",
    inputValue: [Number.MAX_VALUE],
    operations: [{
      operation_id: "op-overflow", operator: "mul_scalar", dependency_ids: [],
      input_tensor_ids: ["x"], output_tensor_id: "y", scalar: 2,
    }],
    nodeAssignments: { "op-overflow": "sim-node-a" },
  }), /non-finite value/);
});

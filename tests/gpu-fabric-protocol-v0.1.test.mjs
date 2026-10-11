import test from "node:test";
import assert from "node:assert/strict";
import {
  PROTOCOL_VERSION,
  validateEnvelope,
  validateTensorDescriptor,
  transitionJob,
  evaluateCompletion,
} from "../aivault-collab-v0.2/gpu-fabric-protocol-v0.1.mjs";

const now = Date.parse("2026-10-11T06:00:00Z");
const envelope = () => ({
  protocol_version: PROTOCOL_VERSION,
  message_type: "operation.result",
  job_id: "job-1",
  session_id: "session-1",
  model_manifest_sha256: "a".repeat(64),
  message_id: "message-1",
  issued_at: "2026-10-11T05:59:00Z",
  expires_at: "2026-10-11T06:01:00Z",
  sender_node_id: "node-a",
});

test("accepts a current well-formed envelope", () => {
  assert.deepEqual(validateEnvelope(envelope(), now), { valid: true, errors: [] });
});

test("rejects unsupported protocol versions and expired messages", () => {
  const unsupported = envelope();
  unsupported.protocol_version = "aivault.gpu-fabric/99";
  assert.equal(validateEnvelope(unsupported, now).valid, false);
  const expired = envelope();
  expired.expires_at = "2026-10-11T05:00:00Z";
  assert.ok(validateEnvelope(expired, now).errors.includes("message expired"));
});

test("checks tensor byte length from dtype and shape", () => {
  const tensor = {
    tensor_id: "tensor-h", dtype: "float32", shape: [2, 3], layout: "row-major",
    byte_length: 24, producer_operation_id: "op-a", consumers: ["op-b"],
    lifetime: { release_condition: "all consumers finished" },
  };
  assert.equal(validateTensorDescriptor(tensor).valid, true);
  assert.ok(validateTensorDescriptor({ ...tensor, byte_length: 23 }).errors.includes(
    "byte_length does not match dtype and shape",
  ));
  assert.equal(validateTensorDescriptor({ ...tensor, shape: [Number.MAX_SAFE_INTEGER, 9] }).valid, false);
});

test("blocks illegal transitions and completion without evidence", () => {
  assert.throws(() => transitionJob("CREATED", "COMPLETED", { completionEligible: true }), /illegal job transition/);
  assert.throws(() => transitionJob("VERIFYING", "COMPLETED"), /validated completion evidence/);
  assert.equal(transitionJob("VERIFYING", "COMPLETED", { completionEligible: true }), "COMPLETED");
});

test("requires every graph operation, two nodes, and independent verification", () => {
  const operationResults = [
    { operation_id: "op-a", node_id: "node-a", status: "succeeded" },
    { operation_id: "op-b", node_id: "node-b", status: "succeeded" },
  ];
  const verification = { independent: true, passed: true, method: "compare-to-single-device-reference" };
  const pass = evaluateCompletion({
    requiredOperationIds: ["op-a", "op-b"], operationResults, verification, requiredNodeCount: 2,
  });
  assert.equal(pass.eligible, true);
  assert.deepEqual(pass.participatingNodeIds, ["node-a", "node-b"]);
  assert.equal(evaluateCompletion({
    requiredOperationIds: ["op-a", "op-b"],
    operationResults: [{ ...operationResults[0], node_id: "node-a" }, { ...operationResults[1], node_id: "node-a" }],
    verification, requiredNodeCount: 2,
  }).eligible, false);
  assert.equal(evaluateCompletion({
    requiredOperationIds: ["op-a", "op-b"], operationResults, verification: { independent: false, passed: true, method: "worker-claim" }, requiredNodeCount: 2,
  }).eligible, false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createTensorTransfer, receiveTensorTransfer } from "../aivault-collab-v0.2/gpu-fabric-tensor-transfer-v0.1.mjs";

const bytes = () => new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);

test("creates and receives a typed tensor payload with verified checksum", () => {
  const envelope = createTensorTransfer({
    tensor_id: "tensor-h", sender_node_id: "node-a", receiver_node_id: "node-b",
    dtype: "float32", shape: [2], payload: bytes(),
  });
  const received = receiveTensorTransfer(envelope, { receiver_node_id: "node-b" });
  assert.equal(received.status, "PAYLOAD_INTEGRITY_VERIFIED");
  assert.deepEqual([...received.payload], [...bytes()]);
  assert.equal(received.byte_length, 8);
  assert.equal(received.payload_sha256, envelope.payload_sha256);
});

test("rejects a wrong destination", () => {
  const envelope = createTensorTransfer({
    tensor_id: "tensor-h", sender_node_id: "node-a", receiver_node_id: "node-b",
    dtype: "float32", shape: [2], payload: bytes(),
  });
  assert.throws(() => receiveTensorTransfer(envelope, { receiver_node_id: "node-c" }), /different receiver/);
});

test("rejects corrupted payload bytes", () => {
  const envelope = createTensorTransfer({
    tensor_id: "tensor-h", sender_node_id: "node-a", receiver_node_id: "node-b",
    dtype: "float32", shape: [2], payload: bytes(),
  });
  envelope.payload[0] ^= 255;
  assert.throws(() => receiveTensorTransfer(envelope, { receiver_node_id: "node-b" }), /SHA-256 mismatch/);
});

test("rejects dtype/shape length mismatch", () => {
  assert.throws(() => createTensorTransfer({
    tensor_id: "tensor-h", sender_node_id: "node-a", receiver_node_id: "node-b",
    dtype: "float32", shape: [3], payload: bytes(),
  }), /does not match dtype and shape/);
});

test("rejects unsupported dtype and malformed shape", () => {
  assert.throws(() => createTensorTransfer({
    tensor_id: "tensor-h", sender_node_id: "node-a", receiver_node_id: "node-b",
    dtype: "complex64", shape: [1], payload: bytes(),
  }), /unsupported tensor dtype/);
  assert.throws(() => createTensorTransfer({
    tensor_id: "tensor-h", sender_node_id: "node-a", receiver_node_id: "node-b",
    dtype: "float32", shape: [2, 0], payload: bytes(),
  }), /positive safe integer/);
});

test("enforces payload size limit and distinct node IDs", () => {
  assert.throws(() => createTensorTransfer({
    tensor_id: "tensor-h", sender_node_id: "node-a", receiver_node_id: "node-b",
    dtype: "float32", shape: [2], payload: bytes(), max_bytes: 4,
  }), /exceeds max_bytes/);
  assert.throws(() => createTensorTransfer({
    tensor_id: "tensor-h", sender_node_id: "node-a", receiver_node_id: "node-a",
    dtype: "float32", shape: [2], payload: bytes(),
  }), /different nodes/);
});

test("receiver revalidates descriptor even when envelope was altered", () => {
  const envelope = createTensorTransfer({
    tensor_id: "tensor-h", sender_node_id: "node-a", receiver_node_id: "node-b",
    dtype: "float32", shape: [2], payload: bytes(),
  });
  envelope.shape = [1];
  assert.throws(() => receiveTensorTransfer(envelope, { receiver_node_id: "node-b" }), /descriptor byte length/);
});

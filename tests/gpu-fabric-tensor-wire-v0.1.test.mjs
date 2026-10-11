import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { receiveSwiftFloat32TensorWire } from "../aivault-collab-v0.2/gpu-fabric-tensor-wire-v0.1.mjs";

function float32LE(values) {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, i) => bytes.writeFloatLE(value, i * 4));
  return bytes;
}

function wireEnvelope(values = [3, 6, -3]) {
  const payload = float32LE(values);
  return {
    protocol_version: "aivault.gpu-fabric-tensor/0.1",
    tensor_id: "tensor-output-1",
    sender_node_id: "iphone-a",
    receiver_node_id: "iphone-b",
    dtype: "float32",
    shape: [values.length],
    layout: "contiguous",
    byte_length: payload.byteLength,
    payload_sha256: createHash("sha256").update(payload).digest("hex"),
    payload_base64: payload.toString("base64"),
  };
}

test("accepts a valid Swift-style Float32 JSON envelope and verifies bytes", () => {
  const result = receiveSwiftFloat32TensorWire(wireEnvelope(), {
    receiver_node_id: "iphone-b",
  });
  assert.equal(result.status, "PAYLOAD_INTEGRITY_VERIFIED");
  assert.equal(result.payload.byteLength, 12);
  assert.deepEqual(
    [0, 4, 8].map(offset => {
      const view = new DataView(result.payload.buffer, result.payload.byteOffset, result.payload.byteLength);
      return view.getFloat32(offset, true);
    }),
    [3, 6, -3],
  );
});

test("rejects the wrong receiver", () => {
  assert.throws(() => receiveSwiftFloat32TensorWire(wireEnvelope(), {
    receiver_node_id: "iphone-c",
  }), /different receiver/);
});

test("rejects a payload changed without updating SHA-256", () => {
  const envelope = wireEnvelope();
  const changed = Buffer.from(envelope.payload_base64, "base64");
  changed[0] ^= 1;
  envelope.payload_base64 = changed.toString("base64");
  assert.throws(() => receiveSwiftFloat32TensorWire(envelope, {
    receiver_node_id: "iphone-b",
  }), /SHA-256 mismatch/);
});

test("rejects non-canonical base64 and unsupported multidimensional shape", () => {
  const badBase64 = wireEnvelope();
  badBase64.payload_base64 += "!";
  assert.throws(() => receiveSwiftFloat32TensorWire(badBase64, {
    receiver_node_id: "iphone-b",
  }), /canonical base64/);

  const badShape = wireEnvelope();
  badShape.shape = [1, 3];
  assert.throws(() => receiveSwiftFloat32TensorWire(badShape, {
    receiver_node_id: "iphone-b",
  }), /one-dimensional/);
});

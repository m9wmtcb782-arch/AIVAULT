/**
 * AIVAULT GPU Fabric tensor transfer envelope v0.1.
 *
 * Defines byte-level tensor descriptors and verifies payload integrity at
 * receipt. This is a local serialization/verification primitive only: it
 * does not open sockets, encrypt traffic, authenticate peers, or move data
 * between physical devices.
 */
import { createHash } from "node:crypto";

const DTYPE_BYTES = Object.freeze({
  bool: 1, int8: 1, uint8: 1, int16: 2, uint16: 2,
  int32: 4, uint32: 4, float16: 2, bfloat16: 2,
  float32: 4, int64: 8, uint64: 8, float64: 8,
});
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asBytes(payload) {
  if (payload instanceof Uint8Array) return new Uint8Array(payload);
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload.slice(0));
  throw new Error("payload must be a Uint8Array or ArrayBuffer");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function expectedByteLength(dtype, shape) {
  const itemBytes = DTYPE_BYTES[dtype];
  if (!itemBytes) throw new Error("unsupported tensor dtype");
  if (!Array.isArray(shape) || shape.length < 1 || shape.length > 16 ||
      shape.some((dim) => !Number.isSafeInteger(dim) || dim <= 0)) {
    throw new Error("shape must contain 1 to 16 positive safe integer dimensions");
  }
  let elements = 1;
  for (const dim of shape) {
    elements *= dim;
    if (!Number.isSafeInteger(elements)) throw new Error("tensor element count exceeds safe integer range");
  }
  const bytes = elements * itemBytes;
  if (!Number.isSafeInteger(bytes)) throw new Error("tensor byte length exceeds safe integer range");
  return bytes;
}

export function createTensorTransfer({ tensor_id, sender_node_id, receiver_node_id, dtype, shape, layout = "contiguous", payload, max_bytes = DEFAULT_MAX_BYTES }) {
  for (const [field, value] of [["tensor_id", tensor_id], ["sender_node_id", sender_node_id], ["receiver_node_id", receiver_node_id]]) {
    if (typeof value !== "string" || !ID_RE.test(value)) throw new Error("invalid " + field);
  }
  if (sender_node_id === receiver_node_id) throw new Error("sender and receiver must be different nodes");
  if (typeof layout !== "string" || !/^[A-Za-z0-9._:-]{1,64}$/.test(layout)) throw new Error("invalid tensor layout");
  if (!Number.isSafeInteger(max_bytes) || max_bytes < 1) throw new Error("max_bytes must be a positive safe integer");
  const bytes = asBytes(payload);
  if (bytes.byteLength > max_bytes) throw new Error("tensor payload exceeds max_bytes");
  const expected = expectedByteLength(dtype, shape);
  if (bytes.byteLength !== expected) throw new Error("payload byte length does not match dtype and shape");
  return {
    protocol_version: "aivault.gpu-fabric-tensor/0.1",
    tensor_id,
    sender_node_id,
    receiver_node_id,
    dtype,
    shape: [...shape],
    layout,
    byte_length: bytes.byteLength,
    payload_sha256: sha256(bytes),
    payload: bytes,
  };
}

export function receiveTensorTransfer(envelope, { receiver_node_id, max_bytes = DEFAULT_MAX_BYTES } = {}) {
  if (!isRecord(envelope) || envelope.protocol_version !== "aivault.gpu-fabric-tensor/0.1") {
    throw new Error("invalid tensor transfer envelope");
  }
  if (typeof receiver_node_id !== "string" || !ID_RE.test(receiver_node_id)) throw new Error("invalid expected receiver_node_id");
  if (envelope.receiver_node_id !== receiver_node_id) throw new Error("tensor transfer addressed to a different receiver");
  if (typeof envelope.sender_node_id !== "string" || !ID_RE.test(envelope.sender_node_id) ||
      envelope.sender_node_id === receiver_node_id) throw new Error("invalid sender_node_id");
  if (typeof envelope.tensor_id !== "string" || !ID_RE.test(envelope.tensor_id)) throw new Error("invalid tensor_id");
  if (!Number.isSafeInteger(max_bytes) || max_bytes < 1) throw new Error("max_bytes must be a positive safe integer");
  if (!Number.isSafeInteger(envelope.byte_length) || envelope.byte_length < 1 || envelope.byte_length > max_bytes) {
    throw new Error("invalid or oversized tensor byte_length");
  }
  const expected = expectedByteLength(envelope.dtype, envelope.shape);
  if (expected !== envelope.byte_length) throw new Error("descriptor byte length does not match dtype and shape");
  if (typeof envelope.layout !== "string" || !/^[A-Za-z0-9._:-]{1,64}$/.test(envelope.layout)) throw new Error("invalid tensor layout");
  if (typeof envelope.payload_sha256 !== "string" || !SHA256_RE.test(envelope.payload_sha256)) throw new Error("invalid payload_sha256");
  const payload = asBytes(envelope.payload);
  if (payload.byteLength !== envelope.byte_length) throw new Error("received payload length mismatch");
  const actualHash = sha256(payload);
  if (actualHash !== envelope.payload_sha256) throw new Error("tensor payload SHA-256 mismatch");
  return {
    status: "PAYLOAD_INTEGRITY_VERIFIED",
    tensor_id: envelope.tensor_id,
    sender_node_id: envelope.sender_node_id,
    receiver_node_id,
    dtype: envelope.dtype,
    shape: [...envelope.shape],
    layout: envelope.layout,
    byte_length: payload.byteLength,
    payload_sha256: actualHash,
    payload,
    note: "Integrity and intended receiver were checked locally. Peer authentication, encryption, and physical network transfer are not implemented here.",
  };
}

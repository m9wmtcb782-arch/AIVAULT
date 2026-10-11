/**
 * JSON wire adapter for the Swift AIVAULTFloat32TensorV01 envelope.
 *
 * Converts payload_base64 into the Uint8Array expected by the local tensor
 * transfer verifier. This is not a transport, authentication, or encryption
 * implementation.
 */
import { receiveTensorTransfer } from "./gpu-fabric-tensor-transfer-v0.1.mjs";

const PROTOCOL = "aivault.gpu-fabric-tensor/0.1";
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

export function receiveSwiftFloat32TensorWire(envelope, {
  receiver_node_id,
  max_bytes = DEFAULT_MAX_BYTES,
} = {}) {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    throw new Error("invalid Swift tensor wire envelope");
  }
  if (envelope.protocol_version !== PROTOCOL || envelope.dtype !== "float32") {
    throw new Error("unsupported Swift tensor wire protocol or dtype");
  }
  if (!Array.isArray(envelope.shape) || envelope.shape.length !== 1 ||
      !Number.isSafeInteger(envelope.shape[0]) || envelope.shape[0] < 1) {
    throw new Error("Swift wire adapter v0.1 only accepts one-dimensional Float32 tensors");
  }
  if (typeof envelope.payload_base64 !== "string" || envelope.payload_base64.length === 0) {
    throw new Error("payload_base64 is required");
  }
  if (!Number.isSafeInteger(max_bytes) || max_bytes < 1) {
    throw new Error("max_bytes must be a positive safe integer");
  }

  // Strict canonical base64: Buffer.from alone silently accepts malformed input.
  const payload = Buffer.from(envelope.payload_base64, "base64");
  if (payload.toString("base64") !== envelope.payload_base64) {
    throw new Error("payload_base64 is not canonical base64");
  }
  if (payload.byteLength > max_bytes) throw new Error("tensor payload exceeds max_bytes");

  return receiveTensorTransfer({
    protocol_version: envelope.protocol_version,
    tensor_id: envelope.tensor_id,
    sender_node_id: envelope.sender_node_id,
    receiver_node_id: envelope.receiver_node_id,
    dtype: envelope.dtype,
    shape: envelope.shape,
    layout: envelope.layout,
    byte_length: envelope.byte_length,
    payload_sha256: envelope.payload_sha256,
    payload: new Uint8Array(payload),
  }, { receiver_node_id, max_bytes });
}

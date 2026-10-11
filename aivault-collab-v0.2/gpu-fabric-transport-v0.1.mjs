import { createTensorTransfer, receiveTensorTransfer } from "./gpu-fabric-tensor-transfer-v0.1.mjs";
import { randomUUID } from "node:crypto";

const PROTOCOL = "aivault.gpu-fabric-transport/0.1";
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

/**
 * Adapter contract only. This module does not implement networking, TLS, key
 * exchange, or peer authentication; the injected transport must enforce those.
 */
function checkChannel(channel, localId, peerId, now) {
  if (!channel || typeof channel !== "object") throw new Error("channel adapter is required");
  if (typeof localId !== "string" || !ID.test(localId) ||
      typeof peerId !== "string" || !ID.test(peerId) || localId === peerId) throw new Error("invalid node IDs");
  if (channel.authenticated !== true) throw new Error("channel peer is not authenticated");
  if (channel.encrypted !== true) throw new Error("channel is not encrypted");
  if (channel.authenticatedPeerNodeId !== peerId) throw new Error("authenticated channel peer does not match expected peer");
  const expiry = typeof channel.sessionExpiresAt === "number" ? channel.sessionExpiresAt : Date.parse(channel.sessionExpiresAt);
  if (!Number.isFinite(expiry) || expiry <= now) throw new Error("channel session is expired or invalid");
}

function toWire(e) {
  return {
    protocol_version: PROTOCOL,
    tensor: {
      protocol_version: e.protocol_version, tensor_id: e.tensor_id,
      sender_node_id: e.sender_node_id, receiver_node_id: e.receiver_node_id,
      dtype: e.dtype, shape: e.shape, layout: e.layout, byte_length: e.byte_length,
      payload_sha256: e.payload_sha256,
      payload_base64: Buffer.from(e.payload).toString("base64"),
    },
  };
}

function fromWire(wire, maxBytes) {
  if (!wire || typeof wire !== "object" || wire.protocol_version !== PROTOCOL ||
      !wire.tensor || typeof wire.tensor !== "object") throw new Error("invalid transport wire envelope");
  const t = wire.tensor;
  if (typeof t.payload_base64 !== "string" || !t.payload_base64) throw new Error("missing tensor payload");
  if (t.payload_base64.length > Math.ceil(maxBytes / 3) * 4 + 4) throw new Error("encoded tensor exceeds max_bytes");
  const bytes = Buffer.from(t.payload_base64, "base64");
  if (bytes.toString("base64") !== t.payload_base64) throw new Error("payload_base64 is not canonical base64");
  if (bytes.length > maxBytes) throw new Error("tensor payload exceeds max_bytes");
  return { ...t, payload: new Uint8Array(bytes) };
}

export async function sendTensorOverAuthenticatedChannel({
  channel, sender_node_id, receiver_node_id, tensor_id, dtype, shape,
  layout = "contiguous", payload, max_bytes = 64 * 1024 * 1024, now = Date.now(),
  context,
}) {
  checkChannel(channel, sender_node_id, receiver_node_id, now);
  if (typeof channel.send !== "function") throw new Error("channel.send must be a function");
  const envelope = createTensorTransfer({
    tensor_id, sender_node_id, receiver_node_id, dtype, shape, layout, payload, max_bytes,
  });
  const wire = stampTransportEnvelope(toWire(envelope), {
    message_id: randomUUID(), expires_at: Math.min(Date.now() + 30000,
      typeof channel.sessionExpiresAt === "number" ? channel.sessionExpiresAt : Date.parse(channel.sessionExpiresAt)),
  });
  if (context !== undefined) wire.context = structuredClone(context);
  const result = await channel.send(wire);
  return {
    status: "HANDED_TO_CHANNEL_ADAPTER", tensor_id, sender_node_id, receiver_node_id,
    byte_length: envelope.byte_length, payload_sha256: envelope.payload_sha256,
    transport_result: result ?? null,
    note: "Adapter acceptance is not proof of remote receipt or GPU execution.",
  };
}

export async function receiveTensorOverAuthenticatedChannel({
  channel, local_node_id, expected_sender_node_id, seenMessageIds,
  max_bytes = 64 * 1024 * 1024, now = Date.now(),
}) {
  checkChannel(channel, local_node_id, expected_sender_node_id, now);
  if (typeof channel.receive !== "function") throw new Error("channel.receive must be a function");
  if (!(seenMessageIds instanceof Set)) throw new Error("seenMessageIds Set is required for replay protection");
  const wire = await channel.receive();
  if (!wire || typeof wire !== "object") throw new Error("channel returned no envelope");
  if (typeof wire.message_id !== "string" || !ID.test(wire.message_id)) throw new Error("message_id is required");
  if (seenMessageIds.has(wire.message_id)) throw new Error("replayed message_id");
  const expiry = Date.parse(wire.expires_at);
  if (!Number.isFinite(expiry) || expiry <= now) throw new Error("transport envelope is expired or invalid");
  const e = fromWire(wire, max_bytes);
  if (e.sender_node_id !== expected_sender_node_id || e.receiver_node_id !== local_node_id) {
    throw new Error("tensor sender or receiver does not match authenticated channel");
  }
  const verified = receiveTensorTransfer(e, { receiver_node_id: local_node_id, max_bytes });
  seenMessageIds.add(wire.message_id);
  return { ...verified, message_id: wire.message_id, status: "CHANNEL_TENSOR_INTEGRITY_VERIFIED" };
}

export function stampTransportEnvelope(wire, { message_id, expires_at }) {
  if (!wire || typeof wire !== "object" || wire.protocol_version !== PROTOCOL) throw new Error("invalid wire envelope");
  if (typeof message_id !== "string" || !ID.test(message_id)) throw new Error("invalid message_id");
  const expiry = typeof expires_at === "number" ? expires_at : Date.parse(expires_at);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) throw new Error("expires_at must be in the future");
  return { ...wire, message_id, expires_at: new Date(expiry).toISOString() };
}


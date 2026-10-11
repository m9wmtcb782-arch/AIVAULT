import test from "node:test";
import assert from "node:assert/strict";
import { sendTensorOverAuthenticatedChannel, receiveTensorOverAuthenticatedChannel, stampTransportEnvelope } from "../aivault-collab-v0.2/gpu-fabric-transport-v0.1.mjs";

function pair() {
  const queue = [];
  return {
    a: { authenticated: true, encrypted: true, authenticatedPeerNodeId: "node-b", sessionExpiresAt: Date.now() + 60000,
      async send(wire) { queue.push(stampTransportEnvelope(wire, { message_id: "msg-1", expires_at: Date.now() + 30000 })); return { accepted: true }; } },
    b: { authenticated: true, encrypted: true, authenticatedPeerNodeId: "node-a", sessionExpiresAt: Date.now() + 60000,
      async receive() { return queue.shift(); } },
  };
}

test("transfers a tensor through a supplied channel adapter and verifies integrity", async () => {
  const { a, b } = pair();
  const sent = await sendTensorOverAuthenticatedChannel({ channel: a, sender_node_id: "node-a", receiver_node_id: "node-b", tensor_id: "h1", dtype: "float32", shape: [2], payload: new Uint8Array(8) });
  assert.equal(sent.status, "HANDED_TO_CHANNEL_ADAPTER");
  const received = await receiveTensorOverAuthenticatedChannel({ channel: b, local_node_id: "node-b", expected_sender_node_id: "node-a", seenMessageIds: new Set() });
  assert.equal(received.status, "CHANNEL_TENSOR_INTEGRITY_VERIFIED");
  assert.equal(received.tensor_id, "h1");
  assert.equal(received.byte_length, 8);
});

test("rejects unencrypted or mismatched-peer channels", async () => {
  const { a } = pair();
  a.encrypted = false;
  await assert.rejects(sendTensorOverAuthenticatedChannel({ channel: a, sender_node_id: "node-a", receiver_node_id: "node-b", tensor_id: "t", dtype: "float32", shape: [1], payload: new Uint8Array(4) }), /not encrypted/);
  a.encrypted = true;
  a.authenticatedPeerNodeId = "node-c";
  await assert.rejects(sendTensorOverAuthenticatedChannel({ channel: a, sender_node_id: "node-a", receiver_node_id: "node-b", tensor_id: "t", dtype: "float32", shape: [1], payload: new Uint8Array(4) }), /does not match/);
});

test("rejects expired sessions and replayed messages", async () => {
  const { a, b } = pair();
  b.sessionExpiresAt = Date.now() - 1;
  await assert.rejects(receiveTensorOverAuthenticatedChannel({ channel: b, local_node_id: "node-b", expected_sender_node_id: "node-a" }), /expired/);
  b.sessionExpiresAt = Date.now() + 60000;
  await sendTensorOverAuthenticatedChannel({ channel: a, sender_node_id: "node-a", receiver_node_id: "node-b", tensor_id: "t", dtype: "float32", shape: [2], payload: new Uint8Array(8) });
  await assert.rejects(receiveTensorOverAuthenticatedChannel({ channel: b, local_node_id: "node-b", expected_sender_node_id: "node-a", seenMessageIds: new Set(["msg-1"]) }), /replayed/);
});

test("rejects oversized wire payloads before decoding", async () => {
  const { b } = pair();
  b.receive = async () => ({ protocol_version: "aivault.gpu-fabric-transport/0.1", message_id: "msg-big", expires_at: new Date(Date.now() + 10000).toISOString(), tensor: { payload_base64: Buffer.alloc(64).toString("base64") } });
  await assert.rejects(receiveTensorOverAuthenticatedChannel({ channel: b, local_node_id: "node-b", expected_sender_node_id: "node-a", max_bytes: 8, seenMessageIds: new Set() }), /encoded tensor exceeds/);
});

test("rejects an expired envelope and a tensor addressed to another node", async () => {
  const { b } = pair();
  b.receive = async () => ({
    protocol_version: "aivault.gpu-fabric-transport/0.1",
    message_id: "expired-1",
    expires_at: new Date(Date.now() - 1000).toISOString(),
    tensor: {},
  });
  await assert.rejects(receiveTensorOverAuthenticatedChannel({
    channel: b, local_node_id: "node-b", expected_sender_node_id: "node-a", seenMessageIds: new Set(),
  }), /envelope is expired/);

  b.receive = async () => ({
    protocol_version: "aivault.gpu-fabric-transport/0.1",
    message_id: "wrong-destination-1",
    expires_at: new Date(Date.now() + 10000).toISOString(),
    tensor: {
      protocol_version: "aivault.gpu-fabric-tensor/0.1",
      tensor_id: "t", sender_node_id: "node-a", receiver_node_id: "node-c",
      dtype: "float32", shape: [1], layout: "contiguous", byte_length: 4,
      payload_sha256: "0000000000000000000000000000000000000000000000000000000000000000",
      payload_base64: Buffer.alloc(4).toString("base64"),
    },
  });
  await assert.rejects(receiveTensorOverAuthenticatedChannel({
    channel: b, local_node_id: "node-b", expected_sender_node_id: "node-a", seenMessageIds: new Set(),
  }), /sender or receiver/);
});

test("rejects corrupted tensor payload at the receiver", async () => {
  const { a, b } = pair();
  await sendTensorOverAuthenticatedChannel({
    channel: a, sender_node_id: "node-a", receiver_node_id: "node-b",
    tensor_id: "corrupt-t", dtype: "float32", shape: [1], payload: new Uint8Array([0, 0, 0, 0]),
  });
  const originalReceive = b.receive;
  b.receive = async () => {
    const wire = await originalReceive();
    wire.tensor.payload_base64 = Buffer.from([1, 0, 0, 0]).toString("base64");
    return wire;
  };
  await assert.rejects(receiveTensorOverAuthenticatedChannel({
    channel: b, local_node_id: "node-b", expected_sender_node_id: "node-a", seenMessageIds: new Set(),
  }), /SHA-256 mismatch/);
});

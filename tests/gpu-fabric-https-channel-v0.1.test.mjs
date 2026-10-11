import test from "node:test";
import assert from "node:assert/strict";
import { createHttpsTensorSender } from "../aivault-collab-v0.2/gpu-fabric-https-channel-v0.1.mjs";

const base = {
  endpoint: "https://gpu.example.test/tensors",
  localNodeId: "node-a", peerNodeId: "node-b",
  accessToken: "test-token-not-real-12345", sessionExpiresAt: Date.now() + 60000,
};
const wire = {
  protocol_version: "aivault.gpu-fabric-transport/0.1",
  message_id: "msg-1",
  tensor: { tensor_id: "t1", sender_node_id: "node-a", receiver_node_id: "node-b", payload_sha256: "a".repeat(64) },
};
test("HTTPS channel submits a tensor and validates receiver receipt", async () => {
  let request;
  const channel = createHttpsTensorSender({ ...base, fetchImpl: async (url, init) => {
    request = { url, init };
    return { ok: true, async json() { return {
      status: "TENSOR_RECEIVED_VERIFIED", message_id: "msg-1", tensor_id: "t1",
      payload_sha256: "a".repeat(64), receiver_node_id: "node-b",
    }; } };
  } });
  const result = await channel.send(wire);
  assert.equal(result.status, "REMOTE_RECEIPT_REPORTED");
  assert.equal(request.url, base.endpoint);
  assert.equal(request.init.redirect, "error");
  assert.equal(request.init.headers["x-aivault-receiver-node"], "node-b");
});
test("rejects HTTP and URL embedded credentials", () => {
  assert.throws(() => createHttpsTensorSender({ ...base, endpoint: "http://gpu.example.test" }), /HTTPS/);
  assert.throws(() => createHttpsTensorSender({ ...base, endpoint: "https://u:p@gpu.example.test" }), /HTTPS/);
});
test("rejects mismatched tensor routing", async () => {
  const channel = createHttpsTensorSender({ ...base, fetchImpl: async () => { throw new Error("must not fetch"); } });
  await assert.rejects(channel.send({ ...wire, tensor: { ...wire.tensor, receiver_node_id: "node-c" } }), /node IDs/);
});
test("rejects missing verification receipt", async () => {
  const channel = createHttpsTensorSender({ ...base, fetchImpl: async () => ({
    ok: true, async json() { return { status: "OK" }; },
  }) });
  await assert.rejects(channel.send(wire), /unverified receipt/);
});
test("rejects HTTP failures without accepting delivery", async () => {
  const channel = createHttpsTensorSender({ ...base, fetchImpl: async () => ({ ok: false, status: 401 }) });
  await assert.rejects(channel.send(wire), /HTTP 401/);
});

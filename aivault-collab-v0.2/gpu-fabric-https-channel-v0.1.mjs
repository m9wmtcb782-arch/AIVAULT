/**
 * AIVAULT GPU Fabric HTTPS tensor channel v0.1.
 * Client-only adapter. Real network I/O uses fetch over HTTPS.
 * A peer endpoint must independently authenticate the bearer token, bind it to
 * the sender node, and return authenticated receipts. TLS trust is supplied by
 * the runtime. This adapter does not prove physical GPU execution.
 */
const NODE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

export function createHttpsTensorSender({
  endpoint, localNodeId, peerNodeId, accessToken, sessionExpiresAt,
  fetchImpl = globalThis.fetch, timeoutMs = 15000,
}) {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new Error("tensor endpoint must be an HTTPS URL without embedded credentials or fragment");
  }
  if (!NODE_ID.test(localNodeId) || !NODE_ID.test(peerNodeId) || localNodeId === peerNodeId) {
    throw new Error("invalid sender or receiver node ID");
  }
  if (typeof accessToken !== "string" || accessToken.length < 16 || /[\r\n]/.test(accessToken)) {
    throw new Error("missing or invalid access token");
  }
  if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) {
    throw new Error("invalid timeoutMs");
  }
  const expiry = typeof sessionExpiresAt === "number" ? sessionExpiresAt : Date.parse(sessionExpiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) throw new Error("session is expired");
  return {
    authenticated: true,
    encrypted: true,
    authenticatedPeerNodeId: peerNodeId,
    sessionExpiresAt: expiry,
    async send(wire) {
      if (Date.now() >= expiry) throw new Error("session expired before send");
      if (!wire || typeof wire !== "object" || wire.protocol_version !== "aivault.gpu-fabric-transport/0.1") {
        throw new Error("invalid tensor wire protocol");
      }
      if (wire.tensor?.sender_node_id !== localNodeId || wire.tensor?.receiver_node_id !== peerNodeId) {
        throw new Error("tensor node IDs do not match configured channel");
      }
      const response = await fetchImpl(url.href, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "authorization": "Bearer " + accessToken,
          "x-aivault-sender-node": localNodeId,
          "x-aivault-receiver-node": peerNodeId,
        },
        body: JSON.stringify(wire),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "error",
      });
      if (!response.ok) throw new Error("tensor endpoint HTTP " + response.status);
      const receipt = await response.json();
      if (receipt?.status !== "TENSOR_RECEIVED_VERIFIED" ||
          receipt?.message_id !== wire.message_id ||
          receipt?.tensor_id !== wire.tensor.tensor_id ||
          receipt?.payload_sha256 !== wire.tensor.payload_sha256 ||
          receipt?.receiver_node_id !== peerNodeId) {
        throw new Error("tensor endpoint returned invalid or unverified receipt");
      }
      return { status: "REMOTE_RECEIPT_REPORTED", receipt };
    },
  };
}

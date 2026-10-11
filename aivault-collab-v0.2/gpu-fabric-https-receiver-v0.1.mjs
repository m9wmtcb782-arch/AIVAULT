/**
 * Research HTTPS receiver. Mount only on a TLS server with externally
 * provisioned, short-lived per-edge grants. No credential issuance/deployment.
 * Replay/stage state is process-local: after restart issue NEW grants/tokens.
 * A receipt proves validated tensor delivery, never hardware execution.
 */
import { timingSafeEqual } from "node:crypto";
import { receiveTensorOverAuthenticatedChannel } from "./gpu-fabric-transport-v0.1.mjs";

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
function sameToken(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function validId(x) { return typeof x === "string" && ID.test(x); }

export function createHttpsTensorReceiver({
  localNodeId, grants, onTensor, maxBytes = 1024 * 1024,
  maxMessages = 4096, maxEnvelopeLifetimeMs = 30000,
}) {
  if (!validId(localNodeId) || !Array.isArray(grants) || !grants.length ||
      typeof onTensor !== "function") throw new Error("receiver configuration is invalid");
  for (const n of [maxBytes, maxMessages, maxEnvelopeLifetimeMs]) {
    if (!Number.isSafeInteger(n) || n < 1) throw new Error("invalid receiver limits");
  }
  const sessions = grants.map(g => {
    if (!g || typeof g.token !== "string" || g.token.length < 16 || /[\r\n]/.test(g.token) ||
        ![g.senderNodeId, g.jobId, g.operationId, g.tensorId].every(validId) ||
        g.senderNodeId === localNodeId || !Number.isFinite(g.expiresAt) ||
        g.expiresAt <= Date.now() || g.dtype !== "float32" ||
        !Array.isArray(g.shape) || g.shape.length !== 1 ||
        !Number.isSafeInteger(g.shape[0]) || g.shape[0] < 1 ||
        g.shape[0] * 4 > maxBytes) throw new Error("invalid tensor grant");
    return { ...g, shape: [...g.shape], used: false, seen: new Set() };
  });
  if (new Set(sessions.map(g => g.token)).size !== sessions.length) {
    throw new Error("grant tokens must be unique");
  }
  let accepted = 0;
  const maxBodyBytes = Math.ceil(maxBytes / 3) * 4 + 8192;
  return async function handle(req, res) {
    const reply = (status, body) => {
      res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", "connection": "close" });
      res.end(JSON.stringify(body));
    };
    let session, consumed = false;
    try {
      if (req.socket.encrypted !== true) return reply(400, { error: "TLS_REQUIRED" });
      if (req.method !== "POST" || req.url !== "/tensor") return reply(404, { error: "NOT_FOUND" });
      const auth = req.headers.authorization;
      if (typeof auth !== "string" || !auth.startsWith("Bearer ")) return reply(401, { error: "UNAUTHORIZED" });
      session = sessions.find(g => sameToken(auth.slice(7), g.token));
      if (!session || Date.now() >= session.expiresAt) return reply(401, { error: "UNAUTHORIZED" });
      if (req.headers["x-aivault-sender-node"] !== session.senderNodeId ||
          req.headers["x-aivault-receiver-node"] !== localNodeId) return reply(403, { error: "PEER_MISMATCH" });
      if (req.headers["content-type"] !== "application/json") return reply(415, { error: "JSON_REQUIRED" });
      const declared = req.headers["content-length"];
      if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > maxBodyBytes)) {
        return reply(413, { error: "BODY_TOO_LARGE" });
      }
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > maxBodyBytes) {
          reply(413, { error: "BODY_TOO_LARGE" });
          res.once("finish", () => req.destroy());
          return;
        }
        chunks.push(chunk);
      }
      const wire = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const now = Date.now();
      if (now >= session.expiresAt) return reply(401, { error: "UNAUTHORIZED" });
      const c = wire.context, t = wire.tensor;
      if (!c || c.job_id !== session.jobId || c.operation_id !== session.operationId ||
          !t || t.tensor_id !== session.tensorId || t.dtype !== session.dtype ||
          t.layout !== "contiguous" || JSON.stringify(t.shape) !== JSON.stringify(session.shape)) {
        return reply(403, { error: "STAGE_MISMATCH" });
      }
      const expiry = Date.parse(wire.expires_at);
      if (!Number.isFinite(expiry) || expiry > session.expiresAt ||
          expiry > now + maxEnvelopeLifetimeMs) return reply(400, { error: "INVALID_EXPIRY" });
      if (session.used || session.seen.has(wire.message_id)) return reply(409, { error: "REPLAY_OR_STAGE_CONSUMED" });
      if (accepted >= maxMessages) return reply(503, { error: "REPLAY_CAPACITY_EXHAUSTED" });
      const verified = await receiveTensorOverAuthenticatedChannel({
        channel: { authenticated: true, encrypted: true,
          authenticatedPeerNodeId: session.senderNodeId, sessionExpiresAt: session.expiresAt,
          receive: async () => wire },
        local_node_id: localNodeId, expected_sender_node_id: session.senderNodeId,
        seenMessageIds: new Set(), max_bytes: maxBytes, now,
      });
      // Recheck after await, then reserve synchronously BEFORE calling backend.
      if (Date.now() >= session.expiresAt || Date.now() >= expiry) return reply(401, { error: "EXPIRED" });
      if (session.used || accepted >= maxMessages) return reply(409, { error: "REPLAY_OR_STAGE_CONSUMED" });
      session.used = true;
      session.seen.add(wire.message_id);
      accepted++;
      consumed = true;
      await onTensor(verified, Object.freeze({ job_id: session.jobId, operation_id: session.operationId }));
      reply(200, { status: "TENSOR_RECEIVED_VERIFIED", message_id: wire.message_id,
        tensor_id: verified.tensor_id, payload_sha256: verified.payload_sha256,
        receiver_node_id: localNodeId });
    } catch {
      // Backend failure remains consumed: never implicitly execute twice.
      if (!res.headersSent && !res.destroyed) reply(consumed ? 500 : 400,
        { error: consumed ? "STAGE_FAILED_REQUIRES_NEW_GRANT" : "INVALID_TENSOR" });
    }
  };
}

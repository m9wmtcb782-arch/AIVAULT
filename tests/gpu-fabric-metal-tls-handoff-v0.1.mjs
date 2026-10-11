// macOS CI integration: two CLI invocations on ONE local Metal device + TLS.
import assert from "node:assert/strict";
import https from "node:https";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTensorTransfer } from "../aivault-collab-v0.2/gpu-fabric-tensor-transfer-v0.1.mjs";
import { createHttpsTensorReceiver } from "../aivault-collab-v0.2/gpu-fabric-https-receiver-v0.1.mjs";
import { createHttpsTensorSender } from "../aivault-collab-v0.2/gpu-fabric-https-channel-v0.1.mjs";
import { receiveSwiftFloat32TensorWire } from "../aivault-collab-v0.2/gpu-fabric-tensor-wire-v0.1.mjs";
import { createFileReplayLedger } from "../aivault-collab-v0.2/gpu-fabric-replay-ledger-v0.1.mjs";

const binary = process.argv[2];
if (!binary) throw new Error("compiled Metal wire CLI is required");
const dir = mkdtempSync(join(tmpdir(), "metal-tls-"));
let server;
try {
  const keyPath = join(dir, "key.pem"), certPath = join(dir, "cert.pem");
  const configPath = join(dir, "openssl.cnf");
  writeFileSync(configPath, "[req]\ndistinguished_name=dn\n[dn]\n[v3_req]\nsubjectAltName=DNS:localhost\n");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=localhost",
    "-config", configPath, "-extensions", "v3_req"], { stdio: "ignore" });
  const ca = readFileSync(certPath);
  const fetchImpl = (url, options) => new Promise((resolve, reject) => {
    const req = https.request(url, { ...options, ca }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c)); res.on("error", reject);
      res.on("end", () => resolve({ ok: res.statusCode === 200, status: res.statusCode,
        json: async () => JSON.parse(Buffer.concat(chunks).toString()) }));
    });
    req.on("error", reject); req.end(options.body);
  });
  function nativeInput(payload, tensorId) {
    const e = createTensorTransfer({ tensor_id: tensorId, sender_node_id: "network-stage",
      receiver_node_id: "metal-stage", dtype: "float32", shape: [3], payload });
    const { payload: bytes, ...descriptor } = e;
    return { ...descriptor, payload_base64: Buffer.from(bytes).toString("base64") };
  }
  function metal(op, scalar, tensor) {
    return JSON.parse(execFileSync(binary, [op, String(scalar)], {
      input: JSON.stringify(tensor), encoding: "utf8", timeout: 15000,
      stdio: ["pipe", "pipe", "inherit"],
    }));
  }
  const inputBytes = Buffer.alloc(12);
  [1, 2, -1].forEach((v, i) => inputBytes.writeFloatLE(v, i * 4));
  const nativeWire = metal("mul_scalar", 3, nativeInput(inputBytes, "x"));
  let finalOutput;
  const expiry = Date.now() + 60000, token = "test-only-metal-network-token-0001";
  const handler = createHttpsTensorReceiver({
    localNodeId: "network-stage",
    grants: [{ token, senderNodeId: "metal-stage", jobId: "metal-network-job",
      operationId: "op-b", tensorId: "h", dtype: "float32", shape: [3], expiresAt: expiry }],
    replayStore: createFileReplayLedger({ directory: join(dir, "ledger") }),
    onTensor: async (tensor, context) => {
      assert.equal(context.operation_id, "op-b");
      const outputWire = metal("add_scalar", 2, nativeInput(tensor.payload, "received-h"));
      const decoded = receiveSwiftFloat32TensorWire(outputWire.tensor, { receiver_node_id: "network-stage" });
      const b = Buffer.from(decoded.payload);
      finalOutput = [0, 1, 2].map(i => b.readFloatLE(i * 4));
    },
  });
  server = https.createServer({ key: readFileSync(keyPath), cert: ca, minVersion: "TLSv1.2" }, handler);
  server.requestTimeout = 5000;
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const sender = createHttpsTensorSender({ endpoint: "https://localhost:" + server.address().port + "/tensor",
    localNodeId: "metal-stage", peerNodeId: "network-stage", accessToken: token,
    sessionExpiresAt: expiry, fetchImpl });
  const received = await sender.send(nativeWire);
  assert.equal(received.status, "REMOTE_RECEIPT_REPORTED");
  assert.deepEqual(finalOutput, [5, 8, -1]);
  await assert.rejects(sender.send(nativeWire), /HTTP 409/);
  console.log("CONFIRMED: native Metal -> Swift transport JSON -> loopback TLS -> native Metal; y=[5,8,-1]");
  console.log("NOT VERIFIED: two physical GPU devices; this uses one macOS runner and Node HTTPS transport");
} finally {
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  rmSync(dir, { recursive: true, force: true });
}

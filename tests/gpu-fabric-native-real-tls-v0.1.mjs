// Native URLSession real TLS test on one macOS runner; never two physical GPUs.
import assert from "node:assert/strict";
import https from "node:https";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHttpsTensorReceiver } from "../aivault-collab-v0.2/gpu-fabric-https-receiver-v0.1.mjs";
import { createFileReplayLedger } from "../aivault-collab-v0.2/gpu-fabric-replay-ledger-v0.1.mjs";
import { createTensorTransfer } from "../aivault-collab-v0.2/gpu-fabric-tensor-transfer-v0.1.mjs";
import { receiveSwiftFloat32TensorWire } from "../aivault-collab-v0.2/gpu-fabric-tensor-wire-v0.1.mjs";

const [nativeBinary, metalBinary] = process.argv.slice(2);
if (!nativeBinary || !metalBinary) throw new Error("native TLS and Metal CLI binaries required");
const dir = mkdtempSync(join(tmpdir(), "native-real-tls-"));
let server;
try {
  const keyPath = join(dir, "key.pem"), certPath = join(dir, "cert.pem"),
    derPath = join(dir, "cert.der"), certConfig = join(dir, "openssl.cnf");
  writeFileSync(certConfig, "[req]\ndistinguished_name=dn\n[dn]\n[v3_req]\nsubjectAltName=DNS:localhost\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,digitalSignature,keyCertSign\nextendedKeyUsage=serverAuth\n");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=localhost",
    "-config", certConfig, "-extensions", "v3_req"], { stdio: "ignore" });
  execFileSync("openssl", ["x509", "-in", certPath, "-outform", "DER", "-out", derPath]);
  const token = "test-only-native-real-tls-token-0001", expiry = Date.now() + 120000;
  let executed = 0, redirectTargetHits = 0, output;
  const handler = createHttpsTensorReceiver({
    localNodeId: "node-b",
    grants: [{ token, senderNodeId: "metal-native", jobId: "native-tls-job", operationId: "op-b",
      tensorId: "h", dtype: "float32", shape: [3], expiresAt: expiry }],
    replayStore: createFileReplayLedger({ directory: join(dir, "ledger") }),
    onTensor: async tensor => {
      const { payload, ...descriptor } = createTensorTransfer({
        tensor_id: "received-h", sender_node_id: "network-stage", receiver_node_id: "metal-stage",
        dtype: tensor.dtype, shape: tensor.shape, payload: tensor.payload,
      });
      const wire = JSON.parse(execFileSync(metalBinary, ["add_scalar", "2"], {
        input: JSON.stringify({ ...descriptor, payload_base64: Buffer.from(payload).toString("base64") }),
        encoding: "utf8", timeout: 15000, stdio: ["pipe", "pipe", "inherit"],
      }));
      const verified = receiveSwiftFloat32TensorWire(wire.tensor, { receiver_node_id: "network-stage" });
      const bytes = Buffer.from(verified.payload);
      output = [0, 1, 2].map(i => bytes.readFloatLE(i * 4));
      executed++;
    },
  });
  server = https.createServer({ key: readFileSync(keyPath), cert: readFileSync(certPath),
    minVersion: "TLSv1.2" }, async (req, res) => {
    if (req.url === "/tensor") return handler(req, res);
    if (req.url === "/redirect-target") redirectTargetHits++;
    if (req.url === "/redirect") {
      res.writeHead(307, { location: "/redirect-target", connection: "close" }); res.end(); return;
    }
    if (req.url === "/large") {
      res.writeHead(200, { "content-length": "9000", connection: "close" });
      res.end("x".repeat(9000)); return;
    }
    if (req.url === "/bad-receipt") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const wire = JSON.parse(Buffer.concat(chunks).toString());
      res.writeHead(200, { "content-type": "application/json", connection: "close" });
      res.end(JSON.stringify({ status: "TENSOR_RECEIVED_VERIFIED", message_id: wire.message_id,
        tensor_id: wire.tensor.tensor_id, payload_sha256: "0".repeat(64), receiver_node_id: "node-b" }));
      return;
    }
    res.writeHead(404); res.end();
  });
  server.requestTimeout = 5000;
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const configPath = join(dir, "native-config.json");
  writeFileSync(configPath, JSON.stringify({
    endpoint: "https://localhost:" + server.address().port + "/tensor",
    certDERPath: derPath, token, expiresAt: expiry,
  }), { mode: 0o600 });
  const result = await promisify(execFile)(nativeBinary, [configPath], { timeout: 60000, maxBuffer: 1024 * 1024 });
  process.stdout.write(result.stdout);
  assert.equal(executed, 1);
  assert.deepEqual(output, [5, 8, -1]);
  assert.equal(redirectTargetHits, 0);
  console.log("CONFIRMED: native Metal -> native URLSession TLS -> Node verifier -> native Metal; y=[5,8,-1]");
} finally {
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  rmSync(dir, { recursive: true, force: true });
}

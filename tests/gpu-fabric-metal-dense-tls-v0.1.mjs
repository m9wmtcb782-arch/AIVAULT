// macOS CI: two dense layers on ONE local Metal device with a TLS hidden-tensor edge.
import assert from "node:assert/strict";
import https from "node:https";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTensorTransfer } from "../aivault-collab-v0.2/gpu-fabric-tensor-transfer-v0.1.mjs";
import { createPlannedHttpsStage } from "../aivault-collab-v0.2/gpu-fabric-planned-stage-v0.1.mjs";
import { planGraph } from "../aivault-collab-v0.2/gpu-fabric-planner-v0.1.mjs";
import { createHttpsTensorSender } from "../aivault-collab-v0.2/gpu-fabric-https-channel-v0.1.mjs";
import { receiveSwiftFloat32TensorWire } from "../aivault-collab-v0.2/gpu-fabric-tensor-wire-v0.1.mjs";
import { createFileReplayLedger } from "../aivault-collab-v0.2/gpu-fabric-replay-ledger-v0.1.mjs";

import { tinyModelOperations, tinyModelBaseline } from './fixtures/gpu-fabric-tiny-model-v0.1.mjs';
import { executeDenseReference } from '../aivault-collab-v0.2/gpu-fabric-dense-v0.1.mjs';

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
      receiver_node_id: "metal-stage", dtype: "float32", shape: [payload.length / 4], payload });
    const { payload: bytes, ...descriptor } = e;
    return { ...descriptor, payload_base64: Buffer.from(bytes).toString("base64") };
  }
  const operations = tinyModelOperations();
  const layerPaths = operations.map((op,i) => {
    const path=join(dir, 'layer-' + i + '.json');
    writeFileSync(path,JSON.stringify(op),{mode:0o600});return path;
  });
  function metal(index, tensor) {
    return JSON.parse(execFileSync(binary, [layerPaths[index]], {
      input: JSON.stringify(tensor), encoding: 'utf8', timeout: 15000,
      stdio: ['pipe','pipe','inherit'],
    }));
  }
  // Independent CPU algebra and Float32 reference on multiple inputs.
  for (const values of [[1,2,-1],[0,0,0],[-2,1,3],[0.25,-0.5,0.75],[4,-3,-2]]) {
    let input=values;
    for (let layer=0;layer<2;layer++) {
      const bytes=Buffer.alloc(input.length*4);input.forEach((v,i)=>bytes.writeFloatLE(v,i*4));
      const wire=metal(layer,nativeInput(bytes,'local-baseline'));
      const tensor=receiveSwiftFloat32TensorWire(wire.tensor,{receiver_node_id:'network-stage'});
      const output=Array.from({length:tensor.shape[0]},(_,i)=>Buffer.from(tensor.payload).readFloatLE(i*4));
      const reference=executeDenseReference(operations[layer],input);
      output.forEach((v,i)=>assert.ok(Math.abs(v-reference[i]) <= 1e-5*Math.max(1,Math.abs(reference[i]))));
      input=output;
    }
    assert.deepEqual(input,tinyModelBaseline(values));
  }
  const inputBytes=Buffer.alloc(12);[1,2,-1].forEach((v,i)=>inputBytes.writeFloatLE(v,i*4));
  const nativeWire=metal(0,nativeInput(inputBytes,'x'));
  let finalOutput;
  const expiry = Date.now() + 60000, token = "test-only-metal-network-token-0001";
  const plan=planGraph({operations,nodes:[
    {node_id:'metal-stage',backends:['layer-a'],supported_operators:['dense'],available_memory_bytes:4096},
    {node_id:'network-stage',backends:['layer-b'],supported_operators:['dense'],available_memory_bytes:4096},
  ],tensorBytes:{h:16}});
  assert.deepEqual(plan.operations.map(p=>p.node_id),['metal-stage','network-stage']);
  const adapter = {
    backend_id: "metal-cli-b", runtime: "macOS-local-Metal-CLI", release: async () => ({}),
    getCapabilities: async () => ({ device_kind: "gpu", operators: ["dense"], memory_bytes: 4096 }),
    execute: async ({ operation, inputs, context }) => {
      assert.equal(context.operation_id, "op-b");
      const bytes = Buffer.alloc(inputs[0].length * 4);
      inputs[0].forEach((v, i) => bytes.writeFloatLE(v, i * 4));
      const outputWire = metal(1, nativeInput(bytes, "received-h"));
      const decoded = receiveSwiftFloat32TensorWire(outputWire.tensor, { receiver_node_id: "network-stage" });
      const b = Buffer.from(decoded.payload);
      return { output: Array.from({length:operation.output_size},(_,i) => b.readFloatLE(i*4)) };
    },
  };
  const stage = createPlannedHttpsStage({
    localNodeId: "network-stage", jobId: "metal-network-job", plan, operations, adapter,
    grant: { token, senderNodeId: "metal-stage", jobId: "metal-network-job",
      operationId: "op-b", tensorId: "h", dtype: "float32", shape: [4], expiresAt: expiry },
    replayStore: createFileReplayLedger({ directory: join(dir, "ledger") }),
    onCompleted: async outcome => { finalOutput = outcome.output; },
  });
  const handler = stage.handler;
  server = https.createServer({ key: readFileSync(keyPath), cert: ca, minVersion: "TLSv1.2" }, handler);
  server.requestTimeout = 5000;
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const sender = createHttpsTensorSender({ endpoint: "https://localhost:" + server.address().port + "/tensor",
    localNodeId: "metal-stage", peerNodeId: "network-stage", accessToken: token,
    sessionExpiresAt: expiry, fetchImpl });
  const received = await sender.send(nativeWire);
  assert.equal(received.status, "REMOTE_RECEIPT_REPORTED");
  assert.deepEqual(finalOutput, [6.5, -1.5]);
  assert.deepEqual(finalOutput,tinyModelBaseline([1,2,-1]));
  assert.equal(stage.getState().status, "PLANNED_STAGE_COMPLETED");
  await assert.rejects(sender.send(nativeWire), /HTTP 409/);
  console.log("CONFIRMED: native Metal -> Swift transport JSON -> loopback TLS -> native Metal; dense 3->4->2; y=[6.5,-1.5]");
  console.log("NOT VERIFIED: two physical GPU devices; this uses one macOS runner and Node HTTPS transport");
} finally {
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  rmSync(dir, { recursive: true, force: true });
}

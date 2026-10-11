// Test-only process-isolated CPU worker. Never reports physical GPU evidence.
import https from "node:https";
import { readFileSync } from "node:fs";
import { createHttpsTensorReceiver } from "../../aivault-collab-v0.2/gpu-fabric-https-receiver-v0.1.mjs";
import { createFileReplayLedger } from "../../aivault-collab-v0.2/gpu-fabric-replay-ledger-v0.1.mjs";
import { createHttpsTensorSender } from "../../aivault-collab-v0.2/gpu-fabric-https-channel-v0.1.mjs";
import { sendTensorOverAuthenticatedChannel } from "../../aivault-collab-v0.2/gpu-fabric-transport-v0.1.mjs";
import { executeBackendOperation } from "../../aivault-collab-v0.2/gpu-fabric-backend-v0.1.mjs";

process.once("message", async config => {
  try {
    const ca = readFileSync(config.certPath);
    const fetchImpl = (url, options) => new Promise((resolve, reject) => {
      const req = https.request(url, { ...options, ca }, res => {
        const chunks = [];
        res.on("data", c => chunks.push(c));
        res.on("error", reject);
        res.on("end", () => resolve({ ok: res.statusCode === 200, status: res.statusCode,
          json: async () => JSON.parse(Buffer.concat(chunks).toString()) }));
      });
      req.on("error", reject); req.end(options.body);
    });
    const adapter = {
      backend_id: "cpu-" + config.nodeId, runtime: "process-isolated-CPU-test",
      getCapabilities: async () => ({ device_kind: "cpu", operators: [config.operator], memory_bytes: 4096 }),
      execute: async ({ inputs, operation }) => ({ output: inputs[0].map(v =>
        Math.fround(operation.operator === "mul_scalar" ? v * operation.scalar : v + operation.scalar)) }),
      release: async () => ({ released: true }),
    };
    const handler = createHttpsTensorReceiver({
      localNodeId: config.nodeId, grants: [config.grant],
      replayStore: createFileReplayLedger({ directory: config.ledgerPath }),
      onTensor: async (tensor, context) => {
        if (config.crashAfterReservation) process.exit(17);
        const input = Buffer.from(tensor.payload);
        const values = Array.from({ length: tensor.shape[0] }, (_, i) => input.readFloatLE(i * 4));
        const result = await executeBackendOperation(adapter,
          { operator: config.operator, scalar: config.scalar }, [values], context);
        if (config.next) {
          const output = Buffer.alloc(result.output.length * 4);
          result.output.forEach((v, i) => output.writeFloatLE(v, i * 4));
          const g = config.next.grant;
          await sendTensorOverAuthenticatedChannel({
            channel: createHttpsTensorSender({ endpoint: config.next.endpoint,
              localNodeId: config.nodeId, peerNodeId: config.next.nodeId,
              accessToken: g.token, sessionExpiresAt: g.expiresAt, fetchImpl }),
            sender_node_id: config.nodeId, receiver_node_id: config.next.nodeId,
            tensor_id: g.tensorId, dtype: "float32", shape: g.shape, payload: output,
            context: { job_id: g.jobId, operation_id: g.operationId },
          });
        }
        process.send({ type: "executed", pid: process.pid, node_id: config.nodeId,
          operation_id: context.operation_id, device_kind: "cpu", output: result.output });
      },
    });
    const server = https.createServer({ key: readFileSync(config.keyPath), cert: ca,
      minVersion: "TLSv1.2" }, handler);
    server.requestTimeout = 2000;
    server.listen(0, "127.0.0.1", () => process.send({ type: "ready", pid: process.pid,
      endpoint: "https://localhost:" + server.address().port + "/tensor" }));
  } catch (e) {
    process.send({ type: "error", message: e.message });
    process.exitCode = 1;
    process.disconnect();
  }
});

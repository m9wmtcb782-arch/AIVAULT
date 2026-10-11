import test from "node:test";
import assert from "node:assert/strict";
import https from "node:https";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHttpsTensorReceiver } from "../aivault-collab-v0.2/gpu-fabric-https-receiver-v0.1.mjs";
import { createHttpsTensorSender } from "../aivault-collab-v0.2/gpu-fabric-https-channel-v0.1.mjs";
import { sendTensorOverAuthenticatedChannel } from "../aivault-collab-v0.2/gpu-fabric-transport-v0.1.mjs";
import { executeBackendOperation } from "../aivault-collab-v0.2/gpu-fabric-backend-v0.1.mjs";
import { planGraph } from "../aivault-collab-v0.2/gpu-fabric-planner-v0.1.mjs";

const dir = mkdtempSync(join(tmpdir(), "aivault-tls-"));
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes",
  "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem"),
  "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost"], { stdio: "ignore" });
const key = readFileSync(join(dir, "key.pem")), ca = readFileSync(join(dir, "cert.pem"));
test.after(() => rmSync(dir, { recursive: true, force: true }));

// Uses trusted test CA and normal TLS hostname verification. Never disables TLS.
function fetchTLS(url, options) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { ...options, ca }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("error", reject);
      res.on("end", () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300,
        status: res.statusCode, json: async () => JSON.parse(Buffer.concat(chunks).toString()) }));
    });
    req.on("error", reject);
    req.end(options.body);
  });
}
async function server(t, handler) {
  const s = https.createServer({ key, cert: ca, minVersion: "TLSv1.2" }, handler);
  s.requestTimeout = 2000;
  await new Promise(resolve => s.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { s.close(resolve); s.closeAllConnections(); }));
  return "https://localhost:" + s.address().port + "/tensor";
}
function bytes(values) {
  const b = Buffer.alloc(values.length * 4);
  values.forEach((v, i) => b.writeFloatLE(v, i * 4));
  return b;
}
function values(payload) {
  const b = Buffer.from(payload);
  return Array.from({ length: b.length / 4 }, (_, i) => b.readFloatLE(i * 4));
}
function grant(overrides = {}) {
  return { token: "test-only-node-a-token-0001", senderNodeId: "node-a",
    jobId: "job-1", operationId: "op-b", tensorId: "h",
    dtype: "float32", shape: [3], expiresAt: Date.now() + 60000, ...overrides };
}
function sender(endpoint, g, local = "node-a", peer = "node-b", fetchImpl = fetchTLS) {
  return createHttpsTensorSender({ endpoint, localNodeId: local, peerNodeId: peer,
    accessToken: g.token, sessionExpiresAt: g.expiresAt, fetchImpl });
}
function send(channel, extra = {}) {
  return sendTensorOverAuthenticatedChannel({ channel, sender_node_id: "node-a",
    receiver_node_id: "node-b", tensor_id: "h", dtype: "float32", shape: [3],
    payload: bytes([3, 6, -3]), context: { job_id: "job-1", operation_id: "op-b" }, ...extra });
}
function cpu(id, operator) {
  return { backend_id: id, runtime: "CPU-conformance", getCapabilities: async () =>
    ({ device_kind: "cpu", operators: [operator], memory_bytes: 4096 }),
    execute: async ({ operation, inputs }) => ({ output: inputs[0].map(v =>
      Math.fround(operator === "mul_scalar" ? v * operation.scalar : v + operation.scalar)) }),
    release: async () => ({ released: true }) };
}

test("one planned graph executes at two CPU endpoints over real loopback TLS", async t => {
  const graph = [
    { operation_id: "op-a", operator: "mul_scalar", scalar: 3, dependency_ids: [],
      input_tensor_ids: ["x"], output_tensor_ids: ["h"], estimated_memory_bytes: 64 },
    { operation_id: "op-b", operator: "add_scalar", scalar: 2, dependency_ids: ["op-a"],
      input_tensor_ids: ["h"], output_tensor_ids: ["y"], estimated_memory_bytes: 64 },
  ];
  const plan = planGraph({ operations: graph, nodes: [
    { node_id: "node-a", backends: ["cpu-a"], supported_operators: ["mul_scalar"], available_memory_bytes: 4096 },
    { node_id: "node-b", backends: ["cpu-b"], supported_operators: ["add_scalar"], available_memory_bytes: 4096 },
  ], tensorBytes: { h: 12 } });
  assert.deepEqual(plan.operations.map(op => op.node_id), ["node-a", "node-b"]);
  const gB = grant(), gA = grant({ token: "test-only-node-b-token-0002",
    senderNodeId: "node-b", operationId: "op-a", tensorId: "x" });
  const a = cpu("cpu-a", "mul_scalar"), b = cpu("cpu-b", "add_scalar");
  const trace = [];
  let output;
  const endpointB = await server(t, createHttpsTensorReceiver({ localNodeId: "node-b", grants: [gB],
    onTensor: async (tensor, context) => {
      assert.equal(trace[0], "op-a");
      const result = await executeBackendOperation(b, graph[1], [values(tensor.payload)], context);
      output = result.output;
      trace.push("op-b");
    } }));
  const endpointA = await server(t, createHttpsTensorReceiver({ localNodeId: "node-a", grants: [gA],
    onTensor: async (tensor, context) => {
      const result = await executeBackendOperation(a, graph[0], [values(tensor.payload)], context);
      trace.push("op-a");
      await send(sender(endpointB, gB), { payload: bytes(result.output) });
    } }));
  const started = performance.now();
  await sendTensorOverAuthenticatedChannel({ channel: sender(endpointA, gA, "node-b", "node-a"),
    sender_node_id: "node-b", receiver_node_id: "node-a", tensor_id: "x",
    dtype: "float32", shape: [3], payload: bytes([1, 2, -1]),
    context: { job_id: "job-1", operation_id: "op-a" } });
  const baseline = (await executeBackendOperation(b, graph[1],
    [(await executeBackendOperation(a, graph[0], [[1, 2, -1]])).output])).output;
  assert.deepEqual(output, baseline);
  assert.deepEqual(output, [5, 8, -1]);
  assert.deepEqual(trace, plan.topological_order);
  t.diagnostic(JSON.stringify({ status: "CONFIRMED", evidence: "LOOPBACK_TLS_CPU_TWO_ENDPOINTS",
    elapsed_ms: performance.now() - started, physical_multi_device_gpu: "NOT VERIFIED" }));
});

test("rejects invalid credentials, stage substitution, corruption, expiry and duplicate delivery", async t => {
  const g = grant();
  let calls = 0, captured;
  const endpoint = await server(t, createHttpsTensorReceiver({ localNodeId: "node-b", grants: [g],
    onTensor: async () => { calls++; } }));
  await assert.rejects(send(sender(endpoint, { ...g, token: "invalid-token-00000000" })), /HTTP 401/);
  await assert.rejects(send(sender(endpoint, g), { context: { job_id: "other-job", operation_id: "op-b" } }), /HTTP 403/);
  const mutate = change => (url, opts) => {
    const wire = JSON.parse(opts.body); change(wire);
    return fetchTLS(url, { ...opts, body: JSON.stringify(wire) });
  };
  await assert.rejects(send(sender(endpoint, g, "node-a", "node-b", mutate(w => {
    w.tensor.payload_base64 = bytes([99, 6, -3]).toString("base64");
  }))), /HTTP 400/);
  await assert.rejects(send(sender(endpoint, g, "node-a", "node-b", mutate(w => {
    w.expires_at = new Date(Date.now() - 1).toISOString();
  }))), /HTTP 400/);
  assert.equal(calls, 0);
  await send(sender(endpoint, g, "node-a", "node-b", async (url, opts) => {
    captured = { url, opts }; return fetchTLS(url, opts);
  }));
  assert.equal((await fetchTLS(captured.url, captured.opts)).status, 409);
  // A new ID cannot execute an already consumed operation either.
  await assert.rejects(send(sender(endpoint, g)), /HTTP 409/);
  assert.equal(calls, 1);
});

test("concurrent deliveries execute a stage only once; backend failure stays consumed", async t => {
  const g = grant();
  let calls = 0;
  const endpoint = await server(t, createHttpsTensorReceiver({ localNodeId: "node-b", grants: [g],
    onTensor: async () => { calls++; await new Promise(r => setTimeout(r, 10)); throw new Error("backend failed"); } }));
  const result = await Promise.allSettled([send(sender(endpoint, g)), send(sender(endpoint, g))]);
  assert.equal(calls, 1);
  assert.ok(result.every(r => r.status === "rejected"));
  assert.ok(result.some(r => /HTTP 500/.test(r.reason.message)));
  await assert.rejects(send(sender(endpoint, g)), /HTTP 409/);
});

test("body limit and header identity mismatch fail before execution", async t => {
  const g = grant();
  let calls = 0;
  const endpoint = await server(t, createHttpsTensorReceiver({ localNodeId: "node-b", grants: [g], maxBytes: 12,
    onTensor: async () => { calls++; } }));
  const headers = { authorization: "Bearer " + g.token, "content-type": "application/json",
    "x-aivault-sender-node": "node-a", "x-aivault-receiver-node": "node-b" };
  const big = await fetchTLS(endpoint, { method: "POST",
    headers: { ...headers, "content-length": "99999" }, body: "{}" });
  assert.equal(big.status, 413);
  const wrong = await fetchTLS(endpoint, { method: "POST",
    headers: { ...headers, "x-aivault-sender-node": "node-c" }, body: "{}" });
  assert.equal(wrong.status, 403);
  assert.equal(calls, 0);
});

test("untrusted TLS certificate fails without invoking the receiver backend", async t => {
  let calls = 0;
  const g = grant();
  const endpoint = await server(t, createHttpsTensorReceiver({ localNodeId: "node-b", grants: [g],
    onTensor: async () => { calls++; } }));
  await assert.rejects(new Promise((resolve, reject) => {
    const req = https.request(endpoint, { method: "POST" }, resolve);
    req.on("error", reject); req.end("{}");
  }), error => /CERT|SELF_SIGNED/.test(error.code));
  assert.equal(calls, 0);
});

test("chunked oversized body is bounded before JSON parsing", async t => {
  const g = grant();
  let calls = 0;
  const endpoint = await server(t, createHttpsTensorReceiver({ localNodeId: "node-b", grants: [g], maxBytes: 12,
    onTensor: async () => { calls++; } }));
  const result = await fetchTLS(endpoint, { method: "POST", headers: {
    authorization: "Bearer " + g.token, "content-type": "application/json",
    "transfer-encoding": "chunked", "x-aivault-sender-node": "node-a",
    "x-aivault-receiver-node": "node-b",
  }, body: "a".repeat(20000) });
  assert.equal(result.status, 413);
  assert.equal(calls, 0);
});

test("replay capacity fails closed without discarding earlier consumed stages", async t => {
  const g = grant(), second = grant({ token: "test-only-second-edge-0002", tensorId: "h2", operationId: "op-c" });
  let calls = 0;
  const endpoint = await server(t, createHttpsTensorReceiver({ localNodeId: "node-b", grants: [g, second],
    maxMessages: 1, onTensor: async () => { calls++; } }));
  await send(sender(endpoint, g));
  await assert.rejects(send(sender(endpoint, second), { tensor_id: "h2",
    context: { job_id: "job-1", operation_id: "op-c" } }), /HTTP 503/);
  await assert.rejects(send(sender(endpoint, g)), /HTTP 409/);
  assert.equal(calls, 1);
});

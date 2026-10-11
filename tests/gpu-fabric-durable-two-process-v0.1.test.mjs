import test from "node:test";
import assert from "node:assert/strict";
import https from "node:https";
import { fork, execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createFileReplayLedger } from "../aivault-collab-v0.2/gpu-fabric-replay-ledger-v0.1.mjs";
import { createHttpsTensorSender } from "../aivault-collab-v0.2/gpu-fabric-https-channel-v0.1.mjs";
import { sendTensorOverAuthenticatedChannel } from "../aivault-collab-v0.2/gpu-fabric-transport-v0.1.mjs";
import { planGraph } from "../aivault-collab-v0.2/gpu-fabric-planner-v0.1.mjs";

function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "fabric-process-"));
  const keyPath = join(dir, "key.pem"), certPath = join(dir, "cert.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=localhost",
    "-addext", "subjectAltName=DNS:localhost"], { stdio: "ignore" });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
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
  return { dir, keyPath, certPath, fetchImpl };
}
async function worker(t, env, config) {
  const child = fork(fileURLToPath(new URL("./fixtures/gpu-fabric-tls-cpu-worker-v0.1.mjs", import.meta.url)),
    [], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
  const events = [];
  let stderr = "";
  child.stderr.on("data", x => { stderr += x; });
  const ready = new Promise((resolve, reject) => {
    child.on("message", msg => {
      events.push(msg);
      if (msg.type === "ready") resolve(msg);
      if (msg.type === "error") reject(new Error(msg.message));
    });
    child.once("error", reject);
    child.once("exit", code => reject(new Error("worker exited " + code + ": " + stderr)));
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
    }
  });
  child.send({ keyPath: env.keyPath, certPath: env.certPath, ...config });
  return { child, events, ...await ready, waitFor(type) {
    const known = events.find(x => x.type === type);
    if (known) return Promise.resolve(known);
    return new Promise(resolve => {
      const listener = msg => {
        if (msg.type === type) { child.off("message", listener); resolve(msg); }
      };
      child.on("message", listener);
    });
  } };
}
function grant(extra = {}) {
  return { token: "isolated-test-token-node-a-0001", senderNodeId: "node-a",
    jobId: "process-job", operationId: "op-b", tensorId: "h",
    dtype: "float32", shape: [3], expiresAt: Date.now() + 60000, ...extra };
}
function send(env, node, g, values) {
  const payload = Buffer.alloc(values.length * 4);
  values.forEach((v, i) => payload.writeFloatLE(v, i * 4));
  return sendTensorOverAuthenticatedChannel({
    channel: createHttpsTensorSender({ endpoint: node.endpoint, localNodeId: g.senderNodeId,
      peerNodeId: node.nodeId, accessToken: g.token, sessionExpiresAt: g.expiresAt, fetchImpl: env.fetchImpl }),
    sender_node_id: g.senderNodeId, receiver_node_id: node.nodeId, tensor_id: g.tensorId,
    dtype: "float32", shape: g.shape, payload,
    context: { job_id: g.jobId, operation_id: g.operationId },
  });
}

test("one graph passes a Float32 tensor between two independent CPU worker processes", { timeout: 15000 }, async t => {
  const env = setup(t), gB = grant(), gA = grant({ senderNodeId: "node-b",
    token: "isolated-test-token-node-b-0002", operationId: "op-a", tensorId: "x" });
  const operations = [
    { operation_id: "op-a", operator: "mul_scalar", scalar: 3, dependency_ids: [],
      input_tensor_ids: ["x"], output_tensor_ids: ["h"], estimated_memory_bytes: 64 },
    { operation_id: "op-b", operator: "add_scalar", scalar: 2, dependency_ids: ["op-a"],
      input_tensor_ids: ["h"], output_tensor_ids: ["y"], estimated_memory_bytes: 64 },
  ];
  const plan = planGraph({ operations, nodes: [
    { node_id: "node-a", backends: ["cpu-a"], supported_operators: ["mul_scalar"], available_memory_bytes: 4096 },
    { node_id: "node-b", backends: ["cpu-b"], supported_operators: ["add_scalar"], available_memory_bytes: 4096 },
  ], tensorBytes: { h: 12 } });
  assert.deepEqual(plan.operations.map(x => x.node_id), ["node-a", "node-b"]);
  const b = await worker(t, env, { nodeId: "node-b", grant: gB, operator: "add_scalar",
    scalar: 2, ledgerPath: join(env.dir, "ledger-b") });
  const a = await worker(t, env, { nodeId: "node-a", grant: gA, operator: "mul_scalar",
    scalar: 3, ledgerPath: join(env.dir, "ledger-a"),
    next: { endpoint: b.endpoint, nodeId: "node-b", grant: gB } });
  assert.notEqual(a.pid, b.pid);
  assert.notEqual(a.pid, process.pid);
  await send(env, { ...a, nodeId: "node-a" }, gA, [0.1, 2, -1]);
  const executedB = await b.waitFor("executed");
  const baseline = [0.1, 2, -1].map(v => Math.fround(Math.fround(Math.fround(v) * 3) + 2));
  assert.deepEqual(executedB.output, baseline);
  assert.equal(executedB.device_kind, "cpu");
  // Restart endpoint B with the SAME durable ledger; a NEW token/message cannot
  // bypass the consumed logical stage.
  const exited = once(b.child, "exit"); b.child.kill("SIGKILL"); await exited;
  const rotated = { ...gB, token: "rotated-test-token-node-a-0003" };
  const restarted = await worker(t, env, { nodeId: "node-b", grant: rotated, operator: "add_scalar",
    scalar: 2, ledgerPath: join(env.dir, "ledger-b") });
  await assert.rejects(send(env, { ...restarted, nodeId: "node-b" }, rotated, [0.3, 6, -3]), /HTTP 409/);
  assert.equal(restarted.events.filter(x => x.type === "executed").length, 0);
  t.diagnostic(JSON.stringify({ evidence: "TWO_CPU_PROCESSES_LOOPBACK_TLS",
    worker_pids: [a.pid, b.pid], restart_replay: "CONFIRMED", physical_gpu: "NOT VERIFIED" }));
});

test("crash after durable reservation blocks execution after process restart", { timeout: 15000 }, async t => {
  const env = setup(t), g = grant(), ledgerPath = join(env.dir, "ledger-crash");
  const a = await worker(t, env, { nodeId: "node-b", grant: g, operator: "add_scalar",
    scalar: 2, ledgerPath, crashAfterReservation: true });
  const exited = once(a.child, "exit");
  await assert.rejects(send(env, { ...a, nodeId: "node-b" }, g, [3, 6, -3]));
  assert.equal((await exited)[0], 17);
  const b = await worker(t, env, { nodeId: "node-b", grant: g, operator: "add_scalar", scalar: 2, ledgerPath });
  await assert.rejects(send(env, { ...b, nodeId: "node-b" }, g, [3, 6, -3]), /HTTP 409/);
  assert.equal(b.events.filter(x => x.type === "executed").length, 0);
});

test("ledger denies duplicate stages after reopening and fails closed on incomplete claims", t => {
  const directory = mkdtempSync(join(tmpdir(), "fabric-ledger-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const claim = { localNodeId: "node-b", senderNodeId: "node-a", jobId: "j",
    operationId: "op", tensorId: "h", messageId: "msg-1", payloadSha256: "a".repeat(64) };
  const first = createFileReplayLedger({ directory });
  assert.equal(first.reserve(claim), true);
  assert.equal(createFileReplayLedger({ directory }).reserve({ ...claim, messageId: "msg-2" }), false);
  const incomplete = { ...claim, operationId: "incomplete" };
  const key = createHash("sha256").update(JSON.stringify([incomplete.localNodeId,
    incomplete.senderNodeId, incomplete.jobId, incomplete.operationId, incomplete.tensorId])).digest("hex");
  mkdirSync(join(directory, key), { mode: 0o700 });
  assert.equal(createFileReplayLedger({ directory }).reserve(incomplete), false);
  // An unwritable path must throw before a caller can invoke any backend.
  const blocked = join(directory, "not-directory");
  writeFileSync(blocked, "x");
  assert.throws(() => createFileReplayLedger({ directory: blocked }));
  assert.throws(() => createFileReplayLedger({ directory: "relative" }));
  const publicPath = join(directory, "public");
  mkdirSync(publicPath, { mode: 0o755 });
  assert.throws(() => createFileReplayLedger({ directory: publicPath }), /private/);
});

test("two receiver processes sharing a ledger atomically reserve the same stage once", { timeout: 15000 }, async t => {
  const env = setup(t), g = grant(), ledgerPath = join(env.dir, "shared-ledger");
  const config = { nodeId: "node-b", grant: g, operator: "add_scalar", scalar: 2, ledgerPath };
  const a = await worker(t, env, config), b = await worker(t, env, config);
  const result = await Promise.allSettled([
    send(env, { ...a, nodeId: "node-b" }, g, [3, 6, -3]),
    send(env, { ...b, nodeId: "node-b" }, g, [3, 6, -3]),
  ]);
  assert.equal(result.filter(r => r.status === "fulfilled").length, 1);
  const failed = result.find(r => r.status === "rejected");
  assert.match(failed.reason.message, /HTTP 409/);
  const winner = result[0].status === "fulfilled" ? a : b;
  await winner.waitFor("executed");
  assert.equal([...a.events, ...b.events].filter(x => x.type === "executed").length, 1);
});

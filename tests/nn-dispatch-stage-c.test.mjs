import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'models/micro-mlp/manifest.json'), 'utf8'));
const weights = readFileSync(join(root, 'models/micro-mlp/weights.f32.bin'));
const inputs = readFileSync(join(root, 'models/micro-mlp/ref-inputs.f32.bin'));
const logits = readFileSync(join(root, 'models/micro-mlp/ref-logits.f32.bin'));
const top1bin = readFileSync(join(root, 'models/micro-mlp/ref-top1.i32.bin'));
const microSrc = readFileSync(join(root, 'assets/compute-pool/nn-micro-engine.js'), 'utf8');
const busSrc = readFileSync(join(root, 'assets/compute-pool/nn-dispatch-bus.js'), 'utf8');
const dispatchHtml = readFileSync(join(root, 'aivault-compute-nn-dispatch.html'), 'utf8');
const nodeHtml = readFileSync(join(root, 'aivault-compute-nn-node.html'), 'utf8');
const stageA = readFileSync(join(root, 'aivault-compute-gemm-test.html'), 'utf8');
const stageB = readFileSync(join(root, 'aivault-compute-nn-micro-test.html'), 'utf8');
const verifyTs = readFileSync(join(root, 'supabase/functions/aivault-compute-coordinator/nn-infer-verify.ts'), 'utf8');
const accessTs = readFileSync(join(root, 'supabase/functions/aivault-compute-coordinator/task-access.ts'), 'utf8');
const indexTs = readFileSync(join(root, 'supabase/functions/aivault-compute-coordinator/index.ts'), 'utf8');

const NN_MODEL_ID = 'owned-micro-mlp-v1';
const NN_WEIGHTS_SHA256 = manifest.weights_sha256;
const NN_LOGITS_SHA256 = manifest.reference.logits_sha256;
const NN_TOP1_SHA256 = manifest.reference.top1_sha256;

function isNnInferType(type) {
  const t = String(type || '');
  return t === 'nn-infer' || t === 'micro-mlp-infer';
}

function verifyNnInferResult(task, result) {
  if (!isNnInferType(task?.type)) return false;
  const payload = task.payload || {};
  const modelId = String(payload.model_id || task.model_id || result?.model_id || '');
  if (modelId !== NN_MODEL_ID) return false;
  if (result?.neural_network !== 'micro-mlp-only') return false;
  if (result?.external_api === true || result?.llm_called === true) return false;
  if (!['WebGPU', 'CPU'].includes(result?.executed_on)) return false;
  if (result.executed_on === 'CPU' && payload.allow_cpu !== true) return false;
  if (result.executed_on === 'WebGPU' && result.gpu !== true) return false;
  if (result.verified !== true) return false;
  if (result.weights_sha256 !== NN_WEIGHTS_SHA256) return false;
  if (result.logits_sha256 !== NN_LOGITS_SHA256) return false;
  if (result.top1_sha256 !== NN_TOP1_SHA256) return false;
  if (Number(result.n) !== 100) return false;
  if (!(Number(result.max_abs_error_vs_host) <= 1e-4)) return false;
  if (!(Number(result.top1_agreement) >= 1)) return false;
  return true;
}

async function checkPoolTaskAccessMirror(task, modelAllowed) {
  // Mirrors the Stage (c) builtin branch in task-access.ts (string-asserted below).
  const ids = new Set();
  let externalArtifact = false;
  const scan = (value, depth = 0) => {
    if (!value || typeof value !== 'object') return;
    if (depth > 8) {
      externalArtifact = true;
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (/^(provider|model_url|weights_url|artifact_url|model_uri|weights|checkpoint|hf_repo|base_model|wasm_url|shader|code)$/i.test(key) && child)
        externalArtifact = true;
      if (/^(model_id|model_key|model_name|model)$/i.test(key) && typeof child === 'string' && child.trim()) ids.add(child.trim());
      if (child && typeof child === 'object') scan(child, depth + 1);
    }
  };
  scan(task);
  if (externalArtifact) return { allowed: false, reason: 'EXTERNAL_MODEL_ACCESS_CLOSED' };
  const type = String(task.type || task.task_type || 'compute').toLowerCase();
  const BUILTIN_NN = new Set(['owned-micro-mlp-v1']);
  if (ids.size === 1 && ['nn-infer', 'micro-mlp-infer'].includes(type) && BUILTIN_NN.has([...ids][0])) {
    return { allowed: true, reason: 'APPROVED_STAGE_B_MICRO_MLP' };
  }
  if (ids.size === 1) {
    try {
      return (await modelAllowed([...ids][0])) === true
        ? { allowed: true, reason: 'APPROVED_FIRST_PARTY_MODEL' }
        : { allowed: false, reason: 'MODEL_NOT_APPROVED_FOR_POOL' };
    } catch {
      return { allowed: false, reason: 'MODEL_AUTHORIZATION_UNAVAILABLE' };
    }
  }
  return { allowed: false, reason: 'MODEL_ID_REQUIRED' };
}

function loadEngines() {
  const store = new Map();
  const sandbox = {
    Float32Array,
    Int32Array,
    Uint8Array,
    Math,
    Number,
    Error,
    URLSearchParams,
    Map,
    Set,
    location: { search: '' },
    performance: { now: () => 0 },
    navigator: {},
    console,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    window: { addEventListener() {}, removeEventListener() {} },
    BroadcastChannel: class {
      constructor() {}
      postMessage() {}
      close() {}
      set onmessage(fn) {}
    },
    crypto: {
      subtle: {
        digest: async (_a, bytes) => {
          const buf = Buffer.from(bytes instanceof ArrayBuffer ? bytes : bytes);
          return createHash('sha256').update(buf).digest().buffer;
        },
      },
    },
  };
  vm.runInNewContext(microSrc, sandbox);
  vm.runInNewContext(busSrc, sandbox);
  return sandbox;
}

test('coordinator sources embed Stage (c) hooks (no new edge function)', () => {
  assert.match(verifyTs, /owned-micro-mlp-v1/);
  assert.match(verifyTs, new RegExp(NN_WEIGHTS_SHA256));
  assert.match(verifyTs, /llm_called/);
  assert.match(accessTs, /APPROVED_STAGE_B_MICRO_MLP/);
  assert.match(accessTs, /nn-infer/);
  assert.match(indexTs, /nn-infer-verify/);
  assert.match(indexTs, /verifyNnInferResult/);
  assert.match(indexTs, /NN_INFER_MODEL_NOT_WHITELISTED/);
  assert.doesNotMatch(indexTs, /groq|openai|gemini|ai-gateway/i);
});

test('manifest hashes match verifier constants', () => {
  assert.equal(createHash('sha256').update(weights).digest('hex'), NN_WEIGHTS_SHA256);
  assert.match(verifyTs, new RegExp(NN_LOGITS_SHA256));
  assert.match(verifyTs, new RegExp(NN_TOP1_SHA256));
});

test('task-access builtin allows micro MLP nn-infer without LLM RPC', async () => {
  let rpc = 0;
  const r = await checkPoolTaskAccessMirror(
    { type: 'nn-infer', model_id: NN_MODEL_ID, input_ref: 'packaged-ref-100' },
    async () => {
      rpc++;
      return false;
    }
  );
  assert.equal(r.allowed, true);
  assert.equal(r.reason, 'APPROVED_STAGE_B_MICRO_MLP');
  assert.equal(rpc, 0);
});

test('provider=groq task denied (no LLM path)', async () => {
  const r = await checkPoolTaskAccessMirror({ type: 'nn-infer', model_id: NN_MODEL_ID, provider: 'groq' }, async () => true);
  assert.equal(r.allowed, false);
});

test('local bus dispatch → CPU infer → verify PASS, zero LLM markers', () => {
  const S = loadEngines();
  const bus = S.AivaultNnDispatchBus;
  const G = S.AivaultNnMicro;
  bus.clear();
  const job = bus.enqueue({ task_id: 'nn-test-1', type: 'nn-infer', model_id: NN_MODEL_ID, allow_cpu: true });
  assert.equal(job.llm_path, false);
  assert.equal(job.external_api, false);
  assert.equal(bus.claim('node-sim-1').task_id, 'nn-test-1');

  const flat = new Float32Array(weights.buffer, weights.byteOffset, weights.byteLength / 4);
  const X = new Float32Array(inputs.buffer, inputs.byteOffset, inputs.byteLength / 4);
  const ref = new Float32Array(logits.buffer, logits.byteOffset, logits.byteLength / 4);
  const got = G.forwardFromFlat(flat, manifest.layout, X, 100);
  const abs = G.maxAbsErr(got, ref);
  assert.ok(abs <= 1e-4, String(abs));
  const pred = G.top1Rows(got, 100, 5);
  const refTop = new Int32Array(top1bin.buffer, top1bin.byteOffset, 100);
  let agree = 0;
  for (let i = 0; i < 100; i++) if (pred[i] === refTop[i]) agree++;
  assert.equal(agree, 100);

  const result = {
    model_id: NN_MODEL_ID,
    neural_network: 'micro-mlp-only',
    executed_on: 'CPU',
    gpu: false,
    verified: true,
    weights_sha256: NN_WEIGHTS_SHA256,
    inputs_sha256: manifest.reference.inputs_sha256,
    logits_sha256: NN_LOGITS_SHA256,
    top1_sha256: NN_TOP1_SHA256,
    n: 100,
    max_abs_error_vs_host: abs,
    top1_agreement: 1,
    llm_called: false,
    external_api: false,
    input_ref: 'packaged-ref-100',
  };
  assert.equal(
    verifyNnInferResult(
      { type: 'nn-infer', payload: { model_id: NN_MODEL_ID, allow_cpu: true, input_ref: 'packaged-ref-100' } },
      result
    ),
    true
  );
  bus.complete('nn-test-1', result);
  assert.equal(bus.get('nn-test-1').status, 'COMPLETED');
});

test('pages forbid LLM hosts and keep stage a/b intact', () => {
  for (const html of [dispatchHtml, nodeHtml]) {
    assert.match(html, /禁止 LLM|NOT LLM|ZERO|無 LLM|no LLM/i);
    assert.match(html, /nn-infer/);
    assert.doesNotMatch(html, /https?:\/\/[^"'\s]*(groq\.com|api\.openai|generativelanguage)/i);
  }
  assert.match(stageA, /matmul only/i);
  assert.match(stageB, /NOT Qwen/);
  assert.match(dispatchHtml, /COMPUTE_NN_DISPATCH_OFF/);
});

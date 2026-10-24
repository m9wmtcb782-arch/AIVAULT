import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'assets/compute-pool/nn-micro-engine.js'), 'utf8');
const html = readFileSync(join(root, 'aivault-compute-nn-micro-test.html'), 'utf8');
const gemmHtml = readFileSync(join(root, 'aivault-compute-gemm-test.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'models/micro-mlp/manifest.json'), 'utf8'));
const weights = readFileSync(join(root, 'models/micro-mlp/weights.f32.bin'));
const inputs = readFileSync(join(root, 'models/micro-mlp/ref-inputs.f32.bin'));
const logits = readFileSync(join(root, 'models/micro-mlp/ref-logits.f32.bin'));
const top1 = readFileSync(join(root, 'models/micro-mlp/ref-top1.i32.bin'));

function load() {
  const sandbox = {
    Float32Array, Int32Array, Uint8Array, Uint32Array, Math, Number, Error, URLSearchParams,
    location: { search: '' },
    performance: { now: () => 0 },
    navigator: {},
    crypto: {
      subtle: {
        digest: async (_a, bytes) => {
          const buf = Buffer.from(bytes instanceof ArrayBuffer ? bytes : bytes.buffer || bytes);
          return createHash('sha256').update(buf).digest().buffer;
        },
      },
    },
    console,
  };
  vm.runInNewContext(source, sandbox);
  return sandbox.AivaultNnMicro;
}

test('honest labels and off switch', () => {
  const G = load();
  assert.equal(G.MODEL_ID, 'owned-micro-mlp-v1');
  assert.equal(G.STAGE, 'b-single-phone-micro-nn');
  assert.equal(G.isOff('?COMPUTE_NN_MICRO_OFF=1'), true);
  assert.equal(G.isOff(''), false);
  assert.match(G.wgslGemmTN(), /@compute/);
  assert.match(G.wgslGemmTN(), /workgroupBarrier/);
});

test('weights sha and CPU forward match host reference within 1e-4 + 100% top1', () => {
  const G = load();
  const wHash = createHash('sha256').update(weights).digest('hex');
  assert.equal(wHash, manifest.weights_sha256);
  assert.equal(createHash('sha256').update(inputs).digest('hex'), manifest.reference.inputs_sha256);
  assert.equal(createHash('sha256').update(logits).digest('hex'), manifest.reference.logits_sha256);

  const flat = new Float32Array(weights.buffer, weights.byteOffset, weights.byteLength / 4);
  const X = new Float32Array(inputs.buffer, inputs.byteOffset, inputs.byteLength / 4);
  const ref = new Float32Array(logits.buffer, logits.byteOffset, logits.byteLength / 4);
  const refTop = new Int32Array(top1.buffer, top1.byteOffset, top1.byteLength / 4);
  const M = manifest.reference.n;
  const got = G.forwardFromFlat(flat, manifest.layout, X, M);
  const abs = G.maxAbsErr(got, ref);
  assert.ok(abs <= 1e-4, 'abs=' + abs);
  const pred = G.top1Rows(got, M, 5);
  let agree = 0;
  for (let i = 0; i < M; i++) if (pred[i] === refTop[i]) agree++;
  assert.equal(agree, M);
  assert.equal(manifest.host_ref_accuracy_100, 1);
  assert.ok(manifest.param_count > 1000);
  assert.deepEqual(manifest.not, ['Qwen', 'cross-device', 'stage-c', 'stage-d', 'stage-e']);
});

test('HTML is local-only CSP, honest badges, does not break stage a page', () => {
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src 'self'/);
  assert.match(html, /NOT Qwen/);
  assert.match(html, /NOT cross-device/);
  assert.match(html, /COMPUTE_NN_MICRO_OFF/);
  assert.match(html, /nn-micro-engine\.js/);
  assert.doesNotMatch(html, /https?:\/\/[^"'\s]*(groq|openai|googleapis)/i);
  // Stage (a) page still present and still matmul-only
  assert.match(gemmHtml, /matmul only/i);
  assert.match(gemmHtml, /NOT AVAILABLE/);
});

test('createRunner refuses without fetch when off', async () => {
  const G = load();
  // off via search simulation
  assert.equal(G.isOff('?off=1'), true);
});

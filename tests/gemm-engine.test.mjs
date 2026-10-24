import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const source = readFileSync(new URL('../assets/compute-pool/gemm-engine.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../aivault-compute-gemm-test.html', import.meta.url), 'utf8');

function load() {
  const sandbox = {
    Float32Array,
    Uint16Array,
    Uint8Array,
    Uint32Array,
    Math,
    Number,
    Error,
    URLSearchParams,
    location: { search: '' },
    crypto: {
      subtle: {
        digest: async (_algo, bytes) => {
          const buf = Buffer.from(bytes instanceof ArrayBuffer ? bytes : bytes.buffer || bytes);
          return createHash('sha256').update(buf).digest().buffer;
        },
      },
    },
    performance: { now: () => 0 },
    navigator: {},
    console,
  };
  vm.runInNewContext(source, sandbox);
  return sandbox.AivaultGemm;
}

test('engine exposes matmul-only labels, not neural network', () => {
  const G = load();
  assert.equal(G.STAGE, 'a-single-phone-gpu-matmul');
  assert.match(G.KERNEL_ID, /gemm/i);
  assert.equal(G.TILE, 16);
  assert.ok(G.wgslFp32().includes('var<workgroup>'));
  assert.ok(G.wgslFp32().includes('@compute'));
  assert.ok(G.wgslFp32().includes('workgroupBarrier'));
  assert.ok(G.wgslFp16().includes('enable f16'));
});

test('off switch reads URL flag', () => {
  const G = load();
  assert.equal(G.isOff('?COMPUTE_GEMM_OFF=1'), true);
  assert.equal(G.isOff('?off=1'), true);
  assert.equal(G.isOff(''), false);
});

test('deterministic fill matches across runs and cpu matmul is finite', () => {
  const G = load();
  const n = 64;
  const A = G.fillMatrix(n, 42, 0);
  const B = G.fillMatrix(n, 42, 1);
  const A2 = G.fillMatrix(n, 42, 0);
  assert.deepEqual(Array.from(A), Array.from(A2));
  const C = G.cpuMatmul(A, B, n);
  assert.equal(C.length, n * n);
  assert.ok(C.every((v) => Number.isFinite(v)));
  // Identity-ish sanity: C not all zeros for nonzero A,B
  assert.ok(G.maxAbsErr(C, new Float32Array(n * n)) > 0);
});

test('cpu matmul agrees with naive triple loop within fround noise for tiny n', () => {
  const G = load();
  const n = 32;
  const A = G.fillMatrix(n, 7, 0);
  const B = G.fillMatrix(n, 7, 1);
  const C = G.cpuMatmul(A, B, n);
  const ref = new Float32Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s = Math.fround(s + Math.fround(A[i * n + k] * B[k * n + j]));
      ref[i * n + j] = s;
    }
  }
  // Association differs (ikj vs ijk) — allow small abs error, still << stage tol 1e-3 for n=32
  assert.ok(G.maxAbsErr(C, ref) < 1e-5);
});

test('createRunner refuses without WebGPU', async () => {
  const G = load();
  await assert.rejects(G.createRunner(), /WebGPU/);
});

test('HTML page is local-only CSP and honest about NN', () => {
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src 'self'/);
  assert.match(html, /NOT AVAILABLE/);
  assert.match(html, /matmul only/i);
  assert.match(html, /COMPUTE_GEMM_OFF/);
  assert.match(html, /PerformanceObserver/);
  // Blocklist may name forbidden hosts; page must not call them as endpoints.
  assert.doesNotMatch(html, /https?:\/\/[^"'\s]*(groq|openai|googleapis|openrouter)/i);
  assert.match(html, /assets\/compute-pool\/gemm-engine\.js/);
});

test('WGSL is tiled 16 and not a fake timer stub', () => {
  const G = load();
  const code = G.wgslFp32();
  assert.match(code, /@workgroup_size\(16,\s*16/);
  assert.match(code, /tileA/);
  assert.match(code, /tileB/);
  assert.doesNotMatch(code, /setTimeout|fake|Math\.random/);
});

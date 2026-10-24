/* AIVAULT Stage (b): micro MLP inference with REAL loaded weights.
 * owned-micro-mlp-v1: 64->48->32->5, ReLU, fp32.
 * Paths: WebGPU (preferred) or CPU JS Float32 — labeled honestly.
 * NOT Qwen. NOT cross-device. Off: ?COMPUTE_NN_MICRO_OFF=1
 */
(function (global) {
  'use strict';

  const MODEL_ID = 'owned-micro-mlp-v1';
  const STAGE = 'b-single-phone-micro-nn';
  const ARCH = [64, 48, 32, 5];
  const LOGITS_ABS_TOL = 1e-4;
  const BASE = 'models/micro-mlp/';

  function isOff(search) {
    const q = new URLSearchParams(search || (typeof location !== 'undefined' ? location.search : ''));
    if (q.get('COMPUTE_NN_MICRO_OFF') === '1' || q.get('off') === '1') return true;
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('COMPUTE_NN_MICRO_OFF') === '1') return true;
    } catch (_) {}
    return false;
  }

  async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function maxAbsErr(a, b) {
    let m = 0;
    for (let i = 0; i < a.length; i++) {
      const d = Math.abs(a[i] - b[i]);
      if (d > m) m = d;
    }
    return m;
  }

  function reluInPlace(x) {
    for (let i = 0; i < x.length; i++) if (x[i] < 0) x[i] = 0;
    return x;
  }

  /** Y[m,n] = X[m,k] @ W[n,k]^T effectively: W is [n,k] row-major, X is [m,k]. */
  function cpuLinear(X, M, K, W, N, bias) {
    const Y = new Float32Array(M * N);
    for (let m = 0; m < M; m++) {
      for (let n = 0; n < N; n++) {
        let s = bias ? bias[n] : 0;
        const wRow = n * K;
        const xRow = m * K;
        for (let k = 0; k < K; k++) {
          s = Math.fround(s + Math.fround(X[xRow + k] * W[wRow + k]));
        }
        Y[m * N + n] = s;
      }
    }
    return Y;
  }

  function top1Rows(logits, M, N) {
    const out = new Int32Array(M);
    for (let m = 0; m < M; m++) {
      let best = 0;
      let bestV = logits[m * N];
      for (let n = 1; n < N; n++) {
        const v = logits[m * N + n];
        if (v > bestV) {
          bestV = v;
          best = n;
        }
      }
      out[m] = best;
    }
    return out;
  }

  function parseParams(flat, layout) {
    const by = {};
    for (const e of layout) {
      by[e.name] = flat.subarray(e.offset_floats, e.offset_floats + e.count);
    }
    return by;
  }

  function cpuForward(params, X, M) {
    // W1 [48,64], b1[48], W2[32,48], b2[32], W3[5,32], b3[5]
    let h = cpuLinear(X, M, 64, params.W1, 48, params.b1);
    reluInPlace(h);
    h = cpuLinear(h, M, 48, params.W2, 32, params.b2);
    reluInPlace(h);
    return cpuLinear(h, M, 32, params.W3, 5, params.b3);
  }

  /** Rectangular tiled GEMM: C[M,N] = A[M,K] @ B[N,K]^T  (B stored row-major as [N,K]). */
  function wgslGemmTN() {
    return `
struct Dims { M: u32, N: u32, K: u32, _pad: u32, }
@group(0) @binding(0) var<storage, read> A: array<f32>;
@group(0) @binding(1) var<storage, read> B: array<f32>;
@group(0) @binding(2) var<storage, read_write> C: array<f32>;
@group(0) @binding(3) var<uniform> dims: Dims;

const TILE: u32 = 16u;
var<workgroup> tileA: array<f32, 256>;
var<workgroup> tileB: array<f32, 256>;

@compute @workgroup_size(16, 16, 1)
fn main(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>,
) {
  let row = gid.y;
  let col = gid.x;
  var acc: f32 = 0.0;
  let numTiles = (dims.K + TILE - 1u) / TILE;
  for (var t: u32 = 0u; t < numTiles; t = t + 1u) {
    let aCol = t * TILE + lid.x;
    let bCol = t * TILE + lid.y;
    let aIdx = lid.y * TILE + lid.x;
    let bIdx = lid.y * TILE + lid.x;
    if (row < dims.M && aCol < dims.K) {
      tileA[aIdx] = A[row * dims.K + aCol];
    } else { tileA[aIdx] = 0.0; }
    // B is [N, K] — load B[col, bCol] into tileB[lid.y][lid.x] carefully:
    // thread (lid.x, lid.y) loads element for tileB row=lid.y, col=lid.x := B[col(=gid.x), k(=t*TILE+lid.y)]
    if (col < dims.N && bCol < dims.K) {
      tileB[bIdx] = B[col * dims.K + bCol];
    } else { tileB[bIdx] = 0.0; }
    workgroupBarrier();
    for (var k: u32 = 0u; k < TILE; k = k + 1u) {
      // tileA[lid.y][k] * tileB[k][lid.x]
      // tileB was stored with bIdx = lid.y * TILE + lid.x where lid.y <-> k-dim when loading B[col, t*TILE+lid.y]
      // So tileB[k][lid.x] lives at index k*TILE + lid.x
      acc = acc + tileA[lid.y * TILE + k] * tileB[k * TILE + lid.x];
    }
    workgroupBarrier();
  }
  if (row < dims.M && col < dims.N) {
    C[row * dims.N + col] = acc;
  }
}
`;
  }

  // Fix tileB indexing: when loading, thread (lx, ly) writes tileB[ly*TILE+lx] = B[col, t*TILE+ly]
  // For product we need tileB[k][lx] = B[col, t*TILE+k], which is at index k*TILE+lx — correct IF
  // the load used ly as the K index. Yes: bCol = t*TILE+lid.y, store at lid.y*TILE+lid.x.
  // Then tileB[k*TILE+lid.x] = value loaded when lid.y=k = B[col, t*TILE+k]. Good.

  function wgslBiasRelu(doRelu) {
    return `
struct P { M: u32, N: u32, do_relu: u32, _pad: u32, }
@group(0) @binding(0) var<storage, read_write> Y: array<f32>;
@group(0) @binding(1) var<storage, read> bias: array<f32>;
@group(0) @binding(2) var<uniform> p: P;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let total = p.M * p.N;
  if (i >= total) { return; }
  let n = i % p.N;
  var v = Y[i] + bias[n];
  if (p.do_relu != 0u) { v = max(v, 0.0); }
  Y[i] = v;
}
`;
  }

  async function createGpuLinear(device) {
    const gemmMod = device.createShaderModule({ code: wgslGemmTN() });
    const gemmPipe = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: gemmMod, entryPoint: 'main' },
    });
    const brMod = device.createShaderModule({ code: wgslBiasRelu(true) });
    const brPipe = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: brMod, entryPoint: 'main' },
    });

    return async function gpuLinear(X, M, K, W, N, bias, doRelu) {
      const aBytes = M * K * 4;
      const bBytes = N * K * 4;
      const cBytes = M * N * 4;
      const biasBytes = N * 4;
      const aBuf = device.createBuffer({ size: aBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      const bBuf = device.createBuffer({ size: bBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      const cBuf = device.createBuffer({
        size: cBytes,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      });
      const biasBuf = device.createBuffer({ size: biasBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      const dimsBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const pBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const readBuf = device.createBuffer({ size: cBytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      try {
        device.queue.writeBuffer(aBuf, 0, X);
        device.queue.writeBuffer(bBuf, 0, W);
        device.queue.writeBuffer(biasBuf, 0, bias);
        device.queue.writeBuffer(dimsBuf, 0, new Uint32Array([M, N, K, 0]));
        device.queue.writeBuffer(pBuf, 0, new Uint32Array([M, N, doRelu ? 1 : 0, 0]));

        const gemmGroup = device.createBindGroup({
          layout: gemmPipe.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: aBuf } },
            { binding: 1, resource: { buffer: bBuf } },
            { binding: 2, resource: { buffer: cBuf } },
            { binding: 3, resource: { buffer: dimsBuf } },
          ],
        });
        const brGroup = device.createBindGroup({
          layout: brPipe.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: cBuf } },
            { binding: 1, resource: { buffer: biasBuf } },
            { binding: 2, resource: { buffer: pBuf } },
          ],
        });

        const enc = device.createCommandEncoder();
        {
          const pass = enc.beginComputePass();
          pass.setPipeline(gemmPipe);
          pass.setBindGroup(0, gemmGroup);
          pass.dispatchWorkgroups(Math.ceil(N / 16), Math.ceil(M / 16), 1);
          pass.end();
        }
        {
          const pass = enc.beginComputePass();
          pass.setPipeline(brPipe);
          pass.setBindGroup(0, brGroup);
          pass.dispatchWorkgroups(Math.ceil((M * N) / 256), 1, 1);
          pass.end();
        }
        enc.copyBufferToBuffer(cBuf, 0, readBuf, 0, cBytes);
        device.queue.submit([enc.finish()]);
        await device.queue.onSubmittedWorkDone();
        await readBuf.mapAsync(GPUMapMode.READ);
        const out = new Float32Array(readBuf.getMappedRange().slice(0));
        readBuf.unmap();
        return out;
      } finally {
        aBuf.destroy();
        bBuf.destroy();
        cBuf.destroy();
        biasBuf.destroy();
        dimsBuf.destroy();
        pBuf.destroy();
        readBuf.destroy();
      }
    };
  }

  async function tryCreateGpu(params) {
    if (!global.navigator || !navigator.gpu) return null;
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    let info = {};
    try {
      if (typeof adapter.requestAdapterInfo === 'function') info = await adapter.requestAdapterInfo();
      else if (adapter.info) info = adapter.info;
    } catch (_) {}
    const gpuLinear = await createGpuLinear(device);

    async function gpuForward(X, M) {
      let h = await gpuLinear(X, M, 64, params.W1, 48, params.b1, true);
      h = await gpuLinear(h, M, 48, params.W2, 32, params.b2, true);
      return gpuLinear(h, M, 32, params.W3, 5, params.b3, false);
    }

    return {
      executed_on: 'WebGPU',
      gpu: true,
      adapter_info: info,
      forward: gpuForward,
      destroy() {
        try {
          device.destroy();
        } catch (_) {}
      },
    };
  }

  async function loadPack(baseUrl) {
    const base = baseUrl || BASE;
    const manRes = await fetch(base + 'manifest.json');
    if (!manRes.ok) throw new Error('manifest 載入失敗: ' + manRes.status);
    const manifest = await manRes.json();
    const [wBuf, iBuf, lBuf, tBuf] = await Promise.all([
      fetch(base + manifest.weights_file).then((r) => {
        if (!r.ok) throw new Error('weights 載入失敗');
        return r.arrayBuffer();
      }),
      fetch(base + manifest.reference.inputs_file).then((r) => {
        if (!r.ok) throw new Error('ref inputs 載入失敗');
        return r.arrayBuffer();
      }),
      fetch(base + manifest.reference.logits_file).then((r) => {
        if (!r.ok) throw new Error('ref logits 載入失敗');
        return r.arrayBuffer();
      }),
      fetch(base + manifest.reference.top1_file).then((r) => {
        if (!r.ok) throw new Error('ref top1 載入失敗');
        return r.arrayBuffer();
      }),
    ]);
    const wHash = await sha256Hex(wBuf);
    if (wHash !== manifest.weights_sha256) throw new Error('weights SHA-256 不符');
    const iHash = await sha256Hex(iBuf);
    if (iHash !== manifest.reference.inputs_sha256) throw new Error('inputs SHA-256 不符');
    const lHash = await sha256Hex(lBuf);
    if (lHash !== manifest.reference.logits_sha256) throw new Error('logits SHA-256 不符');
    const tHash = await sha256Hex(tBuf);
    if (tHash !== manifest.reference.top1_sha256) throw new Error('top1 SHA-256 不符');

    const flat = new Float32Array(wBuf);
    const params = parseParams(flat, manifest.layout);
    // ensure named views
    const named = {
      W1: params.W1,
      b1: params.b1,
      W2: params.W2,
      b2: params.b2,
      W3: params.W3,
      b3: params.b3,
    };
    return {
      manifest,
      params: named,
      inputs: new Float32Array(iBuf),
      refLogits: new Float32Array(lBuf),
      refTop1: new Int32Array(tBuf),
      weights_sha256: wHash,
    };
  }

  async function createRunner(opts) {
    if (isOff()) throw new Error('COMPUTE_NN_MICRO_OFF=1 — 已關閉');
    const pack = await loadPack(opts && opts.baseUrl);
    const M = pack.manifest.reference.n;
    const preferGpu = !opts || opts.preferGpu !== false;

    let backend = {
      executed_on: 'CPU',
      gpu: false,
      adapter_info: null,
      forward: async (X, m) => cpuForward(pack.params, X, m),
      destroy() {},
    };

    if (preferGpu) {
      try {
        const gpu = await tryCreateGpu(pack.params);
        if (gpu) backend = gpu;
      } catch (e) {
        backend.gpu_error = String(e && e.message ? e.message : e);
      }
    }

    async function runReferenceBatch() {
      const t0 = performance.now();
      const logits = await backend.forward(pack.inputs, M);
      const ms = performance.now() - t0;
      const absErr = maxAbsErr(logits, pack.refLogits);
      const pred = top1Rows(logits, M, 5);
      let agree = 0;
      for (let i = 0; i < M; i++) if (pred[i] === pack.refTop1[i]) agree++;
      const top1Rate = agree / M;
      const tol = pack.manifest.reference.tol_logits_abs || LOGITS_ABS_TOL;
      const passAbs = absErr <= tol;
      const passTop1 = top1Rate >= (pack.manifest.reference.require_top1_agreement || 1.0) - 1e-12;
      // Cross-check CPU always for honesty when GPU used
      const cpuLogits = cpuForward(pack.params, pack.inputs, M);
      const cpuAbs = maxAbsErr(cpuLogits, pack.refLogits);
      const gpuVsCpu = maxAbsErr(logits, cpuLogits);

      const report = {
        model_id: MODEL_ID,
        stage: STAGE,
        neural_network: 'micro-mlp-only',
        not: ['Qwen', 'cross-device'],
        capability: 'micro-nn-inference',
        executed_on: backend.executed_on,
        gpu: backend.gpu,
        weights_loaded: true,
        weights_sha256: pack.weights_sha256,
        param_count: pack.manifest.param_count,
        arch: ARCH,
        n: M,
        max_abs_error_vs_host: absErr,
        tol_logits_abs: tol,
        top1_agreement: top1Rate,
        host_ref_accuracy: pack.manifest.host_ref_accuracy_100,
        cpu_vs_host_abs: cpuAbs,
        device_vs_cpu_abs: gpuVsCpu,
        inference_ms_batch: ms,
        ms_per_sample: ms / M,
        adapter_info: backend.adapter_info,
        gpu_error: backend.gpu_error || null,
        external_api: false,
        verified: passAbs && passTop1,
        pass_abs: passAbs,
        pass_top1: passTop1,
      };
      if (!report.verified) {
        throw new Error(
          `校驗失敗 executed_on=${report.executed_on} maxAbs=${absErr} (≤${tol}) top1=${top1Rate}`
        );
      }
      return report;
    }

    return {
      MODEL_ID,
      STAGE,
      pack,
      backend,
      runReferenceBatch,
      cpuForward: (X, m) => cpuForward(pack.params, X, m),
      destroy() {
        backend.destroy();
      },
    };
  }

  // Node/test helpers (no fetch)
  function forwardFromFlat(flat, layout, X, M) {
    const params = parseParams(flat, layout);
    return cpuForward(
      { W1: params.W1, b1: params.b1, W2: params.W2, b2: params.b2, W3: params.W3, b3: params.b3 },
      X,
      M
    );
  }

  global.AivaultNnMicro = {
    MODEL_ID,
    STAGE,
    ARCH,
    LOGITS_ABS_TOL,
    isOff,
    sha256Hex,
    maxAbsErr,
    cpuLinear,
    cpuForward,
    top1Rows,
    loadPack,
    createRunner,
    forwardFromFlat,
    parseParams,
    wgslGemmTN,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

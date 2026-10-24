/* AIVAULT Stage (a): tiled GEMM (matmul) via WebGPU compute shaders.
 * Matmul ONLY — this is NOT a neural network. No weights, no inference.
 * Off switch: URL ?COMPUTE_GEMM_OFF=1 or ?off=1 (page refuses to run).
 * No fetched shaders/weights; no external API.
 */
(function (global) {
  'use strict';

  const TILE = 16;
  const KERNEL_ID = 'owned-tiled-gemm-v1';
  const STAGE = 'a-single-phone-gpu-matmul';
  const FP32_ABS_TOL = 1e-3;
  const FP32_REL_TOL = 1e-5;
  const FP16_ABS_TOL = 1e-1;
  const FP16_REL_TOL = 1e-2;

  function isOff(search) {
    const q = new URLSearchParams(search || (typeof location !== 'undefined' ? location.search : ''));
    if (q.get('COMPUTE_GEMM_OFF') === '1' || q.get('off') === '1') return true;
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('COMPUTE_GEMM_OFF') === '1') return true;
    } catch (_) {}
    return false;
  }

  /** Deterministic fill matching scripts/compute-gemm-cpu-ref.py */
  function fillMatrix(n, seed, which /* 0=A, 1=B */) {
    const out = new Float32Array(n * n);
    const base = (seed >>> 0) + which * 10007;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = ((i * 31 + j * 17 + base) % 2001) - 1000;
        out[i * n + j] = v / 10000;
      }
    }
    return out;
  }

  /** Naive FP32 matmul (row-major). CPU reference oracle. */
  function cpuMatmul(A, B, n) {
    const C = new Float32Array(n * n);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < n; k++) {
        const aik = A[i * n + k];
        const row = i * n;
        const brow = k * n;
        for (let j = 0; j < n; j++) {
          C[row + j] = Math.fround(C[row + j] + Math.fround(aik * B[brow + j]));
        }
      }
    }
    return C;
  }

  function maxAbsErr(got, ref) {
    let m = 0;
    for (let i = 0; i < got.length; i++) {
      const d = Math.abs(got[i] - ref[i]);
      if (d > m) m = d;
    }
    return m;
  }

  function maxRelErr(got, ref) {
    let m = 0;
    for (let i = 0; i < got.length; i++) {
      const denom = Math.max(1e-12, Math.abs(ref[i]));
      const d = Math.abs(got[i] - ref[i]) / denom;
      if (d > m) m = d;
    }
    return m;
  }

  async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /** Classic 16×16 tiled GEMM WGSL (shared memory). */
  function wgslFp32() {
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
    let bRow = t * TILE + lid.y;
    let aIdx = lid.y * TILE + lid.x;
    let bIdx = lid.y * TILE + lid.x;
    if (row < dims.M && aCol < dims.K) {
      tileA[aIdx] = A[row * dims.K + aCol];
    } else {
      tileA[aIdx] = 0.0;
    }
    if (bRow < dims.K && col < dims.N) {
      tileB[bIdx] = B[bRow * dims.N + col];
    } else {
      tileB[bIdx] = 0.0;
    }
    workgroupBarrier();
    for (var k: u32 = 0u; k < TILE; k = k + 1u) {
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

  function wgslFp16() {
    return `
enable f16;
struct Dims { M: u32, N: u32, K: u32, _pad: u32, }
@group(0) @binding(0) var<storage, read> A: array<f16>;
@group(0) @binding(1) var<storage, read> B: array<f16>;
@group(0) @binding(2) var<storage, read_write> C: array<f16>;
@group(0) @binding(3) var<uniform> dims: Dims;

const TILE: u32 = 16u;
var<workgroup> tileA: array<f16, 256>;
var<workgroup> tileB: array<f16, 256>;

@compute @workgroup_size(16, 16, 1)
fn main(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>,
) {
  let row = gid.y;
  let col = gid.x;
  var acc: f16 = 0.0h;
  let numTiles = (dims.K + TILE - 1u) / TILE;
  for (var t: u32 = 0u; t < numTiles; t = t + 1u) {
    let aCol = t * TILE + lid.x;
    let bRow = t * TILE + lid.y;
    let aIdx = lid.y * TILE + lid.x;
    let bIdx = lid.y * TILE + lid.x;
    if (row < dims.M && aCol < dims.K) {
      tileA[aIdx] = A[row * dims.K + aCol];
    } else {
      tileA[aIdx] = 0.0h;
    }
    if (bRow < dims.K && col < dims.N) {
      tileB[bIdx] = B[bRow * dims.N + col];
    } else {
      tileB[bIdx] = 0.0h;
    }
    workgroupBarrier();
    for (var k: u32 = 0u; k < TILE; k = k + 1u) {
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

  function float32ToFloat16Bits(val) {
    const f32 = new Float32Array(1);
    const u32 = new Uint32Array(f32.buffer);
    f32[0] = val;
    const x = u32[0];
    const sign = (x >>> 16) & 0x8000;
    let exp = ((x >>> 23) & 0xff) - 127 + 15;
    let mant = x & 0x7fffff;
    if (exp <= 0) {
      if (exp < -10) return sign;
      mant = (mant | 0x800000) >> (1 - exp);
      return sign | ((mant + 0x1000) >> 13);
    }
    if (exp >= 31) return sign | 0x7c00;
    return sign | (exp << 10) | ((mant + 0x1000) >> 13);
  }

  function float16BitsToFloat32(h) {
    const sign = (h & 0x8000) << 16;
    let exp = (h >> 10) & 0x1f;
    let mant = h & 0x3ff;
    const u32 = new Uint32Array(1);
    const f32 = new Float32Array(u32.buffer);
    if (exp === 0) {
      if (mant === 0) {
        u32[0] = sign;
        return f32[0];
      }
      exp = 1;
      while (!(mant & 0x400)) {
        mant <<= 1;
        exp--;
      }
      mant &= 0x3ff;
      u32[0] = sign | ((exp - 15 + 127) << 23) | (mant << 13);
      return f32[0];
    }
    if (exp === 31) {
      u32[0] = sign | 0x7f800000 | (mant << 13);
      return f32[0];
    }
    u32[0] = sign | ((exp - 15 + 127) << 23) | (mant << 13);
    return f32[0];
  }

  function toF16Bytes(f32arr) {
    const u16 = new Uint16Array(f32arr.length);
    for (let i = 0; i < f32arr.length; i++) u16[i] = float32ToFloat16Bits(f32arr[i]);
    return new Uint8Array(u16.buffer);
  }

  function fromF16Bytes(bytes) {
    const u16 = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    const out = new Float32Array(u16.length);
    for (let i = 0; i < u16.length; i++) out[i] = float16BitsToFloat32(u16[i]);
    return out;
  }

  async function createRunner() {
    if (!global.navigator || !navigator.gpu) throw new Error('沒有 WebGPU（需要 iOS 26+ / Safari 26+ 或支援的 Chrome）');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('requestAdapter 回傳 null');
    const hasF16 = adapter.features.has('shader-f16');
    const requiredFeatures = [];
    if (hasF16) requiredFeatures.push('shader-f16');
    // 16×16×2 tiles × 4 B = 2 KB workgroup storage — within default limits.
    const device = await adapter.requestDevice(
      requiredFeatures.length ? { requiredFeatures } : {}
    );
    let info = {};
    try {
      if (typeof adapter.requestAdapterInfo === 'function') info = await adapter.requestAdapterInfo();
      else if (adapter.info) info = adapter.info;
    } catch (_) {}

    const module32 = device.createShaderModule({ code: wgslFp32() });
    const pipeline32 = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: module32, entryPoint: 'main' },
    });

    let pipeline16 = null;
    if (hasF16) {
      const module16 = device.createShaderModule({ code: wgslFp16() });
      pipeline16 = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module: module16, entryPoint: 'main' },
      });
    }

    async function runOnce(n, precision) {
      if (![256, 512, 1024].includes(n)) throw new Error('尺寸僅支援 256/512/1024');
      const useF16 = precision === 'fp16';
      if (useF16 && !pipeline16) throw new Error('此裝置不支援 shader-f16');
      const pipeline = useF16 ? pipeline16 : pipeline32;
      const A = fillMatrix(n, 42, 0);
      const B = fillMatrix(n, 42, 1);
      const ref = cpuMatmul(A, B, n);

      const bytesPer = useF16 ? 2 : 4;
      const matBytes = n * n * bytesPer;
      const aBuf = device.createBuffer({ size: matBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      const bBuf = device.createBuffer({ size: matBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      const cBuf = device.createBuffer({ size: matBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
      const uBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const readBuf = device.createBuffer({ size: matBytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });

      try {
        if (useF16) {
          device.queue.writeBuffer(aBuf, 0, toF16Bytes(A));
          device.queue.writeBuffer(bBuf, 0, toF16Bytes(B));
        } else {
          device.queue.writeBuffer(aBuf, 0, A);
          device.queue.writeBuffer(bBuf, 0, B);
        }
        device.queue.writeBuffer(uBuf, 0, new Uint32Array([n, n, n, 0]));

        const group = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: aBuf } },
            { binding: 1, resource: { buffer: bBuf } },
            { binding: 2, resource: { buffer: cBuf } },
            { binding: 3, resource: { buffer: uBuf } },
          ],
        });

        const wg = Math.ceil(n / TILE);
        const enc = device.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, group);
        pass.dispatchWorkgroups(wg, wg, 1);
        pass.end();
        enc.copyBufferToBuffer(cBuf, 0, readBuf, 0, matBytes);

        const t0 = performance.now();
        device.queue.submit([enc.finish()]);
        await device.queue.onSubmittedWorkDone();
        await readBuf.mapAsync(GPUMapMode.READ);
        const raw = readBuf.getMappedRange().slice(0);
        readBuf.unmap();
        const elapsed = performance.now() - t0;

        let got;
        if (useF16) {
          got = fromF16Bytes(new Uint8Array(raw));
        } else {
          got = new Float32Array(raw);
        }

        const absErr = maxAbsErr(got, ref);
        const relErr = maxRelErr(got, ref);
        const absTol = useF16 ? FP16_ABS_TOL : FP32_ABS_TOL;
        const relTol = useF16 ? FP16_REL_TOL : FP32_REL_TOL;
        const passAbs = absErr <= absTol;
        const passRel = relErr <= relTol;
        const ok = passAbs || passRel;
        if (!ok) {
          throw new Error(
            `GEMM 校驗失敗 (${precision} n=${n}): maxAbs=${absErr} (≤${absTol}) maxRel=${relErr} (≤${relTol})`
          );
        }

        const flops = 2 * n * n * n;
        const gflops = flops / (elapsed / 1000) / 1e9;
        const hash = await sha256Hex(raw);

        return {
          kernel: KERNEL_ID,
          stage: STAGE,
          neural_network: 'NOT_AVAILABLE',
          capability: 'matmul-only',
          n,
          precision,
          executed_on: 'WebGPU',
          gpu: true,
          verified: true,
          max_abs_error: absErr,
          max_rel_error: relErr,
          abs_tol: absTol,
          rel_tol: relTol,
          pass_abs: passAbs,
          pass_rel: passRel,
          gpu_time_ms: elapsed,
          timing_method: 'GPU completion and readback wall time; no timestamp-query; no hardware attestation',
          gflops,
          output_sha256: hash,
          adapter_info: info,
          shader_f16: hasF16,
          tile: TILE,
          external_api: false,
        };
      } finally {
        aBuf.destroy();
        bBuf.destroy();
        cBuf.destroy();
        uBuf.destroy();
        readBuf.destroy();
      }
    }

    return {
      engine: 'WebGPU',
      kernel: KERNEL_ID,
      stage: STAGE,
      neural_network: 'NOT_AVAILABLE',
      shader_f16: hasF16,
      adapter_info: info,
      adapter_limits: {
        maxBufferSize: adapter.limits.maxBufferSize,
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxComputeWorkgroupStorageSize: adapter.limits.maxComputeWorkgroupStorageSize,
        maxComputeWorkgroupSizeX: adapter.limits.maxComputeWorkgroupSizeX,
        maxComputeWorkgroupSizeY: adapter.limits.maxComputeWorkgroupSizeY,
      },
      runOnce,
      async runSuite({ sizes = [256, 512, 1024], repeats = 5, tryFp16 = true } = {}) {
        const results = [];
        for (const n of sizes) {
          const hashes = [];
          let last = null;
          for (let r = 0; r < repeats; r++) {
            last = await runOnce(n, 'fp32');
            hashes.push(last.output_sha256);
            results.push({ ...last, repeat: r });
          }
          const hashConsistent = hashes.every((h) => h === hashes[0]);
          if (!hashConsistent) throw new Error(`fp32 n=${n} 五次 output hash 不一致`);
          last.hash_consistent_5x = true;

          if (tryFp16 && hasF16) {
            try {
              const f16 = await runOnce(n, 'fp16');
              results.push({ ...f16, repeat: 0 });
            } catch (e) {
              results.push({
                n,
                precision: 'fp16',
                executed_on: 'WebGPU',
                verified: false,
                error: String(e && e.message ? e.message : e),
                neural_network: 'NOT_AVAILABLE',
              });
            }
          }
        }
        return results;
      },
      destroy() {
        try {
          device.destroy();
        } catch (_) {}
      },
    };
  }

  global.AivaultGemm = {
    TILE,
    KERNEL_ID,
    STAGE,
    FP32_ABS_TOL,
    FP32_REL_TOL,
    FP16_ABS_TOL,
    FP16_REL_TOL,
    isOff,
    fillMatrix,
    cpuMatmul,
    maxAbsErr,
    maxRelErr,
    wgslFp32,
    wgslFp16,
    createRunner,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

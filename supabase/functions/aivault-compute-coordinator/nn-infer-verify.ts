/** Stage (c) server-side check for micro-mlp nn-infer results.
 * Recomputes nothing heavy: compares reported hashes to host-packaged Stage (b) constants.
 * NOT an LLM path. NOT Qwen. NOT cross-device.
 */
export const NN_INFER_TYPES = ['nn-infer', 'micro-mlp-infer'] as const;
export const NN_MODEL_ID = 'owned-micro-mlp-v1';
export const NN_WEIGHTS_SHA256 =
  'f8de02eb5d7d26b0ff3ec8ec283e43404b500fac095806e0c6290cb7ab68f2bd';
export const NN_LOGITS_SHA256 =
  'e493c536431ed909c4b4e4a7c60532659dc1f06a35db8289501ce219a2a7dc55';
export const NN_TOP1_SHA256 =
  '252528e7ffa2483bebb2948f1e52ada414e9a73970a7d852e198a8b5984aee9b';
export const NN_INPUTS_SHA256 =
  'afb6c2934c4177aaa7964a967d557303c1ded3eed466fe7aaf9072677dea4336';
export const NN_REF_N = 100;
export const NN_LOGITS_ABS_TOL = 1e-4;

export function isNnInferType(type: unknown): boolean {
  const t = String(type || '');
  return t === 'nn-infer' || t === 'micro-mlp-infer';
}

export function verifyNnInferResult(task: any, result: any): boolean {
  try {
    if (!isNnInferType(task?.type)) return false;
    const payload = task.payload || {};
    const modelId = String(payload.model_id || task.model_id || result?.model_id || '');
    if (modelId !== NN_MODEL_ID) return false;
    if (result?.neural_network !== 'micro-mlp-only') return false;
    if (result?.external_api === true) return false;
    if (result?.llm_called === true) return false;
    if (!['WebGPU', 'CPU'].includes(result?.executed_on)) return false;
    // Stage (c) success prefers WebGPU; CPU results are accepted only if payload.allow_cpu === true
    if (result.executed_on === 'CPU' && payload.allow_cpu !== true) return false;
    if (result.executed_on === 'WebGPU' && result.gpu !== true) return false;
    if (result.verified !== true) return false;
    if (result.weights_sha256 !== NN_WEIGHTS_SHA256) return false;
    if (result.inputs_sha256 && result.inputs_sha256 !== NN_INPUTS_SHA256) return false;
    if (result.logits_sha256 !== NN_LOGITS_SHA256) return false;
    if (result.top1_sha256 !== NN_TOP1_SHA256) return false;
    if (Number(result.n) !== NN_REF_N) return false;
    if (!(Number(result.max_abs_error_vs_host) <= NN_LOGITS_ABS_TOL)) return false;
    if (!(Number(result.top1_agreement) >= 1)) return false;
    if (result.input_ref && result.input_ref !== 'packaged-ref-100' && payload.input_ref && payload.input_ref !== result.input_ref) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

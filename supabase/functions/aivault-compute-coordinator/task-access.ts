// Server-side policy: only approved, tested first-party models may use the pool.
// Fixed AIVAULT arithmetic benchmarks remain available for pool validation.
export async function checkPoolTaskAccess(task: Record<string, unknown>, modelAllowed: (id: string) => Promise<boolean>) {
  const ids = new Set<string>();
  let externalArtifact = false;
  const scan = (value: unknown, depth = 0) => {
    if (!value || typeof value !== 'object') return;
    if (depth > 8) { externalArtifact = true; return; }
    for (const [key, child] of Object.entries(value)) {
      if (/^(provider|model_url|weights_url|artifact_url|model_uri|weights|checkpoint|hf_repo|base_model|wasm_url|shader|code)$/i.test(key) && child) externalArtifact = true;
      if (/^(model_id|model_key|model_name|model)$/i.test(key) && typeof child === 'string' && child.trim()) ids.add(child.trim());
      if (child && typeof child === 'object') scan(child, depth + 1);
    }
  };
  scan(task);
  if (externalArtifact) return { allowed: false, reason: 'EXTERNAL_MODEL_ACCESS_CLOSED' };
  if (ids.size > 1) return { allowed: false, reason: 'MODEL_REFERENCE_MISMATCH' };
  if (ids.size === 1) {
    try {
      return await modelAllowed([...ids][0]) === true
        ? { allowed: true, reason: 'APPROVED_FIRST_PARTY_MODEL' }
        : { allowed: false, reason: 'MODEL_NOT_APPROVED_FOR_POOL' };
    } catch { return { allowed: false, reason: 'MODEL_AUTHORIZATION_UNAVAILABLE' }; }
  }
  const type = String(task.type || task.task_type || 'compute').toLowerCase();
  return ['compute', 'compute_test', 'webgpu-compute', 'gpu-u32-mix'].includes(type)
    ? { allowed: true, reason: 'FIXED_POOL_VALIDATION' }
    : { allowed: false, reason: 'MODEL_ID_REQUIRED' };
}

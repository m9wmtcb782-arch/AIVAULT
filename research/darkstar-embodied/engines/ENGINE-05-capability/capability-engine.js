/**
 * ENGINE-05｜Capability & Affordance（開發中）
 * 第一期：委派 ENGINE-02 canPerform；後續可加路徑規劃／碰撞預檢。
 */
export const CAPABILITY_ENGINE_VERSION = '0.1.0-dev';

export function createCapabilityEngine(opts = {}) {
  const body = opts.bodyAwareness;
  if (!body || typeof body.canPerform !== 'function') {
    throw new Error('ENGINE-05 requires bodyAwareness.canPerform');
  }

  function canPerform(action, context) {
    const result = body.canPerform(action, context);
    return {
      ...result,
      engine: 'ENGINE-05',
      version: CAPABILITY_ENGINE_VERSION,
      // Explicit state vocabulary for ENGINE-10
      intentState: result.can ? '能做' : '無法執行'
    };
  }

  function explain(action, context) {
    const r = canPerform(action, context);
    return {
      action,
      can: r.can,
      domain: r.domain,
      reason: r.reason,
      checks: r.checks,
      note: '動畫完成 ≠ 現實任務完成；僅虛擬域可改虛擬物件狀態'
    };
  }

  return {
    version: CAPABILITY_ENGINE_VERSION,
    canPerform,
    explain
  };
}

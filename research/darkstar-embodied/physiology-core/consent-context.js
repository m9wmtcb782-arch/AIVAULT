/**
 * 情境判斷與同意閘｜親密相關輸出須過閘
 * 不刪除生理槽位；同意／安全不得當任意降低真實度的藉口
 */
export const CONSENT_CONTEXT_VERSION = '0.1.0-dev';

/**
 * @typedef {object} ConsentContext
 * @property {boolean} [userPresent]
 * @property {boolean} [mutualConsent]
 * @property {boolean} [safeMode]
 * @property {boolean} [privacyOk]
 * @property {string} [scene]
 * @property {string[]} [disallowedActs]
 */

/**
 * @param {Partial<ConsentContext>} [seed]
 */
export function createConsentContext(seed = {}) {
  let ctx = {
    userPresent: seed.userPresent !== false,
    mutualConsent: !!seed.mutualConsent,
    safeMode: seed.safeMode !== false,
    privacyOk: seed.privacyOk !== false,
    scene: seed.scene || 'lab',
    disallowedActs: Array.isArray(seed.disallowedActs) ? [...seed.disallowedActs] : []
  };

  function update(patch = {}) {
    ctx = { ...ctx, ...patch };
    if (Array.isArray(patch.disallowedActs)) {
      ctx.disallowedActs = [...patch.disallowedActs];
    }
    return get();
  }

  function get() {
    return { ...ctx, disallowedActs: [...ctx.disallowedActs] };
  }

  /**
   * 閘門：生理槽位可讀；親密相關「行為輸出」須通過。
   * @param {string} outputKind  e.g. 'read_state' | 'intimacy_expression' | 'intimacy_motor'
   * @param {object} [detail]
   */
  function gate(outputKind, detail = {}) {
    const base = {
      schema: 'aivault.darkstar.consent_gate.v0.1',
      version: CONSENT_CONTEXT_VERSION,
      outputKind,
      allowed: false,
      reason: '',
      context: get(),
      physiologySlotsPreserved: true,
      note: '同意閘約束輸出行為，不刪除狀態向量槽位'
    };

    if (outputKind === 'read_state' || outputKind === 'physiology_read') {
      return { ...base, allowed: true, reason: '狀態讀取一律允許（含 pending_research 槽）' };
    }

    if (!ctx.privacyOk) {
      return { ...base, reason: 'privacy_blocked' };
    }

    const intimacyKinds = new Set([
      'intimacy_expression',
      'intimacy_motor',
      'intimacy_speech',
      'intimacy_related_output'
    ]);

    if (intimacyKinds.has(outputKind)) {
      if (!ctx.userPresent) {
        return { ...base, reason: 'user_not_present' };
      }
      if (!ctx.mutualConsent) {
        return { ...base, reason: 'mutual_consent_required' };
      }
      if (ctx.disallowedActs.includes(detail.act || outputKind)) {
        return { ...base, reason: 'act_disallowed_by_policy' };
      }
      // safeMode 可要求額外確認，但不刪槽、不強制把動機槽歸零
      if (ctx.safeMode && detail.requireExplicitConfirm && !detail.explicitConfirm) {
        return { ...base, reason: 'safe_mode_needs_explicit_confirm' };
      }
      return { ...base, allowed: true, reason: 'consent_ok' };
    }

    // 一般運動／表情／語言
    if (ctx.safeMode && detail.forceUnsafe === true) {
      return { ...base, reason: 'safe_mode_blocks_force_unsafe' };
    }
    return { ...base, allowed: true, reason: 'general_output_ok' };
  }

  return { update, get, gate, version: CONSENT_CONTEXT_VERSION };
}

/**
 * Skill Gate｜虛擬經驗 vs 實體技能啟用閘
 * 實體技能預設 locked；須安全校準＋實測驗證＋授權
 */
export const SKILL_GATE_VERSION = '0.1.0-dev';
export const SKILL_GATE_STATUS = '開發中';

/**
 * @param {object} [partial]
 */
export function createSkillRecord(partial = {}) {
  const domain = partial.domain === 'hardware' ? 'hardware' : 'virtual';
  return {
    id: partial.id || 'skill_unnamed',
    domain,
    label: partial.label || partial.id || 'unnamed',
    virtualValidated: !!partial.virtualValidated,
    hardwareEnabled: domain === 'hardware' ? false : !!partial.hardwareEnabled,
    locked: domain === 'hardware' ? partial.locked !== false : !!partial.locked,
    requiresCalibration: partial.requiresCalibration !== false,
    evidence: partial.evidence || null,
    disclaimer: '技能閘｜虛擬經驗≠實體已啟用'
  };
}

/**
 * @param {{ skills?: object[] }} [opts]
 */
export function createSkillGate(opts = {}) {
  /** @type {Map<string, object>} */
  const skills = new Map();

  function register(partial) {
    const s = createSkillRecord(partial);
    // hardware always starts locked/disabled unless explicitly unlocked later
    if (s.domain === 'hardware') {
      s.locked = true;
      s.hardwareEnabled = false;
    }
    skills.set(s.id, s);
    return { ...s };
  }

  for (const s of opts.skills || []) register(s);

  function get(id) {
    const s = skills.get(id);
    return s ? { ...s } : null;
  }

  function list() {
    return [...skills.values()].map((s) => ({ ...s }));
  }

  /** Mark virtual training validated (does NOT enable hardware). */
  function markVirtualValidated(id, evidence = null) {
    const s = skills.get(id);
    if (!s) return { ok: false, reason: 'unknown_skill' };
    s.virtualValidated = true;
    s.evidence = evidence || s.evidence;
    skills.set(id, s);
    return { ok: true, skill: { ...s } };
  }

  /**
   * Attempt to enable hardware skill — default deny.
   * @param {string} id
   * @param {{ calibrated?: boolean, realWorldValidated?: boolean, authorized?: boolean }} proof
   */
  function tryEnableHardware(id, proof = {}) {
    const s = skills.get(id);
    if (!s) return { ok: false, reason: 'unknown_skill' };
    if (s.domain !== 'hardware') {
      return { ok: false, reason: 'not_hardware_skill', note: '虛擬技能無需 hardware enable' };
    }
    if (!proof.calibrated || !proof.realWorldValidated || !proof.authorized) {
      return {
        ok: false,
        reason: 'hardware_still_locked',
        required: ['calibrated', 'realWorldValidated', 'authorized'],
        got: proof,
        skill: { ...s }
      };
    }
    s.locked = false;
    s.hardwareEnabled = true;
    s.evidence = { ...(s.evidence || {}), hardwareProof: proof, at: Date.now() };
    skills.set(id, s);
    return { ok: true, skill: { ...s }, note: '實體技能已啟用（呼叫端須確保實測證據真實）' };
  }

  function canExecute(id, target = 'virtual') {
    const s = skills.get(id);
    if (!s) return { can: false, reason: 'unknown_skill' };
    if (target === 'virtual') {
      return {
        can: s.domain === 'virtual' || s.virtualValidated,
        reason: s.virtualValidated || s.domain === 'virtual' ? 'ok' : 'virtual_not_validated'
      };
    }
    if (target === 'hardware') {
      if (s.locked || !s.hardwareEnabled) {
        return { can: false, reason: 'hardware_locked' };
      }
      return { can: true, reason: 'ok' };
    }
    return { can: false, reason: 'bad_target' };
  }

  return {
    version: SKILL_GATE_VERSION,
    status: SKILL_GATE_STATUS,
    register,
    get,
    list,
    markVirtualValidated,
    tryEnableHardware,
    canExecute,
    createSkillRecord
  };
}

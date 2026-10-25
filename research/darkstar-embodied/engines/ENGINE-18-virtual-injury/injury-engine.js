/**
 * ENGINE-18｜Virtual Injury & Trauma Engine（開發中）
 * 傷害程度僅由虛擬物理條件與明確規則決定。
 */
import {
  evaluateInjuryFromPhysics,
  rejectDialogueOnlyInjury,
  INJURY_RULES_VERSION
} from './injury-rules.js';

export const INJURY_ENGINE_VERSION = '0.1.0-dev';
export const INJURY_STATUS = '開發中';
export const DISCLAIMER =
  '虛擬創傷模擬｜非真實醫學狀態；不得宣稱 AI 真正受傷或出血';

function uid() {
  return `inj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createInjuryEngine(opts = {}) {
  /** @type {Map<string, object>} id → injury */
  const injuries = new Map();

  /**
   * @param {object} input
   * @param {object} [input.sensation]
   * @param {object} [input.collision]
   * @param {boolean} [input.fromDialogueOnly] if true → reject
   */
  function applyFromPhysics(input = {}) {
    if (input.fromDialogueOnly) {
      return rejectDialogueOnlyInjury(input.reason);
    }
    const evaluated = evaluateInjuryFromPhysics(input);
    if (!evaluated) {
      return { ok: true, injury: null, note: '物理參數未達傷害閾值' };
    }
    const id = uid();
    const record = {
      id,
      schema: 'aivault.darkstar.injury.v0.1',
      engine: 'ENGINE-18',
      version: INJURY_ENGINE_VERSION,
      disclaimer: DISCLAIMER,
      ts: Date.now(),
      status: 'active', // active | healing | healed
      recoveryProgress: 0,
      sensationId: input.sensation && input.sensation.id,
      simulated: true,
      ...evaluated
    };
    injuries.set(id, record);
    if (opts.onInjury) opts.onInjury(record);
    return { ok: true, injury: record };
  }

  function listActive() {
    return [...injuries.values()].filter((i) => i.status === 'active' || i.status === 'healing');
  }

  function get(id) {
    return injuries.get(id) || null;
  }

  function updateInjury(id, patch) {
    const cur = injuries.get(id);
    if (!cur) return null;
    const next = { ...cur, ...patch, tsUpdated: Date.now() };
    injuries.set(id, next);
    return next;
  }

  function getMobilityRestrictions() {
    const restrict = new Set();
    const sides = { L: false, R: false };
    let postureBias = null;
    let cannotLift = false;
    for (const inj of listActive()) {
      const m = inj.mobilityImpact || {};
      (m.restrictActions || []).forEach((a) => restrict.add(a));
      if (m.side === 'L') sides.L = true;
      if (m.side === 'R') sides.R = true;
      if (m.postureBias) postureBias = m.postureBias;
      if (m.cannotLift) cannotLift = true;
    }
    return {
      restrictActions: [...restrict],
      injuredSides: sides,
      postureBias,
      cannotLift,
      activeInjuryCount: listActive().length
    };
  }

  function reset() {
    injuries.clear();
  }

  return {
    version: INJURY_ENGINE_VERSION,
    status: INJURY_STATUS,
    disclaimer: DISCLAIMER,
    rulesVersion: INJURY_RULES_VERSION,
    applyFromPhysics,
    rejectDialogueOnlyInjury,
    listActive,
    get,
    updateInjury,
    getMobilityRestrictions,
    reset,
    _all: () => [...injuries.values()]
  };
}

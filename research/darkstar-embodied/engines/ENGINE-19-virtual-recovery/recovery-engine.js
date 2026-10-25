/**
 * ENGINE-19｜Virtual Recovery & Healing Engine（開發中）
 * 可調模擬時間尺度；不得把真實醫學復原時間當成經驗證 AI 生理事實。
 */
export const RECOVERY_ENGINE_VERSION = '0.1.0-dev';
export const RECOVERY_STATUS = '開發中';
export const DISCLAIMER =
  '虛擬復原模擬｜時間尺度可調；非真實人體醫學復原驗證';

/** Base simulated ms to heal by kind at timeScale=1 */
const BASE_HEAL_MS = {
  erythema: 4000,
  abrasion: 8000,
  bruise: 12000,
  burn: 20000,
  bleeding: 15000,
  joint_injury: 25000,
  fracture: 40000
};

export function createRecoveryEngine(opts = {}) {
  let timeScale = opts.timeScale != null ? opts.timeScale : 10; // default accelerated
  let fatigue = 0;
  let resting = false;
  const tracked = new Map(); // injuryId → { startedAtSim, healMs }

  function setTimeScale(s) {
    timeScale = Math.max(0.01, Number(s) || 1);
  }

  function getTimeScale() {
    return timeScale;
  }

  function setResting(v) {
    resting = !!v;
    if (resting) fatigue = Math.max(0, fatigue - 0.05);
  }

  function registerInjury(injury) {
    if (!injury || !injury.id) return;
    const base = BASE_HEAL_MS[injury.kind] || 10000;
    const sev = injury.severity != null ? injury.severity : 0.5;
    tracked.set(injury.id, {
      injuryId: injury.id,
      kind: injury.kind,
      healMs: base * (0.5 + sev),
      progress: injury.recoveryProgress || 0,
      erythema: (injury.visual && injury.visual.erythema) || 0,
      bruise: (injury.visual && injury.visual.bruise) || 0,
      abrasion: (injury.visual && injury.visual.abrasion) || 0,
      simElapsed: 0
    });
  }

  /**
   * Advance recovery.
   * @param {number} realDtMs wall-clock delta
   * @param {object} injuryEngine ENGINE-18 instance
   */
  function tick(realDtMs, injuryEngine) {
    const simDt = realDtMs * timeScale * (resting ? 1.4 : 1);
    const results = [];
    for (const [id, t] of tracked) {
      t.simElapsed += simDt;
      t.progress = Math.min(1, t.simElapsed / t.healMs);
      t.erythema = Math.max(0, t.erythema * (1 - 0.15 * (simDt / 1000)));
      t.bruise = Math.max(0, t.bruise * (1 - 0.08 * (simDt / 1000)));
      t.abrasion = Math.max(0, t.abrasion * (1 - 0.1 * (simDt / 1000)));

      const status = t.progress >= 1 ? 'healed' : 'healing';
      if (injuryEngine && injuryEngine.updateInjury) {
        const patch = {
          status,
          recoveryProgress: t.progress,
          visual: {
            ...(injuryEngine.get(id) && injuryEngine.get(id).visual),
            erythema: t.erythema,
            bruise: t.bruise,
            abrasion: t.abrasion,
            bleeding: status === 'healed' ? false : (injuryEngine.get(id)?.visual?.bleeding || false)
          }
        };
        if (status === 'healed') {
          patch.mobilityImpact = {
            limb: injuryEngine.get(id)?.mobilityImpact?.limb,
            side: injuryEngine.get(id)?.mobilityImpact?.side,
            restrictActions: [],
            postureBias: null,
            cannotLift: false
          };
        }
        injuryEngine.updateInjury(id, patch);
      }
      results.push({ injuryId: id, progress: t.progress, status, visual: { erythema: t.erythema, bruise: t.bruise, abrasion: t.abrasion } });
      if (status === 'healed') tracked.delete(id);
    }
    // mild fatigue from activity unless resting
    if (!resting) fatigue = Math.min(1, fatigue + realDtMs * 0.00001);
    else fatigue = Math.max(0, fatigue - realDtMs * 0.00005);
    return { results, fatigue, resting, timeScale, simDt };
  }

  /** Fast-forward one injury to target progress (tests) */
  function advanceInjury(injuryId, progress, injuryEngine) {
    const t = tracked.get(injuryId);
    if (!t) return null;
    t.progress = Math.min(1, progress);
    t.simElapsed = t.healMs * t.progress;
    return tick(0, injuryEngine);
  }

  function getState() {
    return {
      timeScale,
      fatigue,
      resting,
      tracking: [...tracked.values()],
      disclaimer: DISCLAIMER
    };
  }

  function reset() {
    tracked.clear();
    fatigue = 0;
    resting = false;
  }

  return {
    version: RECOVERY_ENGINE_VERSION,
    status: RECOVERY_STATUS,
    disclaimer: DISCLAIMER,
    setTimeScale,
    getTimeScale,
    setResting,
    registerInjury,
    tick,
    advanceInjury,
    getState,
    reset,
    BASE_HEAL_MS
  };
}

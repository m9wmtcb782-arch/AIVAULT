/**
 * ENGINE-22｜Sensory Memory & Protective Behavior（開發中）
 * 記錄刺激／痛覺／傷害／恢復／動作限制；供 ENGINE-02 canPerform／ENGINE-03 讀取。
 * 例：虛擬骨折臂 → 不可 lift_heavy。
 */
export const SENSORY_MEMORY_VERSION = '0.1.0-dev';
export const SENSORY_MEMORY_STATUS = '開發中';
export const DISCLAIMER = '虛擬感覺記憶｜模擬狀態；非真實主觀體驗檔案';

/** Actions that require intact arm strength */
const ARM_LOAD_ACTIONS = new Set([
  'lift_heavy',
  'wave',
  'hold_virtual_eraser',
  'erase_virtual_blackboard'
]);

export function createSensoryMemory(opts = {}) {
  const stimuli = [];
  const dangerLog = [];
  const injuryIds = new Set();
  const avoidStimuli = new Set(); // e.g. 'temperature:hot'
  let injuryEngine = opts.injuryEngine || null;
  let lastReflex = null;

  function bindInjuryEngine(eng) {
    injuryEngine = eng;
  }

  function recordStimulus(sensation, extra = {}) {
    const entry = {
      ts: sensation.ts || Date.now(),
      region: sensation.region,
      type: sensation.type,
      source: sensation.source,
      virtualPain: sensation.virtualPain || 0,
      temperatureC: sensation.temperatureC,
      sensationId: sensation.id,
      ...extra
    };
    stimuli.push(entry);
    if (stimuli.length > 500) stimuli.shift();
    if ((sensation.heat || 0) >= 0.5) avoidStimuli.add('temperature:hot');
    if ((sensation.cold || 0) >= 0.5) avoidStimuli.add('temperature:cold');
    if (opts.onRecord) opts.onRecord(entry);
    return entry;
  }

  function recordReflex(reflex) {
    lastReflex = reflex;
  }

  function recordInjury(injury) {
    if (injury && injury.id) injuryIds.add(injury.id);
  }

  /**
   * Danger / protection memory — not expression-only.
   * Fed by sensory-nerve-bus nociception + injury dual-write adapter.
   */
  function recordDanger(entry) {
    if (!entry) return null;
    const row = {
      ...entry,
      ts: entry.ts || Date.now(),
      notExpressionOnly: true,
      feedsProtection: entry.feedsProtection !== false
    };
    dangerLog.push(row);
    if (dangerLog.length > 200) dangerLog.shift();
    if ((entry.intensity || 0) >= 0.5 && entry.modality === 'nociception') {
      avoidStimuli.add('temperature:hot');
    }
    if (opts.onDanger) opts.onDanger(row);
    return row;
  }

  function getDangerLog(limit = 50) {
    return dangerLog.slice(-limit);
  }

  function getMotionRestrictions() {
    const fromInjury = injuryEngine
      ? injuryEngine.getMobilityRestrictions()
      : { restrictActions: [], cannotLift: false, injuredSides: { L: false, R: false }, postureBias: null, activeInjuryCount: 0 };
    return {
      ...fromInjury,
      avoidStimuli: [...avoidStimuli],
      lastReflex,
      recentStimuli: stimuli.slice(-10)
    };
  }

  /**
   * Gate for ENGINE-02 / ENGINE-05 / ENGINE-03
   * @returns {{ blocked: boolean, reason?: string, restrictions: object }}
   */
  function blocksAction(action, context = {}) {
    const r = getMotionRestrictions();
    const act = action;
    if (r.restrictActions.includes(act) || (r.cannotLift && act === 'lift_heavy')) {
      return {
        blocked: true,
        reason: `ENGINE-22：虛擬傷害限制動作 ${act}（activeInjuries=${r.activeInjuryCount}）`,
        restrictions: r
      };
    }
    // side-specific: wave with fractured R arm
    if (ARM_LOAD_ACTIONS.has(act)) {
      const side = context.side || 'R';
      if ((side === 'R' && r.injuredSides.R) || (side === 'L' && r.injuredSides.L)) {
        if (r.cannotLift || r.restrictActions.includes(act) || r.restrictActions.includes('wave')) {
          return {
            blocked: true,
            reason: `ENGINE-22：${side}側手臂虛擬受傷，無法執行 ${act}`,
            restrictions: r
          };
        }
      }
    }
    if (context.stimulusType === 'temperature' && context.temperatureC >= 55 && avoidStimuli.has('temperature:hot')) {
      return {
        blocked: true,
        reason: 'ENGINE-22：記憶避開同類高溫刺激',
        restrictions: r
      };
    }
    return { blocked: false, restrictions: r };
  }

  function getState() {
    return {
      schema: 'aivault.darkstar.sensory_memory.v0.1',
      version: SENSORY_MEMORY_VERSION,
      disclaimer: DISCLAIMER,
      stimulusCount: stimuli.length,
      dangerCount: dangerLog.length,
      injuryIds: [...injuryIds],
      restrictions: getMotionRestrictions(),
      recent: stimuli.slice(-20),
      recentDanger: dangerLog.slice(-20)
    };
  }

  function reset() {
    stimuli.length = 0;
    dangerLog.length = 0;
    injuryIds.clear();
    avoidStimuli.clear();
    lastReflex = null;
  }

  return {
    version: SENSORY_MEMORY_VERSION,
    status: SENSORY_MEMORY_STATUS,
    disclaimer: DISCLAIMER,
    bindInjuryEngine,
    recordStimulus,
    recordReflex,
    recordInjury,
    recordDanger,
    getDangerLog,
    getMotionRestrictions,
    blocksAction,
    getState,
    reset
  };
}

/**
 * 最小動態系統｜多狀態耦合＋時間連續
 * 非最終臨床模型；approximation／hypothesis 見 evidence-tiers
 */
import { createStateVector } from './state-vector.js';
import { assertNoFalseBiologicalClaims, listEvidenceCatalog } from './evidence-tiers.js';
import { createConsentContext } from './consent-context.js';

export const PHYSIO_DYNAMICS_VERSION = '0.1.0-dev';

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

/**
 * @param {{ individualSeed?: number, consent?: object, overrides?: object }} [opts]
 */
export function createPhysiologyCore(opts = {}) {
  const state = createStateVector({
    individualSeed: opts.individualSeed,
    overrides: opts.overrides
  });
  const consent = opts.consent || createConsentContext(opts.consentSeed || {});
  let lastStimuli = null;
  let stepCount = 0;

  /**
   * @param {number} dtSec
   * @param {object} [stimuli]
   * @param {number} [stimuli.nociception] 突發痛覺輸入 0..1
   * @param {number} [stimuli.thermal] -1..1
   * @param {number} [stimuli.touchPressure]
   * @param {number} [stimuli.socialStress]
   * @param {number} [stimuli.rest] 休息／睡眠恢復強度 0..1
   * @param {number} [stimuli.alcoholIntakeBac] 增量 BAC
   * @param {number} [stimuli.illnessPulse]
   * @param {number} [stimuli.affectValenceDelta]
   * @param {number} [stimuli.affectArousalDelta]
   */
  function step(dtSec, stimuli = {}) {
    const dt = Math.max(0, Number(dtSec) || 0);
    stepCount += 1;
    lastStimuli = { ...stimuli };
    state.advanceSimTime(dt);

    // —— 外源刺激寫入 ——
    if (stimuli.nociception != null) {
      state.set('nociception', Math.max(state.get('nociception'), clamp01(stimuli.nociception)));
    }
    if (stimuli.thermal != null) {
      state.set('thermalComfort', Math.max(-1, Math.min(1, stimuli.thermal)));
    }
    if (stimuli.touchPressure != null) {
      state.set('touchPressure', clamp01(stimuli.touchPressure));
    }
    if (stimuli.alcoholIntakeBac != null) {
      state.set('bac', state.get('bac') + Math.max(0, stimuli.alcoholIntakeBac));
    }
    if (stimuli.illnessPulse != null) {
      state.set('illnessLoad', clamp01(state.get('illnessLoad') + clamp01(stimuli.illnessPulse)));
    }
    if (stimuli.affectValenceDelta != null) {
      state.set('affectValence', state.get('affectValence') + stimuli.affectValenceDelta);
    }
    if (stimuli.affectArousalDelta != null) {
      state.set('affectArousal', state.get('affectArousal') + stimuli.affectArousalDelta);
    }
    if (stimuli.socialStress != null) {
      state.set('stress', clamp01(state.get('stress') + clamp01(stimuli.socialStress) * 0.2));
    }

    // —— 疲勞累積／恢復（近似）——
    const rest = clamp01(stimuli.rest || 0);
    const wakeLoad = (1 - rest) * (0.01 + state.get('stress') * 0.02 + state.get('illnessLoad') * 0.015);
    state.set('fatigue', state.get('fatigue') + wakeLoad * dt - rest * 0.05 * dt);
    state.set('sleepDebt', state.get('sleepDebt') + (1 - rest) * 0.008 * dt - rest * 0.04 * dt);

    // —— BAC 緩慢消除（Widmark-like 極簡）——
    const elim = 0.015 * dt; // 約每小時單位尺度需外部校準；此處 dt 為秒時係數偏工程示意
    // 為測試可觀測：以「每秒極小消除」＋允許測試用加速係數
    const bacElimPerSec = 0.00005;
    state.set('bac', Math.max(0, state.get('bac') - bacElimPerSec * dt));

    // —— 痛覺自然衰減 ——
    state.set('nociception', state.get('nociception') * Math.exp(-0.3 * dt));

    // —— 創傷／復原耦合 ——
    if (state.get('nociception') > 0.6) {
      state.set('injuryLoad', clamp01(state.get('injuryLoad') + 0.05 * dt));
    }
    state.set('healingProgress', clamp01(state.get('healingProgress') + (0.01 - state.get('injuryLoad') * 0.02) * dt));
    state.set('injuryLoad', clamp01(state.get('injuryLoad') - 0.005 * dt * state.get('healingProgress')));

    // —— 多狀態耦合 → 神經／運動相關輸出槽 ——
    const fatigue = state.get('fatigue');
    const sleepDebt = state.get('sleepDebt');
    const bac = state.get('bac');
    const pain = state.get('nociception');
    const illness = state.get('illnessLoad');
    const injury = state.get('injuryLoad');

    const impair =
      clamp01(fatigue * 0.45 + sleepDebt * 0.25 + bac * 4.0 + pain * 0.2 + illness * 0.25 + injury * 0.2);

    state.set('alertness', clamp01(1 - impair * 0.9));
    state.set('attention', clamp01(0.95 - impair * 0.85 - state.get('stress') * 0.1));
    state.set('reactionSpeed', clamp01(0.95 - impair * 0.9));
    state.set('gazeFocus', clamp01(0.95 - impair * 0.8 - bac * 3));
    state.set('eyelidDroop', clamp01(fatigue * 0.7 + sleepDebt * 0.4 + illness * 0.2));
    state.set('coordination', clamp01(0.95 - bac * 4 - fatigue * 0.3 - injury * 0.25));
    state.set('balance', clamp01(0.95 - bac * 4.5 - fatigue * 0.25));
    state.set('muscleTone', clamp01(0.55 + state.get('affectArousal') * 0.2 - fatigue * 0.25 - bac * 1.5));
    state.set('headPostureControl', clamp01(0.95 - impair * 0.85));
    state.set('comfort', clamp01(0.9 - pain * 0.6 - Math.abs(state.get('thermalComfort')) * 0.3 - fatigue * 0.2));
    state.set('virtualHealth', clamp01(1 - illness * 0.5 - injury * 0.35 - bac * 2));
    state.set('relaxation', clamp01(state.get('relaxation') * 0.99 + (1 - state.get('affectArousal')) * 0.01 + rest * 0.02));

    // 意識代理：嚴重損害時下降（危急閘）
    const criticalImpair = bac > 0.25 || (fatigue > 0.92 && sleepDebt > 0.85) || pain > 0.95;
    if (criticalImpair) {
      state.set('consciousness', clamp01(state.get('consciousness') - 0.15 * dt));
    } else {
      state.set('consciousness', clamp01(state.get('consciousness') + 0.05 * dt));
    }

    // 週期相位：連續緩慢推進（個體差異已在種子；禁止寫死日期→固定情緒）
    // pending_research：僅示意相位移動，不驅動固定情緒腳本
    const phase = state.get('cyclePhase');
    state.set('cyclePhase', (phase + 0.00001 * dt) % 1);

    // intimacy 相關槽：本骨架不套固定劇本；僅允許極弱的自然衰減／刺激占位
    // 真正動力學 = pending_research
    state.set('sexualArousal', state.get('sexualArousal') * Math.exp(-0.05 * dt));
    state.set('intimacyMotivation', clamp01(state.get('intimacyMotivation'))); // 保持槽位，不因「方便」歸零刪除

    void elim; // 保留註解用變數語意
    return readSnapshot();
  }

  function derivedGates() {
    const c = state.get('consciousness');
    const critical = c < 0.35 || state.get('bac') > 0.25;
    const fatigue = state.get('fatigue');
    const reactionSpeed = state.get('reactionSpeed');
    const eyelidDroop = state.get('eyelidDroop');
    // 禁：疲倦眼神 + 全速反應
    const tiredEyesFullSpeedForbidden =
      eyelidDroop > 0.35 ? reactionSpeed <= Math.max(0, 1 - fatigue) + 1e-6 : true;

    return {
      critical,
      allowWalk: !critical && c >= 0.45 && state.get('balance') > 0.25,
      allowComplexAutonomy: !critical && c >= 0.5,
      allowTalk: c >= 0.4,
      reactionDelayMs: Math.round((1 - reactionSpeed) * 800),
      tiredEyesFullSpeedForbidden,
      forbidTiredEyesFullSpeed: eyelidDroop > 0.35
    };
  }

  function readSnapshot() {
    const snap = state.snapshot();
    const gates = derivedGates();
    const out = {
      ...snap,
      dynamicsVersion: PHYSIO_DYNAMICS_VERSION,
      stepCount,
      simTimeSec: state.getSimTime(),
      lastStimuli,
      gates,
      evidenceCatalog: listEvidenceCatalog(),
      consent: consent.get()
    };
    assertNoFalseBiologicalClaims(out);
    return out;
  }

  /**
   * 對外效應器讀取（供 E-15／16／03 等適配）
   * 親密相關「行為輸出」另走 consent.gate
   */
  function getEffectors() {
    const g = derivedGates();
    return {
      blinkRateMul: 1 + state.get('eyelidDroop') * 1.5,
      eyelidDroop: state.get('eyelidDroop'),
      gazeSaccadeScale: state.get('gazeFocus'),
      reactionDelayMs: g.reactionDelayMs,
      headSway: (1 - state.get('headPostureControl')) * 0.5 + state.get('bac') * 2,
      headDroop: state.get('eyelidDroop') * 0.6,
      allowWalk: g.allowWalk,
      allowComplexAutonomy: g.allowComplexAutonomy,
      allowTalk: g.allowTalk,
      critical: g.critical,
      muscleTone: state.get('muscleTone'),
      coordination: state.get('coordination'),
      balance: state.get('balance')
    };
  }

  /**
   * @param {string} outputKind
   * @param {object} [detail]
   */
  function gateOutput(outputKind, detail) {
    return consent.gate(outputKind, detail);
  }

  function safeReset(level = 'soft') {
    if (level === 'hard') {
      // 重建預設（測試模式）
      const fresh = createPhysiologyCore({
        individualSeed: opts.individualSeed,
        consentSeed: consent.get(),
        overrides: opts.overrides
      });
      return fresh;
    }
    state.set('bac', 0);
    state.set('nociception', 0);
    state.set('consciousness', 1);
    state.set('fatigue', 0.15);
    state.set('eyelidDroop', 0.05);
    return readSnapshot();
  }

  return {
    version: PHYSIO_DYNAMICS_VERSION,
    state,
    consent,
    step,
    readSnapshot,
    getEffectors,
    gateOutput,
    safeReset,
    listPendingResearch: () => state.listPendingResearch(),
    assertIntegrity: () => state.assertIntegrity()
  };
}

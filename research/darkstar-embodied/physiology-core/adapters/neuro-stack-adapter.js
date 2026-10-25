/**
 * Formal adapter｜ENGINE-23～27 neuro-physio-stack → Physiology Core
 *
 * Source of truth: physiology-core (state-vector + dynamics)
 * Legacy sleep/alcohol engines remain as specialized input models;
 * their outputs are dual-written into the core, then effectors/gates
 * are read back from the core (避免雙真相).
 *
 * pending_research slots are never deleted.
 */
import { createPhysiologyCore } from '../dynamics.js';

export const NEURO_STACK_ADAPTER_VERSION = '0.1.0-dev';
export const NEURO_STACK_ADAPTER_STATUS = '開發中';
export const SOURCE_OF_TRUTH = 'physiology-core';

function clamp(v, a = 0, b = 1) {
  return Math.max(a, Math.min(b, Number.isFinite(v) ? v : a));
}

/**
 * Push specialized engine outputs into the core (write path).
 * @param {ReturnType<typeof createPhysiologyCore>} core
 * @param {{ sleep?: object, alcohol?: object, illnessLoad?: number, painLoad?: number }} src
 */
export function syncEnginesIntoCore(core, src = {}) {
  const sp = src.sleep || {};
  const al = src.alcohol || {};
  const st = core.state;

  if (sp.fatigue != null) st.set('fatigue', clamp(sp.fatigue));
  if (sp.sleepDebt01 != null) st.set('sleepDebt', clamp(sp.sleepDebt01));
  if (sp.eyelidDroop != null) st.set('eyelidDroop', clamp(sp.eyelidDroop));

  if (al.bac != null) st.set('bac', Math.max(0, al.bac));

  if (src.illnessLoad != null) st.set('illnessLoad', clamp(src.illnessLoad));
  if (src.painLoad != null) st.set('nociception', clamp(Math.max(st.get('nociception'), src.painLoad)));

  // Critical intoxication → lower consciousness proxy (continuous)
  if (al.criticalIntoxication) {
    st.set('consciousness', Math.min(st.get('consciousness'), 0.28));
  }

  // Resync derived channels without advancing simulated wall dynamics
  core.step(0, {});
  return core.readSnapshot();
}

/**
 * Map continuous consciousness + alcohol band → legacy label.
 */
export function mapConsciousnessLabel(coreSnap, alcohol = {}) {
  const c = coreSnap.slots.consciousness.value;
  const bac = coreSnap.slots.bac.value;
  const fatigue = coreSnap.slots.fatigue.value;
  if (c <= 0.08 || bac >= 0.38) return 'coma';
  if (coreSnap.gates.critical || alcohol.criticalIntoxication || c < 0.35 || bac >= 0.25) return 'critical';
  if (bac >= 0.12 || (alcohol.band && alcohol.band !== 'sober' && alcohol.band !== 'mild')) {
    return 'intoxicated';
  }
  if (c < 0.55 || fatigue >= 0.65) return 'drowsy';
  return 'awake';
}

/**
 * Project core effectors into ENGINE-23 getEffectorModifiers() shape.
 */
export function projectCoreToEffectors(core, alcohol = {}) {
  const snap = core.readSnapshot();
  const eff = core.getEffectors();
  const label = mapConsciousnessLabel(snap, alcohol);
  const fatigue = snap.slots.fatigue.value;
  const wakefulness = snap.slots.alertness.value;
  const critical = eff.critical || label === 'critical' || label === 'coma';

  return {
    gazeSaccadeScale: eff.gazeSaccadeScale,
    blinkRateMul: eff.blinkRateMul,
    eyelidDroop: eff.eyelidDroop,
    headSway: eff.headSway,
    headDroop: eff.headDroop,
    reactionDelayMs: eff.reactionDelayMs,
    handPrecision: clamp(eff.coordination * eff.muscleTone),
    gaitStability: clamp(eff.balance * eff.coordination),
    allowWalk: critical || label === 'coma' ? false : eff.allowWalk,
    allowTalk: label === 'coma' ? false : eff.allowTalk,
    allowComplexAutonomy: critical ? false : eff.allowComplexAutonomy,
    yawnHint: fatigue >= 0.6 || label === 'drowsy',
    tiredExpression: fatigue >= 0.45 || snap.slots.gazeFocus.value < 0.5,
    // adapter metadata
    _sourceOfTruth: SOURCE_OF_TRUTH,
    _adapterVersion: NEURO_STACK_ADAPTER_VERSION
  };
}

/**
 * Overlay neuro getState() fields from core (keep disclaimer / schema).
 */
export function projectCoreOntoNeuroState(neuroState, core, alcohol = {}) {
  const snap = core.readSnapshot();
  const label = mapConsciousnessLabel(snap, alcohol);
  return {
    ...neuroState,
    fatigue: snap.slots.fatigue.value,
    wakefulness: snap.slots.alertness.value,
    attention: snap.slots.attention.value,
    reactionSpeed: snap.slots.reactionSpeed.value,
    coordination: snap.slots.coordination.value,
    balance: snap.slots.balance.value,
    muscleTone: snap.slots.muscleTone.value,
    gazeFocus: snap.slots.gazeFocus.value,
    headPostureControl: snap.slots.headPostureControl.value,
    virtualHealth: snap.slots.virtualHealth.value,
    consciousness: label,
    physiologyCoreSimTimeSec: snap.simTimeSec,
    sourceOfTruth: SOURCE_OF_TRUTH
  };
}

/**
 * Apply core gates onto ENGINE-26 coupling bundle (hard bans).
 */
export function applyCoreGatesToCoupling(bundle, core, alcohol = {}) {
  const snap = core.readSnapshot();
  const eff = core.getEffectors();
  const label = mapConsciousnessLabel(snap, alcohol);
  const critical = eff.critical || label === 'critical' || label === 'coma';
  const out = {
    ...bundle,
    consciousness: label,
    critical,
    sourceOfTruth: SOURCE_OF_TRUTH
  };
  out.locomotion = {
    ...bundle.locomotion,
    allowWalk: critical || label === 'coma' ? false : !!eff.allowWalk && bundle.locomotion.allowWalk !== false
  };
  out.behavior = {
    ...bundle.behavior,
    allowTalk: label === 'coma' ? false : !!eff.allowTalk,
    allowComplexAutonomy: critical ? false : !!eff.allowComplexAutonomy,
    reactionDelayMs: eff.reactionDelayMs
  };
  if (label === 'coma') {
    out.locomotion.allowWalk = false;
    out.behavior.allowTalk = false;
    out.behavior.allowComplexAutonomy = false;
    out.gaze = { ...bundle.gaze, trackingScale: 0 };
  }
  return out;
}

/**
 * Create a Physiology Core bound for neuro-stack use.
 */
export function createCoreForNeuroStack(opts = {}) {
  return createPhysiologyCore({
    individualSeed: opts.individualSeed != null ? opts.individualSeed : 23,
    overrides: opts.overrides
  });
}

/**
 * Full sync cycle used by neuro-physio-stack.recomputeAll
 */
export function dualWriteRecompute(ctx) {
  const { core, sleep, alcohol, neuro, coupling, illnessLoad, painLoad } = ctx;
  const sp = sleep.getState();
  const al = alcohol.getImpairment();

  syncEnginesIntoCore(core, {
    sleep: sp,
    alcohol: al,
    illnessLoad,
    painLoad
  });

  // Legacy neuro recompute keeps label path / modulators for callers that
  // still invoke stack.neuro.recompute directly; effectors then overridden.
  const stRaw = neuro.recompute({
    fatigue: sp.fatigue,
    sleepDebt: sp.sleepDebt01,
    alcoholImpairment: al.impairment01,
    criticalIntoxication: al.criticalIntoxication,
    illnessLoad,
    painLoad
  });

  const st = projectCoreOntoNeuroState(stRaw, core, al);

  let effectors = projectCoreToEffectors(core, al);
  // Enforce forbid tired eyes + full speed (core already couples; belt-and-suspenders)
  if (sp.forbidTiredEyesFullSpeed && effectors.reactionDelayMs < 80 && effectors.eyelidDroop > 0.35) {
    effectors = { ...effectors, reactionDelayMs: Math.max(effectors.reactionDelayMs, 120) };
  }

  let bundle = coupling.sync(st, effectors);
  bundle = applyCoreGatesToCoupling(bundle, core, al);

  const physiology = core.readSnapshot();
  return {
    neuro: st,
    sleep: sp,
    alcohol: al,
    coupling: bundle,
    effectors,
    physiology,
    sourceOfTruth: SOURCE_OF_TRUTH,
    adapter: {
      version: NEURO_STACK_ADAPTER_VERSION,
      status: NEURO_STACK_ADAPTER_STATUS,
      pendingResearchCount: physiology.pendingResearchCount
    }
  };
}

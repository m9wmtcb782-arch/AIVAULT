/**
 * Realtime bridge: ENGINE-23～27 → ENGINE-15／16／03（開發中）
 * Physiology Core = source of truth（經 neuro-physio-stack 雙寫適配）。
 * 同一 Shared Body Core；非第二套暗星；非 MP4。
 */
export const REALTIME_NEURO_COUPLING_VERSION = '0.2.0-dev';
export const REALTIME_NEURO_STATUS = '開發中';

/**
 * @param {object} opts
 * @param {object} opts.stack createNeuroPhysioStack()
 * @param {object} [opts.gaze] createGazeEngine()
 * @param {object} [opts.head] createHeadNeckController()
 * @param {object} [opts.motor] createMotorController()
 */
export function createRealtimeNeuroCoupling(opts = {}) {
  const stack = opts.stack;
  if (!stack) throw new Error('realtime coupling requires neuro physio stack');
  const gaze = opts.gaze || null;
  const head = opts.head || null;
  const motor = opts.motor || null;
  let last = null;
  let frames = 0;

  /**
   * Pull stack state (core SoT via adapter) and push modifiers into gaze/head/motor.
   */
  function syncFromStack() {
    frames++;
    const snap = stack.recomputeAll();
    const eff = snap.effectors;
    const bundle = snap.coupling;
    // Prefer live core effectors if stack exposes physiologyCore (belt-and-suspenders)
    let coreEff = null;
    if (stack.physiologyCore && typeof stack.physiologyCore.getEffectors === 'function') {
      coreEff = stack.physiologyCore.getEffectors();
    }

    const reactionDelayMs =
      coreEff && coreEff.reactionDelayMs != null ? coreEff.reactionDelayMs : eff.reactionDelayMs;

    const gazeMod = {
      blinkRateMul: eff.blinkRateMul,
      eyelidDroop: coreEff && coreEff.eyelidDroop != null ? coreEff.eyelidDroop : eff.eyelidDroop,
      trackingScale: eff.gazeSaccadeScale,
      gazeSaccadeScale: eff.gazeSaccadeScale,
      reactionDelayMs,
      tiredExpression: eff.tiredExpression
    };
    const headMod = {
      headSway: eff.headSway,
      headDroop: eff.headDroop,
      sway: eff.headSway,
      droop: eff.headDroop,
      control: snap.neuro.headPostureControl,
      headPostureControl: snap.neuro.headPostureControl,
      reactionDelayMs
    };
    const motorMod = {
      allowWalk: bundle.locomotion.allowWalk,
      allowTalk: bundle.behavior.allowTalk,
      allowComplexAutonomy: bundle.behavior.allowComplexAutonomy,
      reactionDelayMs: bundle.behavior.reactionDelayMs,
      consciousness: snap.neuro.consciousness,
      critical: bundle.critical
    };

    if (gaze && typeof gaze.setNeuroCoupling === 'function') {
      gaze.setNeuroCoupling(gazeMod);
    }
    if (head && typeof head.setNeuroCoupling === 'function') {
      head.setNeuroCoupling(headMod);
    }
    if (motor && typeof motor.setNeuroCoupling === 'function') {
      motor.setNeuroCoupling(motorMod, bundle);
    }

    last = {
      schema: 'aivault.darkstar.realtime_neuro_coupling.v0.2',
      version: REALTIME_NEURO_COUPLING_VERSION,
      status: REALTIME_NEURO_STATUS,
      sourceOfTruth: snap.sourceOfTruth || stack.sourceOfTruth || 'physiology-core',
      ts: Date.now(),
      frames,
      consciousness: snap.neuro.consciousness,
      fatigue: snap.neuro.fatigue,
      reactionDelayMs,
      gazeFocus: snap.neuro.gazeFocus,
      reactionSpeed: snap.neuro.reactionSpeed,
      tiredEyesFullSpeedForbidden:
        (gazeMod.eyelidDroop > 0.35 || snap.sleep.forbidTiredEyesFullSpeed) &&
        snap.neuro.reactionSpeed <= snap.neuro.gazeFocus + 0.15 + 1e-6,
      applied: {
        gaze: gaze ? gazeMod : null,
        head: head ? headMod : null,
        motor: motor ? motorMod : null
      },
      gates: {
        walk: motorMod.allowWalk,
        talk: motorMod.allowTalk,
        complex: motorMod.allowComplexAutonomy
      },
      alcoholBand: snap.alcohol.band,
      physiologyPendingResearch: snap.physiology
        ? snap.physiology.pendingResearchCount
        : null,
      disclaimer: '虛擬模擬｜瀏覽器即時耦合｜Physiology Core SoT｜開發中'
    };
    return last;
  }

  function getLast() {
    return last;
  }

  function tryWalk() {
    syncFromStack();
    if (!motor || !motor.requestAction) {
      return { ok: false, reason: 'no_motor' };
    }
    return motor.requestAction('walk_to');
  }

  function tryTalk() {
    syncFromStack();
    if (!motor || !motor.requestAction) {
      return { ok: false, reason: 'no_motor' };
    }
    return motor.requestAction('talk');
  }

  function tryComplex() {
    syncFromStack();
    if (!motor || !motor.requestAction) {
      return { ok: false, reason: 'no_motor' };
    }
    return motor.requestAction('complex_autonomy');
  }

  return {
    version: REALTIME_NEURO_COUPLING_VERSION,
    status: REALTIME_NEURO_STATUS,
    syncFromStack,
    getLast,
    tryWalk,
    tryTalk,
    tryComplex,
    get stack() {
      return stack;
    },
    get gaze() {
      return gaze;
    },
    get head() {
      return head;
    },
    get motor() {
      return motor;
    }
  };
}

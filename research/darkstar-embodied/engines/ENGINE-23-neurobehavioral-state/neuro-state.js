/**
 * ENGINE-23｜Virtual Neurobehavioral State（開發中）
 * 清醒／注意力／疲勞／反應／協調／平衡／肌張力／眼神聚焦／頭姿／虛擬健康
 * 虛擬模擬｜非真實意識或臨床診斷
 */
export const NEURO_STATE_VERSION = '0.1.0-dev';
export const NEURO_STATUS = '開發中';
export const DISCLAIMER =
  '虛擬神經行為狀態｜不得宣稱真實意識、真實疾病或臨床中毒診斷';

function clamp(v, a = 0, b = 1) {
  return Math.max(a, Math.min(b, v));
}

const DEFAULT = () => ({
  wakefulness: 1, // 0 coma .. 1 fully awake
  attention: 1,
  fatigue: 0,
  reactionSpeed: 1, // 1 = baseline, lower = slower
  coordination: 1,
  balance: 1,
  muscleTone: 1,
  gazeFocus: 1,
  headPostureControl: 1,
  virtualHealth: 1,
  consciousness: 'awake', // awake | drowsy | asleep | intoxicated | critical | coma
  ts: Date.now()
});

export function createNeuroState(opts = {}) {
  let state = { ...DEFAULT(), ...(opts.initial || {}) };

  function getState() {
    return {
      schema: 'aivault.darkstar.neuro_state.v0.1',
      engine: 'ENGINE-23',
      version: NEURO_STATE_VERSION,
      disclaimer: DISCLAIMER,
      simulated: true,
      ...state
    };
  }

  function setPartial(patch) {
    state = { ...state, ...patch, ts: Date.now() };
    // derive consciousness label
    if (state.wakefulness <= 0.05) state.consciousness = 'coma';
    else if (state.wakefulness <= 0.25 && state.virtualHealth < 0.35) state.consciousness = 'critical';
    else if (state.wakefulness < 0.35) state.consciousness = 'asleep';
    else if (state.wakefulness < 0.55) state.consciousness = 'drowsy';
    // intoxicated may be set by alcohol engine
    return getState();
  }

  /**
   * Recompute derived channels from modulators (fatigue, alcohol, illness, pain, sleepDebt)
   */
  function recompute(mod = {}) {
    const fatigue = clamp(mod.fatigue != null ? mod.fatigue : state.fatigue);
    const alcohol = clamp(mod.alcoholImpairment != null ? mod.alcoholImpairment : 0);
    const illness = clamp(mod.illnessLoad != null ? mod.illnessLoad : 0);
    const pain = clamp(mod.painLoad != null ? mod.painLoad : 0);
    const sleepDebt = clamp(mod.sleepDebt != null ? mod.sleepDebt : 0);
    const critical = !!mod.criticalIntoxication;

    let wakefulness = clamp(1 - fatigue * 0.55 - sleepDebt * 0.35 - alcohol * 0.4 - (critical ? 0.7 : 0));
    let attention = clamp(1 - fatigue * 0.4 - alcohol * 0.55 - illness * 0.25 - sleepDebt * 0.3);
    let reactionSpeed = clamp(1 - fatigue * 0.35 - alcohol * 0.6 - sleepDebt * 0.25 - pain * 0.15);
    let coordination = clamp(1 - alcohol * 0.7 - fatigue * 0.2 - illness * 0.15);
    let balance = clamp(1 - alcohol * 0.75 - fatigue * 0.15);
    let muscleTone = clamp(1 - alcohol * 0.35 - fatigue * 0.25 - pain * 0.2);
    let gazeFocus = clamp(1 - fatigue * 0.45 - alcohol * 0.5 - sleepDebt * 0.35);
    let headPostureControl = clamp(1 - fatigue * 0.4 - alcohol * 0.55 - sleepDebt * 0.3);
    let virtualHealth = clamp(1 - illness * 0.5 - pain * 0.3 - (critical ? 0.5 : alcohol * 0.25));

    // RULE: sleep debt / high fatigue → forbid "tired eyes + full-speed reaction"
    if ((fatigue >= 0.55 || sleepDebt >= 0.5) && reactionSpeed > gazeFocus + 0.15) {
      reactionSpeed = clamp(Math.min(reactionSpeed, gazeFocus + 0.1));
    }

    let consciousness = 'awake';
    if (critical || wakefulness <= 0.08) consciousness = wakefulness <= 0.05 ? 'coma' : 'critical';
    else if (alcohol >= 0.55) consciousness = 'intoxicated';
    else if (wakefulness < 0.35) consciousness = 'asleep';
    else if (wakefulness < 0.55 || fatigue >= 0.65) consciousness = 'drowsy';

    state = {
      ...state,
      fatigue,
      wakefulness,
      attention,
      reactionSpeed,
      coordination,
      balance,
      muscleTone,
      gazeFocus,
      headPostureControl,
      virtualHealth,
      consciousness,
      modulators: { alcohol, illness, pain, sleepDebt, critical },
      ts: Date.now()
    };
    return getState();
  }

  function reset() {
    state = DEFAULT();
    return getState();
  }

  /** Motor / gaze / head consumers read this */
  function getEffectorModifiers() {
    const s = state;
    return {
      gazeSaccadeScale: clamp(s.gazeFocus),
      blinkRateMul: 1 + s.fatigue * 1.8 + (1 - s.wakefulness) * 1.2,
      eyelidDroop: clamp(s.fatigue * 0.7 + (1 - s.wakefulness) * 0.5),
      headSway: clamp((1 - s.headPostureControl) * 0.8 + (1 - s.balance) * 0.5),
      headDroop: clamp(s.fatigue * 0.6 + (s.consciousness === 'drowsy' ? 0.3 : 0)),
      reactionDelayMs: Math.round((1 - s.reactionSpeed) * 600),
      handPrecision: clamp(s.coordination * s.muscleTone),
      gaitStability: clamp(s.balance * s.coordination),
      allowWalk: s.consciousness !== 'coma' && s.consciousness !== 'critical' && s.wakefulness > 0.2,
      allowTalk: s.consciousness !== 'coma' && s.wakefulness > 0.15,
      allowComplexAutonomy: s.consciousness !== 'coma' && s.consciousness !== 'critical' && s.attention > 0.25,
      yawnHint: s.fatigue >= 0.6 || s.consciousness === 'drowsy',
      tiredExpression: s.fatigue >= 0.45 || s.gazeFocus < 0.5
    };
  }

  return {
    version: NEURO_STATE_VERSION,
    status: NEURO_STATUS,
    disclaimer: DISCLAIMER,
    getState,
    setPartial,
    recompute,
    getEffectorModifiers,
    reset
  };
}

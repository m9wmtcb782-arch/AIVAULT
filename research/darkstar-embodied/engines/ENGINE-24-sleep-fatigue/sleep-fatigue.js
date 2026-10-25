/**
 * ENGINE-24｜Sleep & Fatigue（開發中）
 * 虛擬睡眠／清醒時鐘、疲勞累積、眨眼眼皮、哈欠頭垂、休息恢復
 * 與生病／疼痛交互；睡眠不足禁「疲倦眼神＋全速反應」（由 23 recompute 強制）
 */
export const SLEEP_FATIGUE_VERSION = '0.1.0-dev';
export const SLEEP_STATUS = '開發中';
export const DISCLAIMER = '虛擬睡眠／疲勞模擬｜非真實生理睡眠醫學';

function clamp(v, a = 0, b = 1) {
  return Math.max(a, Math.min(b, v));
}

export function createSleepFatigue(opts = {}) {
  let awakeHours = opts.awakeHours != null ? opts.awakeHours : 14; // sim hours awake
  let sleepHoursDebt = opts.sleepHoursDebt != null ? opts.sleepHoursDebt : 0;
  let fatigue = opts.fatigue != null ? opts.fatigue : 0.2;
  let isSleeping = false;
  let lastSimHours = 0;

  /**
   * @param {number} simHoursDelta simulated hours advanced
   * @param {object} [ctx] { illnessLoad, painLoad, resting }
   */
  function tickHours(simHoursDelta, ctx = {}) {
    const ill = ctx.illnessLoad || 0;
    const pain = ctx.painLoad || 0;
    if (isSleeping || ctx.resting) {
      // recover
      const rate = isSleeping ? 0.35 : 0.12;
      fatigue = clamp(fatigue - simHoursDelta * rate);
      sleepHoursDebt = clamp(sleepHoursDebt - simHoursDelta * (isSleeping ? 0.9 : 0.25), 0, 24);
      if (isSleeping) awakeHours = Math.max(0, awakeHours - simHoursDelta * 0.1);
    } else {
      awakeHours += simHoursDelta;
      const baseGain = 0.04 + awakeHours * 0.002;
      fatigue = clamp(fatigue + simHoursDelta * (baseGain + ill * 0.05 + pain * 0.04));
      // sleep debt grows if awake > 16h without sleep
      if (awakeHours > 16) {
        sleepHoursDebt = clamp(sleepHoursDebt + simHoursDelta * 0.4, 0, 24);
      }
    }
    lastSimHours += simHoursDelta;
    return getState();
  }

  function startSleep() {
    isSleeping = true;
    return getState();
  }

  function wake() {
    isSleeping = false;
    awakeHours = 0.1;
    return getState();
  }

  function getState() {
    const sleepDebt01 = clamp(sleepHoursDebt / 8);
    return {
      engine: 'ENGINE-24',
      version: SLEEP_FATIGUE_VERSION,
      disclaimer: DISCLAIMER,
      simulated: true,
      isSleeping,
      awakeHours,
      sleepHoursDebt,
      sleepDebt01,
      fatigue,
      eyelidDroop: clamp(fatigue * 0.65 + sleepDebt01 * 0.4),
      blinkRateMul: 1 + fatigue * 1.5 + sleepDebt01,
      yawnHint: fatigue >= 0.55 || sleepDebt01 >= 0.45,
      headDroop: clamp(fatigue * 0.5 + (isSleeping ? 0.8 : 0)),
      tiredExpression: fatigue >= 0.4 || sleepDebt01 >= 0.35,
      // Forbidden combo signal for ENGINE-23
      forbidTiredEyesFullSpeed: fatigue >= 0.55 || sleepDebt01 >= 0.5,
      lastSimHours
    };
  }

  function setFatigue(v) {
    fatigue = clamp(v);
  }

  /** Test / persist restore */
  function hydrate(s = {}) {
    if (s.awakeHours != null) awakeHours = s.awakeHours;
    if (s.sleepHoursDebt != null) sleepHoursDebt = s.sleepHoursDebt;
    if (s.fatigue != null) fatigue = clamp(s.fatigue);
    if (typeof s.isSleeping === 'boolean') isSleeping = s.isSleeping;
  }

  function reset() {
    awakeHours = 0;
    sleepHoursDebt = 0;
    fatigue = 0.1;
    isSleeping = false;
    lastSimHours = 0;
  }

  return {
    version: SLEEP_FATIGUE_VERSION,
    status: SLEEP_STATUS,
    disclaimer: DISCLAIMER,
    tickHours,
    startSleep,
    wake,
    getState,
    setFatigue,
    hydrate,
    reset
  };
}

/**
 * ENGINE-26｜Neuro-Motor Coupling（開發中）
 * 將 ENGINE-23 狀態同步到視線／眨眼／頭頸／肩軀／步態／手精度／平衡／反應／行為選擇。
 * 危急／昏迷：禁正常走／談／複雜自主。
 */
export const NEURO_MOTOR_VERSION = '0.1.0-dev';
export const NEURO_MOTOR_STATUS = '開發中';
export const DISCLAIMER = '虛擬神經－運動耦合｜非真實神經肌肉病理';

export function createNeuroMotorCoupling(opts = {}) {
  let lastBundle = null;

  /**
   * @param {object} neuroState from ENGINE-23 getState()
   * @param {object} [effectors] from ENGINE-23 getEffectorModifiers()
   */
  function sync(neuroState, effectors) {
    const e = effectors || {};
    const c = neuroState.consciousness || 'awake';
    const critical = c === 'critical' || c === 'coma';

    const bundle = {
      engine: 'ENGINE-26',
      version: NEURO_MOTOR_VERSION,
      disclaimer: DISCLAIMER,
      ts: Date.now(),
      consciousness: c,
      critical,
      gaze: {
        trackingScale: e.gazeSaccadeScale != null ? e.gazeSaccadeScale : neuroState.gazeFocus,
        blinkRateMul: e.blinkRateMul != null ? e.blinkRateMul : 1,
        eyelidDroop: e.eyelidDroop != null ? e.eyelidDroop : 0,
        targetHoldMs: 400 + (e.reactionDelayMs || 0)
      },
      headNeck: {
        sway: e.headSway != null ? e.headSway : 0,
        droop: e.headDroop != null ? e.headDroop : 0,
        control: neuroState.headPostureControl
      },
      posture: {
        shoulderSlack: 1 - (neuroState.muscleTone || 1),
        torsoSway: e.headSway != null ? e.headSway * 0.6 : 0
      },
      locomotion: {
        gaitStability: e.gaitStability != null ? e.gaitStability : neuroState.balance,
        allowWalk: critical ? false : e.allowWalk !== false && neuroState.wakefulness > 0.2
      },
      hands: {
        precision: e.handPrecision != null ? e.handPrecision : neuroState.coordination,
        tremor: Math.max(0, 1 - (neuroState.coordination || 1)) * 0.5
      },
      behavior: {
        reactionDelayMs: e.reactionDelayMs || 0,
        allowTalk: critical && c === 'coma' ? false : e.allowTalk !== false,
        allowComplexAutonomy: critical ? false : e.allowComplexAutonomy !== false,
        yawnHint: !!e.yawnHint,
        tiredExpression: !!e.tiredExpression
      },
      // Hooks for ENGINE-15/16/03 — same Shared Body Core
      applyTo: {
        'ENGINE-15': ['gaze.trackingScale', 'gaze.blinkRateMul', 'gaze.eyelidDroop'],
        'ENGINE-16': ['headNeck.sway', 'headNeck.droop'],
        'ENGINE-03': ['locomotion', 'hands', 'behavior.reactionDelayMs', 'posture']
      }
    };

    // Hard bans in coma/critical
    if (c === 'coma') {
      bundle.locomotion.allowWalk = false;
      bundle.behavior.allowTalk = false;
      bundle.behavior.allowComplexAutonomy = false;
      bundle.gaze.trackingScale = 0;
    } else if (c === 'critical') {
      bundle.locomotion.allowWalk = false;
      bundle.behavior.allowComplexAutonomy = false;
      bundle.behavior.allowTalk = neuroState.wakefulness > 0.12;
    }

    lastBundle = bundle;
    if (opts.onSync) opts.onSync(bundle);
    return bundle;
  }

  function getLast() {
    return lastBundle;
  }

  function canPerformMotor(action, bundle) {
    const b = bundle || lastBundle;
    if (!b) return { can: true, reason: 'no coupling yet' };
    if (action === 'walk_to' && !b.locomotion.allowWalk) {
      return { can: false, reason: `ENGINE-26：consciousness=${b.consciousness} 禁止行走` };
    }
    if ((action === 'talk' || action === 'speak') && !b.behavior.allowTalk) {
      return { can: false, reason: `ENGINE-26：consciousness=${b.consciousness} 禁止談話` };
    }
    if (action === 'complex_autonomy' && !b.behavior.allowComplexAutonomy) {
      return { can: false, reason: `ENGINE-26：危急／昏迷禁止複雜自主` };
    }
    return { can: true, reason: 'ok', reactionDelayMs: b.behavior.reactionDelayMs };
  }

  return {
    version: NEURO_MOTOR_VERSION,
    status: NEURO_MOTOR_STATUS,
    disclaimer: DISCLAIMER,
    sync,
    getLast,
    canPerformMotor
  };
}

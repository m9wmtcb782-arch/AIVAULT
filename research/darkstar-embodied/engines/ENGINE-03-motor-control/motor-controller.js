/**
 * ENGINE-03 Shared Motor Controller (DEV Phase2).
 * Continuous sit / short walk / erase-reach — Shared Body Core low-level only.
 * NOT autonomous decision (ENGINE-08). NOT motor learning (ENGINE-09).
 */
import { DarkStarBodySafety } from '../../../../assets/dark-star/body-safety-layer.js';
import { tweenPose, findBoneByPatterns, JOINT_TWEEN_VERSION } from './joint-tween.js';

export const MOTOR_CONTROLLER_VERSION = '0.2.0-dev';

/** Conservative sit targets (degrees) within JOINT_LIMITS soft envelope */
const SIT_TARGETS = {
  hip: { x: 55, y: 0, z: 0 },
  knee: { x: 85, y: 0, z: 0 },
  spine: { x: 12, y: 0, z: 0 }
};

/**
 * @param {object} opts
 * @param {object} [opts.avatar]
 * @param {Array} [opts.bones]
 * @param {object} [opts.bonesByHint]
 * @param {object} [opts.safety]
 * @param {boolean} [opts.sync] force sync tweens (tests)
 */
export function createMotorController(opts = {}) {
  const safety = opts.safety || DarkStarBodySafety;
  const avatar = opts.avatar;
  const bones = opts.bones || [];
  const syncDefault = !!opts.sync;
  let busy = false;
  let lastFeedback = null;
  let sitting = false;

  /** ENGINE-26 neuro-motor gate (dev) */
  let neuroGate = {
    allowWalk: true,
    allowTalk: true,
    allowComplexAutonomy: true,
    reactionDelayMs: 0,
    consciousness: 'awake',
    critical: false
  };

  function resolveBones() {
    const hint = opts.bonesByHint || {};
    return {
      hips:
        hint.hips ||
        findBoneByPatterns(bones, [/hips?/i, /pelvis/i]),
      spine:
        hint.spine ||
        findBoneByPatterns(bones, [/spine/i, /chest/i]),
      leftUpLeg: findBoneByPatterns(bones, [/leftupleg/i, /leftupperleg/i, /left_upper_leg/i, /leftthigh/i, /l_?hip/i]),
      rightUpLeg: findBoneByPatterns(bones, [/rightupleg/i, /rightupperleg/i, /right_upper_leg/i, /rightthigh/i, /r_?hip/i]),
      leftLeg: findBoneByPatterns(bones, [/leftknee/i, /leftleg/i, /left_?lower_?leg/i, /leftshin/i, /l_?knee/i]),
      rightLeg: findBoneByPatterns(bones, [/rightknee/i, /rightleg/i, /right_?lower_?leg/i, /rightshin/i, /r_?knee/i]),
      leftArm: findBoneByPatterns(bones, [/leftarm/i, /left_?upper_?arm/i]),
      rightArm: findBoneByPatterns(bones, [/rightarm/i, /right_?upper_?arm/i])
    };
  }

  function isSitting() {
    return sitting || !!(avatar && avatar.userData && avatar.userData.sitting);
  }

  /**
   * Continuous sit — multi-frame hip/knee/spine + root Y. Not teleport.
   */
  async function sitOnChair(chair, runOpts = {}) {
    if (busy) return feedbackBlocked('motor_busy');
    if (!avatar) return feedbackBlocked('no_avatar');
    if (isSitting()) return feedbackBlocked('already_sitting');

    busy = true;
    const sync = runOpts.sync != null ? runOpts.sync : syncDefault;
    const frames = runOpts.frames || 30;
    const frameMs = runOpts.frameMs != null ? runOpts.frameMs : sync ? 0 : 16;
    const b = resolveBones();
    const standY = avatar.position.y;
    const chairPos = chair && chair.position ? chair.position : null;
    const targetX = chairPos ? chairPos.x : avatar.position.x;
    const targetZ = chairPos ? chairPos.z : avatar.position.z;
    const sitY = runOpts.sitY != null ? runOpts.sitY : Math.max(0.35, standY - 0.42);

    const joints = [];
    // Prefer side legs; fall back to hips bone only
    if (b.leftUpLeg) joints.push({ bone: b.leftUpLeg, to: { ...SIT_TARGETS.hip } });
    if (b.rightUpLeg) joints.push({ bone: b.rightUpLeg, to: { ...SIT_TARGETS.hip } });
    if (b.leftLeg) joints.push({ bone: b.leftLeg, to: { ...SIT_TARGETS.knee } });
    if (b.rightLeg) joints.push({ bone: b.rightLeg, to: { ...SIT_TARGETS.knee } });
    if (!b.leftUpLeg && !b.rightUpLeg && b.hips) {
      joints.push({ bone: b.hips, to: { ...SIT_TARGETS.hip } });
    }
    if (b.spine) joints.push({ bone: b.spine, to: { ...SIT_TARGETS.spine } });

    // If no leg bones found (mock), still tween root + synthetic bones from opts
    if (!joints.length && runOpts.mockJoints) {
      runOpts.mockJoints.forEach((j) => joints.push(j));
    }

    try {
      const tween = await tweenPose({
        joints,
        root: {
          object: avatar,
          to: { x: targetX, y: sitY, z: targetZ }
        },
        frames,
        frameMs,
        sync,
        safety,
        onFrame: runOpts.onFrame
      });

      avatar.userData = avatar.userData || {};
      avatar.userData.sitting = true;
      avatar.userData.standY = standY;
      sitting = true;

      // Prefer completed when root multi-frame succeeded; soft safety clamps ≠ failure
      const sitStatus =
        tween.uniqueRootY >= 2 && tween.ok
          ? tween.blockedCount > tween.frameCount * 0.85
            ? 'partial'
            : 'completed'
          : tween.status;
      lastFeedback = {
        agent: 'dark-star',
        schema: 'aivault.darkstar.motion_feedback.v0.1',
        skill: 'sit_on_virtual_chair',
        ts: Date.now(),
        status: sitStatus,
        ok: tween.ok && tween.uniqueRootY >= 2,
        teleport: false,
        multiFrame: true,
        frames: tween.frameCount,
        uniqueRootY: tween.uniqueRootY,
        blockedCount: tween.blockedCount,
        jointsUsed: joints.map((j) => j.bone.name || 'bone'),
        pose: { y: avatar.position.y, sitting: true },
        timelineSample: tween.timeline.filter((_, i) => i % Math.max(1, Math.floor(tween.frameCount / 5)) === 0 || i === tween.frameCount - 1),
        safety: { layer: safety.version },
        motor: MOTOR_CONTROLLER_VERSION,
        tween: JOINT_TWEEN_VERSION,
        notes: 'Phase2 continuous sit — 開發中；非完整平衡控制'
      };
      return lastFeedback;
    } finally {
      busy = false;
    }
  }

  async function standUp(runOpts = {}) {
    if (busy) return feedbackBlocked('motor_busy');
    if (!avatar) return feedbackBlocked('no_avatar');
    if (!isSitting()) return feedbackBlocked('not_sitting');
    busy = true;
    const sync = runOpts.sync != null ? runOpts.sync : syncDefault;
    const standY = (avatar.userData && avatar.userData.standY != null) ? avatar.userData.standY : 0;
    const b = resolveBones();
    const joints = [];
    [b.leftUpLeg, b.rightUpLeg, b.leftLeg, b.rightLeg, b.hips, b.spine].forEach((bone) => {
      if (bone) joints.push({ bone, to: { x: 0, y: 0, z: 0 } });
    });
    try {
      const tween = await tweenPose({
        joints,
        root: { object: avatar, to: { y: standY } },
        frames: runOpts.frames || 24,
        frameMs: sync ? 0 : 16,
        sync,
        safety
      });
      if (avatar.userData) avatar.userData.sitting = false;
      sitting = false;
      lastFeedback = {
        skill: 'stand',
        status: tween.status,
        ok: true,
        frames: tween.frameCount,
        uniqueRootY: tween.uniqueRootY,
        multiFrame: true,
        motor: MOTOR_CONTROLLER_VERSION
      };
      return lastFeedback;
    } finally {
      busy = false;
    }
  }

  /**
   * Short walk stub toward a target position (multi-frame root XZ).
   */
  async function walkToward(target, runOpts = {}) {
    if (!neuroGate.allowWalk) {
      return feedbackBlocked(`neuro_gate_walk:${neuroGate.consciousness}`);
    }
    if (busy) return feedbackBlocked('motor_busy');
    if (!avatar) return feedbackBlocked('no_avatar');
    if (isSitting()) return feedbackBlocked('cannot_walk_while_sitting');
    if (!target || (target.x == null && target.z == null)) {
      return feedbackBlocked('missing_target');
    }
    busy = true;
    const sync = runOpts.sync != null ? runOpts.sync : syncDefault;
    const from = { x: avatar.position.x, y: avatar.position.y, z: avatar.position.z };
    const to = {
      x: target.x != null ? target.x : from.x,
      y: from.y,
      z: target.z != null ? target.z : from.z
    };
    // Cap step length for stub
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const dist = Math.hypot(dx, dz);
    const maxStep = runOpts.maxStep != null ? runOpts.maxStep : 0.85;
    const scale = dist > maxStep && dist > 0 ? maxStep / dist : 1;
    const capped = {
      x: from.x + dx * scale,
      y: from.y,
      z: from.z + dz * scale
    };
    try {
      const tween = await tweenPose({
        joints: [],
        root: { object: avatar, to: capped },
        frames: runOpts.frames || 20,
        frameMs: sync ? 0 : 16,
        sync,
        safety
      });
      lastFeedback = {
        skill: 'walk_to',
        status: 'completed',
        ok: true,
        stub: true,
        multiFrame: true,
        frames: tween.frameCount,
        from,
        to: capped,
        distance: Math.hypot(capped.x - from.x, capped.z - from.z),
        notes: 'walk stub — root translation only; no foot IK yet',
        motor: MOTOR_CONTROLLER_VERSION
      };
      return lastFeedback;
    } finally {
      busy = false;
    }
  }

  /**
   * Erase virtual blackboard: optional arm reach tween + mutate board state.
   * Returns before/after diff. Physical domain must be rejected upstream (ENGINE-05).
   */
  async function eraseVirtualBlackboard(blackboardApi, runOpts = {}) {
    if (busy) return feedbackBlocked('motor_busy');
    if (!blackboardApi || typeof blackboardApi.erase !== 'function') {
      return feedbackBlocked('no_blackboard_api');
    }
    busy = true;
    const sync = runOpts.sync != null ? runOpts.sync : syncDefault;
    const before = blackboardApi.getState ? blackboardApi.getState() : { text: null };
    const b = resolveBones();
    const joints = [];
    if (b.rightArm) {
      joints.push({ bone: b.rightArm, to: { x: -25, y: 0, z: 35 } });
    }
    try {
      let reach = null;
      if (joints.length) {
        reach = await tweenPose({
          joints,
          frames: runOpts.frames || 12,
          frameMs: sync ? 0 : 16,
          sync,
          safety
        });
      }
      const after = blackboardApi.erase();
      const dirtyBefore = before.dirty === true || !!(before.text && before.text.length);
      lastFeedback = {
        skill: 'erase_virtual_blackboard',
        status: 'completed',
        ok: true,
        domain: 'virtual',
        multiFrame: !!(reach && reach.frameCount >= 2),
        reachFrames: reach ? reach.frameCount : 0,
        stateDiff: {
          before: { text: before.text, isBlank: before.isBlank, dirty: before.dirty },
          after: { text: after.text, isBlank: after.isBlank, dirty: after.dirty },
          textCleared: !!(before.text && before.text.length) && after.isBlank,
          dirtyCleared: after.dirty === false
        },
        motor: MOTOR_CONTROLLER_VERSION,
        notes: 'virtual state mutation verified — not physical erase'
      };
      return lastFeedback;
    } finally {
      busy = false;
    }
  }

  function feedbackBlocked(reason) {
    lastFeedback = {
      ok: false,
      status: 'blocked',
      reason,
      consciousness: neuroGate.consciousness,
      motor: MOTOR_CONTROLLER_VERSION
    };
    return lastFeedback;
  }

  function setNeuroCoupling(mod = {}, bundle = null) {
    const b = bundle || {};
    const loc = b.locomotion || {};
    const beh = b.behavior || {};
    neuroGate = {
      allowWalk: mod.allowWalk != null ? !!mod.allowWalk : (loc.allowWalk != null ? !!loc.allowWalk : neuroGate.allowWalk),
      allowTalk: mod.allowTalk != null ? !!mod.allowTalk : (beh.allowTalk != null ? !!beh.allowTalk : neuroGate.allowTalk),
      allowComplexAutonomy:
        mod.allowComplexAutonomy != null
          ? !!mod.allowComplexAutonomy
          : beh.allowComplexAutonomy != null
            ? !!beh.allowComplexAutonomy
            : neuroGate.allowComplexAutonomy,
      reactionDelayMs:
        mod.reactionDelayMs != null
          ? mod.reactionDelayMs
          : beh.reactionDelayMs != null
            ? beh.reactionDelayMs
            : neuroGate.reactionDelayMs,
      consciousness: mod.consciousness || b.consciousness || neuroGate.consciousness,
      critical: mod.critical != null ? !!mod.critical : !!b.critical
    };
    return { ...neuroGate };
  }

  function getNeuroCoupling() {
    return { ...neuroGate };
  }

  /**
   * Unified action gate used by lab / decision — applies delay metadata.
   * speak/talk/complex_autonomy are logical (no skeletal yet) but gated.
   */
  function requestAction(action, payload = {}) {
    if (action === 'walk_to' || action === 'walk') {
      if (!neuroGate.allowWalk) {
        return feedbackBlocked(`neuro_gate_walk:${neuroGate.consciousness}`);
      }
      return {
        ok: true,
        deferred: true,
        action: 'walk_to',
        reactionDelayMs: neuroGate.reactionDelayMs,
        gate: { ...neuroGate },
        note: 'caller should await delay then walkToward'
      };
    }
    if (action === 'talk' || action === 'speak') {
      if (!neuroGate.allowTalk) {
        return feedbackBlocked(`neuro_gate_talk:${neuroGate.consciousness}`);
      }
      return { ok: true, action: 'talk', reactionDelayMs: neuroGate.reactionDelayMs, gate: { ...neuroGate } };
    }
    if (action === 'complex_autonomy' || action === 'complex') {
      if (!neuroGate.allowComplexAutonomy) {
        return feedbackBlocked(`neuro_gate_complex:${neuroGate.consciousness}`);
      }
      return { ok: true, action: 'complex_autonomy', reactionDelayMs: neuroGate.reactionDelayMs, gate: { ...neuroGate } };
    }
    return { ok: true, action, reactionDelayMs: neuroGate.reactionDelayMs, gate: { ...neuroGate }, payload };
  }

  return {
    version: MOTOR_CONTROLLER_VERSION,
    sitOnChair,
    standUp,
    walkToward,
    eraseVirtualBlackboard,
    setNeuroCoupling,
    getNeuroCoupling,
    requestAction,
    isSitting,
    isBusy: () => busy,
    getLastFeedback: () => lastFeedback,
    resolveBones
  };
}

/**
 * ENGINE-15｜Autonomous Gaze & Eye Contact（自主視線與眼神交流）
 * 狀態：開發中。控制同一 GLB Shared Body Core 的 LeftEye／RightEye／blink morph。
 * 禁止永遠盯鏡頭；禁止固定循環搖頭／眨眼冒充自然互動。
 * WebRTC 三畫面＝未完成（Test B 標 stub）。
 */
import { createConversationTracker } from '../../shared/conversation-target-tracking.js';

export const GAZE_ENGINE_VERSION = '0.1.0-dev';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * World-space look angles from head/eye origin toward target.
 * yaw+: look left (avatar local -Y often); we use yaw+ = turn toward +X (right of avatar facing +Z).
 * Convention: avatar faces +Z; yaw+ turns toward +X; pitch+ looks up.
 */
export function lookAnglesToward(origin, target) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  const horiz = Math.hypot(dx, dz) || 1e-6;
  const yaw = Math.atan2(dx, dz); // rad
  const pitch = Math.atan2(dy, horiz);
  return {
    yaw,
    pitch,
    yawDeg: yaw * RAD,
    pitchDeg: pitch * RAD,
    distance: Math.hypot(dx, dy, dz)
  };
}

/**
 * @param {object} opts
 * @param {object} [opts.tracker] conversation tracker
 * @param {object} [opts.bonesByHint] { leftEye, rightEye, head, neck }
 * @param {Function} [opts.setMorph]
 * @param {object} [opts.headOrigin] fallback {x,y,z} when no head bone
 * @param {Function} [opts.onGazeState] callback for decision system
 */
export function createGazeEngine(opts = {}) {
  const tracker = opts.tracker || createConversationTracker();
  const setMorph = opts.setMorph || (() => {});
  let bonesByHint = opts.bonesByHint || {};
  let headOrigin = opts.headOrigin || { x: 0, y: 1.55, z: 0.05 };
  let getHeadWorldPos = opts.getHeadWorldPos || null;
  const onGazeState = opts.onGazeState || (() => {});

  // Eye local desired (leads head)
  let eyeYaw = 0;
  let eyePitch = 0;
  let saccadeYaw = 0;
  let saccadePitch = 0;
  let nextSaccadeAt = 0;
  let blinkT = 0;
  let nextBlinkAt = 800 + Math.random() * 2400;
  let lookAwayUntil = 0;
  let stareMs = 0;
  let lastTargetId = null;
  let appliedFrames = 0;
  const history = []; // recent target ids for anti-loop check

  const EYE_YAW_LIM = 28 * DEG;
  const EYE_PITCH_LIM = 18 * DEG;
  const STARE_BREAK_MS = 3200;
  const LOOK_AWAY_MS = 280;

  function bindBones(hints) {
    bonesByHint = hints || bonesByHint;
  }

  function setHeadOrigin(p) {
    if (p) headOrigin = { x: +p.x, y: +p.y, z: +p.z };
  }

  function setGetHeadWorldPos(fn) {
    getHeadWorldPos = fn;
  }

  function readHeadOrigin() {
    if (typeof getHeadWorldPos === 'function') {
      const p = getHeadWorldPos();
      if (p && typeof p.x === 'number') return { x: p.x, y: p.y, z: p.z };
    }
    return { ...headOrigin };
  }

  function applyEyeBones(yaw, pitch) {
    const ly = clamp(yaw, -EYE_YAW_LIM, EYE_YAW_LIM);
    const lp = clamp(pitch, -EYE_PITCH_LIM, EYE_PITCH_LIM);
    // Coordinated: both eyes same primary angles (simple vergence omitted)
    const left = bonesByHint.leftEye;
    const right = bonesByHint.rightEye;
    // Bone local: X=pitch, Y=yaw (common humanoid)
    if (left && left.rotation) {
      left.rotation.x = lp;
      left.rotation.y = ly;
      if (left.rotation.z != null) left.rotation.z = 0;
    }
    if (right && right.rotation) {
      right.rotation.x = lp;
      right.rotation.y = ly;
      if (right.rotation.z != null) right.rotation.z = 0;
    }
    return { left: { yaw: ly, pitch: lp }, right: { yaw: ly, pitch: lp } };
  }

  function doBlink(phase) {
    // phase 0..1 open→closed→open
    const v = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
    setMorph('h_expressions.LeyeClose_h', v);
    setMorph('h_expressions.ReyeClose_h', v);
  }

  /**
   * @param {number} dtSec
   * @param {number} [nowMs]
   */
  function update(dtSec, nowMs = Date.now()) {
    const dt = clamp(dtSec, 0.001, 0.05);
    appliedFrames++;

    let targetId = tracker.resolveGazeTarget();

    // Anti-stare: after continuous gaze, brief look-away (not a fixed loop)
    if (targetId === lastTargetId && targetId !== 'away') {
      stareMs += dt * 1000;
    } else {
      stareMs = 0;
      lastTargetId = targetId;
    }
    if (stareMs > STARE_BREAK_MS && nowMs >= lookAwayUntil) {
      lookAwayUntil = nowMs + LOOK_AWAY_MS + Math.random() * 180;
      stareMs = 0;
    }
    if (nowMs < lookAwayUntil) {
      targetId = 'away';
    }

    tracker.setGazeTarget(targetId, nowMs);
    history.push(targetId);
    if (history.length > 240) history.shift();

    const origin = readHeadOrigin();
    const world = tracker.worldPosForTarget(targetId);
    const ang = lookAnglesToward(origin, world);

    // Micro saccades — irregular timing (not fixed cycle)
    if (nowMs >= nextSaccadeAt) {
      saccadeYaw = (Math.random() - 0.5) * 3.5 * DEG;
      saccadePitch = (Math.random() - 0.5) * 2.2 * DEG;
      nextSaccadeAt = nowMs + 450 + Math.random() * 1600;
    } else {
      saccadeYaw *= Math.exp(-dt * 4);
      saccadePitch *= Math.exp(-dt * 4);
    }

    const desiredYaw = clamp(ang.yaw + saccadeYaw, -EYE_YAW_LIM * 1.2, EYE_YAW_LIM * 1.2);
    const desiredPitch = clamp(ang.pitch + saccadePitch, -EYE_PITCH_LIM * 1.2, EYE_PITCH_LIM * 1.2);

    // Eyes lead: fast approach (no snap)
    const eyeFollow = 1 - Math.exp(-dt * 14);
    eyeYaw = lerp(eyeYaw, desiredYaw, eyeFollow);
    eyePitch = lerp(eyePitch, desiredPitch, eyeFollow);

    const eyePose = applyEyeBones(eyeYaw, eyePitch);
    tracker.setEyePose({
      yaw: eyeYaw,
      pitch: eyePitch,
      left: eyePose.left,
      right: eyePose.right
    });

    // Blink — irregular
    if (blinkT > 0) {
      blinkT += dt;
      const phase = blinkT / 0.14;
      if (phase >= 1) {
        blinkT = 0;
        doBlink(0);
        nextBlinkAt = nowMs + 1200 + Math.random() * 3200;
      } else {
        doBlink(phase);
      }
    } else if (nowMs >= nextBlinkAt) {
      blinkT = 0.001;
    }

    const snap = getGazeState();
    onGazeState(snap);
    return snap;
  }

  function getGazeState() {
    const id = tracker.getState().currentGazeTarget;
    return {
      agent: 'dark-star',
      engine: 'ENGINE-15',
      version: GAZE_ENGINE_VERSION,
      schema: 'aivault.darkstar.gaze_state.v0.1',
      ts: Date.now(),
      currentGazeTarget: id,
      eyeYawDeg: eyeYaw * RAD,
      eyePitchDeg: eyePitch * RAD,
      stareMs,
      lookAwayActive: Date.now() < lookAwayUntil,
      blinkActive: blinkT > 0,
      conversation: tracker.getState(),
      calibration: {
        speakToFriendUses: 'virtual_camera',
        note: '對朋友說話看虛擬鏡頭，非手機螢幕朋友影像；WebRTC 遠端眼神驗證＝未完成'
      },
      sharedBodyCore: true,
      webrtcThreePane: 'NOT_IMPLEMENTED',
      frames: appliedFrames,
      status: 'dev'
    };
  }

  /** Decision-system facing API */
  function reportToDecision() {
    return getGazeState();
  }

  /**
   * Force mode helpers for lab / tests.
   */
  function speakToUser(extra) {
    tracker.setMode('answering_user', extra);
  }
  function speakToFriend(extra) {
    tracker.setMode('answering_friend', extra);
  }
  function listenUser(extra) {
    tracker.setMode('listening_user', extra);
  }
  function listenFriend(extra) {
    tracker.setMode('listening_friend', extra);
  }

  function isMechanicalLoop(window = 90) {
    // Detect if last N targets are a strict ABAB... fixed cycle with no away/saccade variety
    const slice = history.slice(-window);
    if (slice.length < window) return false;
    const unique = new Set(slice);
    // Allow at most 2 targets if one is away breaks; mechanical = exactly alternating two without away
    if (unique.size === 1) return true; // never switched — stare frozen (bad if long)
    return false;
  }

  return {
    version: GAZE_ENGINE_VERSION,
    tracker,
    bindBones,
    setHeadOrigin,
    setGetHeadWorldPos,
    update,
    getGazeState,
    reportToDecision,
    speakToUser,
    speakToFriend,
    listenUser,
    listenFriend,
    lookAnglesToward,
    getHistory: () => history.slice(),
    isMechanicalLoop,
    EYE_YAW_LIM,
    EYE_PITCH_LIM
  };
}

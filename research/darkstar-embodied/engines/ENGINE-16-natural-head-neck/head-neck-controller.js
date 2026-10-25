/**
 * ENGINE-16｜Natural Head, Neck & Posture Controller
 * 狀態：開發中。眼球先轉、頭部跟隨；加減速慣性；禁瞬間轉向／機械循環動畫。
 * 控制同一 GLB 的 Head／Neck／Shoulder（Shared Body Core）。
 */
export const HEAD_NECK_VERSION = '0.1.0-dev';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * @param {object} opts
 * @param {object} [opts.bonesByHint] { head, neck, spine2, leftShoulder, rightShoulder }
 * @param {object} [opts.safety] optional DarkStarBodySafety
 * @param {object} [opts.gazeEngine] ENGINE-15 instance (reads eye lead)
 * @param {Function} [opts.onPose]
 */
export function createHeadNeckController(opts = {}) {
  let bonesByHint = opts.bonesByHint || {};
  const safety = opts.safety || null;
  let gazeEngine = opts.gazeEngine || null;
  const onPose = opts.onPose || (() => {});

  // Head state with velocity (inertia)
  let yaw = 0;
  let pitch = 0;
  let roll = 0;
  let yawVel = 0;
  let pitchVel = 0;
  let rollVel = 0;

  // Rest / micro behaviours
  let nodPhase = 0;
  let speakPhase = 0;
  let listening = false;
  let speaking = false;
  let frames = 0;
  const yawSamples = [];

  const HEAD_YAW_LIM = 55 * DEG;
  const HEAD_PITCH_LIM = 28 * DEG;
  const HEAD_ROLL_LIM = 18 * DEG;
  // Eye leads: head covers ~55–70% of eye demand, slower
  const HEAD_COVER = 0.62;
  const ACCEL = 9.5; // rad/s^2 toward desired
  const DAMP = 6.2; // velocity damping

  function bindBones(hints) {
    bonesByHint = hints || bonesByHint;
  }

  function bindGaze(g) {
    gazeEngine = g;
  }

  function setListening(v) {
    listening = !!v;
  }
  function setSpeaking(v) {
    speaking = !!v;
  }

  function applySafety(boneName, anglesDeg) {
    if (!safety || !safety.clampAngles) return anglesDeg;
    return safety.clampAngles(boneName, anglesDeg);
  }

  function writeBone(bone, eulerRad, nameHint) {
    if (!bone || !bone.rotation) return;
    let x = eulerRad.x;
    let y = eulerRad.y;
    let z = eulerRad.z;
    if (safety) {
      const clamped = applySafety(nameHint || bone.name || 'neck', {
        x: x * RAD,
        y: y * RAD,
        z: z * RAD
      });
      x = clamped.x * DEG;
      y = clamped.y * DEG;
      z = clamped.z * DEG;
    }
    bone.rotation.x = x;
    bone.rotation.y = y;
    bone.rotation.z = z;
  }

  /**
   * Desired head angles from gaze eye lead (eyes already near full target).
   * Head follows a fraction with lag — never snap to eye angles in one frame.
   */
  function desiredFromGaze() {
    if (!gazeEngine || !gazeEngine.getGazeState) {
      return { yaw: 0, pitch: 0 };
    }
    const g = gazeEngine.getGazeState();
    const eyeYaw = (g.eyeYawDeg || 0) * DEG;
    const eyePitch = (g.eyePitchDeg || 0) * DEG;
    return {
      yaw: eyeYaw * HEAD_COVER,
      pitch: eyePitch * HEAD_COVER * 0.85
    };
  }

  /**
   * @param {number} dtSec
   * @param {object} [extra] { listening?, speaking?, overrideDesired? }
   */
  function update(dtSec, extra = {}) {
    const dt = clamp(dtSec, 0.001, 0.05);
    frames++;
    if (extra.listening != null) listening = !!extra.listening;
    if (extra.speaking != null) speaking = !!extra.speaking;

    const des = extra.overrideDesired || desiredFromGaze();
    let targetYaw = clamp(des.yaw, -HEAD_YAW_LIM, HEAD_YAW_LIM);
    let targetPitch = clamp(des.pitch, -HEAD_PITCH_LIM, HEAD_PITCH_LIM);
    let targetRoll = 0;

    // Micro tilt (slow, irregular — not a fixed loop amp)
    const t = frames * dt;
    targetRoll += Math.sin(t * 0.35 + 0.7) * 2.2 * DEG * (0.4 + 0.3 * Math.sin(t * 0.11));

    // Listening subtle nod (low amplitude, not metronome)
    if (listening) {
      nodPhase += dt * (1.1 + 0.4 * Math.sin(t * 0.2));
      targetPitch += Math.sin(nodPhase) * 2.5 * DEG;
    }

    // Speaking head motion (irregular)
    if (speaking) {
      speakPhase += dt * (2.2 + Math.sin(t * 0.37));
      targetYaw += Math.sin(speakPhase * 0.7) * 1.8 * DEG;
      targetPitch += Math.sin(speakPhase * 1.1 + 0.4) * 1.4 * DEG;
    }

    // Acceleration toward target + damping (inertia; no instant turn)
    const ay = clamp((targetYaw - yaw) * ACCEL, -14, 14);
    const ap = clamp((targetPitch - pitch) * ACCEL, -12, 12);
    const ar = clamp((targetRoll - roll) * (ACCEL * 0.7), -8, 8);
    yawVel = (yawVel + ay * dt) * Math.exp(-DAMP * dt);
    pitchVel = (pitchVel + ap * dt) * Math.exp(-DAMP * dt);
    rollVel = (rollVel + ar * dt) * Math.exp(-DAMP * dt);

    // Speed limit — prevents snap
    const maxSpeed = 2.8; // rad/s
    yawVel = clamp(yawVel, -maxSpeed, maxSpeed);
    pitchVel = clamp(pitchVel, -maxSpeed * 0.8, maxSpeed * 0.8);
    rollVel = clamp(rollVel, -maxSpeed * 0.5, maxSpeed * 0.5);

    yaw = clamp(yaw + yawVel * dt, -HEAD_YAW_LIM, HEAD_YAW_LIM);
    pitch = clamp(pitch + pitchVel * dt, -HEAD_PITCH_LIM, HEAD_PITCH_LIM);
    roll = clamp(roll + rollVel * dt, -HEAD_ROLL_LIM, HEAD_ROLL_LIM);

    yawSamples.push(yaw);
    if (yawSamples.length > 120) yawSamples.shift();

    // Distribute: neck ~55%, head ~45% of yaw/pitch; shoulders soft counter
    const neckShare = 0.55;
    const headShare = 0.45;
    writeBone(
      bonesByHint.neck,
      { x: pitch * neckShare, y: yaw * neckShare, z: roll * 0.5 },
      'Neck'
    );
    writeBone(
      bonesByHint.head,
      { x: pitch * headShare, y: yaw * headShare, z: roll * 0.5 },
      'Head'
    );

    // Shoulder coordination (subtle opposite roll / slight yaw)
    if (bonesByHint.leftShoulder && bonesByHint.leftShoulder.rotation) {
      bonesByHint.leftShoulder.rotation.z = lerp(
        bonesByHint.leftShoulder.rotation.z || 0,
        -roll * 0.25 - yaw * 0.05,
        1 - Math.exp(-dt * 4)
      );
    }
    if (bonesByHint.rightShoulder && bonesByHint.rightShoulder.rotation) {
      bonesByHint.rightShoulder.rotation.z = lerp(
        bonesByHint.rightShoulder.rotation.z || 0,
        roll * 0.25 + yaw * 0.05,
        1 - Math.exp(-dt * 4)
      );
    }

    const pose = getPose();
    if (gazeEngine && gazeEngine.tracker && gazeEngine.tracker.setHeadPose) {
      gazeEngine.tracker.setHeadPose(pose);
    }
    onPose(pose);
    return pose;
  }

  function getPose() {
    return {
      engine: 'ENGINE-16',
      version: HEAD_NECK_VERSION,
      yaw,
      pitch,
      roll,
      yawDeg: yaw * RAD,
      pitchDeg: pitch * RAD,
      rollDeg: roll * RAD,
      yawVel,
      pitchVel,
      listening,
      speaking,
      frames,
      eyeLead: true,
      headCover: HEAD_COVER,
      sharedBodyCore: true,
      status: 'dev'
    };
  }

  /** Head lag vs eye: positive means eyes reached target earlier (expected). */
  function measureHeadLagVsEye() {
    if (!gazeEngine) return null;
    const g = gazeEngine.getGazeState();
    const eyeYaw = (g.eyeYawDeg || 0) * DEG;
    const headTarget = eyeYaw * HEAD_COVER;
    return {
      eyeYawDeg: g.eyeYawDeg,
      headYawDeg: yaw * RAD,
      desiredHeadYawDeg: headTarget * RAD,
      lagRad: headTarget - yaw,
      lagDeg: (headTarget - yaw) * RAD,
      eyesLead: Math.abs(eyeYaw) >= Math.abs(yaw) - 1e-4 || Math.abs(eyeYaw) > 0.01
    };
  }

  function isInstantSnap(thresholdDeg = 25) {
    if (yawSamples.length < 3) return false;
    const a = yawSamples[yawSamples.length - 3];
    const b = yawSamples[yawSamples.length - 1];
    return Math.abs(b - a) > thresholdDeg * DEG;
  }

  function isFixedCycleYaw(periodHint = 20) {
    // crude: if autocorrelation of yaw samples is extremely high at fixed period → mechanical
    if (yawSamples.length < periodHint * 3) return false;
    const n = yawSamples.length;
    let num = 0;
    let den = 0;
    const mean = yawSamples.reduce((s, v) => s + v, 0) / n;
    for (let i = 0; i < n - periodHint; i++) {
      num += (yawSamples[i] - mean) * (yawSamples[i + periodHint] - mean);
    }
    for (let i = 0; i < n; i++) den += (yawSamples[i] - mean) ** 2;
    if (den < 1e-8) return false;
    const corr = num / den;
    return corr > 0.92;
  }

  return {
    version: HEAD_NECK_VERSION,
    bindBones,
    bindGaze,
    setListening,
    setSpeaking,
    update,
    getPose,
    measureHeadLagVsEye,
    isInstantSnap,
    isFixedCycleYaw,
    HEAD_COVER,
    HEAD_YAW_LIM
  };
}

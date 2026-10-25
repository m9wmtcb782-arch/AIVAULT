/**
 * Multi-frame joint / root tween with Body Safety Layer clamping.
 * DEV — continuous transition evidence for Phase2 sit (not MP4, not teleport).
 */
import { DarkStarBodySafety } from '../../../../assets/dark-star/body-safety-layer.js';

export const JOINT_TWEEN_VERSION = '0.1.0-dev';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Map common Mixamo / GLB bone names to safety-layer types for clamp/gate. */
function safetyJointName(name) {
  const n = String(name || '').toLowerCase().replace(/[-\s:]/g, '');
  if (/upleg|upperleg|thigh/.test(n)) return n.includes('left') || n.startsWith('l') ? 'LeftUpperLeg' : 'RightUpperLeg';
  if (/^mixamorigleftleg$|^leftleg$|leftshin|leftcalf|leftlowerleg/.test(n)) return 'LeftKnee';
  if (/^mixamorigrightleg$|^rightleg$|rightshin|rightcalf|rightlowerleg/.test(n)) return 'RightKnee';
  if (/leftknee|lknee/.test(n)) return 'LeftKnee';
  if (/rightknee|rknee/.test(n)) return 'RightKnee';
  if (/hip|pelvis/.test(n)) return 'Hips';
  if (/spine|chest/.test(n)) return 'Spine';
  return name || 'bone';
}


function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function boneAnglesDeg(bone) {
  return {
    x: (bone.rotation.x || 0) * RAD,
    y: (bone.rotation.y || 0) * RAD,
    z: (bone.rotation.z || 0) * RAD
  };
}

function applyClamped(bone, targetDeg, safety, frameLog) {
  const name = bone.name || 'bone';
  const safetyName = safetyJointName(name);
  const clamped = safety.clampAngles(safetyName, targetDeg);
  const gate = safety.safetyGate({ jointName: safetyName, angles: clamped });
  bone.rotation.x = clamped.x * DEG;
  bone.rotation.y = clamped.y * DEG;
  bone.rotation.z = clamped.z * DEG;
  if (typeof bone.updateMatrixWorld === 'function') bone.updateMatrixWorld(true);
  const entry = {
    joint: name,
    safetyJoint: safetyName,
    target: { ...targetDeg },
    applied: { ...clamped },
    allow: gate.allow,
    blocked: !!(gate.joint && gate.joint.blocked)
  };
  if (frameLog) frameLog.push(entry);
  return { ok: gate.allow, gate, clamped };
}

/**
 * Tween multiple bones + optional root position over N frames.
 * @param {object} opts
 * @param {Array<{bone: object, to: {x,y,z}}>} opts.joints
 * @param {object} [opts.root] { object, to: {x,y,z} }
 * @param {number} [opts.frames=30]
 * @param {number} [opts.frameMs=16]
 * @param {object} [opts.safety]
 * @param {function} [opts.onFrame]
 * @param {boolean} [opts.sync=false] — if true, apply all frames immediately (Node tests)
 */
export async function tweenPose(opts = {}) {
  const safety = opts.safety || DarkStarBodySafety;
  const frames = Math.max(2, opts.frames || 30);
  const frameMs = opts.frameMs != null ? opts.frameMs : 16;
  const sync = !!opts.sync;
  const joints = opts.joints || [];
  const root = opts.root || null;

  const starts = joints.map((j) => ({
    bone: j.bone,
    from: boneAnglesDeg(j.bone),
    to: {
      x: j.to.x != null ? j.to.x : boneAnglesDeg(j.bone).x,
      y: j.to.y != null ? j.to.y : boneAnglesDeg(j.bone).y,
      z: j.to.z != null ? j.to.z : boneAnglesDeg(j.bone).z
    }
  }));

  let rootFrom = null;
  if (root && root.object && root.object.position) {
    rootFrom = {
      x: root.object.position.x,
      y: root.object.position.y,
      z: root.object.position.z
    };
  }

  const timeline = [];
  let blockedCount = 0;

  function step(i) {
    const t = easeInOut(i / (frames - 1));
    const frameLog = [];
    const snapshot = { i, t, joints: {}, root: null, blocked: [] };

    starts.forEach((s) => {
      const target = {
        x: lerp(s.from.x, s.to.x, t),
        y: lerp(s.from.y, s.to.y, t),
        z: lerp(s.from.z, s.to.z, t)
      };
      const r = applyClamped(s.bone, target, safety, frameLog);
      snapshot.joints[s.bone.name || 'bone'] = {
        from: s.from,
        to: s.to,
        applied: r.clamped
      };
      if (!r.ok) {
        blockedCount += 1;
        snapshot.blocked.push(s.bone.name || 'bone');
      }
    });

    if (root && root.object && rootFrom && root.to) {
      root.object.position.x = lerp(rootFrom.x, root.to.x != null ? root.to.x : rootFrom.x, t);
      root.object.position.y = lerp(rootFrom.y, root.to.y != null ? root.to.y : rootFrom.y, t);
      root.object.position.z = lerp(rootFrom.z, root.to.z != null ? root.to.z : rootFrom.z, t);
      snapshot.root = {
        x: root.object.position.x,
        y: root.object.position.y,
        z: root.object.position.z
      };
    }

    timeline.push(snapshot);
    if (opts.onFrame) opts.onFrame(snapshot, i, frames);
  }

  if (sync) {
    for (let i = 0; i < frames; i++) step(i);
  } else {
    for (let i = 0; i < frames; i++) {
      step(i);
      if (i < frames - 1 && frameMs > 0) {
        await new Promise((r) => setTimeout(r, frameMs));
      }
    }
  }

  // Distinct Y samples prove non-teleport when root moves
  const ySamples = timeline.map((f) => (f.root ? f.root.y : null)).filter((y) => y != null);
  const uniqueY = new Set(ySamples.map((y) => y.toFixed(4)));

  return {
    ok: true,
    status: blockedCount > frames * 0.5 ? 'partial' : 'completed',
    frames: timeline.length,
    frameCount: frames,
    blockedCount,
    uniqueRootY: uniqueY.size,
    timeline,
    version: JOINT_TWEEN_VERSION,
    notes: 'multi-frame joint tween via safety.clampAngles — not teleport, not MP4'
  };
}

export function findBoneByPatterns(bones, patterns) {
  if (!bones || !bones.length) return null;
  for (const re of patterns) {
    const b = bones.find((x) => re.test(String(x.name || '')));
    if (b) return b;
  }
  return null;
}

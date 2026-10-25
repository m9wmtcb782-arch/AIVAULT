/**
 * Phase1 arm IK — ported/simplified from technical-dark-star-morph-mapping-test.html (Body Brain Lab V33).
 * Discovers upper→fore→wrist chains, two-bone IK, and a wave sequence.
 * Low-level motion only. NOT autonomous decision-making. NOT neural motor learning.
 */
import * as THREE from 'three';
import { DarkStarBodySafety } from '../../../assets/dark-star/body-safety-layer.js';

export const ARM_IK_VERSION = '0.2.0-dev';

function wp(b) {
  return b.getWorldPosition(new THREE.Vector3());
}

function kids(b) {
  return b.children.filter((x) => x.isBone);
}

function nameSide(b) {
  const n = String(b.name || '').toLowerCase();
  // Prefer substring match: LeftArm / RightArm / mixamorig:LeftArm etc.
  const hasL = n.includes('left') || n.includes('左手') || n.includes('左臂') || n.includes('左肩');
  const hasR = n.includes('right') || n.includes('右手') || n.includes('右臂') || n.includes('右肩');
  if (hasL && !hasR) return 'L';
  if (hasR && !hasL) return 'R';
  return null;
}


function boneAnglesDeg(b) {
  const e = new THREE.Euler().setFromQuaternion(b.quaternion, 'XYZ');
  return {
    x: THREE.MathUtils.radToDeg(e.x),
    y: THREE.MathUtils.radToDeg(e.y),
    z: THREE.MathUtils.radToDeg(e.z)
  };
}

function worldSet(b, qWorld) {
  if (b.parent && b.parent.isBone) {
    const p = new THREE.Quaternion();
    b.parent.getWorldQuaternion(p);
    p.invert();
    b.quaternion.copy(p.multiply(qWorld));
  } else {
    b.quaternion.copy(qWorld);
  }
  b.updateMatrixWorld(true);
}

function pointBone(avatar, b, targetDir) {
  const c = kids(b)[0];
  if (!c) return false;
  avatar.updateMatrixWorld(true);
  const cur = wp(c).sub(wp(b)).normalize();
  const want = targetDir.clone().normalize();
  if (cur.lengthSq() < 1e-8 || want.lengthSq() < 1e-8) return false;
  const delta = new THREE.Quaternion().setFromUnitVectors(cur, want);
  const w = new THREE.Quaternion();
  b.getWorldQuaternion(w);
  worldSet(b, delta.multiply(w));
  return true;
}

/**
 * Geometric arm-chain candidate (Body Lab V33).
 * @param {'L'|'R'} side
 */
export function armCandidate(side, b) {
  const e = kids(b)[0];
  const w = e && kids(e)[0];
  if (!e || !w) return null;
  const named = nameSide(b);
  if (named && named !== side) return null;
  const s = wp(b);
  const p = wp(e);
  const q = wp(w);
  // Geometric side only when bone name does not declare L/R.
  if (!named) {
    const sideOk = side === 'L' ? s.x < 0 : s.x > 0;
    if (!sideOk) return null;
  }
  const v1 = p.clone().sub(s);
  const v2 = q.clone().sub(p);
  const l1 = v1.length();
  const l2 = v2.length();
  if (l1 < 0.06 || l1 > 0.65 || l2 < 0.035 || l2 > 0.65) return null;
  const d1 = v1.clone().normalize();
  const d2 = v2.clone().normalize();
  const horizontal = Math.abs(d1.x);
  const bend = d1.dot(d2);
  if (horizontal < 0.55 || s.y < 0.45) return null;
  const score =
    horizontal * 4 +
    Math.min(l1, 0.4) * 3 +
    Math.min(l2, 0.4) * 2 +
    s.y * 0.4 -
    Math.abs(d1.y) * 2 -
    Math.abs(d1.z) * 0.7 -
    bend * 0.2 +
    (named ? 5 : 0);
  const bendNormal = new THREE.Vector3().crossVectors(d1, d2);
  if (bendNormal.lengthSq() > 1e-7) bendNormal.normalize();
  return { upper: b, fore: e, wrist: w, l1, l2, score, bendNormal };
}

export function inspectArms(avatar, bones) {
  avatar.updateMatrixWorld(true);
  const out = { L: [], R: [] };
  bones.forEach((b) => {
    const l = armCandidate('L', b);
    const r = armCandidate('R', b);
    if (l) out.L.push(l);
    if (r) out.R.push(r);
  });
  out.L.sort((a, b) => b.score - a.score);
  out.R.sort((a, b) => b.score - a.score);
  return {
    L: out.L[0] || null,
    R: out.R[0] || null,
    candidates: { L: out.L.length, R: out.R.length }
  };
}

function snapshotBones(bones) {
  return bones.map((b) => ({
    b,
    q: b.quaternion.clone(),
    p: b.position.clone(),
    s: b.scale.clone()
  }));
}

function restoreSnapshot(avatar, snap) {
  snap.forEach((x) => {
    x.b.quaternion.copy(x.q);
    x.b.position.copy(x.p);
    x.b.scale.copy(x.s);
  });
  avatar.updateMatrixWorld(true);
}

function poseSafetyBlocked(bones) {
  const bad = [];
  for (const b of bones) {
    const r = DarkStarBodySafety.evaluateAngles(b.name, boneAnglesDeg(b));
    if (r.blocked) bad.push({ name: b.name, type: r.type, action: r.action, angles: r.angles });
  }
  return bad;
}

function applyClampedLocalEuler(bone, eulerRad) {
  const deg = {
    x: THREE.MathUtils.radToDeg(eulerRad.x),
    y: THREE.MathUtils.radToDeg(eulerRad.y),
    z: THREE.MathUtils.radToDeg(eulerRad.z)
  };
  const clamped = DarkStarBodySafety.clampAngles(bone.name || 'shoulder', deg);
  const gated = DarkStarBodySafety.safetyGate({
    jointName: bone.name || 'shoulder',
    angles: clamped
  });
  bone.quaternion.setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(clamped.x),
      THREE.MathUtils.degToRad(clamped.y),
      THREE.MathUtils.degToRad(clamped.z),
      'XYZ'
    )
  );
  bone.updateMatrixWorld(true);
  return { clamped, gated, allow: !!gated.allow };
}

/**
 * Two-bone IK toward a side-specific target (Body Lab V33 elbow plane).
 * @param {'L'|'R'} side
 * @param {'down'|'wave_ready'} pose
 */
export function twoBoneIk(avatar, bones, chain, side, pose = 'down', safetyEnabled = true) {
  if (!chain) return { ok: false, reason: 'no_chain' };
  const snap = snapshotBones(bones);
  const S = wp(chain.upper);
  const a = chain.l1;
  const b = chain.l2;
  const sg = side === 'L' ? -1 : 1;

  let target;
  if (pose === 'wave_ready') {
    // Raise hand beside/above head for waving.
    target = S.clone().add(new THREE.Vector3(sg * 0.22, Math.max(0.35, a * 0.55), 0.18));
  } else {
    target = S.clone().add(new THREE.Vector3(sg * 0.12, -Math.max(0.8, a + b * 0.72), 0.06));
  }

  let d = target.clone().sub(S);
  const dist = THREE.MathUtils.clamp(d.length(), Math.abs(a - b) + 0.015, a + b - 0.015);
  const D = d.normalize();
  const T = S.clone().add(D.clone().multiplyScalar(dist));

  let pole;
  if (chain.bendNormal && chain.bendNormal.lengthSq() > 1e-7) {
    pole = S.clone().add(chain.bendNormal.clone().multiplyScalar(sg));
  } else {
    pole = S.clone().add(new THREE.Vector3(sg * 0.05, -0.25, sg * 0.8));
  }
  let P = pole.clone().sub(S).projectOnPlane(D);
  if (P.lengthSq() < 1e-7) {
    restoreSnapshot(avatar, snap);
    return { ok: false, reason: 'bad_pole' };
  }
  P.normalize();

  const cosA = THREE.MathUtils.clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1);
  const along = a * cosA;
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  const E = S.clone().add(D.clone().multiplyScalar(along)).add(P.multiplyScalar(h));

  if (!pointBone(avatar, chain.upper, E.clone().sub(S))) {
    restoreSnapshot(avatar, snap);
    return { ok: false, reason: 'point_upper_fail' };
  }
  avatar.updateMatrixWorld(true);
  const eNow = wp(chain.fore);
  if (!pointBone(avatar, chain.fore, T.clone().sub(eNow))) {
    restoreSnapshot(avatar, snap);
    return { ok: false, reason: 'point_fore_fail' };
  }
  avatar.updateMatrixWorld(true);

  if (safetyEnabled) {
    // Phase1: gate the arm chain only. Full-body scan is too brittle for gestural IK
    // (hair/fingers often unmapped or noisy). ENGINE-08 can widen this later.
    const bad = poseSafetyBlocked([chain.upper, chain.fore]);
    if (bad.length) {
      restoreSnapshot(avatar, snap);
      return { ok: false, reason: 'safety_blocked', blocked: bad.slice(0, 8) };
    }
  }

  const err = wp(chain.wrist).distanceTo(T);
  const ok = err < Math.max(0.08, (a + b) * 0.12);
  return {
    ok,
    reason: ok ? 'ik_ok' : 'ik_error_large',
    error: err,
    pose,
    chain: `${chain.upper.name}→${chain.fore.name}→${chain.wrist.name}`,
    joints: {
      upper: boneAnglesDeg(chain.upper),
      fore: boneAnglesDeg(chain.fore),
      wrist: boneAnglesDeg(chain.wrist)
    }
  };
}

function waitFrame() {
  return new Promise((r) => requestAnimationFrame(() => r(performance.now())));
}

/**
 * Play a right/left arm wave: IK raise + forearm oscillation (real joint rotations).
 * @returns {Promise<object>} motion result (not a stub)
 */
export async function playWave(avatar, bones, side = 'R', opts = {}) {
  const cycles = opts.cycles ?? 3;
  const durationMs = opts.durationMs ?? 1400;
  const amplitudeRad = opts.amplitudeRad ?? 0.55;
  const onSafety = opts.onSafety || (() => {});
  const onProgress = opts.onProgress || (() => {});

  const arms = inspectArms(avatar, bones);
  const chain = side === 'L' ? arms.L : arms.R;
  if (!chain) {
    return {
      ok: false,
      stub: false,
      name: 'wave',
      part: side === 'L' ? 'left_arm' : 'right_arm',
      status: 'blocked',
      reason: 'arm_chain_not_found',
      candidates: arms.candidates
    };
  }

  // Primary: local kinematic raise within Body Safety shoulder envelope.
  // (RightHand is mis-mapped as finger in safety layer and is blocked even at rest —
  //  so gesture safety only watches upper+fore. IK is optional polish.)
  let raiseMode = 'local';
  let raise;
  {
    const snap = snapshotBones(bones);
    const candidates = [
      { u: new THREE.Euler(-0.75, side === 'R' ? -0.15 : 0.15, side === 'R' ? -0.25 : 0.25, 'XYZ'),
        f: new THREE.Euler(0, 0, side === 'R' ? -0.45 : 0.45, 'XYZ') },
      { u: new THREE.Euler(-0.55, 0, side === 'R' ? -0.18 : 0.18, 'XYZ'),
        f: new THREE.Euler(0, 0, side === 'R' ? -0.3 : 0.3, 'XYZ') }
    ];
    let okLocal = false;
    for (const c of candidates) {
      chain.upper.quaternion.setFromEuler(c.u);
      chain.fore.quaternion.setFromEuler(c.f);
      chain.upper.updateMatrixWorld(true);
      chain.fore.updateMatrixWorld(true);
      const bad = poseSafetyBlocked([chain.upper, chain.fore]);
      if (!bad.length) { okLocal = true; break; }
    }
    if (!okLocal) {
      restoreSnapshot(avatar, snap);
      // Last resort: try IK without safety, then clamp upper
      const ik = twoBoneIk(avatar, bones, chain, side, 'wave_ready', false);
      if (ik.ok) {
        const deg = boneAnglesDeg(chain.upper);
        const clamped = DarkStarBodySafety.clampAngles(chain.upper.name || 'shoulder', deg);
        chain.upper.quaternion.setFromEuler(new THREE.Euler(
          THREE.MathUtils.degToRad(clamped.x),
          THREE.MathUtils.degToRad(clamped.y),
          THREE.MathUtils.degToRad(clamped.z),
          'XYZ'
        ));
        chain.upper.updateMatrixWorld(true);
        const bad = poseSafetyBlocked([chain.upper, chain.fore]);
        if (bad.length) {
          restoreSnapshot(avatar, snap);
          onSafety({ event: 'raise_blocked', blocked: bad });
          return {
            ok: false, stub: false, name: 'wave',
            part: side === 'L' ? 'left_arm' : 'right_arm',
            status: 'blocked', reason: 'safety_blocked',
            raise: ik, safety: { blocked: bad.slice(0, 8), warnings: [] }
          };
        }
        raiseMode = 'ik_clamped';
        raise = { ...ik, reason: 'ik_clamped', pose: 'wave_ready_ik_clamped' };
      } else {
        onSafety({ event: 'raise_blocked', raise: ik });
        return {
          ok: false, stub: false, name: 'wave',
          part: side === 'L' ? 'left_arm' : 'right_arm',
          status: 'blocked', reason: ik.reason || 'raise_failed',
          raise: ik, safety: { blocked: ik.blocked || [], warnings: [] }
        };
      }
    }
    if (!raise) {
      raise = {
        ok: true,
        reason: 'local_raise',
        pose: 'wave_ready_local',
        chain: `${chain.upper.name}→${chain.fore.name}→${chain.wrist.name}`,
        joints: {
          upper: boneAnglesDeg(chain.upper),
          fore: boneAnglesDeg(chain.fore),
          wrist: boneAnglesDeg(chain.wrist)
        }
      };
    }
  }

  // Capture raised forearm base quaternion for oscillation.
  const foreBase = chain.fore.quaternion.clone();
  const upperBase = chain.upper.quaternion.clone();
  const t0 = performance.now();
  let frames = 0;
  let lastSafety = null;
  let aborted = false;

  while (true) {
    const now = await waitFrame();
    const t = (now - t0) / durationMs;
    if (t >= 1) break;
    frames++;

    // Oscillate around raised pose (forearm swing = visible wave).
    // Do NOT rewrite quats from clampAngles Euler — that fights IK. Soft-reject unsafe frames.
    const phase = t * cycles * Math.PI * 2;
    let amp = amplitudeRad;
    let accepted = false;
    for (let attempt = 0; attempt < 3 && !accepted; attempt++) {
      const swing = Math.sin(phase) * amp;
      const local = new THREE.Euler(0, swing * 0.35, swing, 'XYZ');
      const delta = new THREE.Quaternion().setFromEuler(local);
      chain.fore.quaternion.copy(foreBase).multiply(delta);
      const bob = new THREE.Euler(0, 0, Math.sin(phase * 0.5) * 0.08 * (amp / amplitudeRad), 'XYZ');
      chain.upper.quaternion.copy(upperBase).multiply(new THREE.Quaternion().setFromEuler(bob));
      chain.upper.updateMatrixWorld(true);
      chain.fore.updateMatrixWorld(true);
      const armBad = poseSafetyBlocked([chain.upper, chain.fore]);
      if (!armBad.length) {
        accepted = true;
        break;
      }
      lastSafety = { event: 'wave_frame_soft_reject', blocked: armBad, amp };
      onSafety(lastSafety);
      amp *= 0.5;
    }
    if (!accepted) {
      chain.fore.quaternion.copy(foreBase);
      chain.upper.quaternion.copy(upperBase);
      avatar.updateMatrixWorld(true);
      lastSafety = {
        event: 'wave_frame_blocked',
        blocked: poseSafetyBlocked(bones).slice(0, 6)
      };
      onSafety(lastSafety);
      aborted = true;
      break;
    }

    onProgress({
      t,
      frames,
      joints: {
        upper: boneAnglesDeg(chain.upper),
        fore: boneAnglesDeg(chain.fore),
        wrist: boneAnglesDeg(chain.wrist)
      }
    });
  }

  // End on raised-then-slight rest (keep raised for visibility) or leave as-is.
  avatar.updateMatrixWorld(true);

  return {
    ok: !aborted,
    stub: false,
    name: 'wave',
    part: side === 'L' ? 'left_arm' : 'right_arm',
    status: aborted ? 'partial' : 'completed',
    reason: aborted ? 'safety_interrupted' : 'wave_joints_driven',
    raise,
    raiseMode,
    frames,
    durationMs,
    cycles,
    chain: `${chain.upper.name}→${chain.fore.name}→${chain.wrist.name}`,
    joints: {
      upper: boneAnglesDeg(chain.upper),
      fore: boneAnglesDeg(chain.fore),
      wrist: boneAnglesDeg(chain.wrist)
    },
    safety: {
      layer: DarkStarBodySafety.version,
      blocked: lastSafety ? lastSafety.blocked || [] : [],
      warnings: aborted ? ['wave_aborted_by_safety'] : [],
      last: lastSafety
    },
    note: 'UI/macro driven — NOT autonomous decision'
  };
}

export function createArmIkController(avatar, bones) {
  return {
    version: ARM_IK_VERSION,
    inspect: () => inspectArms(avatar, bones),
    putArm: (side, pose) => {
      const arms = inspectArms(avatar, bones);
      const chain = side === 'L' ? arms.L : arms.R;
      return twoBoneIk(avatar, bones, chain, side, pose, true);
    },
    wave: (side, opts) => playWave(avatar, bones, side || 'R', opts)
  };
}

// Exported for unit-style checks without WebGL.
export const __test = {
  boneAnglesDeg,
  applyClampedLocalEuler,
  poseSafetyBlocked,
  snapshotBones,
  restoreSnapshot
};

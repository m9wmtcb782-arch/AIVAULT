/*
 * Technical Dark Star — Body Safety Layer v0.1
 *
 * Purpose:
 *   1. Joint-angle safety limits (artificial nociception / pain signal)
 *   2. Joint velocity / acceleration guardrails
 *   3. Whole-body coordination hooks
 *   4. Gravity / center-of-mass / support-polygon hooks
 *
 * Important:
 *   These are simulation safety limits, not medical claims about exact human
 *   anatomy. They are deliberately conservative until the avatar's real bone
 *   axes are calibrated against a biomechanical reference.
 */

export const BODY_SAFETY_VERSION = '0.1.0';
export const GRAVITY_MPS2 = 9.80665;

const DEG = Math.PI / 180;
const rad = (deg) => deg * DEG;

// Local anatomical safety envelopes.
// Values are intentionally conservative simulation limits, not clinical ROM.
export const JOINT_LIMITS = Object.freeze({
  neck: {
    name: 'Neck',
    x: [-45, 45], y: [-70, 70], z: [-40, 40],
    soft: 0.82, hard: 1.00,
  },
  shoulder: {
    name: 'Shoulder',
    x: [-80, 120], y: [-90, 90], z: [-90, 120],
    soft: 0.80, hard: 1.00,
  },
  elbow: {
    name: 'Elbow',
    // Main flexion is treated as the primary DOF. The other axes are kept
    // very small to prevent the classic "backward elbow" failure.
    x: [-10, 150], y: [-8, 8], z: [-8, 8],
    soft: 0.78, hard: 1.00,
  },
  wrist: {
    name: 'Wrist',
    x: [-70, 70], y: [-30, 30], z: [-40, 40],
    soft: 0.82, hard: 1.00,
  },
  hip: {
    name: 'Hip',
    x: [-30, 120], y: [-45, 45], z: [-40, 50],
    soft: 0.80, hard: 1.00,
  },
  knee: {
    name: 'Knee',
    x: [-5, 135], y: [-5, 5], z: [-5, 5],
    soft: 0.78, hard: 1.00,
  },
  ankle: {
    name: 'Ankle',
    x: [-35, 25], y: [-25, 25], z: [-20, 30],
    soft: 0.80, hard: 1.00,
  },
  toe: {
    name: 'Toe',
    x: [-10, 55], y: [-10, 10], z: [-10, 10],
    soft: 0.82, hard: 1.00,
  },
  finger: {
    name: 'Finger',
    x: [-5, 110], y: [-20, 20], z: [-20, 20],
    soft: 0.80, hard: 1.00,
  },
  spine: {
    name: 'Spine',
    x: [-25, 25], y: [-35, 35], z: [-25, 25],
    soft: 0.75, hard: 1.00,
  },
});

const KEYWORDS = [
  ['neck', 'neck'],
  ['cervical', 'neck'],
  ['shoulder', 'shoulder'],
  ['clavicle', 'shoulder'],
  ['upperarm', 'shoulder'],
  ['upper_arm', 'shoulder'],
  ['arm', 'shoulder'],
  ['elbow', 'elbow'],
  ['forearm', 'wrist'],
  ['fore_arm', 'wrist'],
  ['wrist', 'wrist'],
  ['hand', 'finger'],
  ['finger', 'finger'],
  ['thumb', 'finger'],
  ['spine', 'spine'],
  ['chest', 'spine'],
  ['torso', 'spine'],
  ['pelvis', 'hip'],
  ['hip', 'hip'],
  ['thigh', 'hip'],
  ['upperleg', 'hip'],
  ['upper_leg', 'hip'],
  ['knee', 'knee'],
  ['calf', 'ankle'],
  ['shin', 'ankle'],
  ['lowerleg', 'ankle'],
  ['lower_leg', 'ankle'],
  ['ankle', 'ankle'],
  ['foot', 'ankle'],
  ['toe', 'toe'],
];

export function classifyJoint(name = '') {
  const n = String(name).toLowerCase().replace(/[-\s]/g, '_');
  for (const [keyword, type] of KEYWORDS) {
    if (n.includes(keyword)) return type;
  }
  return 'unknown';
}

export function getJointLimit(name, fallback = 'spine') {
  const type = classifyJoint(name);
  return JOINT_LIMITS[type] || JOINT_LIMITS[fallback] || null;
}

function normalizeAngle(deg) {
  let x = deg % 360;
  if (x > 180) x -= 360;
  if (x < -180) x += 360;
  return x;
}

function axisRisk(value, min, max) {
  const v = normalizeAngle(value);
  if (v < min || v > max) return 1;
  const span = Math.max(0.001, max - min);
  const edge = Math.min(v - min, max - v);
  const softWidth = span * 0.18;
  if (edge >= softWidth) return 0;
  return Math.min(0.999, 1 - edge / softWidth);
}

export function evaluateAngles(name, eulerDegrees) {
  const limit = getJointLimit(name);
  if (!limit) return {
    joint: name,
    type: 'unknown',
    safe: true,
    blocked: false,
    painSignal: 0,
    injuryRisk: 0,
    reason: 'No anatomical mapping yet; controller must not invent a hard limit.',
  };

  const x = normalizeAngle(eulerDegrees?.x ?? 0);
  const y = normalizeAngle(eulerDegrees?.y ?? 0);
  const z = normalizeAngle(eulerDegrees?.z ?? 0);
  const rx = axisRisk(x, limit.x[0], limit.x[1]);
  const ry = axisRisk(y, limit.y[0], limit.y[1]);
  const rz = axisRisk(z, limit.z[0], limit.z[1]);
  const risk = Math.max(rx, ry, rz);
  const blocked = x < limit.x[0] || x > limit.x[1] ||
                  y < limit.y[0] || y > limit.y[1] ||
                  z < limit.z[0] || z > limit.z[1];

  return {
    joint: name,
    type: classifyJoint(name),
    safe: !blocked,
    blocked,
    painSignal: blocked ? Math.max(0.8, risk) : risk,
    injuryRisk: blocked ? Math.max(0.9, risk) : Math.min(0.99, risk * 0.72),
    angles: { x, y, z },
    limits: {
      x: [...limit.x], y: [...limit.y], z: [...limit.z],
    },
    action: blocked ? 'BLOCK_AND_RECOVER' : risk > 0.75 ? 'SLOW_AND_RECOVER' : 'ALLOW',
  };
}

export function clampAngles(name, eulerDegrees) {
  const limit = getJointLimit(name);
  if (!limit) return { ...eulerDegrees };
  const clamp = (v, range) => Math.min(range[1], Math.max(range[0], normalizeAngle(v)));
  return {
    x: clamp(eulerDegrees?.x ?? 0, limit.x),
    y: clamp(eulerDegrees?.y ?? 0, limit.y),
    z: clamp(eulerDegrees?.z ?? 0, limit.z),
  };
}

export function evaluateVelocity(previous, current, dtSeconds) {
  if (!previous || !current || !Number.isFinite(dtSeconds) || dtSeconds <= 0) {
    return { angularVelocity: { x: 0, y: 0, z: 0 }, risk: 0 };
  }
  const dt = Math.max(0.001, dtSeconds);
  const angularVelocity = {
    x: normalizeAngle(current.x - previous.x) / dt,
    y: normalizeAngle(current.y - previous.y) / dt,
    z: normalizeAngle(current.z - previous.z) / dt,
  };
  const magnitude = Math.hypot(angularVelocity.x, angularVelocity.y, angularVelocity.z);
  const risk = Math.min(1, magnitude / 720);
  return { angularVelocity, risk };
}

export function createPainSignal(result, velocityRisk = 0) {
  const pain = Math.max(result?.painSignal || 0, velocityRisk * 0.7);
  return {
    active: pain > 0.75,
    intensity: Math.min(1, pain),
    joint: result?.joint || 'unknown',
    injuryRisk: Math.min(1, Math.max(result?.injuryRisk || 0, velocityRisk)),
    action: pain > 0.95 ? 'EMERGENCY_STOP' : pain > 0.75 ? 'BLOCK_AND_RECOVER' : 'ALLOW',
  };
}

export function createGravityState({ massKg = 60, centerOfMass, supportPoints = [] } = {}) {
  const mass = Math.max(0.1, Number(massKg) || 60);
  const com = centerOfMass || { x: 0, y: 1, z: 0 };
  const gravityForceN = mass * GRAVITY_MPS2;

  // Projection of the COM onto the ground plane. This is intentionally simple
  // and deterministic; a later physics layer can replace it with full contact
  // constraints and ground-reaction forces.
  const projection = { x: com.x, z: com.z };

  let supportRadius = 0;
  for (const p of supportPoints) {
    const dx = (p.x || 0) - projection.x;
    const dz = (p.z || 0) - projection.z;
    supportRadius = Math.max(supportRadius, Math.hypot(dx, dz));
  }

  const horizontalOffset = Math.hypot(projection.x, projection.z);
  const balanceRisk = supportPoints.length < 2
    ? 1
    : Math.min(1, horizontalOffset / Math.max(0.05, supportRadius || 0.15));

  return {
    gravity: { x: 0, y: -GRAVITY_MPS2, z: 0 },
    gravityForceN,
    centerOfMass: { ...com },
    projectedCOM: projection,
    supportPoints,
    balanceRisk,
    stable: balanceRisk < 0.75,
    action: balanceRisk > 0.95 ? 'EMERGENCY_BALANCE_RECOVERY' :
            balanceRisk > 0.75 ? 'REPOSITION' : 'STABLE',
  };
}

export function safetyGate({ jointName, angles, previousAngles, dtSeconds, gravityState } = {}) {
  const angleResult = evaluateAngles(jointName, angles);
  const velocity = evaluateVelocity(previousAngles, angles, dtSeconds);
  const pain = createPainSignal(angleResult, velocity.risk);
  const balanceRisk = gravityState?.balanceRisk ?? 0;

  return {
    allow: !angleResult.blocked && pain.action !== 'EMERGENCY_STOP',
    joint: angleResult,
    velocity,
    pain,
    balance: gravityState || null,
    globalRisk: Math.max(pain.injuryRisk, balanceRisk),
  };
}

export const DarkStarBodySafety = Object.freeze({
  version: BODY_SAFETY_VERSION,
  gravity: GRAVITY_MPS2,
  limits: JOINT_LIMITS,
  classifyJoint,
  getJointLimit,
  evaluateAngles,
  clampAngles,
  evaluateVelocity,
  createPainSignal,
  createGravityState,
  safetyGate,
});

/**
 * Body Profile ＋ 換身校準 API stub
 * 換身後必須刷新自我認知（對接 ENGINE-02 風格回呼）
 */
import { createCapabilityDescriptor } from './body-control-bus.js';

export const BODY_PROFILE_VERSION = '0.1.0-dev';
export const BODY_PROFILE_STATUS = '開發中';

/**
 * @param {object} [partial]
 */
export function createBodyProfile(partial = {}) {
  const bodyId = partial.bodyId || 'darkstar-virtual-glb';
  return {
    schema: 'aivault.darkstar.body_profile.v0.1',
    bodyId,
    displayName: partial.displayName || bodyId,
    embodimentKind: partial.embodimentKind || 'virtual_avatar',
    skeleton: partial.skeleton || 'mixamo-like',
    meshRef: partial.meshRef || 'assets/dark-star/technical-dark-star-avatar.glb',
    capability: createCapabilityDescriptor({
      bodyId,
      embodimentKind: partial.embodimentKind || 'virtual_avatar',
      joints: partial.joints || [
        { id: 'Head', dof: 3 },
        { id: 'RightArm', dof: 3 },
        { id: 'RightForeArm', dof: 1 },
        { id: 'RightHand', dof: 3 }
      ],
      actuators: partial.actuators,
      sensors: partial.sensors,
      limits: partial.limits,
      safety: partial.safety
    }),
    calibrated: !!partial.calibrated,
    calibratedAt: partial.calibratedAt || null,
    notes: partial.notes || null,
    disclaimer: '身體檔案｜換身後須校準｜虛擬 stub'
  };
}

/**
 * @param {{ onRecalibrate?: Function, initial?: object }} [opts]
 */
export function createBodyProfileRegistry(opts = {}) {
  /** @type {Map<string, object>} */
  const profiles = new Map();
  let activeId = null;
  const calibrationLog = [];

  function register(profilePartial) {
    const p = createBodyProfile(profilePartial);
    profiles.set(p.bodyId, p);
    if (!activeId) activeId = p.bodyId;
    return p;
  }

  if (opts.initial) register(opts.initial);

  function list() {
    return [...profiles.values()].map((p) => ({ ...p }));
  }

  function getActive() {
    if (!activeId || !profiles.has(activeId)) return null;
    return { ...profiles.get(activeId) };
  }

  /**
   * Switch body → must recalibrate self-model (ENGINE-02 hook).
   * @param {string} bodyId
   * @param {{ skipCalibrate?: boolean }} [opt]
   */
  function switchBody(bodyId, opt = {}) {
    if (!profiles.has(bodyId)) {
      return { ok: false, reason: 'unknown_body', bodyId };
    }
    const prev = activeId;
    activeId = bodyId;
    const profile = profiles.get(bodyId);
    let calibration = null;
    if (!opt.skipCalibrate) {
      calibration = recalibrate(bodyId);
    }
    return {
      ok: true,
      previousBodyId: prev,
      activeBodyId: activeId,
      profile: { ...profile },
      calibration,
      note: '換身完成；自我認知／能力須以校準結果為準'
    };
  }

  /**
   * Stub calibration → ENGINE-02 style self-model refresh callback
   */
  function recalibrate(bodyId = activeId) {
    const p = profiles.get(bodyId);
    if (!p) return { ok: false, reason: 'unknown_body' };
    const result = {
      ok: true,
      bodyId,
      at: Date.now(),
      selfModel: {
        hasPhysicalBody: p.embodimentKind === 'physical_robot',
        jointCount: p.capability.joints.length,
        knownActions: ['gaze', 'wave', 'idle'],
        unknownActions: ['hardware_locomotion'],
        status: 'calibrated_virtual_stub'
      },
      engine02Hook: 'refreshBodyAwareness',
      disclaimer: '虛擬校準 stub｜非實機鑑定'
    };
    p.calibrated = true;
    p.calibratedAt = result.at;
    profiles.set(bodyId, p);
    calibrationLog.push(result);
    if (typeof opts.onRecalibrate === 'function') opts.onRecalibrate(result);
    return result;
  }

  function getCalibrationLog() {
    return calibrationLog.slice();
  }

  return {
    version: BODY_PROFILE_VERSION,
    status: BODY_PROFILE_STATUS,
    register,
    list,
    getActive,
    switchBody,
    recalibrate,
    getCalibrationLog,
    createBodyProfile
  };
}

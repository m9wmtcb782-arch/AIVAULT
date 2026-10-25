/**
 * ENGINE-12 per-region soft-tissue parameters (DEV).
 * Each region has independent volume / elasticity / damping / gravity / contact.
 * Whole-mesh uniform scale is FORBIDDEN as a stand-in for deformation.
 */
export const SOFT_TISSUE_PARAMS_VERSION = '0.1.0-dev';

/**
 * @typedef {object} SoftRegionParams
 * @property {string} id
 * @property {string} label
 * @property {number} volume  relative tissue volume (affects inertia / sink)
 * @property {number} elasticity  spring k toward rest (higher = firmer)
 * @property {number} damping  velocity damping 0..1-ish
 * @property {number} gravityBias  downward soft sag factor
 * @property {number} maxPenetration  meters clamp
 * @property {number} contactAreaGain  maps collider radius → effective area
 * @property {number} recoveryRate  post-release return speed multiplier
 * @property {number} lateralCoupling  how much tangential squeeze spreads
 * @property {[number,number,number]} restCenter local/world rest center
 * @property {[number,number,number]} halfExtents region AABB half-size
 */

/** @type {Record<string, SoftRegionParams>} */
export const REGION_PARAMS = Object.freeze({
  cheek_L: {
    id: 'cheek_L',
    label: '左臉頰',
    volume: 0.35,
    elasticity: 48,
    damping: 0.82,
    gravityBias: 0.15,
    maxPenetration: 0.018,
    contactAreaGain: 1.1,
    recoveryRate: 1.35,
    lateralCoupling: 0.35,
    restCenter: [-0.06, 1.52, 0.07],
    halfExtents: [0.045, 0.04, 0.035]
  },
  cheek_R: {
    id: 'cheek_R',
    label: '右臉頰',
    volume: 0.35,
    elasticity: 48,
    damping: 0.82,
    gravityBias: 0.15,
    maxPenetration: 0.018,
    contactAreaGain: 1.1,
    recoveryRate: 1.35,
    lateralCoupling: 0.35,
    restCenter: [0.06, 1.52, 0.07],
    halfExtents: [0.045, 0.04, 0.035]
  },
  chest_L: {
    id: 'chest_L',
    label: '左胸',
    volume: 1.0,
    elasticity: 22,
    damping: 0.74,
    gravityBias: 0.55,
    maxPenetration: 0.055,
    contactAreaGain: 1.4,
    recoveryRate: 0.95,
    lateralCoupling: 0.55,
    restCenter: [-0.09, 1.22, 0.12],
    halfExtents: [0.09, 0.1, 0.08]
  },
  chest_R: {
    id: 'chest_R',
    label: '右胸',
    volume: 1.0,
    elasticity: 22,
    damping: 0.74,
    gravityBias: 0.55,
    maxPenetration: 0.055,
    contactAreaGain: 1.4,
    recoveryRate: 0.95,
    lateralCoupling: 0.55,
    restCenter: [0.09, 1.22, 0.12],
    halfExtents: [0.09, 0.1, 0.08]
  },
  abdomen: {
    id: 'abdomen',
    label: '腹部',
    volume: 1.2,
    elasticity: 18,
    damping: 0.7,
    gravityBias: 0.65,
    maxPenetration: 0.06,
    contactAreaGain: 1.5,
    recoveryRate: 0.85,
    lateralCoupling: 0.6,
    restCenter: [0, 0.95, 0.1],
    halfExtents: [0.14, 0.12, 0.07]
  },
  buttock_L: {
    id: 'buttock_L',
    label: '左臀',
    volume: 1.1,
    elasticity: 20,
    damping: 0.72,
    gravityBias: 0.7,
    maxPenetration: 0.05,
    contactAreaGain: 1.35,
    recoveryRate: 0.9,
    lateralCoupling: 0.5,
    restCenter: [-0.09, 0.78, -0.08],
    halfExtents: [0.09, 0.1, 0.08]
  },
  buttock_R: {
    id: 'buttock_R',
    label: '右臀',
    volume: 1.1,
    elasticity: 20,
    damping: 0.72,
    gravityBias: 0.7,
    maxPenetration: 0.05,
    contactAreaGain: 1.35,
    recoveryRate: 0.9,
    lateralCoupling: 0.5,
    restCenter: [0.09, 0.78, -0.08],
    halfExtents: [0.09, 0.1, 0.08]
  }
});

export function listRegions() {
  return Object.values(REGION_PARAMS);
}

export function getRegion(id) {
  return REGION_PARAMS[id] || null;
}

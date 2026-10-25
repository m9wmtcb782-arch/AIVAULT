/**
 * Simplified sit motion for virtual chair (DEV stub skill).
 * Lowers root / marks sitting — NOT full locomotion or balance control.
 */
export const SIT_CONTROLLER_VERSION = '0.1.0-dev';

/**
 * @param {object} opts
 * @param {object} opts.avatar THREE.Object3D
 * @param {object} [opts.chair] { position: {x,y,z} }
 * @param {number} [opts.sitY=0.55]
 */
export function createSitController(opts = {}) {
  const avatar = opts.avatar;
  let sitting = false;
  let standY = avatar && avatar.position ? avatar.position.y : 0;

  function isSitting() {
    return !!(avatar && avatar.userData && avatar.userData.sitting) || sitting;
  }

  async function sit(chair) {
    if (!avatar) return { ok: false, reason: 'no_avatar' };
    if (isSitting()) return { ok: false, reason: 'already_sitting' };
    standY = avatar.position.y;
    const target = chair && chair.position ? chair.position : null;
    if (target) {
      avatar.position.x = target.x;
      avatar.position.z = target.z;
    }
    const sitY = opts.sitY != null ? opts.sitY : Math.max(0.35, standY - 0.45);
    // Simple tween-less snap for Phase1 acceptance (continuous blend = Phase2 motor)
    avatar.position.y = sitY;
    if (avatar.rotation) avatar.rotation.x = 0.12;
    avatar.userData = avatar.userData || {};
    avatar.userData.sitting = true;
    sitting = true;
    return {
      ok: true,
      status: 'completed',
      stub: true,
      name: 'sit_on_virtual_chair',
      pose: { y: avatar.position.y, sitting: true },
      notes: 'simplified sit — not full skeletal sit cycle'
    };
  }

  async function stand() {
    if (!avatar) return { ok: false, reason: 'no_avatar' };
    avatar.position.y = standY;
    if (avatar.rotation) avatar.rotation.x = 0;
    if (avatar.userData) avatar.userData.sitting = false;
    sitting = false;
    return { ok: true, status: 'completed', name: 'stand', pose: { y: standY, sitting: false } };
  }

  return { version: SIT_CONTROLLER_VERSION, sit, stand, isSitting };
}

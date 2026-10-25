/**
 * Controllable virtual shoulder collider (DEV).
 * Used to press into soft regions before camera shoulder tracking exists.
 */
export const SHOULDER_COLLIDER_VERSION = '0.1.0-dev';

export function createShoulderCollider(opts = {}) {
  const state = {
    id: opts.id || 'virtual_shoulder',
    x: opts.x != null ? opts.x : -0.25,
    y: opts.y != null ? opts.y : 1.22,
    z: opts.z != null ? opts.z : 0.35,
    radius: opts.radius != null ? opts.radius : 0.07,
    durationMs: 0,
    pressing: false,
    _pressStarted: 0
  };

  function setPosition(x, y, z) {
    if (x != null) state.x = x;
    if (y != null) state.y = y;
    if (z != null) state.z = z;
  }

  function setRadius(r) {
    state.radius = Math.max(0.01, r);
  }

  function startPress(now = Date.now()) {
    state.pressing = true;
    state._pressStarted = now;
    state.durationMs = 0;
  }

  function endPress() {
    state.pressing = false;
  }

  function tick(now = Date.now()) {
    if (state.pressing) state.durationMs = now - state._pressStarted;
    else state.durationMs = 0;
    return getCollider();
  }

  function getCollider() {
    return {
      id: state.id,
      x: state.x,
      y: state.y,
      z: state.z,
      radius: state.radius,
      durationMs: state.durationMs
    };
  }

  function getState() {
    return { ...state, version: SHOULDER_COLLIDER_VERSION };
  }

  return {
    version: SHOULDER_COLLIDER_VERSION,
    setPosition,
    setRadius,
    startPress,
    endPress,
    tick,
    getCollider,
    getState
  };
}

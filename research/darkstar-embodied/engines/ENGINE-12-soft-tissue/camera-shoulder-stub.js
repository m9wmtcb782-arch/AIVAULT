/**
 * Camera shoulder tracking interface — STUB ONLY (開發中).
 * Final goal: track real shoulder → drive collider into soft tissue.
 * This module does NOT run MediaPipe / pose yet.
 */
export const CAMERA_SHOULDER_STUB_VERSION = '0.0.1-stub';
export const CAMERA_SHOULDER_STATUS = '開發中';

/**
 * @param {object} opts
 * @param {object} [opts.shoulderCollider] createShoulderCollider handle
 */
export function createCameraShoulderTracker(opts = {}) {
  const collider = opts.shoulderCollider || null;

  function getStatus() {
    return {
      engine: 'ENGINE-12',
      module: 'camera-shoulder-tracker',
      version: CAMERA_SHOULDER_STUB_VERSION,
      status: CAMERA_SHOULDER_STATUS,
      tracking: false,
      mediapipe: 'not_bound',
      note: '介面預留：未來將肩膀關鍵點映射到 virtual shoulder collider'
    };
  }

  async function start() {
    return {
      ok: false,
      reason: 'not_implemented',
      status: CAMERA_SHOULDER_STATUS,
      message: '本輪請用可控制虛擬肩膀碰撞體測試軟組織；攝影機追蹤尚未實作'
    };
  }

  function stop() {
    return getStatus();
  }

  /** Planned: pose landmarks → collider.setPosition */
  function applyPoseStub(_landmarks) {
    return {
      ok: false,
      reason: 'not_implemented',
      colliderBound: !!collider
    };
  }

  return {
    version: CAMERA_SHOULDER_STUB_VERSION,
    status: CAMERA_SHOULDER_STATUS,
    start,
    stop,
    getStatus,
    applyPoseStub
  };
}

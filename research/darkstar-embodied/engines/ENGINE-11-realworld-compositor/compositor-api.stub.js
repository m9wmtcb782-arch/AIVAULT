/**
 * ENGINE-11 Real-world Scene Compositing — STUB ONLY.
 * Status: 開發中. Does NOT composite, does NOT start WebRTC.
 * Shared Body Core must be injected; this module never owns a second AI brain.
 */
export const ENGINE11_VERSION = '0.0.1-stub';
export const ENGINE11_STATUS = '開發中';

/**
 * @param {object} opts
 * @param {object} opts.bodyCore — Shared Body Core (ENGINE-02/03/08 surface)
 */
export function createRealworldCompositor(opts = {}) {
  const bodyCore = opts.bodyCore || null;
  let running = false;

  function getStatus() {
    return {
      engine: 'ENGINE-11',
      version: ENGINE11_VERSION,
      status: ENGINE11_STATUS,
      compositing: false,
      webrtc: 'not_started',
      bodyCoreBound: !!bodyCore,
      mode: 'mixed-reality-planned',
      notes: [
        'stub only — no segmentation, no overlay, no WebRTC',
        'uses Shared Body Core when bound; does not duplicate decision/motor'
      ]
    };
  }

  async function start() {
    if (!bodyCore) {
      return { ok: false, reason: 'bodyCore_required', status: ENGINE11_STATUS };
    }
    return {
      ok: false,
      reason: 'not_implemented',
      status: ENGINE11_STATUS,
      message: 'ENGINE-11 完整合成尚未實作；請用虛擬教室頁驗證 Shared Body Core'
    };
  }

  function stop() {
    running = false;
    return getStatus();
  }

  function getCompositeStream() {
    return null;
  }

  return {
    version: ENGINE11_VERSION,
    status: ENGINE11_STATUS,
    start,
    stop,
    getStatus,
    getCompositeStream,
    isRunning: () => running
  };
}

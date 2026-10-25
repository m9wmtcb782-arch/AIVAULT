/**
 * ENGINE-27｜Persistent Physiological State（開發中）
 * 跨時間連續：睡眠債／病／酒精代謝／傷＋疲交互。
 * 重新整理後依設定持續（localStorage 或注入的 storage）。
 * 提供模擬時鐘、安全重置、測試模式。
 */
export const PERSISTENT_PHYSIO_VERSION = '0.1.0-dev';
export const PERSISTENT_STATUS = '開發中';
export const DISCLAIMER = '虛擬持續生理狀態｜localStorage 模擬延續；非真實健康檔案';
export const STORAGE_KEY = 'aivault.darkstar.persistent_physio.v0.1';

function now() {
  return Date.now();
}

/** Memory storage for Node tests */
export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
    removeItem(k) {
      map.delete(k);
    }
  };
}

export function createPersistentPhysio(opts = {}) {
  const storage =
    opts.storage ||
    (typeof globalThis !== 'undefined' && globalThis.localStorage
      ? globalThis.localStorage
      : createMemoryStorage());
  const testMode = !!opts.testMode;
  let simClockMin = 0; // simulated minutes since epoch-of-sim
  let wallOriginMs = now();
  let timeScale = opts.timeScale != null ? opts.timeScale : 1; // sim minutes per real minute when auto
  let snapshot = null;

  function getSimClock() {
    return {
      simMinutes: simClockMin,
      timeScale,
      wallOriginMs,
      testMode,
      isoHint: `T+${simClockMin.toFixed(1)}min`
    };
  }

  function advanceSimMinutes(deltaMin) {
    simClockMin += Math.max(0, deltaMin);
    return getSimClock();
  }

  function setTimeScale(s) {
    timeScale = Math.max(0, Number(s) || 0);
  }

  /**
   * Persist stack-relevant fields
   */
  function save(payload) {
    const doc = {
      schema: 'aivault.darkstar.persistent_physio.v0.1',
      version: PERSISTENT_PHYSIO_VERSION,
      disclaimer: DISCLAIMER,
      savedAtWallMs: now(),
      simMinutes: simClockMin,
      timeScale,
      testMode,
      payload: payload || snapshot || {},
      interactions: payload?.interactions || snapshot?.interactions || {
        sleepDebt: 0,
        illness: 0,
        alcoholBac: 0,
        injuryFatigueMul: 1
      }
    };
    snapshot = doc.payload;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(doc));
      return { ok: true, doc };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  function load() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return { ok: false, reason: 'empty' };
      const doc = JSON.parse(raw);
      simClockMin = doc.simMinutes || 0;
      timeScale = doc.timeScale != null ? doc.timeScale : timeScale;
      snapshot = doc.payload || {};
      return { ok: true, doc, continued: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  /** Safe reset — clears persistence; testMode keeps flag */
  function safeReset() {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch (_) {}
    simClockMin = 0;
    wallOriginMs = now();
    snapshot = null;
    return { ok: true, testMode, cleared: true };
  }

  function getSnapshot() {
    return snapshot;
  }

  return {
    version: PERSISTENT_PHYSIO_VERSION,
    status: PERSISTENT_STATUS,
    disclaimer: DISCLAIMER,
    STORAGE_KEY,
    getSimClock,
    advanceSimMinutes,
    setTimeScale,
    save,
    load,
    safeReset,
    getSnapshot,
    isTestMode: () => testMode
  };
}

/**
 * Unified Sensory Nerve Bus（虛擬 stub）
 * source: virtual | hardware — 相容 schema；本階段不連真機
 */
export const SENSORY_NERVE_BUS_VERSION = '0.1.0-dev';
export const SENSORY_BUS_STATUS = '開發中';

const MODALITIES = new Set([
  'touch',
  'pressure',
  'temperature',
  'nociception',
  'vision',
  'audition',
  'proprioception',
  'olfaction',
  'gustation',
  'vestibular'
]);

/**
 * @param {object} partial
 */
export function createSensoryEvent(partial = {}) {
  const source = partial.source === 'hardware' ? 'hardware' : 'virtual';
  const modality = partial.modality || 'touch';
  if (!MODALITIES.has(modality)) {
    throw new Error(`unsupported modality: ${modality}`);
  }
  const intensity =
    partial.intensity != null ? Math.max(0, Math.min(1, Number(partial.intensity))) : 0;
  return {
    schema: 'aivault.darkstar.sensory_event.v0.1',
    id: partial.id || `sev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: partial.ts != null ? partial.ts : Date.now(),
    source,
    modality,
    bodyRegion: partial.bodyRegion || 'unknown',
    intensity,
    vector: partial.vector || null,
    confidence: partial.confidence != null ? partial.confidence : source === 'virtual' ? 0.9 : 0.5,
    rawRef: partial.rawRef || null,
    meta: partial.meta || null,
    disclaimer: '虛擬感覺事件｜hardware 僅預留｜非真實生物感受'
  };
}

/**
 * @param {{ onEvent?: Function }} [opts]
 */
export function createSensoryNerveBus(opts = {}) {
  const listeners = new Set();
  if (opts.onEvent) listeners.add(opts.onEvent);
  /** @type {object[]} */
  const log = [];

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function publish(partial) {
    const ev = createSensoryEvent(partial);
    log.push(ev);
    if (log.length > 500) log.shift();
    for (const fn of listeners) {
      try {
        fn(ev);
      } catch (_) {
        /* isolate listener errors */
      }
    }
    return ev;
  }

  function getLog() {
    return log.slice();
  }

  function clearLog() {
    log.length = 0;
  }

  return {
    version: SENSORY_NERVE_BUS_VERSION,
    status: SENSORY_BUS_STATUS,
    modalities: [...MODALITIES],
    publish,
    subscribe,
    getLog,
    clearLog,
    createSensoryEvent
  };
}

/**
 * Mock visual event feed for CI / no-camera environments.
 * Events use real timestamps at emit time (not a fixed wall-clock script claiming live perception).
 * source is always "mock" — must never be labeled as mediapipe_*.
 */
import { createEventBus } from './event-bus.js';

const SEQUENCE = [
  { delayMs: 200, type: 'face_present', confidence: 0.95, payload: { mock: true } },
  { delayMs: 600, type: 'smile', confidence: 0.72, payload: { mouthSmileLeft: 0.7, mouthSmileRight: 0.74, mock: true } },
  { delayMs: 1100, type: 'head_turn', confidence: 0.61, payload: { yaw_deg: -22, direction: 'right', mock: true } },
  { delayMs: 1600, type: 'wave', confidence: 0.68, payload: { peaks: 4, raised: true, mock: true } },
  { delayMs: 2200, type: 'smile', confidence: 0.55, payload: { mock: true, second: true } }
];

function makeEvent(partial) {
  return {
    schema: 'aivault.darkstar.visual_event.v0.1',
    id: 'mock-' + partial.type + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    ts: Date.now(),
    stream_ts: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    type: partial.type,
    confidence: partial.confidence,
    source: 'mock',
    payload: partial.payload || {},
    note: 'MOCK — not camera perception'
  };
}

/**
 * @param {object} opts
 * @param {ReturnType<typeof createEventBus>} [opts.bus]
 * @param {function} [opts.onEvent]
 * @returns {{ stop: function, bus: object, done: Promise }}
 */
export function startMockFeed(opts = {}) {
  const bus = opts.bus || createEventBus('mock-visual');
  const onEvent = opts.onEvent || (() => {});
  const timers = [];
  let stopped = false;

  const done = new Promise((resolve) => {
    SEQUENCE.forEach((step, i) => {
      const t = setTimeout(() => {
        if (stopped) return;
        const ev = makeEvent(step);
        bus.emit(ev);
        onEvent(ev);
        if (i === SEQUENCE.length - 1) resolve(bus.history());
      }, step.delayMs);
      timers.push(t);
    });
  });

  return {
    bus,
    done,
    stop() {
      stopped = true;
      timers.forEach(clearTimeout);
    }
  };
}

export function validateVisualEvent(ev) {
  const errors = [];
  if (!ev || typeof ev !== 'object') return ['not_object'];
  if (ev.schema !== 'aivault.darkstar.visual_event.v0.1') errors.push('bad_schema');
  if (!ev.id) errors.push('missing_id');
  if (typeof ev.ts !== 'number') errors.push('bad_ts');
  if (typeof ev.confidence !== 'number' || ev.confidence < 0 || ev.confidence > 1) errors.push('bad_confidence');
  const types = ['face_present', 'smile', 'head_turn', 'wave', 'hand_raised', 'lost_face'];
  if (!types.includes(ev.type)) errors.push('bad_type');
  const sources = ['mediapipe_face', 'mediapipe_hand', 'mock', 'rule'];
  if (!sources.includes(ev.source)) errors.push('bad_source');
  return errors;
}

export { SEQUENCE };

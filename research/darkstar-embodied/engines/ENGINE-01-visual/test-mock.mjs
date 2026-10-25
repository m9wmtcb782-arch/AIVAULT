/**
 * Node mock-mode unit test — no camera, no MediaPipe.
 * Run: node research/darkstar-embodied/engines/ENGINE-01-visual/test-mock.mjs
 */
import { startMockFeed, validateVisualEvent, SEQUENCE } from './mock-feed.js';
import { visualEventToControlIntent } from './map-to-intent.js';
import { createEventBus } from './event-bus.js';
import {
  smileFromBlendshapes,
  headTurnFromMatrix,
  createWaveDetector
} from './detectors.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// 1) Detector unit: smile
const smile = smileFromBlendshapes([
  {
    categories: [
      { categoryName: 'mouthSmileLeft', score: 0.6 },
      { categoryName: 'mouthSmileRight', score: 0.7 }
    ]
  }
]);
assert(smile && smile.type === 'smile' && smile.confidence >= 0.45, 'smile detector');

// 2) Head turn from identity-ish rotated matrix (yaw ~30deg)
const yaw = 30 * Math.PI / 180;
const c = Math.cos(yaw);
const s = Math.sin(yaw);
const m = new Float32Array(16);
m[0] = c; m[8] = -s; // r00, r20 for atan2(-r20,r00)
m[5] = 1; m[10] = 1; m[15] = 1;
const turn = headTurnFromMatrix(m, 10);
assert(turn && turn.type === 'head_turn', 'head turn detector');

// 3) Wave detector peaks
const wd = createWaveDetector({ windowMs: 1000, minPeaks: 3, raiseY: 0.9 });
const t0 = 1000;
let wave = null;
for (let i = 0; i < 20; i++) {
  const x = 0.5 + Math.sin(i * 0.9) * 0.08;
  wave = wd.push([[{ x, y: 0.3, z: 0 }]], t0 + i * 40) || wave;
}
assert(wave && wave.type === 'wave' && wave.source === 'mediapipe_hand', 'wave detector');

// 4) Mock feed schema + timestamps + mapping
const bus = createEventBus();
const seen = [];
const feed = startMockFeed({
  bus,
  onEvent: (ev) => {
    const errs = validateVisualEvent(ev);
    assert(errs.length === 0, 'invalid event ' + JSON.stringify(errs) + ' ' + JSON.stringify(ev));
    assert(ev.source === 'mock', 'mock source required');
    seen.push(ev);
  }
});

const history = await feed.done;
assert(history.length === SEQUENCE.length, 'sequence length');
assert(seen.length === SEQUENCE.length, 'seen length');
for (let i = 1; i < seen.length; i++) {
  assert(seen[i].ts >= seen[i - 1].ts, 'timestamps non-decreasing');
}
const types = new Set(seen.map((e) => e.type));
assert(types.has('smile') && types.has('head_turn') && types.has('wave'), 'expected types');

const intent = visualEventToControlIntent(seen.find((e) => e.type === 'wave'));
assert(intent && intent.motion?.right_arm === 'wave', 'map wave');
assert(intent.source.decision === 'demo_visual_map', 'demo map label');

console.log(JSON.stringify({
  ok: true,
  events: seen.map((e) => ({ type: e.type, source: e.source, confidence: e.confidence })),
  mapped_wave_intent: intent.intent,
  note: 'mock+unit detectors only — camera path needs browser+getUserMedia'
}, null, 2));

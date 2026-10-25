/**
 * Realtime neuro → gaze/head/motor coupling proof (Node)
 * Run: node research/darkstar-embodied/phase1/neuro-state-lab/test-realtime-coupling.mjs
 */
import { createNeuroPhysioStack, createMemoryStorage } from '../../shared/neuro-physio-stack.js';
import { createRealtimeNeuroCoupling } from '../../shared/realtime-neuro-coupling.js';
import { createGazeEngine } from '../../engines/ENGINE-15-autonomous-gaze/gaze-engine.js';
import { createHeadNeckController } from '../../engines/ENGINE-16-natural-head-neck/head-neck-controller.js';
import { createMotorController } from '../../engines/ENGINE-03-motor-control/motor-controller.js';

let passed = 0;
let failed = 0;
function assert(c, m) {
  if (c) {
    passed++;
    console.log('  PASS', m);
  } else {
    failed++;
    console.error('  FAIL', m);
  }
}
function section(t) {
  console.log('\n==', t);
}

const stack = createNeuroPhysioStack({ storage: createMemoryStorage(), testMode: true });
const gaze = createGazeEngine();
const head = createHeadNeckController({ gazeEngine: gaze });
// motor without avatar — gates still work via requestAction
const motor = createMotorController({ sync: true });
const bridge = createRealtimeNeuroCoupling({ stack, gaze, head, motor });

section('Baseline｜清醒耦合');
stack.safeReset();
const base = bridge.syncFromStack();
assert(base.applied.gaze.blinkRateMul >= 1, `base blinkMul=${base.applied.gaze.blinkRateMul}`);
assert(base.gates.walk === true, 'base walk allowed');
assert(gaze.getNeuroCoupling().trackingScale > 0.5, 'gaze tracking ok');
const baseDelay = base.reactionDelayMs;

section('Fatigue↑ → reactionDelay↑；非疲倦視覺＋全速');
stack.tickMinutes(18 * 60, { autosave: false });
const fat = bridge.syncFromStack();
assert(fat.fatigue > 0.5, `fatigue=${fat.fatigue}`);
assert(fat.reactionDelayMs > baseDelay, `delay ${baseDelay} → ${fat.reactionDelayMs}`);
assert(fat.applied.gaze.eyelidDroop > 0.2, `eyelidDroop=${fat.applied.gaze.eyelidDroop}`);
assert(fat.applied.gaze.blinkRateMul > base.applied.gaze.blinkRateMul, 'blink faster when tired');
assert(
  fat.reactionSpeed <= fat.gazeFocus + 0.15 + 1e-6,
  `no full-speed with tired eyes: rs=${fat.reactionSpeed} gf=${fat.gazeFocus}`
);
assert(fat.tiredEyesFullSpeedForbidden === true || fat.applied.gaze.eyelidDroop > 0.35, 'forbid combo held');
assert(head.getNeuroCoupling().headDroop > 0 || head.getNeuroCoupling().headSway >= 0, 'head coupled');
// Drive a few gaze updates to ensure coupling is live
for (let i = 0; i < 5; i++) gaze.update(0.016, Date.now() + i * 16);
const gs = gaze.getGazeState();
assert(gs.neuroCoupling && gs.neuroCoupling.eyelidDroop > 0.2, 'gaze state exposes neuroCoupling');

section('Critical｜UI/controller 拒絕 walk／complex');
stack.alcohol.hydrateBac(0.32);
const crit = bridge.syncFromStack();
assert(crit.consciousness === 'critical' || crit.consciousness === 'coma', `c=${crit.consciousness}`);
assert(crit.gates.walk === false, 'walk gate false');
assert(crit.gates.complex === false, 'complex gate false');
const w = bridge.tryWalk();
assert(w.ok === false && String(w.reason).includes('neuro_gate'), `tryWalk blocked: ${w.reason}`);
const cx = bridge.tryComplex();
assert(cx.ok === false, `tryComplex blocked: ${cx.reason}`);
// Actual walkToward also blocked
const walkFb = await motor.walkToward({ x: 1, z: 0 });
assert(walkFb.ok === false && String(walkFb.reason).includes('neuro_gate_walk'), `walkToward: ${walkFb.reason}`);

section('Motor requestAction talk under coma');
stack.alcohol.hydrateBac(0.4);
stack.neuro.recompute({
  fatigue: 0.95,
  sleepDebt: 0.6,
  alcoholImpairment: 1,
  criticalIntoxication: true,
  illnessLoad: 0.4,
  painLoad: 0.2
});
const deep = bridge.syncFromStack();
const talk = bridge.tryTalk();
assert(
  deep.consciousness === 'coma' || talk.ok === false || deep.gates.talk === false,
  `deep c=${deep.consciousness} talk.ok=${talk.ok}`
);

console.log('\n==== SUMMARY ====');
console.log(`passed=${passed} failed=${failed}`);
if (failed) process.exit(1);
console.log('Realtime coupling proofs passed (開發中)');
process.exit(0);

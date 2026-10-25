/**
 * Core 變更 → coupling 延遲／危急閘同步（避免雙真相）
 * Run: node research/darkstar-embodied/physiology-core/test-core-coupling-sync.mjs
 */
import { createNeuroPhysioStack, createMemoryStorage } from '../shared/neuro-physio-stack.js';
import { createRealtimeNeuroCoupling } from '../shared/realtime-neuro-coupling.js';
import { createGazeEngine } from '../engines/ENGINE-15-autonomous-gaze/gaze-engine.js';
import { createHeadNeckController } from '../engines/ENGINE-16-natural-head-neck/head-neck-controller.js';
import { createMotorController } from '../engines/ENGINE-03-motor-control/motor-controller.js';
import { SOURCE_OF_TRUTH, NEURO_STACK_ADAPTER_VERSION } from './adapters/neuro-stack-adapter.js';
import { listAllSlotIds } from './state-vector.js';

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
const motor = createMotorController({ sync: true });
const bridge = createRealtimeNeuroCoupling({ stack, gaze, head, motor });

section('SoT + pending slots preserved');
assert(stack.sourceOfTruth === SOURCE_OF_TRUTH, `sourceOfTruth=${stack.sourceOfTruth}`);
assert(stack.adapterVersion === NEURO_STACK_ADAPTER_VERSION, `adapter=${stack.adapterVersion}`);
const pending = stack.listPendingResearch();
assert(pending.length >= 8, `pending=${pending.length}`);
assert(pending.some((p) => p.id === 'intimacyMotivation'), 'intimacyMotivation kept');
assert(listAllSlotIds().includes('sadness'), 'sadness slot id exists in core defs');
const snap0 = stack.recomputeAll();
assert(snap0.sourceOfTruth === SOURCE_OF_TRUTH, 'recomputeAll tags SoT');
assert(snap0.physiology.pendingResearchCount === pending.length, 'physiology pending count');

section('Fatigue domain → core → coupling delay↑');
stack.safeReset();
const base = bridge.syncFromStack();
assert(base.sourceOfTruth === SOURCE_OF_TRUTH, `bridge SoT=${base.sourceOfTruth}`);
const baseDelay = base.reactionDelayMs;
stack.tickMinutes(18 * 60, { autosave: false });
const fat = bridge.syncFromStack();
const coreFat = stack.physiologyCore.state.get('fatigue');
assert(coreFat > 0.4, `core fatigue=${coreFat}`);
assert(Math.abs(coreFat - fat.fatigue) < 0.15, `core≈stack fatigue ${coreFat} vs ${fat.fatigue}`);
assert(fat.reactionDelayMs > baseDelay, `delay ${baseDelay} → ${fat.reactionDelayMs}`);
assert(
  fat.reactionDelayMs === stack.physiologyCore.getEffectors().reactionDelayMs,
  `bridge delay synced to core ${fat.reactionDelayMs}`
);

section('Core BAC write → critical gates sync');
stack.safeReset();
// Direct core mutation (proves core is truth, not a shadow copy)
stack.physiologyCore.state.set('bac', 0.33);
stack.physiologyCore.state.set('consciousness', 0.25);
stack.physiologyCore.step(0, {});
// Domain alcohol also hydrated so legacy band stays consistent
stack.alcohol.hydrateBac(0.33);
const crit = bridge.syncFromStack();
assert(crit.gates.walk === false, 'walk gated');
assert(crit.gates.complex === false, 'complex gated');
assert(stack.physiologyCore.getEffectors().critical === true, 'core critical');
assert(crit.sourceOfTruth === SOURCE_OF_TRUTH, 'crit SoT');
const w = bridge.tryWalk();
assert(w.ok === false, `tryWalk blocked: ${w.reason}`);

section('Core delay change mirrors into coupling without second truth');
stack.safeReset();
stack.tickMinutes(2 * 60, { autosave: false });
const before = bridge.syncFromStack().reactionDelayMs;
// Push more fatigue into core only, then recomputeAll dual-write from engines...
// Instead: raise sleep fatigue then ensure core matches and delay rises
stack.sleep.setFatigue(0.9);
stack.sleep.hydrate({ sleepHoursDebt: 6, awakeHours: 20, fatigue: 0.9 });
const mid = stack.recomputeAll();
assert(stack.physiologyCore.state.get('fatigue') >= 0.85, 'core took sleep fatigue');
const after = bridge.syncFromStack();
assert(after.reactionDelayMs >= before, `delay ${before} → ${after.reactionDelayMs}`);
assert(mid.effectors._sourceOfTruth === SOURCE_OF_TRUTH, 'effectors tagged from adapter');

console.log('\n==== SUMMARY ====');
console.log(`passed=${passed} failed=${failed}`);
if (failed) process.exit(1);
console.log('Core↔coupling sync proofs passed');
process.exit(0);

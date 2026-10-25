/**
 * Core ↔ sensory stack sync + nerve-bus danger path
 * Run: node research/darkstar-embodied/physiology-core/test-core-sensory-sync.mjs
 */
import { createSensoryPhysioStack } from '../shared/sensory-physio-stack.js';
import { createSkillGate } from '../embodiment-interfaces/skill-gate.js';
import {
  SOURCE_OF_TRUTH,
  SENSORY_STACK_ADAPTER_VERSION
} from './adapters/sensory-stack-adapter.js';

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

const stack = createSensoryPhysioStack({ timeScale: 50 });

section('SoT + pending preserved');
assert(stack.sourceOfTruth === SOURCE_OF_TRUTH, `SoT=${stack.sourceOfTruth}`);
assert(stack.adapterVersion === SENSORY_STACK_ADAPTER_VERSION, 'adapter version');
const pending = stack.listPendingResearch();
assert(pending.length >= 8, `pending=${pending.length}`);
assert(pending.some((p) => p.id === 'intimacyMotivation'), 'intimacyMotivation kept');

section('Hot stimulus → nerve bus nociception + core + danger (not expression-only)');
stack.reset();
const hot = stack.processStimulus({
  region: 'hand_R',
  type: 'temperature',
  temperatureC: 80,
  intensity: 1,
  source: 'virtual_hot_plate'
});
assert(hot.ok && hot.sourceOfTruth === SOURCE_OF_TRUTH, 'hot SoT');
assert(hot.nerveEvents.some((e) => e.source === 'virtual'), 'nerve virtual source');
assert(hot.nerveEvents.some((e) => e.modality === 'nociception'), 'nociception on bus');
assert(hot.nerveEvents.some((e) => e.modality === 'temperature'), 'temperature on bus');
assert(hot.danger && hot.danger.notExpressionOnly === true, 'danger notExpressionOnly');
assert(hot.protectionPath.reflexFirst === true, 'protection reflex first');
assert(hot.protectionPath.nerveBusNociception === true, 'protection via nerve bus');
assert(hot.protectionPath.dangerMemory === true, 'danger memory recorded');
assert(stack.physiologyCore.state.get('nociception') > 0.3, 'core nociception');
assert(
  Math.abs(stack.physiologyCore.state.get('nociception') - hot.coreSensory.nociception) < 1e-9,
  'coreSensory mirrors core'
);
assert(stack.memory.getDangerLog().length >= 1, 'memory danger log');
assert(stack.getNerveEventLog().length >= 2, 'stack nerve log');

section('Injury → core injuryLoad');
stack.reset();
const hit = stack.processStimulus({
  region: 'forearm_R',
  type: 'collision',
  impactForce: 40,
  intensity: 0.5,
  source: 'virtual_obstacle'
});
assert(hit.injury && hit.injury.kind === 'bruise', 'bruise');
assert(stack.physiologyCore.state.get('injuryLoad') > 0.2, 'core injuryLoad');
assert(hit.coreSensory.injuryLoad > 0.2, 'coreSensory injuryLoad');

section('Fracture still gates via memory; core aligned');
stack.reset();
const frac = stack.processStimulus({
  region: 'upper_arm_R',
  type: 'collision',
  impactForce: 100,
  intensity: 1,
  source: 'virtual_fall'
});
assert(frac.injury && frac.injury.kind === 'fracture', 'fracture');
assert(stack.physiologyCore.state.get('injuryLoad') >= 0.8, 'high injuryLoad');
const blocked = stack.memory.blocksAction('lift_heavy', { side: 'R' });
assert(blocked.blocked === true, 'lift still blocked by ENGINE-22');

section('Hardware skill remains locked (embodiment gate)');
const gate = createSkillGate();
gate.register({ id: 'arm_reach_hw', domain: 'hardware' });
assert(gate.get('arm_reach_hw').locked === true, 'hw locked');
assert(gate.canExecute('arm_reach_hw', 'hardware').can === false, 'hw execute denied');

console.log('\n==== SUMMARY ====');
console.log(`passed=${passed} failed=${failed}`);
if (failed) process.exit(1);
console.log('Core↔sensory sync proofs passed');
process.exit(0);

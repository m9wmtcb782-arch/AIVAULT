/**
 * Embodiment-agnostic interfaces — minimal acceptance
 */
import { createSensoryNerveBus } from './sensory-nerve-bus.js';
import { createBodyControlBus, createCapabilityDescriptor } from './body-control-bus.js';
import { createBodyProfileRegistry } from './body-profile.js';
import { createSkillGate } from './skill-gate.js';

let passed = 0;
let failed = 0;
function ok(name, cond, d) {
  if (cond) {
    passed++;
    console.log('  PASS', name);
  } else {
    failed++;
    console.log('  FAIL', name, d || '');
  }
}

console.log('=== Embodiment interfaces ===\n');

console.log('[sensory]');
const bus = createSensoryNerveBus();
const ev = bus.publish({
  source: 'virtual',
  modality: 'nociception',
  bodyRegion: 'RightHand',
  intensity: 0.7
});
ok('virtual sensory event', ev.source === 'virtual' && ev.modality === 'nociception');
const hw = bus.publish({ source: 'hardware', modality: 'pressure', bodyRegion: 'LeftHand', intensity: 0.2 });
ok('hardware source allowed in schema', hw.source === 'hardware');
ok('log has 2', bus.getLog().length === 2);

console.log('\n[control]');
const control = createBodyControlBus({
  capability: createCapabilityDescriptor({
    bodyId: 'v1',
    joints: [{ id: 'RightArm', dof: 3 }]
  })
});
ok('accept known joint', control.submit({ type: 'joint_target', jointId: 'RightArm', value: 0.2 }).ok);
ok('reject unknown joint', control.submit({ type: 'joint_target', jointId: 'Tail', value: 1 }).ok === false);
ok(
  'reject hardware torque on virtual',
  control.submit({ type: 'hardware_torque', jointId: 'RightArm' }).ok === false
);

console.log('\n[profile / switch]');
let calibrated = 0;
const reg = createBodyProfileRegistry({
  onRecalibrate: () => {
    calibrated += 1;
  }
});
reg.register({ bodyId: 'body-a', displayName: 'A' });
reg.register({
  bodyId: 'body-b',
  displayName: 'B',
  joints: [{ id: 'Head', dof: 3 }]
});
const sw = reg.switchBody('body-b');
ok('switch ok', sw.ok && sw.activeBodyId === 'body-b');
ok('recalibrate hooked (ENGINE-02 style)', calibrated >= 1 && sw.calibration.ok);
ok('active calibrated', reg.getActive().calibrated === true);

console.log('\n[skill gate]');
const gate = createSkillGate();
gate.register({ id: 'wave_virtual', domain: 'virtual' });
gate.register({ id: 'arm_reach_hw', domain: 'hardware', label: '實體伸手' });
ok('hardware starts locked', gate.get('arm_reach_hw').locked === true);
ok('hardware not enabled', gate.get('arm_reach_hw').hardwareEnabled === false);
gate.markVirtualValidated('wave_virtual', { lab: 'phase1' });
ok('virtual execute ok', gate.canExecute('wave_virtual', 'virtual').can === true);
ok(
  'hardware execute denied by default',
  gate.canExecute('arm_reach_hw', 'hardware').can === false
);
const denied = gate.tryEnableHardware('arm_reach_hw', { calibrated: true });
ok('enable without full proof denied', denied.ok === false);
const enabled = gate.tryEnableHardware('arm_reach_hw', {
  calibrated: true,
  realWorldValidated: true,
  authorized: true
});
ok('enable with proof ok', enabled.ok === true && gate.canExecute('arm_reach_hw', 'hardware').can);

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
if (failed) process.exit(1);
process.exit(0);

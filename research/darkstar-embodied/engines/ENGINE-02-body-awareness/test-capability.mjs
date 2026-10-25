/**
 * ENGINE-02 / ENGINE-05 capability boundary tests (Node, no browser).
 * Run: node research/darkstar-embodied/engines/ENGINE-02-body-awareness/test-capability.mjs
 */
import { createBodyAwareness } from './body-awareness.js';
import { createCapabilityEngine } from '../ENGINE-05-capability/capability-engine.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log('  PASS', msg);
  } else {
    failed += 1;
    console.error('  FAIL', msg);
  }
}

function section(title) {
  console.log('\n==', title);
}

// Mock controller mirroring phase1 surface
const mockController = {
  version: '0.2.0-dev-mock',
  armIkVersion: '0.2.0-dev',
  macros: ['idle_stand', 'turn_toward_target', 'smile', 'blink', 'mouth_open', 'wave'],
  getLastFeedback: () => ({ status: 'idle' }),
  inspectArms: () => ({
    version: '0.2.0-dev',
    R: { upper: { name: 'RightArm' }, fore: { name: 'RightForeArm' }, hand: { name: 'RightHand' } },
    L: { upper: { name: 'LeftArm' }, fore: { name: 'LeftForeArm' }, hand: { name: 'LeftHand' } }
  })
};

const awareness = createBodyAwareness({
  controller: mockController,
  mockState: {
    boneCount: 912,
    pose: { position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 }, standing: true, sitting: false },
    skeleton: { boneCount: 912, hints: ['neck'], armChains: { R: true, L: true }, morphCapable: true }
  },
  scene: {
    id: 'virtual-classroom-test',
    objects: {
      chair: { id: 'chair-1', domain: 'virtual' },
      blackboard: { id: 'bb-1', domain: 'virtual', text: 'HELLO' },
      eraser: { id: 'eraser-1', domain: 'virtual' }
    }
  }
});

section('getBodyState connects to controller (not empty table)');
const state = awareness.getBodyState();
assert(state.embodiment.hasPhysicalBody === false, 'hasPhysicalBody=false');
assert(state.embodiment.canOperatePhysicalObjects === false, 'canOperatePhysicalObjects=false');
assert(state.controller.bound === true, 'controller bound');
assert(state.controller.version === '0.2.0-dev-mock', 'controller version from live bind');
assert(state.skills.learned.includes('wave'), 'wave in learned skills');
assert(state.asset.path.includes('technical-dark-star-avatar.glb'), 'asset path present');
assert(state.jointRanges.shoulder && state.jointRanges.elbow, 'jointRanges from safety layer');

section('Test1 sit_on_virtual_chair → can=true');
const sit = awareness.canPerform('sit_on_virtual_chair');
assert(sit.can === true, `sit can=true (${sit.reason})`);
assert(sit.domain === 'virtual', 'sit domain=virtual');

section('Test2 erase_virtual_blackboard → can=true when eraser+board+skill');
const eraseV = awareness.canPerform('erase_virtual_blackboard');
assert(eraseV.can === true, `erase virtual can=true (${eraseV.reason})`);
assert(eraseV.domain === 'virtual', 'erase virtual domain');

section('Test2b erase virtual without eraser → can=false');
awareness.setScene({ id: 'no-eraser', objects: { chair: {}, blackboard: {} } });
const eraseNo = awareness.canPerform('erase_virtual_blackboard');
assert(eraseNo.can === false, `no eraser blocked (${eraseNo.reason})`);
assert(String(eraseNo.reason).includes('eraser') || String(eraseNo.reason).includes('物件'), 'reason mentions missing eraser');
// restore scene
awareness.setScene({
  id: 'virtual-classroom-test',
  objects: { chair: {}, blackboard: { text: 'HELLO' }, eraser: {} }
});

section('Test3 erase_real_classroom_blackboard → can=false');
const eraseR = awareness.canPerform('erase_real_classroom_blackboard');
assert(eraseR.can === false, 'erase real can=false');
assert(eraseR.domain === 'physical', 'erase real domain=physical');
assert(
  String(eraseR.reason).includes('無實體') || String(eraseR.reason).includes('現實'),
  `reason explicit physical denial: ${eraseR.reason}`
);

section('ENGINE-05 capability wrapper delegates');
const cap = createCapabilityEngine({ bodyAwareness: awareness });
const c1 = cap.canPerform('sit_on_virtual_chair');
const c2 = cap.canPerform('erase_virtual_blackboard');
const c3 = cap.canPerform('erase_real_classroom_blackboard');
assert(c1.can === true, 'ENGINE-05 sit ok');
assert(c2.can === true, 'ENGINE-05 erase virtual ok');
assert(c3.can === false, 'ENGINE-05 erase real denied');

section('Already sitting blocks sit');
awareness.setMockState({
  boneCount: 912,
  pose: { position: { x: 0, y: 0, z: 0 }, standing: false, sitting: true },
  sitting: true
});
const sit2 = awareness.canPerform('sit_on_virtual_chair');
assert(sit2.can === false, `already sitting blocked (${sit2.reason})`);

console.log('\n--------------------------------');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log('ALL CAPABILITY TESTS PASSED');

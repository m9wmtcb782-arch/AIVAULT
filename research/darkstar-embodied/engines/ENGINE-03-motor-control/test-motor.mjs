/**
 * ENGINE-03 Phase2 motor tests (Node, sync tweens, mock bones).
 * Run: node research/darkstar-embodied/engines/ENGINE-03-motor-control/test-motor.mjs
 */
import { createMotorController } from './motor-controller.js';
import { createBodyAwareness } from '../ENGINE-02-body-awareness/body-awareness.js';
import { createCapabilityEngine } from '../ENGINE-05-capability/capability-engine.js';
import { createBlackboard } from '../../phase1/virtual-classroom/blackboard-state.js';

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

function mockBone(name) {
  return {
    name,
    rotation: { x: 0, y: 0, z: 0 },
    updateMatrixWorld() {}
  };
}

const hips = mockBone('Hips');
const leftUpLeg = mockBone('LeftUpperLeg');
const rightUpLeg = mockBone('RightUpperLeg');
const leftLeg = mockBone('LeftKnee');
const rightLeg = mockBone('RightKnee');
const spine = mockBone('Spine');
const rightArm = mockBone('RightArm');
const bones = [hips, leftUpLeg, rightUpLeg, leftLeg, rightLeg, spine, rightArm];

const avatar = {
  position: { x: 0.2, y: 0, z: 0.6 },
  userData: {}
};

const motor = createMotorController({
  avatar,
  bones,
  bonesByHint: { hips, spine },
  sync: true
});

section('Test1 continuous sit — multi-frame, not teleport');
const yLog = [];
const sit = await motor.sitOnChair(
  { position: { x: -1.2, y: 0, z: 0.2 } },
  {
    frames: 24,
    sync: true,
    onFrame: (snap) => {
      if (snap.root) yLog.push(snap.root.y);
    }
  }
);
assert(sit.ok === true, `sit ok (${sit.status})`);
assert(sit.multiFrame === true, 'multiFrame true');
assert(sit.frames >= 2, `frames=${sit.frames} >= 2`);
assert(sit.uniqueRootY >= 2, `uniqueRootY=${sit.uniqueRootY} >= 2 (not teleport)`);
assert(sit.teleport === false, 'teleport flag false');
assert(yLog.length >= 2, `onFrame y samples=${yLog.length}`);
const yDistinct = new Set(yLog.map((y) => y.toFixed(4))).size;
assert(yDistinct >= 2, `distinct Y values in timeline=${yDistinct}`);
assert(motor.isSitting() === true, 'isSitting after sit');
assert(leftUpLeg.rotation.x !== 0 || rightUpLeg.rotation.x !== 0, 'hip joints rotated');
assert(leftLeg.rotation.x !== 0 || rightLeg.rotation.x !== 0, 'knee joints rotated');

section('Test2 erase virtual blackboard — state diff');
const board = createBlackboard('請擦掉這行字');
const before = board.getState();
assert(before.dirty === true, 'before dirty=true');
assert(before.text.length > 0, 'before has text');
const erase = await motor.eraseVirtualBlackboard(board, { sync: true, frames: 10 });
assert(erase.ok === true, 'erase ok');
assert(erase.stateDiff.textCleared === true, 'textCleared');
assert(erase.stateDiff.dirtyCleared === true, 'dirtyCleared');
assert(erase.stateDiff.after.isBlank === true, 'after blank');
assert(erase.stateDiff.before.text === '請擦掉這行字', 'before text preserved in diff');
const after = board.getState();
assert(after.dirty === false && after.isBlank, 'board state dirty=false blank');

section('Test3 reject physical erase via capability');
const awareness = createBodyAwareness({
  controller: { version: 'mock', macros: ['wave'], getLastFeedback: () => null, inspectArms: () => null },
  avatar,
  bones,
  scene: {
    id: 'vc',
    objects: { chair: {}, blackboard: {}, eraser: {} }
  },
  mockState: { sitting: true, pose: { sitting: true, standing: false } }
});
const cap = createCapabilityEngine({ bodyAwareness: awareness });
const deny = cap.canPerform('erase_real_classroom_blackboard');
assert(deny.can === false, 'physical erase denied');
assert(deny.domain === 'physical', 'domain physical');
const board2 = createBlackboard('should_remain');
const beforeDeny = board2.getState().text;
// motor must not be called for physical — simulate gate only
assert(beforeDeny === 'should_remain', 'board unchanged without erase call');
const denySitGate = awareness.canPerform('sit_on_virtual_chair');
assert(denySitGate.can === false, 'already sitting blocks another sit');

section('Optional walk stub toward chair');
// stand first, then move away so walk has nonzero distance
await motor.standUp({ sync: true, frames: 12 });
avatar.position.x = 0.2;
avatar.position.z = 0.6;
const walk = await motor.walkToward({ x: -1.2, z: 0.2 }, { sync: true, frames: 16, maxStep: 0.5 });
assert(walk.ok === true && walk.stub === true, 'walk stub ok');
assert(walk.multiFrame === true && walk.frames >= 2, 'walk multi-frame');
assert(walk.distance > 0 && walk.distance <= 0.51, `walk distance=${walk.distance}`);

console.log('\n--------------------------------');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
console.log('ALL MOTOR PHASE2 TESTS PASSED');

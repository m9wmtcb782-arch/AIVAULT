/**
 * ENGINE-15／16 automated tests (Node, no MP4).
 * node research/darkstar-embodied/engines/ENGINE-15-autonomous-gaze/test-gaze-head.mjs
 */
import { createGazeEngine, lookAnglesToward } from './gaze-engine.js';
import { createHeadNeckController } from '../ENGINE-16-natural-head-neck/head-neck-controller.js';
import { createConversationTracker } from '../../shared/conversation-target-tracking.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  return { name, rotation: { x: 0, y: 0, z: 0 } };
}

section('Conversation target tracking roles');
const tr = createConversationTracker();
tr.setMode('answering_user');
assert(tr.resolveGazeTarget() === 'user_eyes', 'answer user → user_eyes');
tr.setMode('answering_friend');
assert(tr.resolveGazeTarget() === 'virtual_camera', 'answer friend → virtual_camera (not friend_display)');
tr.setMode('listening_friend');
assert(tr.resolveGazeTarget() === 'friend_display', 'listen friend → friend_display');
tr.rotateThreeWay('darkstar_to_friend');
assert(tr.getState().currentGazeTarget === 'virtual_camera', 'three_way answer friend → virtual_camera');
tr.rotateThreeWay('darkstar_to_user');
assert(tr.getState().currentGazeTarget === 'user_eyes', 'three_way answer user → user_eyes');

section('lookAnglesToward math');
const a = lookAnglesToward({ x: 0, y: 1.5, z: 0 }, { x: 0.5, y: 1.5, z: 1 });
assert(a.yaw > 0, `yaw toward +X = ${a.yaw}`);
const b = lookAnglesToward({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 1.8, z: 1 });
assert(b.pitch > 0, `pitch up = ${b.pitch}`);

section('Gaze target switch user ↔ virtual camera');
const leftEye = mockBone('LeftEye');
const rightEye = mockBone('RightEye');
const head = mockBone('Head');
const neck = mockBone('Neck');
const morphLog = [];
const gaze = createGazeEngine({
  bonesByHint: { leftEye, rightEye, head },
  setMorph: (n, v) => morphLog.push([n, v]),
  headOrigin: { x: 0, y: 1.55, z: 0.05 }
});
gaze.tracker.setUserEyePos({ x: 0.35, y: 1.55, z: 1.2 });
gaze.tracker.setVirtualCameraGaze({ x: 0, y: 1.52, z: 2.4 });
gaze.speakToUser();
for (let i = 0; i < 40; i++) gaze.update(1 / 60, 1000 + i * 16);
const gUser = gaze.getGazeState();
assert(gUser.currentGazeTarget === 'user_eyes' || gUser.currentGazeTarget === 'away', `user mode target=${gUser.currentGazeTarget}`);
assert(Math.abs(gUser.eyeYawDeg) > 0.5, `eyes moved for user eyeYaw=${gUser.eyeYawDeg}`);
const yawUser = gUser.eyeYawDeg;

gaze.speakToFriend();
for (let i = 0; i < 50; i++) gaze.update(1 / 60, 2000 + i * 16);
const gFriend = gaze.getGazeState();
assert(
  gFriend.currentGazeTarget === 'virtual_camera' || gFriend.currentGazeTarget === 'away',
  `friend mode target=${gFriend.currentGazeTarget}`
);
assert(
  Math.abs(gFriend.eyeYawDeg - yawUser) > 0.3 || gFriend.currentGazeTarget !== gUser.currentGazeTarget,
  `gaze differs user vs friend (yaw ${yawUser} → ${gFriend.eyeYawDeg})`
);
assert(gFriend.calibration.speakToFriendUses === 'virtual_camera', 'calibration note set');
assert(gFriend.webrtcThreePane === 'NOT_IMPLEMENTED', 'WebRTC marked not implemented');
assert(gFriend.sharedBodyCore === true, 'shared body core tag');

section('Eye bones applied (coordinated)');
assert(Math.abs(leftEye.rotation.y - rightEye.rotation.y) < 1e-6, 'L/R eye yaw coordinated');
assert(Math.abs(leftEye.rotation.x - rightEye.rotation.x) < 1e-6, 'L/R eye pitch coordinated');

section('Head follows eyes with lag (ENGINE-16)');
const headCtl = createHeadNeckController({
  bonesByHint: {
    head,
    neck,
    leftShoulder: mockBone('LeftShoulder'),
    rightShoulder: mockBone('RightShoulder')
  },
  gazeEngine: gaze
});
gaze.speakToUser();
gaze.tracker.setUserEyePos({ x: 0.6, y: 1.55, z: 1.0 });
// Reset by running a few frames with eyes updating first
let firstLag = null;
let eyesLed = false;
for (let i = 0; i < 30; i++) {
  gaze.update(1 / 60, 5000 + i * 16);
  headCtl.update(1 / 60, { speaking: true });
  const lag = headCtl.measureHeadLagVsEye();
  if (i === 2) firstLag = lag;
  if (lag && lag.eyesLead) eyesLed = true;
}
const lagEnd = headCtl.measureHeadLagVsEye();
assert(eyesLed, 'eyes lead head during pursuit');
assert(lagEnd && Math.abs(lagEnd.headYawDeg) < Math.abs(lagEnd.eyeYawDeg) + 5, 'head cover < full eye yaw (approx)');
assert(!headCtl.isInstantSnap(20), 'no instant head snap (>20°/2frames)');

section('Three-way rotation switches targets');
const targets = [];
['user', 'darkstar_to_user', 'friend', 'darkstar_to_friend'].forEach((turn, idx) => {
  gaze.tracker.rotateThreeWay(turn, 8000 + idx * 100);
  for (let i = 0; i < 10; i++) {
    gaze.update(1 / 60, 8000 + idx * 200 + i * 16);
    headCtl.update(1 / 60);
  }
  targets.push(gaze.tracker.getState().currentGazeTarget);
});
assert(targets.includes('user_eyes'), `has user_eyes in ${targets}`);
assert(targets.includes('virtual_camera'), `has virtual_camera in ${targets}`);
assert(targets.includes('friend_display'), `has friend_display in ${targets}`);

section('Decision report interface');
const rep = gaze.reportToDecision();
assert(rep.engine === 'ENGINE-15' && rep.schema === 'aivault.darkstar.gaze_state.v0.1', 'decision schema');
assert(rep.conversation && 'answerTarget' in rep.conversation, 'conversation state in report');

section('Anti mechanical fixed-cycle (head)');
// Run irregular listening/speaking mix — should not trip fixed-cycle detector easily
for (let i = 0; i < 180; i++) {
  if (i % 47 === 0) gaze.speakToFriend();
  if (i % 53 === 0) gaze.speakToUser();
  gaze.update(1 / 60, 10000 + i * 16);
  headCtl.update(1 / 60, { speaking: i % 2 === 0, listening: i % 3 === 0 });
}
assert(!headCtl.isFixedCycleYaw(20), 'yaw not extreme fixed-period cycle');

const report = {
  ts: new Date().toISOString(),
  zone: 'Asia/Taipei',
  passed,
  failed,
  targetsSample: targets,
  lagEnd,
  firstLag,
  gazeVersion: gaze.version,
  headVersion: headCtl.version,
  webrtcThreePane: 'NOT_IMPLEMENTED',
  notes: [
    'Test A/C/D mock covered in Node',
    'Test B WebRTC live friend view NOT run',
    'Same Shared Body Core API; GLB lab page separate',
    'DEV — not production'
  ]
};

const outDir = path.join(__dirname, 'docs');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'gaze-head-test-2026-10-25.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log('\nWrote', outPath);
console.log(`\nRESULT ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

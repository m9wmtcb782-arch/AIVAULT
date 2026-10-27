import test from 'node:test';
import assert from 'node:assert/strict';
import {REFERENCE_SKELETON,REFERENCE_NODE_INDEX} from '../modules/darkstar-reference-skeleton.js';
import {forwardKinematics,axisAngleQuaternion} from '../modules/darkstar-forward-kinematics.js';
import {auditRig} from '../modules/darkstar-rig-audit.js';
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('reference skeleton has both arms, fingers and legs',()=>{
 for(const name of ['LeftHand','RightHand','LeftThumb2','RightLittle3','LeftFoot','RightToe'])assert.ok(Number.isInteger(REFERENCE_NODE_INDEX[name]));
});
test('reference skeleton is explicitly not a skinned avatar',()=>{
 assert.equal(REFERENCE_SKELETON.extras.skinnedMesh,false);
 assert.equal(REFERENCE_SKELETON.extras.actuationAllowed,false);
});
test('skeleton structure passes index audit, but remains unverified',()=>{
 const r=auditRig(REFERENCE_SKELETON,['Hips','Head','LeftHand','RightHand']);
 assert.equal(r.status,'SKINNED_RIG_FOUND');assert.equal(r.actuationAllowed,false);
});
test('neutral forward kinematics preserves root position',()=>{
 const poses=forwardKinematics(REFERENCE_SKELETON),root=poses[REFERENCE_NODE_INDEX.Hips];
 assert.deepEqual(root.position,[0,1,0]);
});
test('rotating upper arm moves downstream hand, not hips',()=>{
 const neutral=forwardKinematics(REFERENCE_SKELETON);
 const rotated=forwardKinematics(REFERENCE_SKELETON,{LeftUpperArm:{rotation:axisAngleQuaternion([0,0,1],45)}});
 const hand=REFERENCE_NODE_INDEX.LeftHand,hips=REFERENCE_NODE_INDEX.Hips;
 assert.notDeepEqual(rotated[hand].position,neutral[hand].position);
 assert.deepEqual(rotated[hips].position,neutral[hips].position);
});
test('90 degree quaternion rotation maps x to y',()=>{
 const s={nodes:[{name:'root',rotation:axisAngleQuaternion([0,0,1],90),children:[1]},{name:'child',translation:[1,0,0]}]};
 const p=forwardKinematics(s);approx(p[1].position[0],0);approx(p[1].position[1],1);
});
test('cyclic skeleton is rejected',()=>assert.throws(()=>forwardKinematics({nodes:[{name:'a',children:[1]},{name:'b',children:[0]}]}),/CYCLIC_SKELETON/));
test('invalid quaternion is rejected',()=>assert.throws(()=>forwardKinematics({nodes:[{name:'a',rotation:[0,0,0,0]}]}),/ZERO_QUATERNION/));

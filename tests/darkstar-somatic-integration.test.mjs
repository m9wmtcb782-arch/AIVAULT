import test from 'node:test';
import assert from 'node:assert/strict';
import {jointAudit,ANATOMICAL_JOINTS} from '../modules/darkstar-anatomical-registry.js';
import {createSomaticAvatarAdapter} from '../modules/darkstar-avatar-somatic-adapter.js';
const contacts=[{x:-0.2,y:-0.1,active:true},{x:0.2,y:-0.1,active:true},{x:0.2,y:0.1,active:true},{x:-0.2,y:0.1,active:true}];
const sensors={segments:[{massKg:70,position:{x:0,y:0,z:1}}],velocity:{x:0,y:0,z:0},contacts};
function fixture(validateDynamics){let applied=0;const rig={validatedMapping:true,readPose:()=>({leftKneeFlex:30}),applyPose:()=>applied++,validateDynamics};return {adapter:createSomaticAvatarAdapter(rig),count:()=>applied}}
test('anatomical inventory has no fictional C7-C8 segment',()=>assert.equal(ANATOMICAL_JOINTS.some(j=>j.name.includes('C7-C8')),false));
test('anatomical inventory includes C7-T1',()=>assert.equal(ANATOMICAL_JOINTS.some(j=>j.name.includes('C7-T1')),true));
test('joint IDs are unique',()=>assert.equal(jointAudit().uniqueIds,true));
test('missing sensors prevent actuation',()=>{const f=fixture(()=>({approved:true}));f.adapter.enable();assert.equal(f.adapter.step({leftKneeFlex:30}).status,'BLOCKED_MISSING_BALANCE_SENSORS');assert.equal(f.count(),0)});
test('missing dynamics solver prevents actuation',()=>{const f=fixture(undefined);f.adapter.enable();assert.equal(f.adapter.step({leftKneeFlex:30},sensors).status,'BLOCKED_NO_DYNAMICS_SOLVER');assert.equal(f.count(),0)});
test('unsafe joint angle prevents actuation',()=>{const f=fixture(()=>({approved:true}));f.adapter.enable();assert.equal(f.adapter.step({leftKneeFlex:200},sensors).status,'BLOCKED_REFLEX');assert.equal(f.count(),0)});
test('unapproved dynamics prevent actuation',()=>{const f=fixture(()=>({approved:false}));f.adapter.enable();assert.equal(f.adapter.step({leftKneeFlex:30},sensors).status,'BLOCKED_DYNAMICS_NOT_APPROVED');assert.equal(f.count(),0)});
test('explicitly approved dynamics permit actuation',()=>{const f=fixture(()=>({approved:true}));f.adapter.enable();assert.equal(f.adapter.step({leftKneeFlex:30},sensors).status,'POSE_APPLIED');assert.equal(f.count(),1)});

// M0 anatomical audit regressions (Issue #43)
test('M0: spine includes T12-L1 and has 24 intervertebral/occipital segments',()=>{
 assert.equal(ANATOMICAL_JOINTS.some(j=>j.name.includes('T12-L1')),true);
 assert.equal(ANATOMICAL_JOINTS.filter(j=>j.region==='spine').length,25);
});
test('M0: not every joint is 3-axis; hinges and pivots are single-axis',()=>{
 const by=n=>ANATOMICAL_JOINTS.filter(j=>j.name===n);
 for(const n of ['humeroulnar','proximal radioulnar','distal radioulnar','talocrural'])for(const j of by(n))assert.equal(j.axes.length,1,n);
 for(const n of ['radiocarpal','tibiofemoral'])for(const j of by(n))assert.equal(j.axes.length,2,n);
 assert.equal(by('distal tibiofibular').every(j=>j.axes.length===0),true);
});
test('M0: fixed sutures have no axes and no motor',()=>{
 for(const j of ANATOMICAL_JOINTS.filter(j=>j.type.startsWith('fibrous')))assert.equal(j.axes.length===0&&j.motorEnabled===false,true,j.name);
});
test('M0: no joint is motor-enabled while ROM is unverified',()=>assert.equal(jointAudit().motorReady,0));

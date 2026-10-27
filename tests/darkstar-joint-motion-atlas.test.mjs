import test from 'node:test';
import assert from 'node:assert/strict';
import {MOTION_ATLAS,ATLAS_METADATA,validateAtlas,evaluateAtlasPose} from '../modules/darkstar-joint-motion-atlas.js';
test('all joint records have unique IDs and valid ranges',()=>{const r=validateAtlas();assert.equal(r.errors.length,0);assert.ok(r.records>=50)});
test('all provisional motors remain disabled',()=>{assert.equal(ATLAS_METADATA.actuationAllowed,false);assert.ok(MOTION_ATLAS.every(j=>!j.motorEnabled&&!j.verified))});
test('bilateral finger phalanges are represented',()=>{for(const side of ['left','right'])for(const finger of ['thumb','index','middle','ring','little'])assert.ok(MOTION_ATLAS.some(j=>j.id===side+'.'+finger+'.base'))});
test('out of range knee flexion is flagged and clamped',()=>{const r=evaluateAtlasPose({'left.knee':{flexion:180,axialRotation:0}});assert.equal(r.clamped['left.knee'].flexion,135);assert.equal(r.violations.length,1);assert.equal(r.actuationAllowed,false)});
test('missing axes do not silently become zero',()=>{const r=evaluateAtlasPose({'right.shoulder':{flexion:30}});assert.ok(r.violations.some(v=>v.reason==='MISSING_OR_INVALID'))});
test('root pelvis has no fictitious motor',()=>assert.equal(MOTION_ATLAS.find(j=>j.id==='midline.pelvis').axes.length,0));

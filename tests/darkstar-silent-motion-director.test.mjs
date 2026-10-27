import test from 'node:test';import assert from 'node:assert/strict';
import {inferNonverbalContext,createSilentMotionDirector} from '../modules/darkstar-silent-motion-director.js';
test('greeting response triggers greeting context',()=>assert.equal(inferNonverbalContext({assistantText:'歡迎回來'}),'greet'));
test('analysis response triggers thoughtful context',()=>assert.equal(inferNonverbalContext({assistantText:'讓我想一想'}),'thoughtful'));
test('listening triggers attentive context',()=>assert.equal(inferNonverbalContext({phase:'listening'}),'attentive'));
test('director emits silent internal channel without changing speech',()=>{let cmd;const d=createSilentMotionDirector({emit:x=>cmd=x,now:()=>10000});const r=d.decide({assistantText:'歡迎回來'});assert.equal(r.spokenOutputChanged,false);assert.equal(cmd.silent,true);assert.equal(cmd.channel,'internal-motor');assert.equal(cmd.actuationAllowed,false)});
test('director debounces',()=>{const d=createSilentMotionDirector({emit:()=>{},now:()=>10000});d.decide({});assert.equal(d.decide({}).reason,'COOLDOWN')});
test('director varies gestures within context',()=>{let t=0;const d=createSilentMotionDirector({emit:()=>{},now:()=>t,cooldownMs:100});t=1000;const a=d.decide({assistantText:'你好'}).name;t=1200;const b=d.decide({assistantText:'你好'}).name;assert.notEqual(a,b)});
test('history is immutable copy',()=>{const d=createSilentMotionDirector({emit:()=>{},now:()=>10000});d.decide({});d.getHistory().push('fake');assert.equal(d.getHistory().includes('fake'),false)});

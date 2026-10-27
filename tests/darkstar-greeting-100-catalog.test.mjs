import test from 'node:test';import assert from 'node:assert/strict';import {GREETING_100,chooseGreetingClip} from '../modules/darkstar-greeting-100-catalog.js';
test('exactly 100 unique greeting briefs',()=>{assert.equal(GREETING_100.length,100);assert.equal(new Set(GREETING_100.map(x=>x.id)).size,100)});
test('all assets are honestly unrendered',()=>assert.ok(GREETING_100.every(x=>x.mp4===null&&x.renderStatus==='NOT_RENDERED')));
test('unverified clips never play',()=>assert.equal(chooseGreetingClip({}).status,'NO_VERIFIED_MATCH'));
test('verified clips are pose-compatible',()=>{const a={...GREETING_100[0],mp4:'example.mp4',renderStatus:'VERIFIED'};assert.equal(chooseGreetingClip({pose:a.startPose,assets:[a]}).clip.id,a.id);assert.equal(chooseGreetingClip({pose:'standing-neutral',assets:[a]}).clip,null)});
test('recent clips are skipped when alternative exists',()=>{const a={...GREETING_100[0],mp4:'a.mp4',renderStatus:'VERIFIED'},b={...GREETING_100[1],mp4:'b.mp4',renderStatus:'VERIFIED',startPose:a.startPose};assert.equal(chooseGreetingClip({pose:a.startPose,recent:[a.id],assets:[a,b]}).clip.id,b.id)});

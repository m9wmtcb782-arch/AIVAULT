import test from "node:test";
import assert from "node:assert/strict";
import {planVoiceClauses} from "./voice-pool-task-planner.mjs";
import {OrderedVoiceResults} from "./ordered-voice-results.mjs";
const tasks=planVoiceClauses({text:"第一句。第二句。第三句。",modelId:"aivault-mandarin-v1"});
const result=i=>({...tasks[i],sampleRate:24000,pcm:new Uint8Array([1,2])});
test("out-of-order worker results play only in original clause order",()=>{
 const queue=new OrderedVoiceResults(tasks);
 assert.deepEqual(queue.accept(result(2)),[]);
 assert.deepEqual(queue.accept(result(0)).map(x=>x.sequence),[0]);
 assert.deepEqual(queue.accept(result(1)).map(x=>x.sequence),[1,2]);
 assert.equal(queue.complete,true);
});
test("duplicate, stale and mismatched worker responses fail closed",()=>{
 const queue=new OrderedVoiceResults(tasks);
 queue.accept(result(2));
 assert.throws(()=>queue.accept(result(2)),/DUPLICATE/);
 assert.throws(()=>queue.accept({...result(1),charEnd:999}),/INVALID_VOICE_RESULT/);
 queue.accept(result(0));
 assert.throws(()=>queue.accept(result(0)),/STALE/);
});
test("failure invalidates pending worker audio",()=>{
 const queue=new OrderedVoiceResults(tasks);
 queue.accept(result(2));queue.fail();
 assert.throws(()=>queue.accept(result(0)),/VOICE_SESSION_FAILED/);
 assert.equal(queue.complete,false);
});

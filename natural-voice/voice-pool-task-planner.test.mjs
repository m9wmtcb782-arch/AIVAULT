import test from "node:test";
import assert from "node:assert/strict";
import {planVoiceClauses,validateVoiceClauseResult} from "./voice-pool-task-planner.mjs";
const modelId="aivault-mandarin-v1";
test("plans traditional Chinese with emoji and original Unicode offsets",()=>{
 const text="🐳你好。\n暗星繼續朗讀！";
 const tasks=planVoiceClauses({text,modelId});
 assert.equal(tasks.map(x=>x.text).join(""),text.replace("\n",""));
 for(const t of tasks)assert.equal(Array.from(text).slice(t.charStart,t.charEnd).join(""),t.text);
 assert.deepEqual(tasks.map(x=>x.sequence),[0,1]);
 assert.deepEqual(tasks.map(x=>x.charStart),[0,5]);
});
test("long clauses are bounded and ordered",()=>{
 const tasks=planVoiceClauses({text:"學".repeat(270),modelId,maxChars:100});
 assert.deepEqual(tasks.map(x=>Array.from(x.text).length),[100,100,70]);
});
test("unapproved external-style model identifiers are not planned",()=>{
 assert.throws(()=>planVoiceClauses({text:"你好",modelId:"https://example.com/weights"}),/INVALID_FIRST_PARTY_MODEL/);
});
test("reject mismatched or invalid inference result metadata",()=>{
 const task=planVoiceClauses({text:"你好。",modelId})[0];
 const result={sequence:task.sequence,modelId,charStart:task.charStart,charEnd:task.charEnd,sampleRate:24000,pcm:new Uint8Array([1,2])};
 assert.equal(validateVoiceClauseResult(task,result),true);
 assert.equal(validateVoiceClauseResult(task,{...result,charEnd:100}),false);
 assert.equal(validateVoiceClauseResult(task,{...result,pcm:new Uint8Array([1])}),false);
});

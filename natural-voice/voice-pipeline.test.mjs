import test from "node:test";
import assert from "node:assert/strict";
import {VoicePipeline} from "./voice-pipeline.mjs";
test("completes mocked ASR to brain to TTS stream",async()=>{
 const events=[];
 const p=new VoicePipeline({
  asr:{transcribe:async()=> "你好暗星"},
  brain:{respond:async({text})=> "收到："+text},
  tts:{synthesize:async()=> (async function*(){yield new Uint8Array([0,0]);yield new Uint8Array([1,0]);})()},
  onEvent:e=>events.push(e)
 });
 const result=await p.run({audio:new Uint8Array([0,0])});
 assert.equal(result.status,"completed");
 assert.equal(result.frames,2);
 assert.deepEqual(events.filter(e=>e.type==="audio.frame").map(e=>e.sequence),[0,1]);
});
test("interruption suppresses late output",async()=>{
 let release;const gate=new Promise(resolve=>release=resolve);
 const events=[];
 const p=new VoicePipeline({
  asr:{transcribe:async()=>{await gate;return "stale";}},
  brain:{respond:async()=> "no"},
  tts:{synthesize:async()=> (async function*(){yield new Uint8Array([0,0]);})()},
  onEvent:e=>events.push(e)
 });
 const pending=p.run({audio:new Uint8Array([0,0])});
 p.interrupt();release();
 assert.equal((await pending).status,"cancelled");
 assert.equal(events.some(e=>e.type==="audio.frame"),false);
});
test("missing GPU workers rejected",()=>{
 assert.throws(()=>new VoicePipeline({asr:{},brain:{},tts:{}}),/WORKERS_REQUIRED/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {runVoicePoolSession} from "./voice-pool-session.mjs";
const modelId="aivault-mandarin-v1";
const pool={success:true,nodes:[{online:true,available:true,gpu:true,capability:{
 voice_tts_runtime:modelId,voice_model_id:modelId,voice_model_loaded:true,voice_inference_verified:true}}]};
const base={text:"第一句。第二句。第三句。",modelId,pool,approved:true,weightsInstalled:true};
const output=task=>({...task,sampleRate:24000,pcm:new Uint8Array([1,2])});
test("voice session reorders concurrent GPU results before audible callbacks",async()=>{
 const played=[];
 const result=await runVoicePoolSession({...base,dispatch:async task=>{
  if(task.sequence===0)await new Promise(resolve=>setTimeout(resolve,12));
  return output(task);
 },onAudio:async task=>{played.push(task.sequence);await Promise.resolve();}});
 assert.deepEqual(played,[0,1,2]);
 assert.equal(result.status,"COMPLETED");
});
test("unapproved model never dispatches",async()=>{
 let called=false;
 await assert.rejects(runVoicePoolSession({...base,approved:false,dispatch:async()=>{called=true;},onAudio:async()=>{}}),/MODEL_NOT_APPROVED/);
 assert.equal(called,false);
});
test("invalid worker audio aborts rather than reporting completed",async()=>{
 await assert.rejects(runVoicePoolSession({...base,dispatch:async task=>({...output(task),sampleRate:8000}),onAudio:async()=>{}}),/INVALID_VOICE_RESULT/);
});
test("pre-aborted session never dispatches",async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(runVoicePoolSession({...base,signal:controller.signal,dispatch:async()=>{throw Error("must not run");},onAudio:async()=>{}}),/VOICE_CANCELLED/);
});

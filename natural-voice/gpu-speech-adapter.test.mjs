import test from "node:test";
import assert from "node:assert/strict";
import {createGpuSpeechAdapter} from "./gpu-speech-adapter.mjs";
test("requires HTTPS and auth",()=>{
 assert.throws(()=>createGpuSpeechAdapter({baseUrl:"http://localhost",token:"a"}),/HTTPS_REQUIRED/);
 assert.throws(()=>createGpuSpeechAdapter({baseUrl:"https://gpu.example",token:""}),/AUTH_REQUIRED/);
});
test("ASR and TTS adapter contract with fake worker",async()=>{
 const calls=[];
 const adapter=createGpuSpeechAdapter({
  baseUrl:"https://gpu.example",token:"fake-test-token",
  fetchImpl:async(url,options)=>{
   calls.push({url,options});
   return {ok:true,json:async()=>url.endsWith("/v1/asr")?{text:"你好暗星"}:{frames:["AAA=","AQA="]}};
  }
 });
 const text=await adapter.asr.transcribe({audio:new Uint8Array([0,0])});
 assert.equal(text,"你好暗星");
 const stream=await adapter.tts.synthesize({text:"你好",voiceId:"anxing-default"});
 const frames=[];for await(const frame of stream)frames.push([...frame]);
 assert.deepEqual(frames,[[0,0],[1,0]]);
 assert.equal(calls.length,2);
 assert.ok(calls.every(c=>c.options.headers.Authorization==="Bearer fake-test-token"));
});
test("unavailable worker returns explicit error",async()=>{
 const adapter=createGpuSpeechAdapter({baseUrl:"https://gpu.example",token:"test",fetchImpl:async()=>({ok:false,status:503})});
 await assert.rejects(adapter.asr.transcribe({audio:new Uint8Array([0,0])}),/MODEL_UNAVAILABLE/);
});

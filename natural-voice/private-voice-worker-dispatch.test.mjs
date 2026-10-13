import test from "node:test";
import assert from "node:assert/strict";
import {createPrivateVoiceDispatch} from "./private-voice-worker-dispatch.mjs";
const task={text:"你好。",modelId:"aivault-mandarin-v1",sequence:0,charStart:0,charEnd:3};
const token="private-test-token-123";
test("trusted worker returns real response bytes with immutable task metadata",async()=>{
 let seen;
 const dispatch=createPrivateVoiceDispatch({baseUrl:"https://voice.example.test",token,fetchImpl:async(url,init)=>{
  seen={url:String(url),init};
  return {ok:true,json:async()=>({frames:[Buffer.from([1,2,3,4]).toString("base64")]})};
 }});
 const result=await dispatch(task);
 assert.equal(seen.url,"https://voice.example.test/v1/tts");
 assert.equal(seen.init.headers.Authorization,"Bearer "+token);
 assert.equal(JSON.parse(seen.init.body).text,"你好。");
 assert.deepEqual(Array.from(result.pcm),[1,2,3,4]);
 assert.equal(result.charEnd,3);
});
test("rejects non-HTTPS or credentialed URL",()=>{
 for(const baseUrl of ["http://example.test","https://u:p@example.test","https://example.test/?token=x"])
  assert.throws(()=>createPrivateVoiceDispatch({baseUrl,token}),/PRIVATE_VOICE_WORKER_HTTPS_REQUIRED/);
});
test("unavailable worker fails without simulated audio",async()=>{
 const dispatch=createPrivateVoiceDispatch({baseUrl:"https://voice.example.test",token,fetchImpl:async()=>({ok:false,status:503})});
 await assert.rejects(dispatch(task),/VOICE_WORKER_HTTP_503/);
});
test("rejects malformed worker PCM",async()=>{
 const dispatch=createPrivateVoiceDispatch({baseUrl:"https://voice.example.test",token,fetchImpl:async()=>({ok:true,json:async()=>({frames:["AQ=="]})})});
 await assert.rejects(dispatch(task),/INVALID_VOICE_PCM/);
});

test("rejects oversized worker output before base64 decoding",async()=>{
 const dispatch=createPrivateVoiceDispatch({baseUrl:"https://voice.example.test",token,fetchImpl:async()=>({
  ok:true,json:async()=>({frames:Array(1201).fill("AQI=")})
 })});
 await assert.rejects(dispatch(task),/VOICE_AUDIO_TOO_LARGE/);
});
test("rejects worker frame total larger than one-minute PCM cap",async()=>{
 const dispatch=createPrivateVoiceDispatch({baseUrl:"https://voice.example.test",token,fetchImpl:async()=>({
  ok:true,json:async()=>({frames:["AQID".repeat(960001)]})
 })});
 await assert.rejects(dispatch(task),/VOICE_AUDIO_TOO_LARGE/);
});

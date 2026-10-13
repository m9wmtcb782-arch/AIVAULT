import test from "node:test";
import assert from "node:assert/strict";
import {runPrivateVoicePool} from "./private-voice-pool-runner.mjs";
const modelId="aivault-mandarin-v1",token="private-test-token-123456";
const pool={success:true,nodes:[{online:true,available:true,gpu:true,capability:{
 voice_tts_runtime:modelId,voice_model_id:modelId,voice_model_loaded:true,voice_inference_verified:true}}]};
const base={text:"第一句。第二句。",modelId,pool,approved:true,weightsInstalled:true,
 workerBaseUrl:"https://voice.example.test",workerToken:token};
test("private worker response reaches ordered audio callback without live coordinator",async()=>{
 const played=[],requested=[];
 const result=await runPrivateVoicePool({...base,fetchImpl:async(_url,init)=>{
  const payload=JSON.parse(init.body);requested.push(payload.text);
  if(payload.text==="第一句。")await new Promise(resolve=>setTimeout(resolve,10));
  return {ok:true,json:async()=>({frames:[Buffer.from([1,2]).toString("base64")]})};
 },onAudio:async audio=>played.push(audio.sequence)});
 assert.equal(result.status,"COMPLETED");
 assert.deepEqual(played,[0,1]);
 assert.equal(requested.length,2);
});
test("unapproved model sends no text to private worker",async()=>{
 let count=0;
 await assert.rejects(runPrivateVoicePool({...base,approved:false,fetchImpl:async()=>{count++;throw Error("must not send");},onAudio:async()=>{}}),/MODEL_NOT_APPROVED/);
 assert.equal(count,0);
});

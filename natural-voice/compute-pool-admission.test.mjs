import test from "node:test";
import assert from "node:assert/strict";
import {assessVoicePool} from "./compute-pool-admission.mjs";
const id="aivault-mandarin-v1";
const node={online:true,available:true,gpu:true,capability:{
 voice_tts_runtime:id,voice_model_id:id,voice_model_loaded:true,voice_inference_verified:true}};
const opts={modelId:id,approved:true,weightsInstalled:true,pool:{success:true,nodes:[node]}};
test("no model approval means no GPU access",()=>assert.equal(assessVoicePool({...opts,approved:false}).reason,"MODEL_NOT_APPROVED_FOR_POOL"));
test("no weights means no inference",()=>assert.equal(assessVoicePool({...opts,weightsInstalled:false}).reason,"MODEL_WEIGHTS_NOT_INSTALLED"));
test("offline or generic GPU is not voice inference",()=>{
 assert.equal(assessVoicePool({...opts,pool:{success:true,nodes:[{...node,online:false}]}}).ready,false);
 assert.equal(assessVoicePool({...opts,pool:{success:true,nodes:[{online:true,available:true,gpu:true,capability:{webgpu:true}}]}}).ready,false);
});
test("missing or invalid status fails closed",()=>assert.equal(assessVoicePool({...opts,pool:null}).reason,"POOL_STATUS_UNAVAILABLE"));
test("verified, loaded and approved voice worker can be considered eligible",()=>{
 const result=assessVoicePool(opts);
 assert.equal(result.ready,true);
 assert.equal(result.eligibleWorkers,1);
});

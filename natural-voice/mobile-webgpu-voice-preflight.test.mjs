import test from "node:test";
import assert from "node:assert/strict";
import {probeMobileVoiceRuntime} from "./mobile-webgpu-voice-preflight.mjs";
test("Android without WebGPU is correctly reported",async()=>{
 assert.equal((await probeMobileVoiceRuntime({gpu:null})).reason,"WEBGPU_UNAVAILABLE");
});
test("iPhone browser with missing adapter is not voice ready",async()=>{
 const result=await probeMobileVoiceRuntime({gpu:{requestAdapter:async()=>null}});
 assert.equal(result.reason,"WEBGPU_ADAPTER_UNAVAILABLE");
 assert.equal(result.ready,false);
});
test("GPU adapter does not imply real voice model inference",async()=>{
 const result=await probeMobileVoiceRuntime({gpu:{requestAdapter:async()=>({limits:{
 maxStorageBufferBindingSize:134217728,maxComputeWorkgroupStorageSize:16384,maxComputeInvocationsPerWorkgroup:256}})}});
 assert.equal(result.ready,true);
 assert.equal(result.voiceInferenceReady,false);
 assert.equal(result.modelLoaded,false);
 assert.equal(result.limits.maxStorageBufferBindingSize,134217728);
});
test("adapter errors are contained",async()=>{
 const result=await probeMobileVoiceRuntime({gpu:{requestAdapter:async()=>{throw Error("blocked");}}});
 assert.equal(result.reason,"WEBGPU_ADAPTER_ERROR");
});

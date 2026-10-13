import test from "node:test";
import assert from "node:assert/strict";
import {runMobileGpuComputeTest} from "./mobile-gpu-compute-test.mjs";
test("missing WebGPU never claims speech inference",async()=>{
 const result=await runMobileGpuComputeTest({gpu:null});
 assert.deepEqual(result,{ok:false,reason:"WEBGPU_UNAVAILABLE"});
});
test("adapter unavailable does not claim success",async()=>{
 const result=await runMobileGpuComputeTest({gpu:{requestAdapter:async()=>null}});
 assert.equal(result.reason,"NO_GPU_ADAPTER");
});
test("device errors are contained",async()=>{
 const result=await runMobileGpuComputeTest({gpu:{requestAdapter:async()=>({requestDevice:async()=>{throw Error("device lost");}})}});
 assert.equal(result.reason,"GPU_COMPUTE_ERROR");
 assert.equal(result.ok,false);
});
test("actual compute path verifies expected GPU readback, not speech",async()=>{
 const oldUsage=globalThis.GPUBufferUsage,oldMap=globalThis.GPUMapMode;
 globalThis.GPUBufferUsage={STORAGE:1,COPY_DST:2,COPY_SRC:4,MAP_READ:8};
 globalThis.GPUMapMode={READ:1};
 let destroyed=false;
 const buffers=[];
 const device={
  createShaderModule:()=>({}),
  createComputePipeline:()=>({getBindGroupLayout:()=>({})}),
  createBuffer:()=>{const b={data:new Uint32Array(4),mapAsync:async()=>{},getMappedRange(){return this.data.buffer},unmap(){}};buffers.push(b);return b},
  queue:{writeBuffer:(b,_offset,data)=>b.data.set(data),submit:()=>{}},
  createBindGroup:()=>({}),
  createCommandEncoder:()=>({beginComputePass:()=>({setPipeline(){},setBindGroup(){},dispatchWorkgroups(){},end(){}}),
   copyBufferToBuffer:(a,_a,b)=>b.data.set(a.data.map(v=>v*2+1)),finish:()=>({})}),
  destroy:()=>{destroyed=true}
 };
 try{
  const result=await runMobileGpuComputeTest({gpu:{requestAdapter:async()=>({requestDevice:async()=>device})}});
  assert.equal(result.ok,true);
  assert.deepEqual(result.values,[3,5,7,9]);
  assert.equal(result.voiceInferenceVerified,false);
  assert.equal(destroyed,true);
 }finally{globalThis.GPUBufferUsage=oldUsage;globalThis.GPUMapMode=oldMap;}
});

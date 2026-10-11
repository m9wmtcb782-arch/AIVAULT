import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {benchmarkChecksum,compatibleGpuTask,verifyPortableGpuResult,poolGpuRating} from '../supabase/functions/aivault-compute-coordinator/gpu-benchmark.ts';
const portable={type:'gpu-u32-mix',elements:256,iterations:1,payload:{}};
test('WebGL2 cannot claim a WebGPU-only workload',()=>assert.equal(compatibleGpuTask({runtime:'webgl2'}, {...portable,type:'webgpu-compute'}),false));
test('WebGL2 can claim the small portable benchmark',()=>assert.equal(compatibleGpuTask({runtime:'webgl2'},portable),true));
test('WebGL2 oversized workloads are skipped',()=>assert.equal(compatibleGpuTask({runtime:'webgl2'}, {...portable,elements:1000000}),false));
test('device-targeted task is not handed to another phone',()=>assert.equal(compatibleGpuTask({node_id:'a',runtime:'webgpu'},{...portable,payload:{target_node_id:'b'}}),false));
const proof={executed_on:'WebGL2',gpu:true,verified:true,elements:256,iterations_per_element:1,sample_count:256,checksum:benchmarkChecksum(256,1),gpu_time_ms:1};
test('WebGL2 evidence accepted only with matching output',()=>assert.equal(verifyPortableGpuResult(portable,proof),true));
test('wrong checksum fails despite verified flag',()=>assert.equal(verifyPortableGpuResult(portable,{...proof,checksum:proof.checksum^1}),false));
test('wrong workload dimensions fail',()=>assert.equal(verifyPortableGpuResult(portable,{...proof,elements:4096}),false));
test('CPU result is not treated as GPU evidence',()=>assert.equal(verifyPortableGpuResult(portable,{...proof,executed_on:'CPU'}),false));
test('WebGL2 cannot complete an arbitrary model task',()=>assert.equal(verifyPortableGpuResult({...portable,type:'inference'},proof),false));
function glFixture({wrong=false,compile=true}={}){
 const calls={draw:0,read:0};const uniforms={};let gl;
 const api={VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,FRAMEBUFFER_COMPLETE:5,NO_ERROR:0,RENDERER:6,
 createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>compile,getShaderInfoLog:()=> 'compile failure',deleteShader(){},createProgram:()=>({}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,getProgramInfoLog:()=>'',createVertexArray:()=>({}),bindVertexArray(){},getParameter:()=> 'reported WebGL2',isContextLost:()=>false,createTexture:()=>({}),createFramebuffer:()=>({}),getUniformLocation:(_,name)=>name,uniform1ui:(key,value)=>uniforms[key]=value,checkFramebufferStatus:()=>5,getError:()=>0,drawArrays:()=>calls.draw++,readPixels:(_,__,w,h,format,type,pixels)=>{calls.read++;if(wrong)return;for(let i=0;i<uniforms.u_elements;i++){let x=(i+1)>>>0;for(let j=0;j<uniforms.u_iterations;j++){x=(Math.imul(x,1664525)+1013904223)>>>0;x=(x^(x>>>13))>>>0;x=Math.imul(x,2246822519)>>>0;x=(x^(x>>>16))>>>0;}pixels[i*4]=x;}},deleteProgram(){},deleteVertexArray(){}};
 gl=new Proxy(api,{get:(obj,key)=>key in obj?obj[key]:()=>{}});
 const sandbox={document:{createElement:()=>({getContext:()=>gl,addEventListener(){}})},performance,Uint32Array,Math,Number,Error};vm.runInNewContext(readFileSync(new URL('../assets/compute-pool/webgl2-engine.js',import.meta.url),'utf8'),sandbox);
 return {engine:sandbox.AivaultWebGL2,calls};
}
test('real runner code reads the GPU framebuffer and verifies it',async()=>{const f=glFixture();const result=await f.engine.createRunner().run(256,1);assert.equal(f.calls.draw,1);assert.equal(f.calls.read,1);assert.equal(result.checksum,benchmarkChecksum(256,1));assert.equal(result.executed_on,'WebGL2');});
test('runner never substitutes CPU output for wrong GPU pixels',async()=>{const f=glFixture({wrong:true});await assert.rejects(f.engine.createRunner().run(256,1),/輸出與參考值不符/);assert.equal(f.calls.read,1);});
test('shader compilation failure does not enable a GPU node',()=>assert.throws(()=>glFixture({compile:false}).engine.createRunner(),/編譯失敗/));

const ratingProof={executed_on:'WebGL2',gpu:true,verified:true,elements:4096,iterations_per_element:16,sample_count:1024,checksum:benchmarkChecksum(4096,16),gpu_time_ms:2,benchmark_version:'pool-u32-v1',benchmark_samples_ms:[1,2,2,3,4]};
test('fixed five-run median derives visual GPU units',()=>assert.equal(poolGpuRating(ratingProof).units,32.768));
test('small proof cannot masquerade as GPU rating',()=>assert.equal(poolGpuRating({...proof,benchmark_version:'pool-u32-v1',benchmark_samples_ms:[1,1,1,1,1]}),null));
test('zero or inconsistent times do not rate GPU',()=>{assert.equal(poolGpuRating({...ratingProof,benchmark_samples_ms:[0,0,0,0,0],gpu_time_ms:0}),null);assert.equal(poolGpuRating({...ratingProof,gpu_time_ms:1}),null);});
test('wrong output cannot get GPU rating',()=>assert.equal(poolGpuRating({...ratingProof,checksum:1}),null));

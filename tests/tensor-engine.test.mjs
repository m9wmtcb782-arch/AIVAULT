import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {tensorReference,initialTensor} from '../supabase/functions/aivault-compute-coordinator/tensor-pipeline.ts';
function fixture({extension=true,wrong=false}={}){
 const calls={draw:0,read:0};let input,stage;
 const api={VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,FRAMEBUFFER_COMPLETE:5,NO_ERROR:0,getExtension:()=>extension?{}:null,getParameter:()=> 'GPU',createShader:()=>({}),getShaderParameter:()=>true,createProgram:()=>({}),getProgramParameter:()=>true,createVertexArray:()=>({}),createTexture:()=>({}),createFramebuffer:()=>({}),isContextLost:()=>false,checkFramebufferStatus:()=>5,getError:()=>0,getUniformLocation:(_,n)=>n,uniform1fv:(_,values)=>input=Array.from(values),uniform1i:(_,v)=>stage=v,drawArrays:()=>calls.draw++,readPixels:(_,__,w,h,format,type,pixels)=>{calls.read++;if(wrong)return;const values=tensorReference(input,stage);for(let i=0;i<16;i++)pixels[i*4]=values[i];}};
 const gl=new Proxy(api,{get:(o,k)=>k in o?o[k]:()=>{}}),sandbox={navigator:{},document:{createElement:()=>({getContext:()=>gl})},performance,Float32Array,Uint32Array,Array,Math,Number,Error};
 vm.runInNewContext(readFileSync(new URL('../assets/compute-pool/tensor-engine.js',import.meta.url),'utf8'),sandbox);return {engine:sandbox.AivaultTensor,calls};
}
test('FP32 framebuffer supplies both dependent layer results',async()=>{const f=fixture(),runner=await f.engine.createRunner(),a=await runner.run(initialTensor(),1),b=await runner.run(a.tensor,2);assert.deepEqual(b.tensor,tensorReference(a.tensor,2));assert.equal(a.executed_on,'WebGL2');assert.equal(f.calls.draw,2);assert.equal(f.calls.read,2);});
test('incorrect GPU pixels never get replaced by CPU reference',async()=>{const f=fixture({wrong:true}),runner=await f.engine.createRunner();await assert.rejects(runner.run(initialTensor(),1),/校驗失敗/);assert.equal(f.calls.read,1);});
test('unsupported float target does not claim tensor capability',async()=>{await assert.rejects(fixture({extension:false}).engine.createRunner(),/FP32/);});
test('unbounded tensor shape is refused before GPU submission',async()=>{const f=fixture(),runner=await f.engine.createRunner();await assert.rejects(runner.run([1],1),/無效/);assert.equal(f.calls.draw,0);});

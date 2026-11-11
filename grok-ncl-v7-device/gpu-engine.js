// WebGPU engine. Never falls back to CPU: if WebGPU is missing or fails, it throws.
export const LAYOUT={uniform:32,input:2048,output:4096*4,readback:4096*4};
export class GpuEngine{
 static async create(spec,blob,onFail){
  if(!globalThis.isSecureContext)throw Error('非安全來源（需HTTPS或localhost）：WebGPU不可用；不會改用CPU。');
  if(!navigator.gpu)throw Error('此瀏覽器沒有navigator.gpu（WebGPU）；不會改用CPU冒充GPU。');
  const e=new GpuEngine();const t={};let t0=performance.now();
  e.adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!e.adapter)throw Error('requestAdapter回傳null；不會改用CPU。');
  const info=e.adapter.info||{};e.adapterInfo={vendor:info.vendor||'',architecture:info.architecture||'',device:info.device||'',description:info.description||'',isFallbackAdapter:info.isFallbackAdapter??e.adapter.isFallbackAdapter??null,note:'瀏覽器可能隱藏或清空adapter欄位；空字串代表未公開，不代表沒有GPU。'};
  e.features=[...e.adapter.features].sort();e.limits={maxStorageBufferBindingSize:e.adapter.limits.maxStorageBufferBindingSize,maxBufferSize:e.adapter.limits.maxBufferSize,maxComputeWorkgroupSizeX:e.adapter.limits.maxComputeWorkgroupSizeX,maxComputeInvocationsPerWorkgroup:e.adapter.limits.maxComputeInvocationsPerWorkgroup};
  if(e.adapterInfo.isFallbackAdapter===true)throw Error('瀏覽器回報fallback（軟體）adapter；拒絕當作手機GPU測量。');
  e.device=await e.adapter.requestDevice();t.adapter_device_ms=performance.now()-t0;
  e.failure=null;e.device.lost.then(i=>{e.failure='GPU device lost: '+i.reason+' '+i.message;onFail&&onFail(e.failure);});
  e.device.addEventListener('uncapturederror',ev=>{e.failure='WebGPU錯誤: '+ev.error.message;onFail&&onFail(e.failure);});
  const d=e.device,data=spec.parts.map(p=>new Uint8Array(blob,p.offset,p.bytes));
  const sizes=[LAYOUT.uniform,data[0].length,data[1].length,data[2].length,data[3].length,LAYOUT.input,LAYOUT.output,data[4].length,data[5].length,LAYOUT.readback];
  e.apiBufferBytes=sizes.reduce((a,b)=>a+b,0);if(e.apiBufferBytes>spec.api_budget_bytes)throw Error('超過GPU buffer預算');
  t0=performance.now();e.b=sizes.map((size,i)=>d.createBuffer({size:Math.max(4,size),usage:i===0?GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST:i===9?GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|(i===6?GPUBufferUsage.COPY_SRC:0)}));
  for(const [i,k] of [[1,0],[2,1],[3,2],[4,3],[7,4],[8,5]])d.queue.writeBuffer(e.b[i],0,data[k]);await d.queue.onSubmittedWorkDone();t.upload_ms=performance.now()-t0;
  t0=performance.now();d.pushErrorScope('validation');const module=d.createShaderModule({code:spec.shader});const ci=module.getCompilationInfo?await module.getCompilationInfo():{messages:[]};const errs=ci.messages.filter(m=>m.type==='error');if(errs.length)throw Error('WGSL編譯錯誤: '+errs.map(m=>m.message).join('; '));
  const layout=d.createBindGroupLayout({entries:Array.from({length:9},(_,binding)=>({binding,visibility:GPUShaderStage.COMPUTE,buffer:{type:binding===0?'uniform':binding===6?'storage':'read-only-storage'}}))});const pl=d.createPipelineLayout({bindGroupLayouts:[layout]});
  e.pipeline={};for(const key of ['generate','distribution'])e.pipeline[key]=await d.createComputePipelineAsync({layout:pl,compute:{module,entryPoint:key}});e.group=d.createBindGroup({layout,entries:e.b.slice(0,9).map((buffer,binding)=>({binding,resource:{buffer}}))});
  const verr=await d.popErrorScope();if(verr)throw Error('WebGPU驗證錯誤: '+verr.message);t.shader_pipeline_ms=performance.now()-t0;e.loadTimings=t;e.spec=spec;return e;
 }
 config(n,steps,seed){const x=new Uint32Array(8);x.set([n,steps,seed>>>0,1]);new Float32Array(x.buffer).set([this.spec.discount,this.spec.alpha,0,0],4);return x;}
 async dispatch(key,config,input,words){if(this.failure)throw Error(this.failure);const d=this.device;d.queue.writeBuffer(this.b[0],0,config);d.queue.writeBuffer(this.b[5],0,input);const enc=d.createCommandEncoder(),pass=enc.beginComputePass();pass.setPipeline(this.pipeline[key]);pass.setBindGroup(0,this.group);pass.dispatchWorkgroups(1);pass.end();enc.copyBufferToBuffer(this.b[6],0,this.b[9],0,words*4);
  const t0=performance.now();d.queue.submit([enc.finish()]);await d.queue.onSubmittedWorkDone();const t1=performance.now();await this.b[9].mapAsync(GPUMapMode.READ,0,words*4);const out=new Uint32Array(this.b[9].getMappedRange(0,words*4).slice(0));this.b[9].unmap();const t2=performance.now();if(this.failure)throw Error(this.failure);return {out,timing:{submit_to_done_ms:t1-t0,submit_to_readback_ms:t2-t0}};}
 async generateChunk(tail,steps,rng){const input=Uint32Array.from(tail);const r=await this.dispatch('generate',this.config(tail.length,steps,rng),input,steps);return {bytes:Uint8Array.from(r.out),timing:r.timing};}
 async distribution(ctx){const c=Array.from(ctx).slice(-this.spec.dims.width),x=new Uint32Array(this.spec.dims.width+2);x[0]=c.length;x.set(c,1);const r=await this.dispatch('distribution',this.config(1,0,7),x,256);return new Float32Array(r.out.buffer);}
 destroy(){try{for(const b of this.b||[])b.destroy();this.device&&this.device.destroy();}catch(_){}}
}

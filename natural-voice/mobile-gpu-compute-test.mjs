/** Read-only WebGPU compute execution test for the current phone.
 * Runs actual GPU arithmetic; this is NOT neural speech inference.
 */
export async function runMobileGpuComputeTest({gpu=globalThis.navigator?.gpu}={}){
 if(!gpu?.requestAdapter)return {ok:false,reason:"WEBGPU_UNAVAILABLE"};
 let device;
 try{
  const adapter=await gpu.requestAdapter();
  if(!adapter)return {ok:false,reason:"NO_GPU_ADAPTER"};
  device=await adapter.requestDevice();
  const shader=device.createShaderModule({code:`@group(0) @binding(0) var<storage,read_write> data:array<u32>;
@compute @workgroup_size(4) fn main(@builtin(global_invocation_id) id:vec3<u32>){
 if(id.x<4u){data[id.x]=data[id.x]*2u+1u;}
}`});
  const pipeline=device.createComputePipeline({layout:"auto",compute:{module:shader,entryPoint:"main"}});
  const bytes=16;
  const input=device.createBuffer({size:bytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});
  const output=device.createBuffer({size:bytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  device.queue.writeBuffer(input,0,new Uint32Array([1,2,3,4]));
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:input}}]});
  const encoder=device.createCommandEncoder();
  const pass=encoder.beginComputePass();
  pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();
  encoder.copyBufferToBuffer(input,0,output,0,bytes);
  device.queue.submit([encoder.finish()]);
  await output.mapAsync(GPUMapMode.READ);
  const values=Array.from(new Uint32Array(output.getMappedRange().slice(0)));
  output.unmap();
  const ok=values.join(",")==="3,5,7,9";
  return {ok,reason:ok?"GPU_COMPUTE_VERIFIED":"GPU_COMPUTE_MISMATCH",values,voiceInferenceVerified:false};
 }catch(error){return {ok:false,reason:"GPU_COMPUTE_ERROR",detail:String(error?.message||error).slice(0,160)};}
 finally{try{device?.destroy()}catch{}}
}

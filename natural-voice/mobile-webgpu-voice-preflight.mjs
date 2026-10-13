/** Mobile-first WebGPU speech-runtime preflight.
 * GPU arithmetic support does NOT mean an ONNX/Piper TTS model is executable.
 * This performs only local feature checks; no paid API, model download or pool task.
 */
export async function probeMobileVoiceRuntime({gpu=globalThis.navigator?.gpu,createAdapter}={}){
 if(!gpu||typeof gpu.requestAdapter!=="function")
  return {ready:false,reason:"WEBGPU_UNAVAILABLE"};
 let adapter;
 try{adapter=typeof createAdapter==="function"?await createAdapter(gpu):await gpu.requestAdapter({powerPreference:"low-power"});}
 catch{return {ready:false,reason:"WEBGPU_ADAPTER_ERROR"};}
 if(!adapter)return {ready:false,reason:"WEBGPU_ADAPTER_UNAVAILABLE"};
 const limits=adapter.limits||{};
 const maxStorageBufferBindingSize=Number(limits.maxStorageBufferBindingSize||0);
 const maxComputeWorkgroupStorageSize=Number(limits.maxComputeWorkgroupStorageSize||0);
 const maxComputeInvocationsPerWorkgroup=Number(limits.maxComputeInvocationsPerWorkgroup||0);
 return {
  ready:true,reason:"WEBGPU_ADAPTER_PRESENT",
  voiceInferenceReady:false,
  modelLoaded:false,
  gpuModelVerified:false,
  limits:{maxStorageBufferBindingSize,maxComputeWorkgroupStorageSize,maxComputeInvocationsPerWorkgroup},
  next:"INSTALL_AND_VALIDATE_BROWSER_COMPATIBLE_TTS_MODEL"
 };
}

/** Fail-closed admission for AIVAULT's existing Compute Mesh.
 * This module only evaluates sanitized status/capabilities; it NEVER submits a task.
 * The Coordinator's server-side first-party model authorization remains mandatory.
 */
export function assessVoicePool({pool,modelId,approved=false,weightsInstalled=false}={}){
 if(typeof modelId!=="string"||!modelId.trim())return {ready:false,reason:"MODEL_ID_REQUIRED"};
 if(!approved)return {ready:false,reason:"MODEL_NOT_APPROVED_FOR_POOL"};
 if(!weightsInstalled)return {ready:false,reason:"MODEL_WEIGHTS_NOT_INSTALLED"};
 if(!pool||pool.success!==true||!Array.isArray(pool.nodes))return {ready:false,reason:"POOL_STATUS_UNAVAILABLE"};
 const nodes=pool.nodes.filter(n=>{
  if(!n||typeof n!=="object")return false;
  if(n.online!==true||n.available!==true||n.gpu!==true)return false;
  const caps=n.capability&&typeof n.capability==="object"?n.capability:{};
  // Generic WebGPU and tensor benchmark support do NOT imply Piper/ONNX inference.
  return caps.voice_tts_runtime==="aivault-mandarin-v1" &&
    caps.voice_model_id===modelId &&
    caps.voice_model_loaded===true &&
    caps.voice_inference_verified===true;
 });
 if(!nodes.length)return {ready:false,reason:"NO_VERIFIED_VOICE_GPU_WORKER"};
 return {ready:true,reason:"ELIGIBLE_WORKER_REPORTED",eligibleWorkers:nodes.length,
         note:"Worker claims are not hardware attestation or a successful real inference"};
}

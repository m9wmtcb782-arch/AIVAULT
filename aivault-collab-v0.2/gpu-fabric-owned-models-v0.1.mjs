// Research-owned service identities. Open-weight candidates retain attribution.
// No API routing, automatic downloads, paid fallback or production registration.
import { readBackendCapabilities } from './gpu-fabric-backend-v0.1.mjs';
const entry = (id, name, capability, weights, source, input) => Object.freeze({
  model_id:id, display_name:name, capability, weight_bundle:weights,
  candidate_source:source, input, availability:'PLANNED',
  weight_revision:null, graph_compiler:null, runtime:null,
});
export const ownedModels = Object.freeze([
  entry('aivault-dawn-image-v0.1','曙光·映像','text-to-image','Qwen/Qwen-Image','https://github.com/QwenLM/Qwen-Image','text'),
  entry('aivault-liuguang-t2v-v0.1','流光·文生影片','text-to-video','Wan-AI/Wan2.2-TI2V-5B','https://github.com/Wan-Video/Wan2.2','text'),
  entry('aivault-liuguang-i2v-v0.1','流光·圖生影片','image-to-video','Wan-AI/Wan2.2-TI2V-5B','https://github.com/Wan-Video/Wan2.2','image'),
  entry('aivault-xianyin-music-v0.1','弦音','text-to-music','ACE-Step-1.5','https://github.com/ace-step/ACE-Step-1.5','text'),
  entry('aivault-sujie-3d-v0.1','塑界','image-to-3d','tencent/Hunyuan3D-2.1','https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1','image'),
]);
export function getOwnedModel(id) { return ownedModels.find(x=>x.model_id===id) ?? null; }

// This is a diagnostic call by trusted coordinator code, not authentication.
// Adapter declarations are not GPU attestation. Never execute a whole external
// pipeline as one fake Fabric operator: real graph import must exist first.
export async function prepareOwnedModelRequest(request, {adapters=[]}={}) {
  request=structuredClone(request);
  const model=getOwnedModel(request?.model_id);
  if (!model) return {status:'BLOCKED',executed:false,reasons:['unknown_model']};
  const reasons=[];
  if (request.agent_id!=='technical-dark-star') reasons.push('dark_star_route_required');
  if (request.capability!==model.capability) reasons.push('capability_mismatch');
  if (typeof request.prompt!=='string'||!request.prompt.trim()||request.prompt.length>12000) reasons.push('invalid_prompt');
  if (model.input==='image'&&(typeof request.image_tensor_id!=='string'||! /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(request.image_tensor_id))) reasons.push('image_tensor_required');
  // Request-supplied AVAILABLE, API key, runtime and graph cannot override registry.
  reasons.push('pinned_weights_not_installed','model_graph_import_not_implemented','physical_model_inference_not_verified');
  const nodes=[];
  for (const adapter of adapters) nodes.push(await readBackendCapabilities(adapter));
  return {status:'BLOCKED',executed:false,model_id:model.model_id,display_name:model.display_name,
    capability:model.capability,execution_target:'aivault-unified-gpu-fabric',
    reasons,nodes,plan:null,external_provider:null};
}

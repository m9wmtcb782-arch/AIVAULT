// Research catalogue only. No provider calls, model downloads or execution.
const planned = (id, capability, input, output, source = null) => Object.freeze({
  model_id: id, capability, input, output, availability: 'PLANNED',
  verification: source ? 'NOT VERIFIED' : 'BLOCKED', source,
  fabric_runtime: null, provider_execution_enabled: false,
});
export const modelCatalogue = Object.freeze([
  planned('planned-extract', 'extract', 'text', 'text'),
  planned('planned-reasoning', 'reasoning', 'text', 'text'),
  planned('planned-coding', 'coding', 'text', 'text'),
  planned('planned-verify', 'verify', 'text', 'text'),
  planned('planned-vision', 'vision', 'image', 'text', 'supabase/functions/dawn-light-vision/index.ts'),
  planned('planned-image-generation', 'text-to-image', 'text', 'image', 'supabase/functions/dawn-light-image/index.ts'),
  planned('planned-text-to-video', 'text-to-video', 'text', 'video', 'supabase/functions/dawn-light-video/index.ts'),
  planned('planned-image-to-video', 'image-to-video', 'image', 'video', 'supabase/functions/dawn-light-photo-video/index.ts'),
  planned('planned-speech-recognition', 'speech-to-text', 'audio', 'text'),
  planned('planned-speech-synthesis', 'text-to-speech', 'text', 'audio'),
  planned('planned-music-generation', 'text-to-music', 'text', 'audio'),
  planned('planned-3d-generation', 'text-to-3d', 'text', 'model/gltf-binary'),
]);

// Fail closed: source code and capability registration are not execution evidence.
// This catalogue cannot promote itself to AVAILABLE or route to a paid provider.
export function inspectModelRequest({ model_id, image } = {}) {
  const model = modelCatalogue.find(entry => entry.model_id === model_id);
  if (!model) return Object.freeze({ status: 'BLOCKED', executed: false, reason: 'unknown_model' });
  if (model.capability === 'image-to-video' && (typeof image !== 'string' || !image.trim())) {
    return Object.freeze({ status: 'BLOCKED', executed: false, model_id, reason: 'image_required' });
  }
  return Object.freeze({ status: 'BLOCKED', executed: false, model_id,
    capability: model.capability, availability: model.availability,
    reason: 'verified_runtime_not_bound' });
}

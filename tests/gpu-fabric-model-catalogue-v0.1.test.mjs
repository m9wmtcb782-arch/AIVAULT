import test from 'node:test';
import assert from 'node:assert/strict';
import { modelCatalogue, inspectModelRequest } from '../aivault-collab-v0.2/gpu-fabric-model-catalogue-v0.1.mjs';

test('image-to-video is distinct from text-to-video; music and 3D have explicit slots', () => {
  const capabilities = new Set(modelCatalogue.map(x => x.capability));
  for (const capability of ['image-to-video', 'text-to-video', 'text-to-music', 'text-to-3d']) assert.ok(capabilities.has(capability));
  assert.equal(new Set(modelCatalogue.map(x => x.model_id)).size, modelCatalogue.length);
  assert.equal(modelCatalogue.find(x => x.capability === 'image-to-video').input, 'image');
});
test('missing images and unknown models cannot execute', () => {
  assert.equal(inspectModelRequest({model_id:'planned-image-to-video'}).reason, 'image_required');
  assert.equal(inspectModelRequest({model_id:'unknown'}).reason, 'unknown_model');
});
test('all research slots deny execution even when source or image exists', () => {
  for (const model of modelCatalogue) {
    const result = inspectModelRequest({model_id:model.model_id, image:'https://example.invalid/image.png'});
    assert.equal(result.executed, false); assert.equal(result.status, 'BLOCKED');
    assert.equal(result.reason, 'verified_runtime_not_bound');
    assert.equal(model.fabric_runtime, null);
    assert.throws(() => {model.availability = 'AVAILABLE';}, TypeError);
  }
  assert.throws(() => modelCatalogue.push({availability:'AVAILABLE'}), TypeError);
});

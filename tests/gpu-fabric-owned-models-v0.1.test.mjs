import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {ownedModels,prepareOwnedModelRequest} from '../aivault-collab-v0.2/gpu-fabric-owned-models-v0.1.mjs';
import {verifyOwnedModelWeights} from '../aivault-collab-v0.2/gpu-fabric-weight-verifier-v0.1.mjs';

test('five named generation routes use self-hosted targets with no paid fallback', async()=>{
  let executions=0;
  const adapter={backend_id:'test-metal-declaration',runtime:'controlled',getCapabilities:async()=>({operators:['dense','add_scalar','mul_scalar'],memory_bytes:1024,device_kind:'gpu'}),execute:async()=>{executions++},release:async()=>{}};
  for(const model of ownedModels){const r=await prepareOwnedModelRequest({agent_id:'technical-dark-star',model_id:model.model_id,capability:model.capability,prompt:'test',image_tensor_id:'image-1',availability:'AVAILABLE',runtime:'external-api'},{adapters:[adapter]});
    assert.equal(r.status,'BLOCKED');assert.equal(r.executed,false);assert.equal(r.external_provider,null);assert.equal(r.plan,null);assert.equal(r.nodes.length,1);assert.ok(r.reasons.includes('model_graph_import_not_implemented'));
  }
  assert.equal(executions,0);
  assert.equal(ownedModels[1].weight_bundle,ownedModels[2].weight_bundle);
});
test('request contract refuses wrong capability, agent and absent image',async()=>{
  const r=await prepareOwnedModelRequest({agent_id:'someone',model_id:'aivault-liuguang-i2v-v0.1',capability:'text-to-video',prompt:'test'});
  for(const reason of ['dark_star_route_required','capability_mismatch','image_tensor_required'])assert.ok(r.reasons.includes(reason));
  assert.equal((await prepareOwnedModelRequest({model_id:'missing'})).executed,false);
  await assert.rejects(prepareOwnedModelRequest({model_id:ownedModels[0].model_id},{adapters:[{}]}),/invalid backend/);
});
test('offline lock verifies fixture bytes, denies tampering/traversal/symlinks; never marks model ready',async()=>{
  const root=await mkdtemp(join(tmpdir(),'aivault-weight-test-'));
  try{
    const bytes=Buffer.from('fixture bytes; not actual model weights');await writeFile(join(root,'weights.safetensors'),bytes);
    const lock={model_id:ownedModels[0].model_id,weight_bundle:ownedModels[0].weight_bundle,revision:'a'.repeat(40),files:[{path:'weights.safetensors',size_bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}]};
    const r=await verifyOwnedModelWeights(root,lock);assert.equal(r.status,'CHECKSUMS_VERIFIED');assert.equal(r.fabric_ready,false);assert.equal(r.model_loaded,false);
    for(const path of ['../escape','/absolute','dir/../escape','bad\\path'])await assert.rejects(verifyOwnedModelWeights(root,{...lock,files:[{...lock.files[0],path}]}),/invalid file/);
    await assert.rejects(verifyOwnedModelWeights(root,{...lock,revision:'main'}),/revision/);
    await assert.rejects(verifyOwnedModelWeights(root,{...lock,weight_bundle:'attacker/model'}),/source/);
    await assert.rejects(verifyOwnedModelWeights(root,{...lock,files:[lock.files[0],lock.files[0]]}),/invalid file/);
    await symlink(join(root,'weights.safetensors'),join(root,'link.safetensors'));
    await assert.rejects(verifyOwnedModelWeights(root,{...lock,files:[{...lock.files[0],path:'link.safetensors'}]}),/symlink/);
    await writeFile(join(root,'weights.safetensors'),Buffer.alloc(bytes.length,0));await assert.rejects(verifyOwnedModelWeights(root,lock),/integrity/);
  }finally{await rm(root,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDenseOperation, executeDenseReference } from '../aivault-collab-v0.2/gpu-fabric-dense-v0.1.mjs';
import { executeBackendOperation } from '../aivault-collab-v0.2/gpu-fabric-backend-v0.1.mjs';
import { tinyModelOperations, tinyModelBaseline } from './fixtures/gpu-fabric-tiny-model-v0.1.mjs';
import { planGraph } from '../aivault-collab-v0.2/gpu-fabric-planner-v0.1.mjs';
import { createPlannedHttpsStage } from '../aivault-collab-v0.2/gpu-fabric-planned-stage-v0.1.mjs';

const adapter={backend_id:'cpu-test',runtime:'CPU-reference',release:async()=>({}),
  getCapabilities:async()=>({device_kind:'cpu',operators:['dense','add_scalar'],memory_bytes:4096}),
  execute:async({operation,inputs})=>({output:executeDenseReference(operation,inputs[0])})};
test('dense reference matches independent model algebra across ReLU boundaries',async()=>{
  const [a,b]=tinyModelOperations();
  for(const x of [[1,2,-1],[0,0,0],[-2,1,3],[0.25,-0.5,0.75],[4,-3,-2]]){
    const h=await executeBackendOperation(adapter,a,[x]);
    const y=await executeBackendOperation(adapter,b,[h.output]);
    assert.deepEqual(y.output,tinyModelBaseline(x));
  }
});
test('rejects dense dimensions, Float32 overflow, missing weights, bias and activation',()=>{
  for(const mutate of [o=>o.input_size=0,o=>o.output_size=4097,o=>o.input_size=1.5,
    o=>o.weights.pop(),o=>o.bias.push(1),o=>o.weights[0]=Infinity,o=>o.bias[0]=1e100,
    o=>o.activation='eval',o=>{o.input_size=4096;o.output_size=4096;}]){
    const o=tinyModelOperations()[0];mutate(o);assert.throws(()=>validateDenseOperation(o));
  }
  assert.throws(()=>executeDenseReference(tinyModelOperations()[0],[1,2]));
  assert.throws(()=>executeDenseReference({operator:'dense',input_size:1,output_size:1,weights:[3e38],bias:[0],activation:'relu'},[2]),/accumulation/);
});
test('backend checks declared output dimensions and memory before execution',async()=>{
  const o=tinyModelOperations()[0]; let calls=0;
  const bad={...adapter,execute:async()=>{calls++;return {output:[1,2,3]};}};
  await assert.rejects(executeBackendOperation(bad,o,[[1,2,-1]]),/output shape/);
  await assert.rejects(executeBackendOperation(bad,o,[[1,2]]),/input shape/);
  const small={...bad,getCapabilities:async()=>({device_kind:'cpu',operators:['dense'],memory_bytes:4})};
  await assert.rejects(executeBackendOperation(small,o,[[1,2,-1]]),/memory budget/);
  assert.equal(calls,1);
  await assert.rejects(executeBackendOperation({...adapter,execute:async()=>({output:[1,2]})},
    {operator:'add_scalar',scalar:1},[[1,2,3]]),/output shape/);
});
test('planned dense stage rejects incompatible edge and grant shapes',()=>{
  const operations=tinyModelOperations();
  const plan=planGraph({operations,nodes:[
    {node_id:'node-a',backends:['layer-a'],supported_operators:['dense'],available_memory_bytes:4096},
    {node_id:'node-b',backends:['layer-b'],supported_operators:['dense'],available_memory_bytes:4096}],tensorBytes:{h:16}});
  const c={localNodeId:'node-b',jobId:'j',plan,operations,adapter,replayStore:{reserve:()=>true},
    grant:{jobId:'j',operationId:'op-b',tensorId:'h',senderNodeId:'node-a',dtype:'float32',shape:[3],token:'test-dense-token-0001',expiresAt:Date.now()+60000}};
  assert.throws(()=>createPlannedHttpsStage(c),/grant shape/);
  c.grant.shape=[4];assert.doesNotThrow(()=>createPlannedHttpsStage(c));
  c.operations[1].input_size=3;c.operations[1].weights=[1,2,3,4,5,6];
  assert.throws(()=>createPlannedHttpsStage(c),/edge shape/);
});

test('backend pins dense weights across asynchronous capability lookup',async()=>{
  const op=tinyModelOperations()[0];
  let resume; const paused=new Promise(resolve=>{resume=resolve;});
  const slow={...adapter,getCapabilities:async()=>{await paused;return {device_kind:'cpu',operators:['dense'],memory_bytes:4096};}};
  const result=executeBackendOperation(slow,op,[[1,2,-1]]);
  op.weights.fill(0);op.bias.fill(999);resume();
  assert.deepEqual((await result).output,[2,2,0,0.5]);
});

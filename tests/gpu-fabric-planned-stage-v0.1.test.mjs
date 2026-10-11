import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createPlannedHttpsStage } from '../aivault-collab-v0.2/gpu-fabric-planned-stage-v0.1.mjs';
import { planGraph } from '../aivault-collab-v0.2/gpu-fabric-planner-v0.1.mjs';
import { sendTensorOverAuthenticatedChannel } from '../aivault-collab-v0.2/gpu-fabric-transport-v0.1.mjs';

function config() {
  const operations = [
    { operation_id: 'a', operator: 'mul_scalar', scalar: 3, dependency_ids: [], input_tensor_ids: ['x'], output_tensor_ids: ['h'] },
    { operation_id: 'b', operator: 'add_scalar', scalar: 2, dependency_ids: ['a'], input_tensor_ids: ['h'], output_tensor_ids: ['y'] },
  ];
  const plan = planGraph({ operations, nodes: [
    { node_id: 'node-a', backends: ['cpu-a'], supported_operators: ['mul_scalar'], available_memory_bytes: 4096 },
    { node_id: 'node-b', backends: ['cpu-b'], supported_operators: ['add_scalar'], available_memory_bytes: 4096 },
  ], tensorBytes: { h: 12 } });
  const grant = { jobId: 'job', operationId: 'b', senderNodeId: 'node-a', tensorId: 'h',
    shape: [3], dtype: 'float32', token: 'test-stage-secret-0001', expiresAt: Date.now() + 60000 };
  const reserved = new Set(); // Unit harness only: NOT a durable store or real TLS.
  const calls = [];
  return { localNodeId: 'node-b', jobId: 'job', plan, operations, grant, calls,
    replayStore: { reserve: c => { const k = JSON.stringify([c.jobId,c.operationId,c.tensorId]);
      if (reserved.has(k)) return false; reserved.add(k); return true; } },
    adapter: { backend_id: 'cpu-b', runtime: 'unit-CPU', release: async () => ({}),
      getCapabilities: async () => ({ device_kind: 'cpu', operators: ['add_scalar'], memory_bytes: 4096 }),
      execute: async ({ inputs, operation }) => { calls.push(operation.scalar);
        return { output: inputs[0].map(v => Math.fround(v + operation.scalar)) }; } },
  };
}
async function request(stage, g, context = { job_id: g.jobId, operation_id: g.operationId }) {
  let wire;
  const bytes = Buffer.alloc(12); [3,6,-3].forEach((v,i) => bytes.writeFloatLE(v,i*4));
  await sendTensorOverAuthenticatedChannel({ channel: { authenticated: true, encrypted: true,
    authenticatedPeerNodeId: 'node-b', sessionExpiresAt: g.expiresAt, send: async w => { wire = w; } },
    sender_node_id: 'node-a', receiver_node_id: 'node-b', tensor_id: 'h', dtype: 'float32',
    shape: [3], payload: bytes, context });
  const req = Readable.from([Buffer.from(JSON.stringify(wire))]);
  Object.assign(req, { method: 'POST', url: '/tensor', socket: { encrypted: true }, headers: {
    authorization: 'Bearer ' + g.token, 'content-type': 'application/json',
    'x-aivault-sender-node': 'node-a', 'x-aivault-receiver-node': 'node-b' } });
  let status, body;
  const res = { writeHead: s => { status=s; }, end: s => { body=JSON.parse(s); } };
  await stage.handler(req,res); return { status,body };
}

test('rejects plan/grant/node mismatches before executing any adapter', () => {
  for (const change of [c => {c.grant.jobId='other';}, c => {c.grant.operationId='a';},
    c => {c.grant.senderNodeId='other';}, c => {c.plan.operations[1].operator='mul_scalar';},
    c => {c.plan.topological_order=['b','a'];}, c => {c.plan.topological_order=['a','a'];},
    c => {c.operations[1].dependency_ids=[];}, c => {c.localNodeId='missing';},
    c => {c.replayStore=null;}, c => {c.next={nodeId:'unplanned'};},
  ]) { const c=config(); change(c); assert.throws(() => createPlannedHttpsStage(c)); assert.equal(c.calls.length,0); }
});

test('pins scalar, tensor and job configuration against later caller mutation', async () => {
  const c=config(), originalGrant=structuredClone(c.grant), stage=createPlannedHttpsStage(c);
  c.operations[1].scalar=999; c.grant.jobId='other'; c.plan.operations[1].node_id='other';
  assert.equal((await request(stage,originalGrant)).status,200);
  assert.deepEqual(stage.getState().output,[5,8,-1]); assert.deepEqual(c.calls,[2]);
  const copy=stage.getState(); copy.output[0]=999;
  assert.equal(stage.getState().output[0],5);
});

test('wrong job is rejected without consuming the valid stage', async () => {
  const c=config(), stage=createPlannedHttpsStage(c);
  assert.equal((await request(stage,c.grant,{job_id:'other',operation_id:'b'})).status,403);
  assert.equal(c.calls.length,0);
  assert.equal((await request(stage,c.grant)).status,200);
  assert.equal((await request(stage,c.grant)).status,409);
  assert.equal(c.calls.length,1);
});

test('invalid Float32 backend output remains consumed and cannot execute twice', async () => {
  const c=config(); c.adapter.execute=async () => { c.calls.push(1); return {output:[1e100,1,1]}; };
  const stage=createPlannedHttpsStage(c);
  assert.equal((await request(stage,c.grant)).status,500);
  assert.equal(stage.getState().status,'FAILED_REQUIRES_NEW_JOB');
  assert.equal((await request(stage,c.grant)).status,409); assert.equal(c.calls.length,1);
});

test('forwarding failure cannot be reported as stage completion or retried implicitly', async () => {
  const c=config(); c.localNodeId='node-a'; c.grant={...c.grant,operationId:'a',tensorId:'x',senderNodeId:'submitter'};
  c.next={nodeId:'node-b',endpoint:'https://example.invalid/tensor',grant:{...config().grant}};
  c.adapter.getCapabilities=async () => ({device_kind:'cpu',operators:['mul_scalar'],memory_bytes:4096});
  c.adapter.execute=async ({inputs}) => {c.calls.push(1);return {output:inputs[0].map(v=>v*3)};};
  c.fetchImpl=async () => {throw new Error('network unavailable');};
  // Verify configuration first; exercise failure via a correctly addressed input.
  const stage=createPlannedHttpsStage(c);
  let wire;
  await sendTensorOverAuthenticatedChannel({channel:{authenticated:true,encrypted:true,authenticatedPeerNodeId:'node-a',
    sessionExpiresAt:c.grant.expiresAt,send:async w=>{wire=w;}},sender_node_id:'submitter',receiver_node_id:'node-a',
    tensor_id:'x',dtype:'float32',shape:[3],payload:Buffer.alloc(12),context:{job_id:'job',operation_id:'a'}});
  async function deliver() {
    const req=Readable.from([Buffer.from(JSON.stringify(wire))]);
    Object.assign(req,{method:'POST',url:'/tensor',socket:{encrypted:true},headers:{authorization:'Bearer '+c.grant.token,
      'content-type':'application/json','x-aivault-sender-node':'submitter','x-aivault-receiver-node':'node-a'}});
    let status; await stage.handler(req,{writeHead:s=>{status=s;},end:()=>{}}); return status;
  }
  assert.equal(await deliver(),500); assert.equal(stage.getState().status,'FAILED_REQUIRES_NEW_JOB');
  assert.equal(await deliver(),409); assert.equal(c.calls.length,1);
});

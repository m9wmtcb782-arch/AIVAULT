import test from "node:test";
import assert from "node:assert/strict";
import {normalizeMeshNodes} from "./mesh-live-snapshot.mjs";
import {assessVoicePool} from "./compute-pool-admission.mjs";
const nowMs=Date.parse("2026-10-13T05:43:05Z");
test("real READY status and WebGPU heartbeat are correctly counted",()=>{
 const pool=normalizeMeshNodes([{status:"READY",available:true,runtime:"webgpu",
  last_seen:"2026-10-13T05:43:04Z",capability:{webgpu:true}}],{nowMs});
 assert.equal(pool.nodes[0].online,true);
 assert.equal(pool.nodes[0].gpu,true);
 assert.equal(assessVoicePool({pool,modelId:"aivault-mandarin-v1",approved:true,weightsInstalled:true}).reason,"NO_VERIFIED_VOICE_GPU_WORKER");
});
test("old or future heartbeat cannot claim online",()=>{
 const rows=[{status:"READY",available:true,runtime:"webgpu",last_seen:"2026-10-12T05:43:05Z"},
 {status:"READY",available:true,runtime:"webgpu",last_seen:"2026-10-13T05:43:06Z"}];
 assert.deepEqual(normalizeMeshNodes(rows,{nowMs}).nodes.map(x=>x.online),[false,false]);
});
test("WebGL fallback is not misreported as WebGPU",()=>{
 const pool=normalizeMeshNodes([{status:"READY",available:true,runtime:"webgl2",last_seen:"2026-10-13T05:43:05Z"}],{nowMs});
 assert.equal(pool.nodes[0].gpu,false);
});

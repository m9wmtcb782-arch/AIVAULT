import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import * as tensor from '../supabase/functions/aivault-compute-coordinator/tensor-pipeline.ts';
import {compatibleGpuTask,verifyPortableGpuResult,poolGpuRating} from '../supabase/functions/aivault-compute-coordinator/gpu-benchmark.ts';
import {checkPoolTaskAccess} from '../supabase/functions/aivault-compute-coordinator/task-access.ts';
const source=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/aivault-compute-coordinator/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,''));
const copy=x=>structuredClone(x);
function fixture(){
 const now=new Date().toISOString();const state={compute_mesh_nodes:['a','b','c'].map(node_id=>({node_id,gpu:true,status:'READY',available:true,last_seen:now,capability:{supported_task_types:['gpu-tensor-stage','gpu-u32-mix']}})),compute_mesh_tasks:[],compute_mesh_assignments:[]};let handler,sequence=0;
 class Query{
 constructor(table){this.table=table;this.filters=[];this.op='select';this.max=Infinity;}
 select(){return this;}eq(k,v){this.filters.push(r=>(k.startsWith('payload->>')?r.payload?.[k.slice(10)]:r[k])===v);return this;}
 neq(k,v){this.filters.push(r=>r[k]!==v);return this;}in(k,vs){this.filters.push(r=>vs.includes(r[k]));return this;}
 or(s){const id=s.split('.eq.')[1];this.filters.push(r=>!r.payload?.target_node_id||r.payload.target_node_id===id);return this;}
 order(k,{ascending=true}={}){this.sortKey=k;this.ascending=ascending;return this;}limit(n){this.max=n;return this;}
 insert(v){this.op='insert';this.value=v;return this;}upsert(v,opt){this.op='upsert';this.value=v;this.opt=opt;return this;}update(v){this.op='update';this.value=v;return this;}
 async single(){const r=await this.run();return {...r,data:r.data[0]||null};}maybeSingle(){return this.single();}then(a,b){return this.run().then(a,b);}
 async run(){
 const allowed={compute_mesh_tasks:['WAITING','QUEUED','RUNNING','COMPLETED','FAILED','CANCELLED'],compute_mesh_assignments:['ASSIGNED','RUNNING','COMPLETED','FAILED','CANCELLED'],compute_mesh_nodes:['READY','RUNNING','OFFLINE','BUSY','ERROR']};
 if(this.op!=='select'&&this.value?.status&&!allowed[this.table]?.includes(this.value.status))return {data:[],error:{message:'live CHECK constraint rejected status'}};
 const table=state[this.table]??=[];
 if(this.op==='insert'&&this.table==='compute_mesh_assignments'&&table.some(r=>r.task_id===this.value.task_id&&r.node_id===this.value.node_id&&(r.slice_index||0)===(this.value.slice_index||0)))return {data:[],error:{message:'live UNIQUE task/node/slice rejected duplicate'}};
let data=[];if(this.op==='insert'){const r={id:'assignment-'+(++sequence),...copy(this.value),created_at:new Date().toISOString()};table.push(r);data=[r];}else if(this.op==='upsert'){const k=this.opt?.onConflict||'id',old=table.find(r=>r[k]===this.value[k]);if(old){if(!this.opt?.ignoreDuplicates){Object.assign(old,copy(this.value));data=[old];}}else{const r={created_at:new Date().toISOString(),...copy(this.value)};table.push(r);data=[r];}}else{data=table.filter(r=>this.filters.every(fn=>fn(r)));if(this.sortKey)data.sort((a,b)=>String(a[this.sortKey]).localeCompare(String(b[this.sortKey]))*(this.ascending?1:-1));data=data.slice(0,this.max);if(this.op==='update')for(const r of data)Object.assign(r,copy(this.value));}return {data:copy(data),error:null,count:data.length};}
 }
 const db={from:t=>new Query(t),rpc:async name=>({data:name==='darkstar_normalize_compute_capability'?{}:false,error:null})};
 vm.runInNewContext(source,{...tensor,compatibleGpuTask,verifyPortableGpuResult,poolGpuRating,checkPoolTaskAccess,crypto:globalThis.crypto,createClient:()=>db,Request,Response,Date,Map,Set,console,Deno:{env:{get:()=> 'offline'},serve:f=>handler=f}});
 const invoke=async body=>{const r=await handler(new Request('https://offline.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()};};
 return {state,db,invoke};
}
const output=t=>({kernel:t.kernel,stage:t.stage,tensor:tensor.tensorReference(t.input,t.stage),executed_on:'WebGPU',gpu:true,verified:true,gpu_time_ms:.3});
async function begin(f){return (await f.invoke({type:'pipeline.start'})).body.pipeline_id;}
async function claim(f,nodeId){return (await f.invoke({type:'task.request',nodeId})).body;}
async function finish(f,claimed,nodeId,result=output(claimed.task)){return f.invoke({type:'task.result',nodeId,taskId:claimed.task.id,assignmentId:claimed.assignmentId,lease_generation:claimed.task.lease_generation,result});}
async function firstLayer(f){const id=await begin(f),a=await claim(f,'a');await finish(f,a,'a');return {id,a};}
test('fixed stages actually depend on the previous tensor',()=>{const first=tensor.tensorReference(tensor.initialTensor(),1);assert.notDeepEqual(tensor.tensorReference(first,2),tensor.tensorReference(tensor.initialTensor(),2));});
test('cannot start with fewer than two tensor-capable nodes',async()=>{const f=fixture();f.state.compute_mesh_nodes=f.state.compute_mesh_nodes.slice(0,1);assert.equal((await f.invoke({type:'pipeline.start'})).status,409);assert.equal(f.state.compute_mesh_tasks.length,0);});
test('starting twice preserves one task and existing progress',async()=>{const f=fixture();await begin(f);const a=await claim(f,'a');await begin(f);assert.equal(f.state.compute_mesh_tasks.length,1);assert.equal(f.state.compute_mesh_tasks[0].status,'QUEUED');assert.equal(f.state.compute_mesh_tasks[0].payload.lease_generation,a.task.lease_generation);});
test('second stage is not queued before first GPU result is verified',async()=>{const f=fixture();await begin(f);await claim(f,'a');assert.equal((await claim(f,'b')).task,undefined);assert.equal(f.state.compute_mesh_tasks.length,1);});
test('two different nodes finish one dependent GPU pipeline',async()=>{const f=fixture();const {id,a}=await firstLayer(f),b=await claim(f,'b');assert.deepEqual(b.task.input,output(a.task).tensor);await finish(f,b,'b');const d=(await f.invoke({type:'pipeline.status',pipeline_id:id})).body;assert.equal(d.verified,true);assert.equal(d.distinct_browser_nodes,2);assert.equal(d.video_generation_verified,false);assert.equal(d.billing_enabled,false);});
test('first node cannot execute the second stage of its own proof',async()=>{const f=fixture();await firstLayer(f);assert.equal((await claim(f,'a')).task,undefined);});
test('incorrect GPU output never enqueues the next stage',async()=>{const f=fixture();await begin(f);const a=await claim(f,'a');const bad=output(a.task);bad.tensor[0]+=1;assert.equal((await finish(f,a,'a',bad)).body.verified,false);assert.equal(f.state.compute_mesh_tasks.length,1);});
test('failed output is retried on another node with the same input',async()=>{const f=fixture();await begin(f);const a=await claim(f,'a');const bad=output(a.task);bad.tensor[0]+=1;await finish(f,a,'a',bad);const b=await claim(f,'b');assert.deepEqual(b.task.input,a.task.input);assert.notEqual(b.task.lease_generation,a.task.lease_generation);assert(b.task.excluded_node_ids.includes('a'));});
test('offline next-stage node is replaced without rerunning previous layer',async()=>{const f=fixture();const {id}=await firstLayer(f),b=await claim(f,'b');f.state.compute_mesh_nodes.find(n=>n.node_id==='b').last_seen='2000-01-01T00:00:00Z';const c=await claim(f,'c');assert.deepEqual(c.task.input,b.task.input);assert.equal(c.task.stage,2);await finish(f,c,'c');assert.equal((await f.invoke({type:'pipeline.status',pipeline_id:id})).body.verified,true);assert.equal(f.state.compute_mesh_assignments.filter(a=>a.task_id.endsWith('s1')).length,1);});
test('late result from expired lease is rejected',async()=>{const f=fixture();await firstLayer(f);const b=await claim(f,'b');f.state.compute_mesh_nodes.find(n=>n.node_id==='b').last_seen='2000-01-01T00:00:00Z';await claim(f,'c');assert.equal((await finish(f,b,'b')).status,409);assert.equal(f.state.compute_mesh_tasks.find(t=>t.payload.stage===2).status,'QUEUED');});
test('old worker cannot fail or extend replacement lease',async()=>{const f=fixture();await firstLayer(f);const b=await claim(f,'b');f.state.compute_mesh_nodes.find(n=>n.node_id==='b').last_seen='2000-01-01T00:00:00Z';await claim(f,'c');for(const type of ['task.failure','task.progress'])assert.equal((await f.invoke({type,nodeId:'b',taskId:b.task.id,assignmentId:b.assignmentId,lease_generation:b.task.lease_generation})).status,409);});
test('replayed completion does not create duplicate downstream tasks',async()=>{const f=fixture();const {a}=await firstLayer(f);assert.equal((await finish(f,a,'a')).body.idempotent,true);assert.equal(f.state.compute_mesh_tasks.length,2);});
test('standalone arbitrary tensor task creation is blocked',async()=>{const f=fixture();assert.equal((await f.invoke({type:'task.create',task:{id:'evil',type:'gpu-tensor-stage',input:[1],shader:'external'}})).status,403);assert.equal(f.state.compute_mesh_tasks.length,0);});
test('enterprise submissions remain denied with no writes',async()=>{const f=fixture();const before=copy(f.state);assert.equal((await f.invoke({type:'enterprise.submit',model_id:'external'})).status,403);assert.deepEqual(f.state,before);assert.equal((await f.invoke({type:'enterprise.status'})).body.available_for_rental,false);});
test('invalid pipeline ID is rejected',async()=>assert.equal((await fixture().invoke({type:'pipeline.status',pipeline_id:'anything'})).status,400));
test('concurrent claimers cannot both own the same layer',async()=>{const f=fixture();await begin(f);const results=await Promise.all([claim(f,'a'),claim(f,'b')]);assert.equal(results.filter(r=>r.task).length,1);assert.equal(f.state.compute_mesh_assignments.length,1);});
test('reserved pipeline IDs cannot be overwritten by public diagnostic creation',async()=>{const f=fixture();const id=await begin(f),before=copy(f.state.compute_mesh_tasks);assert.equal((await f.invoke({type:'task.create',task:{id:id+'-s1',type:'gpu-u32-mix',elements:16,iterations:1}})).status,403);assert.deepEqual(f.state.compute_mesh_tasks,before);});
test('wrong output retries are bounded and do not reuse failed workers',async()=>{const f=fixture();await begin(f);for(const node of ['a','b','c']){const t=await claim(f,node),bad=output(t.task);bad.tensor[0]+=1;await finish(f,t,node,bad);}assert.equal((await claim(f,'a')).task,undefined);assert.equal(f.state.compute_mesh_tasks[0].status,'FAILED');});

test('healthy heartbeats do not extend a hard-expired layer lease',async()=>{const f=fixture();await firstLayer(f);const b=await claim(f,'b');f.state.compute_mesh_tasks.find(t=>t.payload.stage===2).payload.lease_expires_at='2000-01-01T00:00:00Z';assert.equal((await finish(f,b,'b')).status,409);const c=await claim(f,'c');assert.equal(c.task.stage,2);assert.notEqual(c.task.lease_generation,b.task.lease_generation);});

test('same node reclaims an expired layer without violating assignment uniqueness',async()=>{const f=fixture();await firstLayer(f);const b=await claim(f,'b');f.state.compute_mesh_tasks.find(t=>t.payload.stage===2).payload.lease_expires_at='2000-01-01T00:00:00Z';const b2=await claim(f,'b');assert.equal(b2.task.stage,2);assert.equal(b2.assignmentId,b.assignmentId);assert.notEqual(b2.task.lease_generation,b.task.lease_generation);assert.equal((await finish(f,b,'b')).status,409);assert.equal((await finish(f,b2,'b')).body.verified,true);});
test('stopping a node uses valid OFFLINE storage state and releases its pending layer',async()=>{const f=fixture();await firstLayer(f);await claim(f,'b');const pause=await f.invoke({type:'node.heartbeat',nodeId:'b',status:'PAUSED',gpu:true,available:false});assert.equal(pause.status,200);assert.equal(f.state.compute_mesh_nodes.find(n=>n.node_id==='b').status,'OFFLINE');const c=await claim(f,'c');assert.equal(c.task.stage,2);});

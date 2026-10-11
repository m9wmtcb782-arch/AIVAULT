import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {checkPoolTaskAccess} from '../supabase/functions/aivault-compute-coordinator/task-access.ts';
const source=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/aivault-compute-coordinator/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,''));
function fixture({allowed=false,workers=[],registered=[],tasks=[],assignments=[],fail=false,taskWriteFails=false}={}){
 let handler;const writes=[];
 class Query{
  constructor(table){this.table=table;this.op='select';}select(){return this;}eq(){return this;}neq(){return this;}in(){return this;}order(){return this;}limit(){return this;}
  upsert(value){this.op='upsert';this.value=value;return this;}insert(value){this.op='insert';this.value=value;return this;}update(value){this.op='update';this.value=value;return this;}
  async single(){const r=await this.run();return {...r,data:Array.isArray(r.data)?r.data[0]:r.data};}async maybeSingle(){return this.single();}then(a,b){return this.run().then(a,b);}
  async run(){if(this.op!=='select'){writes.push({table:this.table,value:this.value});return {data:this.value,error:taskWriteFails&&this.table==='compute_mesh_tasks'?{message:'failed'}:null};}const data=this.table==='compute_mesh_nodes'?workers:this.table==='aivault_compute_nodes'?registered:this.table==='compute_mesh_tasks'?tasks:this.table==='compute_mesh_assignments'?assignments:[];return {data,error:fail?{message:'offline'}:null,count:data.length};}
 }
 const client={from:t=>new Query(t),rpc:async(name)=>{if(name==='darkstar_normalize_compute_capability')return {data:{platform_family:'reported'},error:null};assert.equal(name,'aivault_check_pool_model_access');return {data:allowed,error:fail?{message:'offline'}:null};}};
 vm.runInNewContext(source,{checkPoolTaskAccess,createClient:()=>client,Request,Response,console,Date,Map,Set,Deno:{env:{get:()=> 'offline'},serve:fn=>handler=fn}});
 return {writes,invoke:async(body,headers={})=>{const r=await handler(new Request('https://offline.invalid',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()};}};
}
test('external model task refused before any database write',async()=>{const f=fixture();const r=await f.invoke({type:'task.create',task:{id:'external',type:'inference',model_id:'external',ownership:'first_party'}});assert.equal(r.status,403);assert.equal(f.writes.length,0);});
test('unapproved model task in old queue is not dispatched',async()=>{const f=fixture({workers:[{node_id:'worker',gpu:true}],tasks:[{task_id:'external',type:'inference',payload:{model_id:'external'}}]});const r=await f.invoke({type:'task.request',nodeId:'worker'});assert.equal(r.body.error,'no available task');assert.equal(f.writes.length,0);});
test('fixed internal test is accepted without a model RPC or inference',async()=>{const f=fixture();const r=await f.invoke({type:'task.create',task:{id:'fixed',type:'webgpu-compute',elements:16,iters:2}});assert.equal(r.status,200);assert.equal(f.writes[0].table,'compute_mesh_tasks');});
test('approved own-model task passes its server lookup',async()=>{const f=fixture({allowed:true});const r=await f.invoke({type:'task.create',task:{id:'own',type:'inference',model_id:'owned-and-tested'}});assert.equal(r.status,200);assert.equal(f.writes.length,1);});
test('pool snapshot has offline inventory without exposing user identity',async()=>{const f=fixture({workers:[{node_id:'phone',gpu:true,platform:'iPhone',last_seen:'2000-01-01T00:00:00Z',user_id:'private-user',status:'READY'}],registered:[{id:'pc',node_name:'desk',platform:'Windows',webgpu_supported:true,last_heartbeat_at:new Date().toISOString(),status:'online',user_id:'private-user'}]});const r=await f.invoke({type:'mesh.pool'});assert.equal(r.status,200);assert.equal(r.body.nodes.length,2);assert.equal(r.body.nodes.find(n=>n.id==='phone').online,false);assert.equal(r.body.nodes.find(n=>n.id==='pc').online,true);assert(!JSON.stringify(r.body).includes('private-user'));assert.equal(r.body.policy.external_models,'CLOSED');assert.equal(f.writes.length,0);});
test('snapshot failure is an error, not an empty pool',async()=>{const f=fixture({fail:true});const r=await f.invoke({type:'mesh.pool'});assert.equal(r.status,503);assert.equal(r.body.success,false);});

const proof={verified:true,executed_on:'WebGPU',gpu:true,gpu_time_ms:1,checksum:1,workgroups:1,elements:256};
test('completion persists result only on assignment and checks task update',async()=>{const f=fixture({assignments:[{id:'assignment',task_id:'task',node_id:'node'}]});const r=await f.invoke({type:'task.result',taskId:'task',nodeId:'node',result:proof});assert.equal(r.body.success,true);const taskWrite=f.writes.find(w=>w.table==='compute_mesh_tasks');assert.equal(taskWrite.value.status,'COMPLETED');assert(!('result'in taskWrite.value));assert.deepEqual(f.writes.find(w=>w.table==='compute_mesh_assignments').value.result,proof);});
test('task database update failure must not report completion',async()=>{const f=fixture({assignments:[{id:'assignment'}],taskWriteFails:true});const r=await f.invoke({type:'task.result',taskId:'task',nodeId:'node',result:proof});assert.equal(r.status,500);assert.equal(r.body.success,false);assert.equal(r.body.error,'TASK_STATUS_WRITE_FAILED');});
test('device metadata platform survives registration',async()=>{const f=fixture();await f.invoke({type:'node.register',node:{id:'node',gpu:true,metadata:{platform:'iPhone'}}});assert.equal(f.writes.find(w=>w.table==='compute_mesh_nodes').value.platform,'iPhone');});
test('heartbeat can restore missing platform from reported browser header',async()=>{const f=fixture();await f.invoke({type:'node.heartbeat',nodeId:'node',gpu:true},{'User-Agent':'Mozilla iPhone OS Safari'});assert.equal(f.writes.find(w=>w.table==='compute_mesh_nodes').value.platform,'Mozilla iPhone OS Safari');});

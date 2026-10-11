import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/aivault-compute-mesh/index.ts',import.meta.url),'utf8').replace(/^import .*supabase-js.*;\n/m,''),{mode:'transform'});
const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const id=i=>`33333333-3333-4333-8333-${String(i).padStart(12,'0')}`;
function fixture(initial=[],initialTasks=[]){
  const rows=initial.map(r=>({...r})),tasks=initialTasks.map(r=>({...r})),events=[];let handler;let authCalls=0;
  class Query {
    constructor(table){this.table=table;this.filters=[];this.op='select';this.maximum=Infinity;}
    select(){return this;} in(k,values){this.filters.push(r=>values.includes(r[k]));return this;} lt(k,v){this.filters.push(r=>r[k]<v);return this;} order(){return this;} eq(k,v){this.filters.push(r=>r[k]===v);return this;} limit(n){this.maximum=n;return this;}
    update(patch){this.op='update';this.patch=patch;return this;} insert(value){this.op='insert';this.patch=value;return this;}
    async single(){const r=await this.run();return {...r,data:Array.isArray(r.data)?r.data[0]:r.data};}
    async maybeSingle(){return this.single();} then(resolve,reject){return this.run().then(resolve,reject);}
    async run(){
      if(this.table==='aivault_compute_node_events'){events.push(this.patch);return {data:null,error:null};}
      assert(['aivault_compute_nodes','aivault_compute_tasks'].includes(this.table),'Unexpected table operation');
      const tableRows=this.table==='aivault_compute_tasks'?tasks:rows;
      let selected=tableRows.filter(r=>this.filters.every(f=>f(r))).slice(0,this.maximum);
      if(this.op==='insert'){
        if(tableRows.some(r=>r.id===this.patch.id))return {data:null,error:{code:'23505',message:'duplicate'}};
        const row={id:this.patch.id||webcrypto.randomUUID(),...this.patch};tableRows.push(row);selected=[row];
      }
      if(this.op==='update')selected.forEach(r=>Object.assign(r,this.patch));
      return {data:selected.map(r=>({...r})),error:null};
    }
  }
  const client={from:t=>new Query(t),auth:{getUser:async token=>{authCalls++;return (['valid','valid-other','anonymous'].includes(token))?{data:{user:{id:token==='valid-other'?other:owner,is_anonymous:token==='anonymous'}},error:null}:{data:{user:null},error:{message:'invalid'}};}}};
  const sandbox={createClient:()=>client,Request,Response,crypto:webcrypto,console:{error(){}},Deno:{env:{get:()=> 'offline-placeholder'},serve:fn=>{handler=fn;}}};
  vm.runInNewContext(source,sandbox);
  return {rows,tasks,events,authCalls:()=>authCalls,invoke:async(body,token='valid')=>{
    const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
    const r=await handler(new Request('https://offline.invalid',{method:'POST',headers,body:JSON.stringify(body)}));return {status:r.status,body:await r.json()};
  }};
}
test('requires login before registration',async()=>{const f=fixture();assert.equal((await f.invoke({action:'register',node_id:id(1)},null)).status,401);assert.equal(f.rows.length,0);});
test('invalid login cannot register',async()=>{const f=fixture();assert.equal((await f.invoke({action:'register',node_id:id(1)},'invalid')).status,401);assert.equal(f.rows.length,0);});
test('same account registers 120 distinct devices without count cap',async()=>{const f=fixture();for(let i=1;i<=120;i++)assert.equal((await f.invoke({action:'register',node_id:id(i),webgpu_supported:true})).status,200);assert.equal(f.rows.length,120);assert(f.rows.every(r=>r.user_id===owner));});
test('re-registering same device keeps one row',async()=>{const f=fixture();await f.invoke({action:'register',node_id:id(1)});await f.invoke({action:'register',node_id:id(1),node_name:'updated'});assert.equal(f.rows.length,1);assert.equal(f.rows[0].node_name,'updated');});
test('request user_id cannot spoof ownership',async()=>{const f=fixture();await f.invoke({action:'register',node_id:id(1),user_id:other});assert.equal(f.rows[0].user_id,owner);});
test('cannot take over another user device',async()=>{const f=fixture([{id:id(1),user_id:other,node_name:'original'}]);assert.equal((await f.invoke({action:'register',node_id:id(1),node_name:'hijacked'})).status,409);assert.equal(f.rows[0].node_name,'original');});
test('malformed node id rejected before insert',async()=>{const f=fixture();assert.equal((await f.invoke({action:'register',node_id:'bad'})).status,400);assert.equal(f.rows.length,0);});
test('legacy single-device registration remains compatible',async()=>{const f=fixture([{id:id(1),user_id:owner}]);assert.equal((await f.invoke({action:'register',node_name:'legacy'})).status,200);assert.equal(f.rows.length,1);});
test('multiple devices require explicit id for legacy actions',async()=>{const f=fixture([{id:id(1),user_id:owner},{id:id(2),user_id:owner}]);for(const action of ['register','heartbeat','pause','resume','claim-task','submit-result']){const r=await f.invoke({action});assert.equal(r.status,400,action);assert.equal(r.body.error,'NODE_ID_REQUIRED_FOR_MULTIPLE_DEVICES');}});
test('pause changes only requested owned device',async()=>{const f=fixture([{id:id(1),user_id:owner,status:'online'},{id:id(2),user_id:owner,status:'online'}]);assert.equal((await f.invoke({action:'pause',node_id:id(2)})).status,200);assert.equal(f.rows[0].status,'online');assert.equal(f.rows[1].status,'paused');});
test('heartbeat changes only requested device',async()=>{const f=fixture([{id:id(1),user_id:owner,status:'online'},{id:id(2),user_id:owner,status:'online'}]);assert.equal((await f.invoke({action:'heartbeat',node_id:id(2),battery_level:55})).status,200);assert.equal(f.rows[0].battery_level,undefined);assert.equal(f.rows[1].battery_level,55);});
test('resume retains low battery protection on requested device',async()=>{const f=fixture([{id:id(1),user_id:owner,status:'paused',paused_by_user:true,battery_level:5,charging:false}]);const r=await f.invoke({action:'resume',node_id:id(1)});assert.equal(r.status,200);assert.equal(r.body.status,'paused');assert.equal(f.rows[0].paused_by_user,true);});
test('foreign device heartbeat cannot mutate it',async()=>{const f=fixture([{id:id(1),user_id:other,battery_level:80}]);assert.notEqual((await f.invoke({action:'heartbeat',node_id:id(1),battery_level:1})).status,200);assert.equal(f.rows[0].battery_level,80);});

test('anonymous Auth accounts must register a real account first',async()=>{const f=fixture();assert.equal((await f.invoke({action:'register',node_id:id(1)},'anonymous')).status,401);assert.equal(f.rows.length,0);});

test('another account device can reclaim an expired task without replacing original node',async()=>{
  const taskId=id(90),oldLease=id(91);
  const f=fixture([{id:id(1),user_id:owner,status:'busy'},{id:id(2),user_id:other,status:'online',paused_by_user:false}], [{id:taskId,status:'leased',assigned_node_id:id(1),lease_token:oldLease,lease_expires_at:'2000-01-01T00:00:00Z',attempt_count:1,max_attempts:3,task_type:'compute_test',task_version:1,payload:{operation:'sha256_test',iterations:10}}]);
  const result=await f.invoke({action:'claim-task',node_id:id(2)},'valid-other');
  assert.equal(result.status,200);assert.equal(result.body.status,'leased');
  assert.equal(f.tasks[0].assigned_node_id,id(2));assert.notEqual(f.tasks[0].lease_token,oldLease);
  assert.equal(f.rows.length,2);assert.equal(f.rows[0].user_id,owner);assert.equal(f.rows[1].user_id,other);
  const late=await f.invoke({action:'submit-result',node_id:id(1),task_id:taskId,lease_token:oldLease,result_sha256:'a'.repeat(64),result:{ok:true}});
  assert.notEqual(late.status,200);assert.equal(f.tasks[0].assigned_node_id,id(2));
});
test('another account cannot steal an unexpired leased task',async()=>{
  const f=fixture([{id:id(1),user_id:owner,status:'busy'},{id:id(2),user_id:other,status:'online'}],[{id:id(90),status:'leased',assigned_node_id:id(1),lease_expires_at:'2999-01-01T00:00:00Z',attempt_count:1,task_type:'compute_test',task_version:1}]);
  // A foreign node cannot return results for an assignment still owned by the active node.
  const forbidden=await f.invoke({action:'submit-result',node_id:id(2),task_id:id(90),lease_token:id(91),result_sha256:'a'.repeat(64),result:{ok:true}},'valid-other');
  assert.notEqual(forbidden.status,200);assert.equal(f.tasks[0].assigned_node_id,id(1));
});

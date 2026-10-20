import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/aivault-independent-agent-runtime/index.ts', import.meta.url), 'utf8').replace(/^import "jsr:[^\n]+\n/, ''));
const uid = '12345678-1234-1234-1234-123456789012';
const service = 'offline-service-placeholder';
const base = 'https://offline.invalid';
const response = (body, status=200) => new Response(JSON.stringify(body), {status});
function fixture({auth=()=>response({id:uid}), access=()=>response(true), env={}}={}) {
  let handler;
  const calls=[];
  const sandbox = {
    Request, Response, AbortSignal, crypto:webcrypto,
    Deno:{env:{get:n=>({...{SUPABASE_URL:base,SUPABASE_SERVICE_ROLE_KEY:service},...env})[n]}, serve:fn=>{handler=fn;}},
    fetch:async(url, init={})=>{
      calls.push({url, init});
      if(url===base+'/auth/v1/user') return auth();
      if(url===base+'/rest/v1/rpc/aivault_check_agent_execute_access') return access();
      if(url===base+'/rest/v1/rpc/aivault_prepare_agent_context') return response({identity:{}});
      // Every provider and every write is intercepted. No real network is available here.
      throw new Error('UNEXPECTED_DOWNSTREAM_CALL');
    },
  };
  vm.runInNewContext(source,sandbox);
  return {calls, invoke:async({token='user-token', body={agent_id:'agent-a',action:'check_access'}, method='POST', internal=false}={})=>{
    const headers={'Content-Type':'application/json'};
    if(token!==null) headers.Authorization='Bearer '+token;
    if(internal) headers['x-aivault-internal']='fake-internal-secret';
    const req=new Request(base,{method,headers,...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
    return handler(req);
  }};
}
async function expectDenied(options,request,status,error,callCount) {
  const f=fixture(options);const r=await f.invoke(request);
  assert.equal(r.status,status);assert.equal((await r.json()).error,error);
  assert.equal(f.calls.length,callCount);
  assert(f.calls.every(c=>c.url.endsWith('/auth/v1/user')||c.url.endsWith('/rpc/aivault_check_agent_execute_access')));
}

test('missing bearer cannot access context or inference',()=>expectDenied({}, {token:null},401,'AUTH_REQUIRED',0));
test('internal secret cannot bypass user authentication',()=>expectDenied({}, {token:null,internal:true},401,'AUTH_REQUIRED',0));
test('service key is not a user identity',()=>expectDenied({}, {token:service},401,'AUTH_REQUIRED',0));
test('invalid user token rejected',()=>expectDenied({auth:()=>response({},401)}, {},401,'AUTH_INVALID',1));
test('auth outage fails closed',()=>expectDenied({auth:()=>response({},500)}, {},503,'AUTHORIZATION_UNAVAILABLE',1));
test('auth rate limit fails closed',()=>expectDenied({auth:()=>response({},429)}, {},503,'AUTHORIZATION_UNAVAILABLE',1));
test('auth network failure fails closed without details',()=>expectDenied({auth:()=>{throw Error('sensitive-detail')}}, {},503,'AUTHORIZATION_UNAVAILABLE',1));
test('malformed auth JSON fails closed',()=>expectDenied({auth:()=>new Response('bad-json')}, {},503,'AUTHORIZATION_UNAVAILABLE',1));
test('malformed user id rejected',()=>expectDenied({auth:()=>response({id:'spoofed'})}, {},401,'AUTH_INVALID',1));
test('null auth record rejected',()=>expectDenied({auth:()=>response(null)}, {},401,'AUTH_INVALID',1));
for(const value of [false,null,{},'true',1,[true]]) {
  test('RPC only accepts literal true: '+JSON.stringify(value),()=>expectDenied({access:()=>response(value)}, {},403,'AGENT_ACCESS_DENIED',2));
}
test('RPC permission error fails closed',()=>expectDenied({access:()=>response({},403)}, {},503,'AUTHORIZATION_UNAVAILABLE',2));
test('RPC network failure fails closed',()=>expectDenied({access:()=>{throw Error('network')}}, {},503,'AUTHORIZATION_UNAVAILABLE',2));
test('malformed RPC JSON fails closed',()=>expectDenied({access:()=>new Response('bad-json')}, {},503,'AUTHORIZATION_UNAVAILABLE',2));
test('missing configuration fails closed',()=>expectDenied({env:{SUPABASE_SERVICE_ROLE_KEY:''}}, {},503,'AUTHORIZATION_UNAVAILABLE',0));
test('spoofed body identity ignored and check-only never invokes model',async()=>{
  const f=fixture();const r=await f.invoke({body:{agent_id:'agent-a',action:'check_access',user_id:'attacker',owner_id:'attacker'}});
  assert.equal(r.status,200);assert.deepEqual(await r.json(),{success:true,authorized:true,agent_id:'agent-a',inference_executed:false});
  assert.equal(f.calls.length,2);
  const rpc=f.calls[1];assert.deepEqual(JSON.parse(rpc.init.body),{p_agent_id:'agent-a',p_user_id:uid});
  assert.equal(f.calls[0].init.headers.Authorization,'Bearer user-token');
  assert.equal(rpc.init.headers.Authorization,'Bearer '+service);
});
test('normal execute denied before context, gateway and learning writes',()=>expectDenied({access:()=>response(false)}, {body:{agent_id:'agent-a',task:'do work',capability:'image_generation'}},403,'AGENT_ACCESS_DENIED',2));
test('authorized normal execute reaches context after auth and RPC',async()=>{
  const f=fixture();const r=await f.invoke({body:{agent_id:'agent-a',task:'do work'}});
  assert.equal(r.status,500); // Mock deliberately blocks inference.
  assert.deepEqual(f.calls.map(c=>c.url),[base+'/auth/v1/user',base+'/rest/v1/rpc/aivault_check_agent_execute_access',base+'/rest/v1/rpc/aivault_prepare_agent_context',base+'/functions/v1/ai-gateway']);
});
test('invalid JSON rejected before any backend call',()=>expectDenied({}, {body:'{'},400,'INVALID_JSON',0));
test('null request body rejected',()=>expectDenied({}, {body:'null'},400,'INVALID_JSON',0));
test('array request body rejected',()=>expectDenied({}, {body:[]},400,'INVALID_JSON',0));
test('empty agent rejected',()=>expectDenied({}, {body:{agent_id:'',action:'check_access'}},400,'AGENT_ID_AND_TASK_REQUIRED',0));
test('oversized agent rejected',()=>expectDenied({}, {body:{agent_id:'x'.repeat(129),action:'check_access'}},400,'AGENT_ID_AND_TASK_REQUIRED',0));
test('execute still requires a task',()=>expectDenied({}, {body:{agent_id:'agent-a'}},400,'AGENT_ID_AND_TASK_REQUIRED',0));
test('preflight does not access backend',async()=>{const f=fixture();assert.equal((await f.invoke({method:'OPTIONS',token:null})).status,204);assert.equal(f.calls.length,0);});
test('unsupported method rejected',()=>expectDenied({}, {method:'GET'},405,'METHOD_NOT_ALLOWED',0));

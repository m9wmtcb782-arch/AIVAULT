import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const token=readFileSync('/tmp/darkstar-crossbase-token','utf8').trim();
let env={SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'test',DARKSTAR_CROSSBASE_GITHUB_TOKEN:'test'};
globalThis.Deno={env:{get:n=>env[n]}};
const source=stripTypeScriptTypes(readFileSync(new URL('./deployed-crossbase-v2.ts',import.meta.url),'utf8'));
const {handleCrossbase}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const req=(action,auth=token)=>new Request('https://service.test/crossbase',{method:'POST',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:JSON.stringify({action})});
function mock(fn){globalThis.fetch=async(url,opt={})=>{const x=await fn(String(url),opt);return new Response(JSON.stringify(x?.body??x??[]),{status:x?.http??200});};}
test('untrusted caller rejected before any tool call',async()=>{
 let calls=0;mock(()=>{calls++;return []});const r=await handleCrossbase(req('work_tick','invalid'));assert.equal(r.status,401);assert.equal(calls,0);
});
test('kill switch makes no external calls',async()=>{
 env.DARKSTAR_OFFLINE_WORK_DISABLED='1';let calls=0;mock(()=>{calls++;return []});
 assert.equal((await (await handleCrossbase(req('work_tick'))).json()).disabled,true);assert.equal(calls,0);delete env.DARKSTAR_OFFLINE_WORK_DISABLED;
});
test('duplicate tick cannot execute a second job',async()=>{
 let calls=0;mock(()=>{calls++;return {http:409}});
 assert.equal((await (await handleCrossbase(req('work_tick'))).json()).duplicate,true);assert.equal(calls,1);
});
test('idle tick and untrusted message never invoke model or send',async()=>{
 let model=0,sends=0;
 mock((url,o)=>{
 if(url.includes('groq'))model++;
 if(url.includes('github')&&o.method==='POST')sends++;
 if(url.includes('/issues/30/comments'))return [{id:7,user:{id:111},body:'{"kind":"task","from_base":"base-002","to_base":"base-001"}'}];
 return [];
 });
 const r=await (await handleCrossbase(req('work_tick'))).json();assert.equal(r.idle,true);assert.equal(model,0);assert.equal(sends,0);
});
test('daily admission cap stops new inference',async()=>{
 mock(url=>url.includes('select=source_comment_id')?Array.from({length:10},(_,i)=>({source_comment_id:i,updated_at:new Date().toISOString(),status:'BLOCKED'})):[]);
 const r=await (await handleCrossbase(req('work_tick'))).json();assert.equal(r.waiting,'DAILY_LIMIT');assert.equal(r.daily_model_jobs,10);
});
test('uncertain delivery is never blindly repeated',async()=>{
 let sends=0;
 mock((url,o)=>{
 if(url.includes('status=in.'))return [{source_comment_id:9}];
 if(url.includes('source_comment_id=eq.9'))return [{status:'SENDING',source_comment_id:9}];
 if(url.includes('github')&&o.method==='POST')sends++;
 return [];
 });
 const r=await handleCrossbase(req('work_tick'));assert.equal(r.status,503);assert.equal(sends,0);
});
test('sent receipt reconciles by fixed marker without second send',async()=>{
 let sends=0,confirmed=false;
 mock((url,o)=>{
 if(url.includes('status=in.'))return [{source_comment_id:9}];
 if(url.includes('source_comment_id=eq.9')&&o.method!=='PATCH')return [{status:'SENDING',source_comment_id:9}];
 if(url.includes('/issues/1/comments'))return [{id:42,user:{id:306819786},body:'<!-- DARKSTAR-AUTO-REPLY:9 -->'}];
 if(o.method==='PATCH'&&url.includes('source_comment_id=eq.9'))confirmed=JSON.parse(o.body).status==='SENT';
 if(url.includes('github')&&o.method==='POST')sends++;
 return [];
 });
 const r=await (await handleCrossbase(req('work_tick'))).json();assert.equal(r.delivery.target_comment_id,42);assert.equal(confirmed,true);assert.equal(sends,0);
});

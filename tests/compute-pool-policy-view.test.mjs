import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkPoolTaskAccess} from '../supabase/functions/aivault-compute-coordinator/task-access.ts';
import {classify,deviceLabel,oceanScale,waterState,transitions} from '../assets/compute-pool/pool-view.mjs';
const denied=async()=>false,approved=async id=>id==='owned-and-tested';
test('external model cannot self-approve',async()=>assert.equal((await checkPoolTaskAccess({type:'inference',model_id:'external',approved:true,ownership:'first_party',test_passed:true},denied)).allowed,false));
test('planned own model remains denied',async()=>assert.equal((await checkPoolTaskAccess({model_id:'planned-vision'},denied)).allowed,false));
test('only server-approved model passes',async()=>assert.equal((await checkPoolTaskAccess({model_id:'owned-and-tested'},approved)).allowed,true));
test('external weight URL rejected even when naming approved model',async()=>assert.equal((await checkPoolTaskAccess({model_id:'owned-and-tested',payload:{model_url:'https://example.invalid/external'}},approved)).allowed,false));
test('provider task denied before lookup',async()=>{let queries=0;const r=await checkPoolTaskAccess({type:'webgpu-compute',provider:'grok'},async()=>{queries++;return true;});assert.equal(r.allowed,false);assert.equal(queries,0);});
test('nested model reference cannot bypass arithmetic test gate',async()=>assert.equal((await checkPoolTaskAccess({type:'webgpu-compute',payload:{input:{model_id:'external'}}},denied)).allowed,false));
test('deep envelope fails closed',async()=>{let task={model_id:'external'};for(let i=0;i<12;i++)task={input:task};assert.equal((await checkPoolTaskAccess(task,approved)).allowed,false);});
test('conflicting model IDs denied',async()=>assert.equal((await checkPoolTaskAccess({model_id:'owned-and-tested',payload:{model_id:'other'}},approved)).allowed,false));
test('authorization outage fails closed',async()=>assert.equal((await checkPoolTaskAccess({model_id:'owned-and-tested'},async()=>{throw Error('network');})).allowed,false));
test('RPC must be literal true',async()=>assert.equal((await checkPoolTaskAccess({model_id:'owned'},async()=> 'true')).allowed,false));
test('built-in benchmark preserved',async()=>assert.equal((await checkPoolTaskAccess({type:'webgpu-compute',elements:100,iters:2},denied)).allowed,true));
test('unknown workload requires model',async()=>assert.equal((await checkPoolTaskAccess({type:'external-inference'},denied)).allowed,false));
const videoCapacity=units=>({status:'VALIDATED',unit:'standard_5s_videos_per_hour',workload_id:'fixed-owned-video-v1',scope:'pool',units});
test('GPU microbenchmarks never become video water',()=>{const r=waterState([{online:true,gpu_reported:true,available:true,gpu_rating:{version:'pool-u32-v1',units:1000000}}]);assert.equal(r.validated,false);assert.equal(r.totalVideo,null);assert.equal(r.ratio,0);assert.equal(r.members.length,1);});
test('standalone video ratings are not summed into cluster capacity',()=>{const r=waterState([{online:true,video_rating:{status:'VALIDATED',unit:'standard_5s_videos_per_hour',workload_id:'own',units:5000}}]);assert.equal(r.totalVideo,null);});
test('whole-pool validated capacity drives water',()=>{const r=waterState([],videoCapacity(600));assert.equal(r.totalVideo,600);assert.equal(r.reference,1000);assert.equal(r.ratio,.6);});
test('ocean scale grows far beyond 500',()=>{assert(oceanScale(100000000)>100000000);assert.equal(waterState([],videoCapacity(100000000)).totalVideo,100000000);});
test('missing profile and wrong units cannot validate water',()=>{assert.equal(waterState([],{...videoCapacity(5),workload_id:null}).validated,false);assert.equal(waterState([],{...videoCapacity(5),unit:'PGU'}).validated,false);});
test('validated zero differs from unverified capacity',()=>{assert.equal(waterState([],videoCapacity(0)).totalVideo,0);assert.equal(waterState([]).totalVideo,null);});
test('initial snapshot never triggers fishing',()=>assert.deepEqual(transitions(null,[{id:'phone',online:false}]),[]));
test('confirmed departure catches exactly one previously online GPU',()=>{const old=[{id:'a',online:true,gpu_reported:true},{id:'b',online:false,gpu_reported:true}];assert.deepEqual(transitions(old,[{id:'a',online:false},{id:'b',online:false}]).map(n=>n.id),['a']);});
test('truncated response does not create false departure',()=>assert.deepEqual(transitions([{id:'a',online:true,gpu_reported:true}],[],{truncated:true}),[]));

test('unsupported phone remains a pool member and is caught when offline',()=>{const n={id:'iphone',platform:'iPhone',online:true,gpu_reported:false};assert.equal(waterState([n],500).ratio,0);assert.equal(waterState([n],20).count,0);assert.equal(classify(n),'unknown');assert.equal(transitions([n],[{...n,online:false}]).length,1);});

for(const p of ['Macintosh','MacBook Air','MacBook Pro','Mac mini','iMac','Mac Studio','Mac Pro','iPhone','iPad'])test('Apple display group '+p,()=>assert.equal(deviceLabel({platform:p}),'iOS'));
for(const [units,tier] of [[.5,'phone'],[1,'tablet'],[10,'computer'],[100,'shark'],[1000,'whale'],[10000,'leviathan']])test('GPU throughput tier '+units,()=>{for(const platform of ['iPhone','iPad','MacBook Pro','Windows'])assert.equal(classify({platform,video_rating:{status:'VALIDATED',unit:'standard_5s_videos_per_hour',workload_id:'fixed',units}}),tier);});
test('faster phone is larger than slower tablet',()=>{assert.equal(classify({platform:'iPhone',video_rating:{status:'VALIDATED',unit:'standard_5s_videos_per_hour',workload_id:'fixed',units:200}}),'shark');assert.equal(classify({platform:'iPad',video_rating:{status:'VALIDATED',unit:'standard_5s_videos_per_hour',workload_id:'fixed',units:5}}),'tablet');});
test('GPU brand alone never implies fish tier',()=>assert.equal(classify({platform:'Windows',hardware:{gpu:{description:'RTX 5090'}}}),'unknown'));
test('Mac chip alone never implies fish tier',()=>assert.equal(classify({platform:'MacBook Pro',hardware:{gpu:{description:'Apple M4 Max'}}}),'unknown'));
for(const units of [0,-1,NaN,Infinity])test('invalid score remains unrated '+units,()=>assert.equal(classify({video_rating:{status:'VALIDATED',unit:'standard_5s_videos_per_hour',workload_id:'fixed',units}}),'unknown'));
test('desktop GPU model hidden from device label',()=>assert.equal(deviceLabel({platform:'Windows',hardware:{gpu:{description:'NVIDIA RTX 5090'}}}),'電腦'));

test('PGU never determines fish size',()=>assert.equal(classify({gpu_rating:{version:'pool-u32-v1',units:1000000}}),'unknown'));

test('AppleWebKit on Android is not an Apple device',()=>assert.equal(deviceLabel({platform:'Mozilla/5.0 (Linux; Android 8.1.0) AppleWebKit/537.36 Chrome/138 Mobile Safari/537.36'}),'手機'));
test('Miui desktop-mode browser still identifies as mobile',()=>assert.equal(deviceLabel({platform:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/534.24 Chrome/135 XiaoMi/MiuiBrowser/14.60.0-gn'}),'手機'));
test('AppleWebKit on Windows is still a computer',()=>assert.equal(deviceLabel({platform:'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/138 Safari/537.36'}),'電腦'));

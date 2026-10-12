import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
async function fixture({denied=false}={}){
 const nodes=new Map(['poolPipeline','pipelineState','pipelineDetail','pipelineEvidence','pipelineStart','pipelineRefresh','rentalState'].map(id=>[id,{textContent:'',handlers:{},addEventListener(t,f){this.handlers[t]=f;}}]));let complete=false;const calls=[];
 vm.runInNewContext(readFileSync(new URL('../assets/compute-pool/pipeline-panel.mjs',import.meta.url),'utf8'),{document:{hidden:false,getElementById:id=>nodes.get(id)},localStorage:{getItem:()=>null,setItem(){}},setInterval(){},AbortSignal,Error,fetch:async(_,options)=>{const body=JSON.parse(options.body);calls.push(body);let data=body.type==='enterprise.status'?{available_for_rental:false}:body.type==='pipeline.start'?{pipeline_id:'tensor-chain-1'}:{verified:complete,status:complete?'OUTPUT_VERIFIED':'IN_PROGRESS',stages:[{stage:1,status:complete?'COMPLETED':'ASSIGNED'}],gpu_reports:[]};if(denied&&body.type==='pipeline.start')data={error:'TWO_TENSOR_CAPABLE_NODES_REQUIRED'};return {ok:!(denied&&body.type==='pipeline.start'),json:async()=>data};}});
 await new Promise(resolve=>setImmediate(resolve));return {nodes,calls,complete:()=>complete=true};
}
test('panel reports closed rental and does not auto-start workload',async()=>{const f=await fixture();assert.match(f.nodes.get('rentalState').textContent,/未開放/);assert.deepEqual(f.calls.map(c=>c.type),['enterprise.status']);});
test('manual kernel proof shows in-progress then verified output',async()=>{const f=await fixture();await f.nodes.get('pipelineStart').handlers.click();assert.match(f.nodes.get('pipelineState').textContent,/執行中/);f.complete();await f.nodes.get('pipelineRefresh').handlers.click();assert.match(f.nodes.get('pipelineState').textContent,/非影片/);});
test('not enough nodes explains the condition and does not pretend success',async()=>{const f=await fixture({denied:true});await f.nodes.get('pipelineStart').handlers.click();assert.match(f.nodes.get('pipelineState').textContent,/至少兩個/);assert(!f.calls.some(c=>c.type==='pipeline.status'));});

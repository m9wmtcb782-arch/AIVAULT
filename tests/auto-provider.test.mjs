import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../assets/compute-pool/auto-provider.mjs',import.meta.url),'utf8');
async function fixture({supported=true}={}){
 const ids=['autoGpuProvider','autoDeviceId','autoGpuTitle','autoGpuDetail','autoGpuState','autoGpuToggle','autoProof','autoTensorStatus'];const els=new Map(ids.map(id=>[id,{dataset:{},handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}}]));
 const calls=[];let task;
 const fakeGpu={async run(elements,iterations){return {elements,iterations_per_element:iterations,executed_on:'WebGL2',gpu:true,verified:true,checksum:123,sample_count:elements,gpu_time_ms:1};}};
 const sandbox={document:{hidden:false,getElementById:id=>els.get(id),addEventListener(){}},window:{dispatchEvent(){}},Event:class{},navigator:{userAgent:'iPhone test'},localStorage:{getItem:()=> 'GPU-NODE-test',setItem(){}},crypto:{randomUUID:()=> 'offline'},AivaultWebGL2:{createRunner(){if(!supported)throw Error('WebGL2 unavailable');return fakeGpu;}},setInterval:()=>1,clearInterval(){},Date,Math,Number,Error,fetch:async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);let data={success:true};if(body.type==='task.create'){task={...body.task};data.task=task;}if(body.type==='task.request')data={success:true,task,assignmentId:'assignment'};if(body.type==='task.result')data={success:true,verified:true,taskStatus:'COMPLETED'};return {ok:true,json:async()=>data};}};
 vm.runInNewContext(source,sandbox);await new Promise(resolve=>setImmediate(resolve));return {calls,els};
}
test('pool entry auto-registers and enables fallback without a start click',async()=>{const f=await fixture();const registration=f.calls.filter(c=>c.type==='node.register');assert.equal(registration[0].node.gpu,false);assert.equal(registration[1].node.runtime,'webgl2');assert.equal(registration[1].node.gpu,true);assert(f.calls.some(c=>c.type==='task.result'&&c.result.executed_on==='WebGL2'));assert.match(f.els.get('autoProof').textContent,/已完成/);});
test('unsupported phone remains registered with a reason and no false GPU',async()=>{const f=await fixture({supported:false});assert.equal(f.calls.filter(c=>c.type==='node.register').length,2);assert(f.calls.filter(c=>c.type==='node.register').every(c=>c.node.gpu===false));assert.equal(f.calls.filter(c=>c.type==='task.create').length,0);assert.match(f.els.get('autoGpuTitle').textContent,/無法提供 GPU/);assert.match(f.els.get('autoGpuDetail').textContent,/WebGL2 unavailable/);});
test('visible stop sends paused and unavailable status',async()=>{const f=await fixture();await f.els.get('autoGpuToggle').handlers.click();const last=f.calls.at(-1);assert.equal(last.type,'node.heartbeat');assert.equal(last.status,'PAUSED');assert.equal(last.available,false);assert.match(f.els.get('autoGpuTitle').textContent,/已停止/);});

test('automatic entry submits the same five-sample workload for GPU tiering',async()=>{const f=await fixture();const task=f.calls.find(c=>c.type==='task.create').task;assert.equal(task.elements,4096);assert.equal(task.iterations,16);const result=f.calls.find(c=>c.type==='task.result').result;assert.equal(result.benchmark_version,'pool-u32-v1');assert.equal(result.benchmark_samples_ms.length,5);assert.equal(result.gpu_time_ms,1);});

test('tensor probe failure does not stop ordinary GPU contribution',async()=>{const f=await fixture();assert.match(f.els.get('autoTensorStatus').textContent,/未啟用/);assert.match(f.els.get('autoProof').textContent,/GPU 基礎診斷：已完成/);assert.equal(f.calls.filter(c=>c.type==='node.register').at(-1).node.gpu,true);});

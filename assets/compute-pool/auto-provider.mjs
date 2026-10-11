// Automatic, visible and stoppable contribution of small fixed GPU validation workloads.
const root=document.getElementById('autoGpuProvider');
if(root){
 const $=id=>document.getElementById(id),url='https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/aivault-compute-coordinator';
 let nodeId=localStorage.getItem('aivault_compute_mesh_gpu_node_id');
 if(!nodeId){nodeId='GPU-NODE-'+crypto.randomUUID();localStorage.setItem('aivault_compute_mesh_gpu_node_id',nodeId);}
 $('autoDeviceId').textContent=nodeId;
 let stopped=false,starting=false,ready=false,running=false,polling=false,runner=null,backend='initializing',heartbeatTimer=null,pollTimer=null,reason='';
 const api=async body=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'HTTP '+r.status);return data;};
 function state(title,detail){$('autoGpuTitle').textContent=title;$('autoGpuDetail').textContent=detail;$('autoGpuState').dataset.state=ready&&!stopped?'ready':'pending';}
 async function register(){const result=await api({type:'node.register',node:{id:nodeId,node_id:nodeId,status:stopped?'PAUSED':running?'RUNNING':'READY',gpu:ready,available:ready&&!stopped&&!running,runtime:backend,platform:navigator.userAgent,capability:{cpu:true,webgpu:backend==='webgpu',webgl2:backend==='webgl2',supported_task_types:['gpu-u32-mix'],gpu_failure_reason:reason,self_test_passed:ready,gpu_info:runner?.info||(runner?.renderer?{description:runner.renderer}:null)}}});window.dispatchEvent(new Event('aivault:gpu-provider-updated'));return result;}
 async function heartbeat(refresh=false){try{await api({type:'node.heartbeat',nodeId,status:stopped?'PAUSED':running?'RUNNING':'READY',gpu:ready,available:ready&&!stopped&&!running,platform:navigator.userAgent});if(refresh)window.dispatchEvent(new Event('aivault:gpu-provider-updated'));}catch(e){state('暫時無法連線',e.message+'。保留裝置登記，等待恢復連線。');}}
 async function nativeRunner(){
  if(!navigator.gpu)throw Error('瀏覽器沒有 WebGPU');const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('WebGPU adapter 無法取得');const device=await adapter.requestDevice();let info={};try{info=adapter.info||(typeof adapter.requestAdapterInfo==='function'?await adapter.requestAdapterInfo():{});}catch{}
  const shader='struct Params{elements:u32,iterations:u32,} @group(0) @binding(0) var<storage,read_write> values:array<u32>; @group(0) @binding(1) var<uniform> params:Params; @compute @workgroup_size(256) fn main(@builtin(global_invocation_id) gid:vec3<u32>){let index=gid.x;if(index>=params.elements){return;}var x=index+1u;for(var i=0u;i<params.iterations;i=i+1u){x=x*1664525u+1013904223u;x=x^(x>>13u);x=x*2246822519u;x=x^(x>>16u);}values[index]=x;}';
  const pipeline=device.createComputePipeline({layout:'auto',compute:{module:device.createShaderModule({code:shader}),entryPoint:'main'}});
  device.lost.then(()=>{ready=false;reason='GPU 裝置已中斷，請重新載入此頁。';state('GPU 已中斷',reason);register().catch(()=>{});});
  return {info,async run(elements,iterations){
   if(!Number.isInteger(elements)||elements<1||elements>4096||!Number.isInteger(iterations)||iterations<1||iterations>16)throw Error('此入口目前只支援小型 GPU 驗證任務');
   const size=elements*4,out=device.createBuffer({size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),params=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),read=device.createBuffer({size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
   try{
    device.queue.writeBuffer(params,0,new Uint32Array([elements,iterations,0,0]));const bg=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:out}},{binding:1,resource:{buffer:params}}]});const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bg);pass.dispatchWorkgroups(Math.ceil(elements/256));pass.end();encoder.copyBufferToBuffer(out,0,read,0,size);const start=performance.now();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();await read.mapAsync(GPUMapMode.READ);const values=new Uint32Array(read.getMappedRange().slice(0));const elapsed=performance.now()-start;let sum=0;for(let i=0;i<Math.min(1024,elements);i++)sum=(sum+values[i])>>>0;read.unmap();if(sum!==AivaultWebGL2.checksum(elements,iterations))throw Error('GPU 輸出未通過校驗');return {elements,iterations_per_element:iterations,sample_count:Math.min(1024,elements),checksum:sum,executed_on:'WebGPU',gpu:true,verified:true,gpu_time_ms:Math.round(elapsed*100)/100,workgroups:Math.ceil(elements/256),timing_method:'Wall time including GPU completion and readback; not GPU timestamp-query'};
   }finally{out.destroy();params.destroy();read.destroy();}
  }};
 }
 async function poll(){
  if(!ready||stopped||running||polling||document.hidden)return;polling=true;
  try{const data=await api({type:'task.request',nodeId,gpu_available:true});if(!data.task)return;
   if(data.task.type!=='gpu-u32-mix'){state('等待相容任務','此入口不支援目前任務，未以其他運算冒充結果。');return;}
   running=true;const task=data.task,assignmentId=data.assignmentId||data.assignment?.id;
   state('GPU 正在執行',backend.toUpperCase()+' · '+task.elements+' 個元素，'+task.iterations+' 次迭代。');
   try{
    await api({type:'task.progress',nodeId,taskId:task.id,assignmentId,progress:5,status:'RUNNING'});
    let result=await runner.run(Number(task.elements),Number(task.iterations));
    if(Number(task.elements)===4096&&Number(task.iterations)===16){
     const samples=[result.gpu_time_ms];
     for(let i=1;i<5;i++){result=await runner.run(4096,16);samples.push(result.gpu_time_ms);}
     result={...result,gpu_time_ms:[...samples].sort((a,b)=>a-b)[2],benchmark_version:'pool-u32-v1',benchmark_samples_ms:samples};
    }
    const ack=await api({type:'task.result',nodeId,taskId:task.id,assignmentId,status:'COMPLETED',result});
    if(ack.verified!==true||ack.taskStatus!=='COMPLETED')throw Error('後端未接受 GPU 結果');
    $('autoProof').textContent='GPU 驗證已完成 · '+result.executed_on+' · checksum '+result.checksum;
    localStorage.setItem('aivault_gpu_proof_'+nodeId,new Date().toISOString());
    if(!stopped)state('正在提供 GPU','已通過小型 GPU 驗證，目前等待相容任務。請保持此頁前景。');else state('已停止提供','本次驗證已結束，未再領取新任務。');
   }catch(e){reason=e.message;state('本次任務未完成',reason);await api({type:'task.failure',nodeId,taskId:task.id,assignmentId,status:'FAILED',result:{verified:false,error:reason}}).catch(()=>{});}
   finally{running=false;await heartbeat(true);}
  }catch(e){state('暫時無法取得任務',e.message);}finally{polling=false;}
 }
 async function start(){
  if(starting)return;starting=true;
  stopped=false;ready=false;backend='initializing';reason='';$('autoGpuToggle').textContent='停止提供';state('正在自動加入','正在登記這台裝置，接著偵測 WebGPU 與 WebGL2。');
  try{
   await register();
   clearInterval(heartbeatTimer);heartbeatTimer=setInterval(()=>{if(!document.hidden&&!stopped)heartbeat();},30000);
   try{runner=await nativeRunner();await runner.run(16,1);backend='webgpu';}
   catch(webgpuError){try{runner=AivaultWebGL2.createRunner();await runner.run(16,1);backend='webgl2';}catch(glError){reason='WebGPU：'+webgpuError.message+'；WebGL2：'+glError.message;backend='unavailable';await register();state('已登記，無法提供 GPU',reason+'。裝置仍會以魚呈現並計入參與水位，GPU 節點數不增加。');$('autoGpuToggle').textContent='重新偵測';return;}}
   if(stopped)return;ready=true;await register();state('正在提供 GPU',backend==='webgl2'?'已啟用 WebGL2 備援，只接相容的小型任務。':'已啟用 WebGPU，正在等待相容任務。');
   clearInterval(heartbeatTimer);clearInterval(pollTimer);heartbeatTimer=setInterval(()=>{if(!document.hidden&&!stopped)heartbeat();},30000);pollTimer=setInterval(poll,30000);
   const id='auto-gpu-proof-'+nodeId+'-'+Date.now();await api({type:'task.create',task:{id,name:'裝置自動 GPU 驗證',type:'gpu-u32-mix',target_node_id:nodeId,elements:4096,iterations:16,gpu_required:true,backend:'portable-gpu'}});await poll();
  }catch(e){reason=e.message;state('暫時無法加入',reason+'。請檢查網路後重新嘗試。');$('autoGpuToggle').textContent='重新嘗試';}finally{starting=false;}
 }
 $('autoGpuToggle').addEventListener('click',async()=>{if(starting){stopped=true;clearInterval(heartbeatTimer);clearInterval(pollTimer);$('autoGpuToggle').textContent='恢復提供';state('已停止提供','已取消自動加入，不再領取新任務。');await heartbeat(true);return;}if(stopped||!ready){await start();return;}stopped=true;clearInterval(heartbeatTimer);clearInterval(pollTimer);$('autoGpuToggle').textContent='恢復提供';state('已停止提供','裝置登記保留；不再領取新任務。');await heartbeat(true);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(ready&&!stopped)state('頁面進入背景','手機可能暫停運算與心跳。回到此頁後自動恢復。');}else if(ready&&!stopped){heartbeat(true);poll();state('正在提供 GPU','已回到前景，恢復心跳與任務領取。');}});
 start();
}

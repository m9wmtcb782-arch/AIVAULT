// Fixed, untrained two-layer affine/ReLU kernel validation, NOT a video model.
export const TENSOR_KERNEL='owned-dense16-v1';
export const initialTensor=()=>Array.from({length:16},(_,i)=>(i-8)/8);
export function tensorReference(input:number[],stage:number){
 if(!Array.isArray(input)||input.length!==16||![1,2].includes(stage)||!input.every(x=>Number.isFinite(x)&&Math.abs(x)<=8))throw Error('INVALID_FIXED_TENSOR');
 return Array.from({length:16},(_,row)=>{let y=(row%3-1)/16;for(let col=0;col<16;col++)y=Math.fround(y+Math.fround(input[col]*(((row+col*3+stage)%7-3)/16)));return stage===1?Math.max(0,y):y;});
}
export function tensorMatches(a:any,b:any){return Array.isArray(a)&&Array.isArray(b)&&a.length===16&&b.length===16&&a.every((v,i)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v-b[i])<=1e-5);}
export function verifyTensorStage(task:any,result:any){
 const p=task.payload||task;
 try{return task.type==='gpu-tensor-stage'&&p.kernel===TENSOR_KERNEL&&result.kernel===TENSOR_KERNEL&&result.stage===p.stage&&['WebGPU','WebGL2'].includes(result.executed_on)&&result.gpu===true&&result.verified===true&&Number.isFinite(result.gpu_time_ms)&&result.gpu_time_ms>=0&&tensorMatches(result.tensor,tensorReference(p.input,p.stage));}catch{return false;}
}
export function tensorTask(pipelineId:string,stage:number,input:number[],exclude:string|null=null){
 return {task_id:pipelineId+'-s'+stage,name:'跨設備 GPU 張量驗證 · 第 '+stage+' 層',type:'gpu-tensor-stage',elements:16,iterations:1,nodes_needed:1,priority:'NORMAL',status:'WAITING',payload:{id:pipelineId+'-s'+stage,type:'gpu-tensor-stage',pipeline_id:pipelineId,kernel:TENSOR_KERNEL,stage,input,gpu_required:true,excluded_node_id:exclude,execution:'remote',backend:'portable-tensor'},updated_at:new Date().toISOString()};
}
export function tensorEligible(node:any,now=Date.now()){
 const seen=Date.parse(node.last_seen);
 return node.gpu===true&&node.available===true&&node.status==='READY'&&Number.isFinite(seen)&&seen<=now+5000&&now-seen<120000&&node.capability?.supported_task_types?.includes('gpu-tensor-stage')===true;
}
export async function enqueueTensorNext(db:any,task:any,result:any,nodeId:string){
 if(task.type!=='gpu-tensor-stage'||task.payload?.stage!==1||!verifyTensorStage(task,result))return {queued:false};
 const next=tensorTask(task.payload.pipeline_id,2,result.tensor,nodeId);
 const r=await db.from('compute_mesh_tasks').upsert(next,{onConflict:'task_id',ignoreDuplicates:true});
 return {queued:!r.error,error:r.error?'NEXT_STAGE_WRITE_FAILED':null};
}
export async function tensorPipelineStart(db:any){
 const {data,error}=await db.from('compute_mesh_nodes').select('node_id,gpu,status,available,capability,last_seen').order('last_seen',{ascending:false}).limit(1000);
 if(error)return {status:503,body:{success:false,error:'NODE_STATUS_UNAVAILABLE'}};
 const eligible=(data||[]).filter((n:any)=>tensorEligible(n));
 if(new Set(eligible.map((n:any)=>n.node_id)).size<2)return {status:409,body:{success:false,error:'TWO_TENSOR_CAPABLE_NODES_REQUIRED',eligible_nodes:eligible.length}};
 // One fixed small proof per five-minute global window, idempotent; no arbitrary input/model/code.
 const id='tensor-chain-'+Math.floor(Date.now()/300000);
 const r=await db.from('compute_mesh_tasks').upsert(tensorTask(id,1,initialTensor()),{onConflict:'task_id',ignoreDuplicates:true});
 return r.error?{status:500,body:{success:false,error:'PIPELINE_CREATE_FAILED'}}:{status:200,body:{success:true,pipeline_id:id,kernel:TENSOR_KERNEL,status:'QUEUED_OR_EXISTING',purpose:'FIXED_KERNEL_VALIDATION_NOT_VIDEO',distinct_browser_nodes_required:2}};
}
export async function recoverTensorLeases(db:any,tasks:any[],now=Date.now()){
 const pending=tasks.filter(t=>(['ASSIGNED','RUNNING'].includes(t.status)||(t.status==='FAILED'&&(t.payload.retry_count||0)<2))&&t.payload?.lease_node_id);
 if(!pending.length)return 0;
 const nodes=await db.from('compute_mesh_nodes').select('node_id,last_seen').in('node_id',pending.map(t=>t.payload.lease_node_id));
 if(nodes.error)return 0;
 let recovered=0;
 for(const task of pending){
  const n=(nodes.data||[]).find((n:any)=>n.node_id===task.payload.lease_node_id),seen=Date.parse(n?.last_seen),updated=Date.parse(task.updated_at);
  if(task.status!=='FAILED'&&Number.isFinite(seen)&&now-seen<120000&&Number.isFinite(updated)&&now-updated<180000&&Date.parse(task.payload.lease_expires_at)>now)continue;
  const payload={...task.payload,lease_node_id:null,lease_generation:null,lease_expires_at:null,retry_count:(task.payload.retry_count||0)+(task.status==='FAILED'?1:0),excluded_node_ids:task.status==='FAILED'?[...(task.payload.excluded_node_ids||[]),task.payload.lease_node_id]:(task.payload.excluded_node_ids||[])};
  const r=await db.from('compute_mesh_tasks').update({status:'WAITING',payload,updated_at:new Date(now).toISOString()}).eq('task_id',task.task_id).eq('status',task.status).eq('updated_at',task.updated_at).select('task_id');
  if(r.error||!r.data?.length)continue;
  await db.from('compute_mesh_assignments').update({status:'EXPIRED',updated_at:new Date(now).toISOString()}).eq('task_id',task.task_id).eq('node_id',task.payload.lease_node_id).in('status',['ASSIGNED','RECEIVED','RUNNING']);
  task.status='WAITING';task.payload=payload;recovered++;
 }
 return recovered;
}
export async function tensorPipelineStatus(db:any,id:string){
 if(!/^tensor-chain-\d{1,16}$/.test(id))return {status:400,body:{success:false,error:'INVALID_PIPELINE_ID'}};
 const [t,a]=await Promise.all([db.from('compute_mesh_tasks').select('*').eq('payload->>pipeline_id',id).order('task_id').limit(2),db.from('compute_mesh_assignments').select('task_id,node_id,status,result,updated_at').in('task_id',[id+'-s1',id+'-s2']).order('updated_at',{ascending:false}).limit(20)]);
 if(t.error||a.error)return {status:503,body:{success:false,error:'PIPELINE_STATUS_UNAVAILABLE'}};
 const tasks=t.data||[],results=a.data||[];
 const recovered=await recoverTensorLeases(db,tasks);
 const s1=tasks.find((v:any)=>v.payload?.stage===1),s2=tasks.find((v:any)=>v.payload?.stage===2);
 const first=results.find((v:any)=>v.task_id===id+'-s1'&&v.status==='COMPLETED'&&s1&&v.result?.lease_generation===s1.payload.lease_generation&&verifyTensorStage(s1,v.result));
 if(first&&s1.status==='COMPLETED'&&!s2)await enqueueTensorNext(db,s1,first.result,first.node_id);
 const second=results.find((v:any)=>v.task_id===id+'-s2'&&v.status==='COMPLETED'&&s2&&v.result?.lease_generation===s2.payload.lease_generation&&verifyTensorStage(s2,v.result));
 const verified=Boolean(first&&second&&first.node_id!==second.node_id&&s1?.status==='COMPLETED'&&s2?.status==='COMPLETED'&&tensorMatches(s2.payload.input,first.result.tensor));
 return {status:200,body:{success:true,pipeline_id:id,recovered_leases:recovered,status:verified?'OUTPUT_VERIFIED':tasks.some((v:any)=>v.status==='FAILED')?'FAILED':tasks.length?'IN_PROGRESS':'NOT_FOUND',verified,distinct_browser_nodes:verified?2:null,stages:tasks.map((v:any)=>({stage:v.payload.stage,status:v.status})),gpu_reports:[first,second].filter(Boolean).map((v:any)=>({stage:v.task_id.endsWith('s1')?1:2,node_id:v.node_id,engine:v.result?.executed_on,gpu_time_ms:v.result?.gpu_time_ms})),tensor_bytes_per_transfer:64,transport:'HTTPS_JSON_VIA_COORDINATOR',video_generation_verified:false,enterprise_access:'CLOSED',billing_enabled:false,identity_scope:'browser IDs, not hardware-attested physical devices'}};
}

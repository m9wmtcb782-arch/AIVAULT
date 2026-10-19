const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-aivault-internal,authorization","Access-Control-Allow-Methods":"POST,OPTIONS"};
const J=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...H,"Content-Type":"application/json"}});
const url=`${(Deno.env.get("SUPABASE_URL")||"").replace(/\/$/,"")}/functions/v1/aivault-compute-coordinator`;
const secret=Deno.env.get("COMPUTE_COORDINATOR_SECRET")||Deno.env.get("AIVAULT_INTERNAL_SECRET")||Deno.env.get("GATEWAY_INTERNAL_SECRET")||"";
async function call(x:any){const h:any={"Content-Type":"application/json"};if(secret){h["x-aivault-internal"]=secret;h.Authorization=`Bearer ${secret}`};const r=await fetch(url,{method:"POST",headers:h,body:JSON.stringify(x)});const t=await r.text();let d:any;try{d=JSON.parse(t)}catch{d=t};return{ok:r.ok,status:r.status,data:d}}
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:H});try{
 const b=await req.json().catch(()=>({})); const nodeId=b.node_id||`test-cpu-worker-${crypto.randomUUID().slice(0,8)}`;
 const cap={cpu:true,compute_score:100,ram_mb:4096,supported_task_types:["numeric_compute"]};
 const reg=await call({type:"node.register",nodeId,payload:{nodeId,capability:cap,gpu:null}});
 if(!reg.ok)return J({success:false,stage:"register",reg},502);
 const got=await call({type:"task.request",nodeId,payload:{nodeId}});
 if(!got.ok||got.data?.type!=="task.assigned")return J({success:false,stage:"request",nodeId,register:reg.data,request:got.data},200);
 const task=got.data.task, assignment=got.data.assignment, aid=assignment.assignmentId;
 await call({type:"task.progress",nodeId,assignmentId:aid,progress:25,payload:{nodeId,assignmentId:aid,progress:25}});
 const op=task.operation||task.request?.operation||{}; const start=Number(op.start||1), end=Number(op.end||task.elements||1000000);
 let result:any;
 if((op.type||"")==="sum_range"||task.type==="numeric_compute") { const n=end-start+1; result={operation:"sum_range",start,end,sum:n*(start+end)/2,worker:"aivault-compute-worker-test",execution:"real_cpu"}; }
 else { let acc=0; for(let i=0;i<Math.min(1000000,Number(task.elements||1000000));i++) acc=(acc+i)%1000000007; result={operation:"deterministic_cpu",value:acc,worker:"aivault-compute-worker-test",execution:"real_cpu"}; }
 await call({type:"task.progress",nodeId,assignmentId:aid,progress:75,payload:{nodeId,assignmentId:aid,progress:75}});
 const done=await call({type:"task.result",nodeId,assignmentId:aid,result,payload:{nodeId,assignmentId:aid,result}});
 return J({success:done.ok&&done.data?.taskStatus==="COMPLETED",stage:"completed",nodeId,taskId:task.id||task.task_id,assignmentId:aid,result,register:reg.data,assigned:got.data,result_response:done.data});
}catch(e){return J({success:false,error:String(e)},500)}});
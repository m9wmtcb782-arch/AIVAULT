import { handleCrossbase } from "./crossbase.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const VERSION="1.12.0",SERVICE="technical-dark-star";
const MEMORY="dark_star_learning_memory",MEMORY_MAX_CHARS=500000,EVIDENCE="dark_star_learning_evidence",EXAMPLES="dark_star_training_examples",DATASETS="dark_star_datasets",ITEMS="dark_star_dataset_items",RUNS="dark_star_training_runs",MODELS="dark_star_model_versions",EVALS="dark_star_evaluations",PROMOTIONS="dark_star_model_promotions";
const SUPABASE=(Deno.env.get("SUPABASE_URL")||"").replace(/\/$/,"");
const BRIDGE=`${SUPABASE}/functions/v1/aivault-ai-bridge`;
const GATEWAY=`${SUPABASE}/functions/v1/ai-gateway`;
const COORD=`${SUPABASE}/functions/v1/aivault-compute-coordinator`;
const AGENT={agent_id:"technical-dark-star",agent_key:"technical-dark-star",name:"Technical Dark Star",display_name:"暗星",identity_type:"technical_learning_agent",identity_locked:true};
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type,x-aivault-internal","Access-Control-Allow-Methods":"GET,POST,PATCH,OPTIONS","Content-Type":"application/json; charset=utf-8"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d,null,2),{status:s,headers:CORS});
const str=(v:unknown,d="")=>typeof v==="string"?v.trim():v==null?d:String(v).trim();const uuidOrNull=(v:unknown)=>{const s=str(v);return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)?s:null};const num=(v:unknown,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d};const bool=(v:unknown,d=false)=>typeof v==="boolean"?v:d;
const body=async(r:Request)=>{try{const x=await r.json();return x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:{};}catch{return {}}};
function cfg(){let key=Deno.env.get("SUPABASE_SECRET_KEY")||"";if(!key){try{key=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||""}catch{}}return{url:SUPABASE,key:key||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""}}
async function db(path:string,method="GET",data?:unknown){const c=cfg();try{const r=await fetch(`${c.url}/rest/v1/${path}`,{method,headers:{apikey:c.key,Authorization:`Bearer ${c.key}`,"Content-Type":"application/json",Prefer:"return=representation"},body:data===undefined?undefined:JSON.stringify(data)});const t=await r.text();let x:any;try{x=t?JSON.parse(t):null}catch{x=t}return{ok:r.ok,status:r.status,data:x,error:r.ok?null:t}}catch(e){return{ok:false,status:0,data:null,error:String(e)}}}
const first=(r:any)=>r?.ok&&Array.isArray(r.data)?r.data[0]??null:r?.data??null;function containsLearningMarkup(v:string){const s=String(v||"").toLowerCase();return s.includes("<svg")||s.includes("</svg>")||s.includes("<?xml")||s.includes("xmlns=")||s.includes("<html")||s.includes("<body")||s.includes("<script")||s.includes("<style")||s.includes("<!--")||s.includes("```svg")||s.includes("```html")||s.includes("```xml");}
function checkedLearning(v:string){const s=String(v||"").trim();if(!s)return{ok:false,error:"LEARNING_CONTENT_REQUIRED"};if(containsLearningMarkup(s))return{ok:false,error:"LEARNING_OUTPUT_MARKUP_REJECTED",message:"學習輸出包含 SVG/HTML/XML/程式碼標記，已拒絕寫入暗星學習記憶。"};return{ok:true,text:s};}
function secret(){return str(Deno.env.get("AIVAULT_INTERNAL_SECRET")||Deno.env.get("COMPUTE_COORDINATOR_SECRET")||Deno.env.get("GATEWAY_INTERNAL_SECRET"))}
async function call(url:string,payload:any){const s=secret();const h:Record<string,string>={"Content-Type":"application/json"};if(s){h["x-aivault-internal"]=s;h.Authorization=`Bearer ${s}`}try{const r=await fetch(url,{method:"POST",headers:h,body:JSON.stringify(payload)});const t=await r.text();let x:any;try{x=t?JSON.parse(t):null}catch{x=t}return{ok:r.ok,status:r.status,data:x,error:r.ok?null:t}}catch(e){return{ok:false,status:0,data:null,error:String(e)}}}
function id(p:string){return`${p}-${Date.now()}-${crypto.randomUUID().slice(0,8)}`}
async function runtimeConcurrencyTest(b:Record<string,unknown>){
 const topic=str(b.topic,"Distributed Locking & Concurrency Race Condition Mitigation");
 const requested=Math.max(1,Math.min(5000,Math.floor(num(b.request_count,500))));
 let lock=false,success=0,fail=0,duplicates=0,races=0,activeExecutions=0,maxActive=0;
 const attempts=Array.from({length:requested},async()=>{
  await Promise.resolve();
  if(lock){fail++;return false;}
  lock=true;success++;activeExecutions++;maxActive=Math.max(maxActive,activeExecutions);
  await new Promise(r=>setTimeout(r,0));
  if(activeExecutions>1)races++;
  activeExecutions--;lock=false;return true;
 });
 await Promise.all(attempts);
 if(success!==1)duplicates=Math.max(0,success-1);
 const passed=success===1&&fail===requested-1&&duplicates===0&&races===0&&maxActive===1;
 const details={executor:"technical-dark-star backend",test_scope:"in-process concurrency semantics",not_redis_proof:true,request_count:requested,success_count:success,failure_count:fail,duplicate_execution_count:duplicates,race_condition_count:races,max_concurrent_executions:maxActive};
 const row=await db("dark_star_runtime_test_results","POST",{test_type:"concurrency_lock_semantics",topic,request_count:requested,success_count:success,failure_count:fail,duplicate_execution_count:duplicates,race_condition_count:races,passed,details});
 return json({success:row.ok,test_passed:passed,runtime_test:first(row),details,warning:"此測試驗證鎖定/競態語義，不等同於 Redis/Redlock 真實外部服務整合測試。",error:row.ok?null:row.error},row.ok?200:500);
}
async function runtimeIdempotencyTest(b:Record<string,unknown>){
 const topic=str(b.topic,"Idempotent Request Processing & Duplicate Submission Protection");
 const requested=Math.max(1,Math.min(5000,Math.floor(num(b.request_count,500))));
 const key=str(b.idempotency_key,"dark-star-idempotency-test");
 const seen=new Set<string>(),results:number[]=[];
 for(let i=0;i<requested;i++){
  await Promise.resolve();
  if(seen.has(key)){results.push(409);continue;}
  seen.add(key);results.push(201);
 }
 const accepted=results.filter(x=>x===201).length,duplicates=results.filter(x=>x===409).length;
 const passed=accepted===1&&duplicates===requested-1&&seen.size===1;
 const details={executor:"technical-dark-star backend",test_scope:"in-process idempotency semantics",request_count:requested,idempotency_key:key,accepted_count:accepted,duplicate_rejection_count:duplicates,unique_keys:seen.size,status_codes:{accepted:201,duplicate:409}};
 const row=await db("dark_star_runtime_test_results","POST",{test_type:"idempotency_semantics",topic,request_count:requested,success_count:accepted,failure_count:duplicates,duplicate_execution_count:Math.max(0,accepted-1),race_condition_count:0,passed,details});
 return json({success:row.ok,test_passed:passed,runtime_test:first(row),details,warning:"此測試驗證後端 in-process idempotency 語義，不等同於 Redis/database UNIQUE constraint 的跨實例整合測試。",error:row.ok?null:row.error},row.ok?200:500);
}
async function runtimeRetryBackoffTest(b:Record<string,unknown>){
 const topic=str(b.topic,"API Error Handling & Automatic Retry/Backoff");
 const forcedFailures=Math.max(1,Math.min(10,Math.floor(num(b.forced_failures,3))));
 const maxRetries=Math.max(forcedFailures,Math.min(10,Math.floor(num(b.max_retries,5))));
 const baseDelay=Math.max(1,Math.min(100,num(b.base_delay_ms,5)));
 let attempts=0,success=false;
 const delays:number[]=[];
 const errors:string[]=[];
 const started=Date.now();
 for(let retry=0;retry<=maxRetries;retry++){
  attempts++;
  if(attempts<=forcedFailures){
   errors.push("HTTP_503_SIMULATED");
   if(retry===maxRetries)break;
   const delay=baseDelay*Math.pow(2,retry);
   delays.push(delay);
   await new Promise(r=>setTimeout(r,delay));
   continue;
  }
  success=true;
  break;
 }
 const elapsed=Date.now()-started;
 const expectedAttempts=forcedFailures+1;
 const expectedDelaySum=delays.reduce((a,v)=>a+v,0);
 const passed=success&&attempts===expectedAttempts&&delays.length===forcedFailures&&delays.every((v,i)=>v===baseDelay*Math.pow(2,i))&&elapsed>=expectedDelaySum;
 const details={executor:"technical-dark-star backend",test_scope:"in-process API retry/backoff semantics",forced_failures:forcedFailures,max_retries:maxRetries,attempts,expected_attempts:expectedAttempts,delays_ms:delays,expected_delay_sum_ms:expectedDelaySum,elapsed_ms:elapsed,final_success:success,error_sequence:errors,backoff:"exponential",formula:"baseDelay * 2^retry"};
 const row=await db("dark_star_runtime_test_results","POST",{test_type:"api_retry_backoff",topic,request_count:1,success_count:success?1:0,failure_count:success?forcedFailures:attempts,duplicate_execution_count:0,race_condition_count:0,passed,details});
 return json({success:row.ok,test_passed:passed,runtime_test:first(row),details,warning:"此測試驗證後端 retry/backoff 控制流程，不等同於真實第三方 API 網路故障與跨服務整合測試。",error:row.ok?null:row.error},row.ok?200:500);
}
async function runtimeProviderFailoverTest(b:Record<string,unknown>){
 const topic=str(b.topic,"API Error Classification, Retry Policy & Provider Failover");
 const providers=Array.isArray(b.providers)?b.providers.map(x=>str(x)).filter(Boolean):["provider-A","provider-B","provider-C"];
 const codes=Array.isArray(b.provider_failures)?b.provider_failures.map(x=>Number(x)): [503,429,200];
 let attempts=0,selected="",retried=0,skipped=0; const trace:any[]=[];
 for(let i=0;i<providers.length;i++){
  const code=Number.isFinite(codes[i])?codes[i]:503; attempts++;
  const transient=code===408||code===425||code===429||code>=500;
  const terminal=code>=400&&code<500&&!transient;
  trace.push({provider:providers[i],status:code,transient,terminal});
  if(code>=200&&code<300){selected=providers[i];break;}
  if(transient){retried++;continue;}
  if(terminal){skipped++;break;}
 }
 const passed=selected===providers[Math.min(retried,providers.length-1)]&&attempts===Math.min(retried+1,providers.length)&&retried===2&&selected===providers[2];
 const details={executor:"technical-dark-star backend",test_scope:"in-process provider failover policy",providers,provider_statuses:codes,attempts,transient_retries:retried,terminal_skips:skipped,selected_provider:selected,trace,policy:"retry transient errors; fail over; stop on success; stop on terminal client error"};
 const row=await db("dark_star_runtime_test_results","POST",{test_type:"provider_failover_policy",topic,request_count:1,success_count:selected?1:0,failure_count:attempts-(selected?1:0),duplicate_execution_count:0,race_condition_count:0,passed,details});
 return json({success:row.ok,test_passed:passed,runtime_test:first(row),details,warning:"此測試驗證 provider failover 決策語義，不是對真實 Gemini/Groq/Grok 網路故障的整合測試。",error:row.ok?null:row.error},row.ok?200:500);
}
async function verifyLearning(b:Record<string,unknown>){
 const evidenceId=str(b.evidence_id);if(!evidenceId)return json({success:false,verified:false,error:"EVIDENCE_ID_REQUIRED"},400);
 const ev=await db(EVIDENCE+"?id=eq."+encodeURIComponent(evidenceId)+"&limit=1"),x=first(ev);if(!x)return json({success:false,verified:false,error:"EVIDENCE_NOT_FOUND"},404);
 const hasImplementation=!!str(x.implementation_evidence),hasTest=!!str(x.test_result),passed=x.verification_status==="passed",verified=hasImplementation&&hasTest&&passed;
 const mem=verified?await db(MEMORY+"?memory_type=eq.verified_capability&title=eq."+encodeURIComponent(str(x.topic))+"&active=eq.true&limit=1"):{ok:true,data:[]},m=first(mem);
 return json({success:true,verified,learned:verified&&!!m,reusable:verified&&x.reusable===true&&!!m,evidence:x,memory:m||null,rule:"暗星不得只依回答宣稱學會；必須有實作證據、實際測試結果、verification_status=passed，並存在verified_capability記憶。"});
}

async function finalizeLearning(b:Record<string,unknown>){
 const topic=str(b.topic)||str(b.name)||str(b.title)||"Technical Dark Star Task",learned=str(b.learned_content)||str(b.learning)||str(b.summary),implementation=str(b.implementation_evidence)||str(b.implementation)||str(b.output),test=str(b.test_result)||str(b.test)||str(b.result),runtimeId=str(b.runtime_test_id);const lc=checkedLearning(learned),ic=checkedLearning(implementation),tc=checkedLearning(test);if(!lc.ok||!ic.ok||!tc.ok)return json({success:false,error:"LEARNING_OUTPUT_MARKUP_REJECTED",message:"學習完成資料包含 SVG/HTML/XML/程式碼標記，拒絕進入 verified_capability。"},422);
 if(!learned)return json({success:false,error:"LEARNED_CONTENT_REQUIRED"},400);
 if(!implementation)return json({success:false,error:"IMPLEMENTATION_EVIDENCE_REQUIRED",message:"沒有實作證據，不得判定已學會"},400);
 if(!test)return json({success:false,error:"TEST_RESULT_REQUIRED",message:"沒有實際測試結果，不得判定已學會"},400);
 if(!runtimeId)return json({success:false,error:"RUNTIME_TEST_ID_REQUIRED",message:"必須先由後端執行 Runtime Test，不能只由暗星自行宣稱通過"},400);
 const rt=await db("dark_star_runtime_test_results?id=eq."+encodeURIComponent(runtimeId)+"&passed=eq.true&limit=1"),runtime=first(rt); if(!runtime)return json({success:false,error:"RUNTIME_TEST_NOT_VERIFIED",message:"找不到後端實際通過的 Runtime Test，因此不得寫入 verified_capability"},400);
 const ev=await db(EVIDENCE,"POST",{learning_memory_id:uuidOrNull(b.learning_memory_id),task_id:uuidOrNull(b.task_id),run_id:uuidOrNull(b.run_id),topic,learned_content:learned,implementation_evidence:implementation,test_result:test+"\nBackend Runtime Test: "+runtime.id,verification_status:"passed",reusable:true,source_type:"backend_runtime_test"});
 if(!ev.ok)return json({success:false,error:ev.error},500);
 const mem=await db(MEMORY,"POST",{memory_type:"verified_capability",title:topic,content:learned,confidence:Math.max(.85,Math.min(1,num(b.confidence,.9))),usage_count:0,success_count:1,failure_count:0,active:true,source_task_id:uuidOrNull(b.task_id)});
 return json({success:mem.ok,learning:{verified:mem.ok,reusable:mem.ok,evidence:first(ev),memory:first(mem),runtime_test:runtime,verification_rule:"後端 Runtime Test 通過 + 實作證據 + 測試結果，才可標示真正學會"},error:mem.ok?null:mem.error},mem.ok?200:500)
}
async function dispatchComputeTask(b:Record<string,unknown>,route:string){const taskId=str(b.task_id)||id("dark-star");const req=b.request&&typeof b.request==="object"?b.request as Record<string,unknown>:{};const metadata=b.metadata&&typeof b.metadata==="object"?b.metadata as Record<string,unknown>:{};const task={id:taskId,name:str(b.name)||str(b.title)||str(req.name)||"Technical Dark Star Compute Task",type:str(b.type)||str(b.task_type)||str(req.type)||"dark-star-compute",task_type:str(b.task_type)||str(b.type)||"dark-star-compute",priority:str(b.priority,"NORMAL"),nodesNeeded:Number(b.nodesNeeded??b.nodes_needed??1)||1,elements:Number(b.elements??0)||0,iters:Number(b.iters??b.iterations??1)||1,gpu_required:bool(b.gpu_required,bool(b.gpuRequired,false)),source:SERVICE,agent_id:AGENT.agent_id,request:b.request??b.prompt??b.input??b.payload??null,requirements:b.requirements??req.requirements??{},metadata:{...metadata,dark_star_version:VERSION,source_route:route}};
 const assist=await call(BRIDGE+"/assist/request",{agent_key:AGENT.agent_key,task_id:taskId,task_type:task.task_type,capability:task.gpu_required?"gpu":"general",description:String(task.request||task.name)});
 const created=await call(BRIDGE+"/compute/request",{agent_key:AGENT.agent_key,task});
 if(!created.ok)return json({success:false,service:SERVICE,version:VERSION,task_id:taskId,status:"failed",stage:"collaboration.compute",collaboration_pool:true,assist,compute:created},502);
 return json({success:true,service:SERVICE,version:VERSION,task_id:taskId,status:"queued",collaboration_pool:true,compute_mesh:true,collaboration:{stage:"helper_search",result:assist.data},compute:created.data,dispatch:{status:"waiting_for_compute_node",protocol:["task.request","task.progress","task.result"]}})}
async function trainingExample(b:Record<string,unknown>){const input=b.input_data??b.input??{},target=b.target_data??b.target??{},score=Math.max(0,Math.min(1,num(b.quality_score,num(b.score,0)))),approved=score>=.85&&str(b.compliance_status,"pending")==="approved"&&str(b.quality_status,"pending")==="approved";const r=await db(EXAMPLES,"POST",{task_id:str(b.task_id)||null,session_id:str(b.session_id)||null,input_data:input,target_data:target,source_type:str(b.source_type,"task"),source_ref:str(b.source_ref)||null,quality_score:score,compliance_status:str(b.compliance_status,"pending"),quality_status:str(b.quality_status,"pending"),approved_for_training:approved});return json({success:r.ok,example:first(r),training_ready:approved,error:r.ok?null:r.error},r.ok?200:400)}
async function buildDataset(b:Record<string,unknown>){const key=str(b.dataset_key,`dark-star-${Date.now()}`),version=str(b.version,"1.0.0"),ex=await db(`${EXAMPLES}?approved_for_training=eq.true&quality_status=eq.approved&compliance_status=eq.approved&order=created_at.asc&limit=10000`);if(!ex.ok)return json({success:false,error:ex.error},500);const rows=Array.isArray(ex.data)?ex.data:[];if(rows.length<3)return json({success:false,error:"INSUFFICIENT_TRAINING_EXAMPLES",required_minimum:3,count:rows.length},400);const d=await db(DATASETS,"POST",{dataset_key:key,version,description:str(b.description),status:"building",item_count:rows.length,quality_gate:true,compliance_gate:true}),dataset=first(d);if(!dataset)return json({success:false,error:d.error||"DATASET_CREATE_FAILED"},500);for(let i=0;i<rows.length;i++){const split=i%10<8?"train":i%10===8?"validation":"test";await db(ITEMS,"POST",{dataset_id:dataset.id,example_id:rows[i].id,split,input_data:rows[i].input_data,target_data:rows[i].target_data,provenance:{example_id:rows[i].id,task_id:rows[i].task_id}})}const u=await db(`${DATASETS}?id=eq.${encodeURIComponent(dataset.id)}`,"PATCH",{status:"ready",updated_at:new Date().toISOString()});return json({success:u.ok,dataset:first(u)||dataset})}
async function startTraining(b:Record<string,unknown>){const datasetId=str(b.dataset_id);if(!datasetId)return json({success:false,error:"DATASET_ID_REQUIRED"},400);const d=await db(`${DATASETS}?id=eq.${encodeURIComponent(datasetId)}&status=eq.ready&quality_gate=eq.true&compliance_gate=eq.true&limit=1`),dataset=first(d);if(!dataset)return json({success:false,error:"DATASET_NOT_TRAINING_READY"},400);const run=await db(RUNS,"POST",{dataset_id:datasetId,model_base_version:str(b.model_base_version,"baseline"),status:"queued",hyperparameters:b.hyperparameters??{},progress:0}),r=first(run);if(!r)return json({success:false,error:run.error||"TRAINING_RUN_CREATE_FAILED"},500);const taskId=str(b.compute_task_id,id("dark-star-train"));const created=await dispatchComputeTask({task_id:taskId,name:`Dark Star Training ${r.id.slice(0,8)}`,type:"model_training",task_type:"model_training",priority:"HIGH",nodesNeeded:1,iters:1,gpu_required:true,request:{dataset_id:datasetId,training_run_id:r.id,hyperparameters:b.hyperparameters??{}},metadata:{dark_star_training:true}},"/training/start");await db(`${RUNS}?id=eq.${encodeURIComponent(r.id)}`,"PATCH",{compute_task_id:taskId,status:"dispatched",updated_at:new Date().toISOString()});return new Response(created.body,{status:created.status,headers:CORS})}
async function trainingStatus(id:string){const r=await db(`${RUNS}?id=eq.${encodeURIComponent(id)}&limit=1`);return json({success:r.ok,training_run:first(r),error:r.ok?null:r.error},r.ok?200:500)}
async function recordResult(b:Record<string,unknown>){const runId=str(b.training_run_id);if(!runId)return json({success:false,error:"TRAINING_RUN_ID_REQUIRED"},400);const status=str(b.status,"completed"),p=Math.max(0,Math.min(1,num(b.progress,status==="completed"?1:0)));const r=await db(`${RUNS}?id=eq.${encodeURIComponent(runId)}`,"PATCH",{status,progress:p,result:b.result??{},error:str(b.error)||null,completed_at:status==="completed"?new Date().toISOString():null,updated_at:new Date().toISOString()});return json({success:r.ok,training_run:first(r),error:r.ok?null:r.error})}
async function evaluate(b:Record<string,unknown>){const runId=str(b.training_run_id),candidate=str(b.candidate_model_id),baseline=str(b.baseline_model_id);if(!runId||!candidate)return json({success:false,error:"TRAINING_RUN_AND_CANDIDATE_REQUIRED"},400);const cs=num(b.candidate_score,-1),bs=num(b.baseline_score,-1),safety=bool(b.safety_pass,false),reg=cs>=0&&bs>=0&&cs<bs,gate=cs>=0&&bs>=0&&cs>=bs&&safety;const r=await db(EVALS,"POST",{training_run_id:runId,candidate_model_id:candidate,baseline_model_id:baseline||null,benchmark_key:str(b.benchmark_key,"default"),metrics:b.metrics??{},candidate_score:cs>=0?cs:null,baseline_score:bs>=0?bs:null,regression:reg,safety_pass:safety,evaluation_gate:gate});return json({success:r.ok,evaluation:first(r),evaluation_gate:gate,error:r.ok?null:r.error})}
async function promote(b:Record<string,unknown>){const candidate=str(b.candidate_model_id),evaluation=str(b.evaluation_id);if(!candidate||!evaluation)return json({success:false,error:"CANDIDATE_AND_EVALUATION_REQUIRED"},400);const ev=await db(`${EVALS}?id=eq.${encodeURIComponent(evaluation)}&evaluation_gate=eq.true&safety_pass=eq.true&regression=eq.false&limit=1`),ok=!!first(ev)&&bool(b.owner_approval,false)&&bool(b.sandbox_pass,false)&&bool(b.compliance_pass,false);const p=await db(PROMOTIONS,"POST",{candidate_model_id:candidate,baseline_model_id:str(b.baseline_model_id)||null,evaluation_id:evaluation,owner_approval:bool(b.owner_approval,false),sandbox_pass:bool(b.sandbox_pass,false),compliance_pass:bool(b.compliance_pass,false),promotion_gate:ok,status:ok?"promoted":"pending",promoted_at:ok?new Date().toISOString():null});return json({success:ok,promotion:first(p),error:ok?null:"PROMOTION_GATE_NOT_PASSED"},ok?200:400)}
async function rollback(b:Record<string,unknown>){const c=str(b.candidate_model_id);if(!c)return json({success:false,error:"CANDIDATE_MODEL_ID_REQUIRED"},400);const r=await db(`${MODELS}?id=eq.${encodeURIComponent(c)}`,"PATCH",{status:"rolled_back"});return json({success:r.ok,rollback:true,model:first(r),error:r.ok?null:r.error})}
async function health(){return{success:true,service:SERVICE,version:VERSION,identity:AGENT,collaboration_pool:{enabled:true,compute_bridge:true,helper_search:true},compute_mesh:{enabled:true,coordinator:COORD,ordinary_task_routes:true},production_promotion_requires_owner:true}}
async function learningPromote(b:Record<string,unknown>){const title=str(b.title,"Technical Dark Star Learning"),rawContent=str(b.content),check=checkedLearning(rawContent);if(!check.ok)return json({success:false,error:check.error,message:check.message},422);const content=check.text;if(content.length>MEMORY_MAX_CHARS)return json({success:false,error:"LEARNING_CONTENT_TOO_LARGE",max_chars:MEMORY_MAX_CHARS,received_chars:content.length},413);const success=bool(b.success,true),confidence=Math.max(0,Math.min(1,num(b.confidence,.5))),memoryType=str(b.memory_type,"autonomous_execution");if(memoryType!=="verified_capability"){const ev=await db("dark_star_learning_events","POST",{task_id:uuidOrNull(b.source_task_id),session_id:uuidOrNull(b.session_id),event_type:success?"learning_candidate_success":"learning_candidate_failure",input_data:{title,memory_type:memoryType,confidence},outcome_data:{content,success,source:"learning_promote"},score:confidence,feedback:str(b.feedback)||null});return json({success:ev.ok,accepted:true,promoted:false,storage:"dark_star_learning_events",reason:"ONLY_VERIFIED_CAPABILITY_MAY_ENTER_LONG_TERM_CAPABILITY_MEMORY",event:first(ev),error:ev.ok?null:ev.error},ev.ok?200:400)}const r=await db(MEMORY,"POST",{memory_type:"verified_capability",title,content,confidence,usage_count:0,success_count:success?1:0,failure_count:success?0:1,active:true,source_task_id:uuidOrNull(b.source_task_id)});return json({success:r.ok,memory:first(r),promoted:r.ok,memory_type:"verified_capability",error:r.ok?null:r.error},r.ok?200:400)}
async function learningEvidence(b:Record<string,unknown>){const topic=str(b.topic)||str(b.title),rawLearned=str(b.learned_content)||str(b.content),check=checkedLearning(rawLearned),learned=check.ok?check.text:"";if(!topic||!learned)return json({success:false,error:check.error||"LEARNING_TOPIC_AND_CONTENT_REQUIRED",message:check.message},check.error?422:400);const status=str(b.verification_status,"unverified");if(!["unverified","passed","failed"].includes(status))return json({success:false,error:"INVALID_VERIFICATION_STATUS"},400);const r=await db(EVIDENCE,"POST",{learning_memory_id:uuidOrNull(b.learning_memory_id),task_id:uuidOrNull(b.task_id),run_id:uuidOrNull(b.run_id),topic,learned_content:learned,implementation_evidence:str(b.implementation_evidence)||null,test_result:str(b.test_result)||null,verification_status:status,reusable:status==="passed"&&bool(b.reusable,true),source_type:str(b.source_type,"runtime_test")});return json({success:r.ok,evidence:first(r),error:r.ok?null:r.error},r.ok?200:400)}
async function learningReuseTest(b:Record<string,unknown>){
 const query=str(b.query,"Provider Failover");
 const q=encodeURIComponent(query);
 const found=await db(MEMORY+"?memory_type=eq.verified_capability&active=eq.true&or=(title.ilike.%25"+q+"%25,content.ilike.%25"+q+"%25)&order=confidence.desc&limit=1");
 const memory=first(found);
 if(!memory)return json({success:false,reused:false,error:"VERIFIED_CAPABILITY_NOT_FOUND",query},404);
 const learned=str(memory.content);
 const supportsFailover=/failover|切換|無可用金鑰|provider/i.test(learned);
 if(!supportsFailover)return json({success:false,reused:false,error:"MEMORY_NOT_RELEVANT",memory_id:memory.id},400);
 const provider=str(b.provider,"grok"),model=str(b.model,"grok-4"),marker=str(b.marker,"LEARNING-REUSE-REAL-OK");
 const gateway=await call(GATEWAY,{message:"請只回覆："+marker,provider,model,topic_id:str(b.topic_id,"dark-star-learning-reuse-test"),agent:AGENT.agent_key});
 const ok=!!gateway.ok&&gateway.data?.success===true&&gateway.data?.fallback===true;
 const event=await db("dark_star_learning_events","POST",{task_id:uuidOrNull(b.task_id),session_id:uuidOrNull(b.session_id),event_type:"verified_capability_reuse",input_data:{memory_id:memory.id,query,provider,model,topic_id:str(b.topic_id,"dark-star-learning-reuse-test")},outcome_data:{success:ok,reused_memory:true,gateway_status:gateway.status,requested_provider:provider,actual_provider:gateway.data?.provider||null,fallback:gateway.data?.fallback||false,marker},score:ok?1:0,feedback:ok?"verified capability reused successfully":"verified capability reuse failed"});
 if(!event.ok)return json({success:ok,reused:true,learning_recorded:false,memory:{id:memory.id,title:memory.title,content:memory.content,confidence:memory.confidence},gateway:gateway.data||null,learning_event:null,error:"LEARNING_EVENT_WRITE_FAILED",event_error:event.error,rule:"先執行真實 Gateway，再寫入 learning event；event 寫入失敗時不得更新能力統計。"},ok?200:502);
 const usage=await db(MEMORY+"?id=eq."+encodeURIComponent(String(memory.id)),"PATCH",{usage_count:Number(memory.usage_count||0)+1,success_count:Number(memory.success_count||0)+(ok?1:0),failure_count:Number(memory.failure_count||0)+(ok?0:1),updated_at:new Date().toISOString()});
 return json({success:ok,reused:true,learning_recorded:true,memory:{id:memory.id,title:memory.title,content:memory.content,confidence:memory.confidence},gateway:gateway.data||null,memory_update:first(usage),learning_event:first(event),rule:"先執行真實 Gateway，再成功寫入 learning event，最後才更新能力成功/失敗統計。"},ok?200:502);
}
async function learningReport(b:Record<string,unknown>){
 const limit=Math.min(100,Math.max(1,Math.floor(num(b.limit,20))));
 const ev=await db(EVIDENCE+"?order=created_at.desc&limit="+limit);
 const mem=await db(MEMORY+"?active=eq.true&order=updated_at.desc&limit="+limit);
 const reuse=await db("dark_star_learning_events?event_type=eq.verified_capability_reuse&order=created_at.desc&limit="+Math.min(500,limit*10));
 const evidence=Array.isArray(ev.data)?ev.data:[];
 const memories=Array.isArray(mem.data)?mem.data:[];
 const reuseEvents=Array.isArray(reuse.data)?reuse.data:[];
 const verified=evidence.filter((x:any)=>x.verification_status==="passed");
 const reusable=verified.filter((x:any)=>x.reusable===true);
 const reuseByMemory=new Map<string,{uses:number,successes:number,failures:number,last_reused_at:string|null}>();
 for(const e of reuseEvents){
  const mid=str(e?.input_data?.memory_id); if(!mid)continue;
  const cur=reuseByMemory.get(mid)||{uses:0,successes:0,failures:0,last_reused_at:null};
  cur.uses++; if(Number(e.score)>=1)cur.successes++; else cur.failures++;
  cur.last_reused_at=str(e.created_at)||cur.last_reused_at; reuseByMemory.set(mid,cur);
 }
 const capabilityReuse=memories.filter((m:any)=>m.memory_type==="verified_capability").map((m:any)=>{
  const r=reuseByMemory.get(String(m.id))||{uses:0,successes:0,failures:0,last_reused_at:null};
  return {...m,reuse:r,reuse_status:r.uses===0?"verified_not_reused":r.failures===0?"reused_successfully":"reused_with_failures"};
 });
 return json({success:ev.ok&&mem.ok&&reuse.ok,service:SERVICE,report:{generated_at:new Date().toISOString(),learning_memory_count:memories.length,evidence_count:evidence.length,verified_learning_count:verified.length,reusable_capability_count:reusable.length,reuse_event_count:reuseEvents.length,verified_capability_reuse:capabilityReuse,rule:"只有有實作與測試證據的項目才能標示為已學會；reuse 統計只採用已寫入 verified_capability_reuse event 的實際結果；失敗不會被當成成功。",verified_learning:verified,unverified_learning:evidence.filter((x:any)=>x.verification_status!=="passed"),recent_memory:memories},errors:[ev.ok?null:ev.error,mem.ok?null:mem.error,reuse.ok?null:reuse.error].filter(Boolean)})
}
async function learningRunCreate(b:Record<string,unknown>){const r=await db("dark_star_learning_runs","POST",{trigger_type:str(b.trigger_type,"autonomous"),task_id:uuidOrNull(b.task_id),session_id:uuidOrNull(b.session_id),observed_count:Math.max(0,Math.floor(num(b.observed_count,0))),candidates_created:Math.max(0,Math.floor(num(b.candidates_created,0))),candidates_promoted:Math.max(0,Math.floor(num(b.candidates_promoted,0))),status:str(b.status,"running"),summary:b.summary&&typeof b.summary==="object"?b.summary:{}});return json({success:r.ok,learning_run:first(r),error:r.ok?null:r.error},r.ok?200:400)}
async function learningRunUpdate(runId:string,b:Record<string,unknown>){const patch:Record<string,unknown>={};if("trigger_type" in b)patch.trigger_type=str(b.trigger_type);if("status" in b)patch.status=str(b.status);for(const k of ["observed_count","candidates_created","candidates_promoted"])if(k in b)patch[k]=Math.max(0,Math.floor(num(b[k],0)));if("summary" in b)patch.summary=b.summary&&typeof b.summary==="object"?b.summary:{};const r=await db("dark_star_learning_runs?id=eq."+encodeURIComponent(runId),"PATCH",patch);return json({success:r.ok,learning_run:first(r),error:r.ok?null:r.error},r.ok?200:400)}


type DarkStarVisualIntent={task_type:"image"|"video";subject:string;action:string;appearance:string[];clothing:string[];colors:string[];pose:string[];scene:string[];lighting:string[];camera:string[];style:string[];composition:string[];constraints:string[];negatives:string[];prompt_zh:string};
const cleanText=(v:unknown)=>str(v).replace(/\\s+/g," ").trim();
function asStringArray(v:unknown){return Array.isArray(v)?v.map(x=>cleanText(x)).filter(Boolean):[]}
function parseJsonObject(v:string){try{const m=v.match(/\\{[\\s\\S]*\\}/);return m?JSON.parse(m[0]):null}catch{return null}}
function deterministicVisualIntent(request:string):DarkStarVisualIntent{
 const q=cleanText(request),low=q.toLowerCase();
 const pick=(terms:string[])=>terms.filter(t=>q.includes(t)||low.includes(t.toLowerCase()));
 const clothing=pick(["旗袍","qipao","cheongsam","漢服","hanfu","西裝","suit","洋裝","連衣裙","dress","制服","uniform"]);
 const colors=pick(["紅色","紅","黑色","黑","白色","白","藍色","藍","綠色","綠","黃色","黃","紫色","紫","粉紅","粉色"]);
 const pose=pick(["站著","站立","standing","坐著","坐在","坐","sitting","seated","躺著","躺","lying"]);
 const scene=pick(["咖啡廳","咖啡店","cafe","coffee shop","上海街頭","街頭","street","室內","戶外","房間"]);
 const lighting=pick(["晚上","夜晚","night","evening","陽光","日光","sunlight","daylight","霓虹","neon"]);
 const style=pick(["電影感","cinematic","寫實","寫實風","photorealistic","realistic","動漫","anime"]);
 const task_type=/影片|視頻|video|短片|動畫|animation/i.test(q)?"video":"image";
 const subject=pick(["女性","女人","女生","女子","女孩子","woman","female","girl","男性","男人","男生","男子","男孩子","man","male","boy"])[0]||"使用者指定的主體";
 const action=pick(["走路","行走","walking","跑步","running","微笑","smiling","看向鏡頭","looking at camera"])[0]||"";
 const constraints=/不要|不能|不可|避免|不可以/.test(q)?[q]:[];
 const negatives=constraints.length?["不要添加使用者未要求的服裝、道具、場景或人物"]:[];
 const parts=[subject,action,...clothing,...colors,...pose,...scene,...lighting,...style].filter(Boolean);
 return {task_type,subject,action,appearance:[],clothing,colors,pose,scene,lighting,camera:[],style,composition:[],constraints,negatives,prompt_zh:q};
}
function extractGatewayText(x:any){return cleanText(x?.text||x?.message||x?.content||x?.response||x?.output||x?.answer||x?.data?.text||x?.data?.message||x?.data?.content||"")}
async function understandVisualIntent(request:string){
 const fallback=deterministicVisualIntent(request);
 const semanticPrompt=[
 "你是 Technical Dark Star 的視覺語意編譯器，不是另一個 AI Agent。",
 "唯一工作：把使用者自然語言轉成嚴格 JSON，供真正的圖片/影片生成器執行。",
 "理解繁體中文、口語、省略、同義詞、錯字與上下文。例如「傳旗袍的女性」在明確圖片生成語境中，應理解為「呈現/生成一名穿旗袍的女性」，不是上傳或傳送檔案。",
 "絕對不要自行增加使用者沒有指定的年齡、身材、髮型、姿勢、背景、道具、鏡頭、風格或色情元素；保留使用者明確要求的限制。",
 "task_type 只能是 image 或 video；沒有明確影片要求時使用 image。",
 "只輸出 JSON，不要 Markdown。固定欄位：task_type,subject,action,appearance,clothing,colors,pose,scene,lighting,camera,style,composition,constraints,negatives,prompt_zh。",
 "prompt_zh 必須是可直接交給生成器的繁體中文完整視覺提示，不得新增未指定內容。",
 "使用者要求："+request
 ].join("\\n");
 try{
   const g=await call(GATEWAY,{message:semanticPrompt,provider:"gemini",model:"gemini-3.6-flash",topic_id:"dark-star-visual-semantic",conversation_id:"dark-star-visual-semantic",memory:false,agent:AGENT.agent_key});
   const raw=extractGatewayText(g.data),parsed=parseJsonObject(raw);
   if(g.ok&&parsed&&["image","video"].includes(parsed.task_type)&&cleanText(parsed.prompt_zh))
     return {intent:{...fallback,...parsed,prompt_zh:cleanText(parsed.prompt_zh)},semantic_source:"gateway-gemini-3.6-flash"};
 }catch{}
 return {intent:fallback,semantic_source:"deterministic-fallback"};
}
function visualIntentPrompt(i:DarkStarVisualIntent){return i.prompt_zh||[i.subject,i.action,...i.appearance,...i.clothing,...i.colors,...i.pose,...i.scene,...i.lighting,...i.camera,...i.style,...i.composition,...i.constraints].filter(Boolean).join("，");}

async function imageGenerate(b:Record<string,unknown>){
 const originalRequest=str(b.prompt)||str(b.message)||str(b.text);
 if(!originalRequest)return json({success:false,error:"prompt is required",capability:"image_generation"},400);
 // AIVAULT_IMAGE_PROMPT_FIDELITY_V1
 // Semantic fields are diagnostic only. Never replace the complete request with
 // a lossy keyword list or a model paraphrase. Content checks still run downstream.
 const semantic=await understandVisualIntent(originalRequest);
 const semanticPrompt=originalRequest;
 const url=`${SUPABASE}/functions/v1/dark-star-image-generation`;
 const payload={prompt:semanticPrompt,mime_type:str(b.mime_type,"image/png"),aspect_ratio:str(b.aspect_ratio,"1:1"),image_size:str(b.image_size,"1K"),image_task_mode:b.image_task_mode==="continuation"?"continuation":"new",user_request:str(b.user_request)||originalRequest,semantic_intent:semantic.intent,semantic_source:semantic.semantic_source,reference_images:b.image_task_mode==="continuation"&&Array.isArray(b.reference_images)?b.reference_images:[],reference_image_urls:b.image_task_mode==="continuation"&&Array.isArray(b.reference_image_urls)?b.reference_image_urls:[],web_research:b.web_research===true||b.web_research==="true"};
 const s=secret(),h:Record<string,string>={"Content-Type":"application/json"};if(s)h["x-aivault-internal"]=s;
 try{
  const r=await fetch(url,{method:"POST",headers:h,body:JSON.stringify(payload)}),t=await r.text();let x:any;try{x=t?JSON.parse(t):null}catch{x={raw:t}};
  if(r.ok)return json({success:true,status:r.status,capability:"image_generation",semantic_understanding:{source:semantic.semantic_source,intent:semantic.intent,prompt_source:"original_request",summary_is_advisory:true},image_generation:x},200);
  const nested=x?.error,nestedMessage=typeof nested==="string"?nested:nested?.message||nested?.error?.message||(nested?JSON.stringify(nested):"");
  const downstreamMessage=nestedMessage||x?.message||x?.detail||(typeof x?.raw==="string"?x.raw:"")||`dark-star-image-generation returned HTTP ${r.status}`;
  return json({success:false,status:r.status,capability:"image_generation",semantic_understanding:{source:semantic.semantic_source,intent:semantic.intent},error:downstreamMessage,diagnostic:{downstream_function:"dark-star-image-generation",downstream_status:r.status,downstream_code:nested?.code||null},image_generation:x},200);
 }catch(e){return json({success:false,capability:"image_generation",semantic_understanding:{source:semantic.semantic_source,intent:semantic.intent},error:e instanceof Error?e.message:String(e)},502)}
}
serve(async(req)=>{if(new URL(req.url).pathname.replace(/\/$/,"").endsWith("/crossbase"))return handleCrossbase(req);if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});const u=new URL(req.url);let p=u.pathname.replace(/\/+/g,"/");const marker="/technical-dark-star",i=p.indexOf(marker);if(i>=0)p=p.slice(i+marker.length)||"/";try{if(req.method==="GET"&&(p==="/"||p==="/health"||p==="/training/health"))return json(await health());if(req.method==="GET"&&p==="/identity")return json({success:true,service:SERVICE,version:VERSION,identity:AGENT});if(req.method==="GET"&&p==="/pipeline")return json({success:true,pipeline:["Research","Understanding","Implementation","Implementation Execution","Runtime Testing","Evaluation","Sandbox Verification","Capability Promotion","Learning","Model Training","Model Evaluation","Owner Approval","Production Promotion"]});if(req.method==="POST"&&p==="/training/example")return trainingExample(await body(req));if(req.method==="POST"&&p==="/training/dataset/build")return buildDataset(await body(req));if(req.method==="POST"&&p==="/training/start")return startTraining(await body(req));if(req.method==="GET"&&p.startsWith("/training/status/"))return trainingStatus(decodeURIComponent(p.slice(17)));if(req.method==="POST"&&p==="/training/result")return recordResult(await body(req));if(req.method==="POST"&&p==="/training/evaluate")return evaluate(await body(req));if(req.method==="POST"&&p==="/training/promote")return promote(await body(req));if(req.method==="POST"&&p==="/training/rollback")return rollback(await body(req));if(req.method==="POST"&&p==="/image/generate")return imageGenerate(await body(req));if(req.method==="POST"&&(p==="/task"||p==="/run"))return dispatchComputeTask(await body(req),p);if(req.method==="POST"&&p==="/learning/promote")return learningPromote(await body(req));if(req.method==="POST"&&p==="/learning/evidence")return learningEvidence(await body(req));if(req.method==="POST"&&p==="/learning/runtime-test")return runtimeConcurrencyTest(await body(req));if(req.method==="POST"&&p==="/learning/runtime-idempotency-test")return runtimeIdempotencyTest(await body(req));if(req.method==="POST"&&p==="/learning/runtime-retry-backoff-test")return runtimeRetryBackoffTest(await body(req));if(req.method==="POST"&&p==="/learning/runtime-provider-failover-test")return runtimeProviderFailoverTest(await body(req));if(req.method==="POST"&&p==="/learning/finalize")return finalizeLearning(await body(req));if(req.method==="POST"&&p==="/learning/verify")return verifyLearning(await body(req));if(req.method==="POST"&&p==="/learning/reuse")return learningReuseTest(await body(req));if(req.method==="POST"&&p==="/learning/report")return learningReport(await body(req));if(req.method==="POST"&&p==="/learning/run")return learningRunCreate(await body(req));if(req.method==="PATCH"&&p.startsWith("/learning/run/"))return learningRunUpdate(decodeURIComponent(p.slice(13)),await body(req));if(req.method==="POST"&&p==="/learning/observe"){const b=await body(req),r=await db("dark_star_learning_events","POST",{task_id:str(b.task_id)||null,session_id:str(b.session_id)||null,event_type:str(b.event_type,"observation"),input_data:b.input_data??{},outcome_data:b.outcome_data??{},score:Math.max(0,Math.min(1,num(b.score,0))),feedback:str(b.feedback)||null});return json({success:r.ok,event:first(r),error:r.ok?null:r.error})}if(req.method==="POST"&&p==="/learning/retrieve"){const b=await body(req),q=str(b.query)||str(b.message),r=await db(`${MEMORY}?or=(title.ilike.%25${encodeURIComponent(q)}%25,content.ilike.%25${encodeURIComponent(q)}%25)&memory_type=eq.verified_capability&active=eq.true&order=confidence.desc&limit=20`);return json({success:r.ok,memories:Array.isArray(r.data)?r.data:[],error:r.ok?null:r.error})}return json({success:false,error:"Route not found",path:p},404)}catch(e){return json({success:false,error:String(e),service:SERVICE,version:VERSION},500)}});

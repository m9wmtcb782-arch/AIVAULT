// AIVAULT Compute Coordinator
// Minimal lifecycle fix: real assignment row, no COMPLETED without verified WebGPU result.
import { verifyTensorStage, tensorPipelineStart, tensorPipelineStatus, enqueueTensorNext, recoverTensorLeases } from "./tensor-pipeline.ts";
import { compatibleGpuTask, verifyPortableGpuResult, poolGpuRating } from "./gpu-benchmark.ts";
import { checkPoolTaskAccess } from "./task-access.ts";
import { isNnInferType, verifyNnInferResult, NN_MODEL_ID } from "./nn-infer-verify.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function pick(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (body[key] != null && body[key] !== "") return body[key];
  }
  return null;
}

async function recognize(node: Record<string, unknown>) {
  const { data, error } = await db.rpc("darkstar_normalize_compute_capability", {
    p_platform: node.platform ?? null,
    p_gpu: node.gpu && typeof node.gpu === "object" ? node.gpu : {},
    p_capability: node.capability ?? {},
    p_accelerator: node.accelerator ?? {},
    p_memory_gb: node.memory_gb ?? null,
  });
  if (error || !data) {
    return {
      ai_role: "browser_gpu",
      memory_gb: null,
      accelerators: ["webgpu"],
      platform_family: "unknown",
      recognition_version: "darkstar-compute-capability-v1",
    };
  }
  return data;
}

async function meshStatus() {
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("compute_mesh_nodes")
    .select("*")
    .gte("last_seen", since);
  if (error) return { success: false, error: error.message };
  const nodes = data || [];
  return {
    success: true,
    online: nodes.length,
    available: nodes.filter((n) => n.available && n.status !== "RUNNING").length,
    running: nodes.filter((n) => n.status === "RUNNING").length,
    queued: 0,
    nodes,
  };
}

function storedNodeStatus(value:unknown){const status=String(value||"READY").toUpperCase();return ["PAUSED","STOPPED"].includes(status)?"OFFLINE":status;}

async function registerNode(body: Record<string, unknown>, request?: Request) {
  const node = (body.node && typeof body.node === "object" ? body.node : body) as Record<string, unknown>;
  const nodeId = String(pick(node, ["node_id", "id"]) || pick(body, ["nodeId", "node_id"]) || "");
  if (!nodeId) return json({ success: false, error: "node.id required" }, 400);
  const metadata = node.metadata && typeof node.metadata === "object" ? node.metadata as Record<string, unknown> : {};
  const platform = node.platform ?? metadata.platform ?? request?.headers.get("user-agent") ?? null;
  const recognized = await recognize({ ...node, platform });
  const row = {
    node_id: nodeId,
    status:storedNodeStatus(node.status),
    available:node.available!==false&&!["PAUSED","STOPPED","OFFLINE"].includes(String(node.status||"").toUpperCase()),
    gpu: node.gpu === true || node.gpu === "true" || (node.webgpu === true && node.gpu !== false),
    capability: {
      ...(typeof node.capability === "object" && node.capability ? node.capability as object : {}),
      aivault_compute_capability: recognized,
      ...(node.gpu && typeof node.gpu === "object" ? {gpu_info:node.gpu} : {}),
    },
    platform,
    runtime: node.runtime ?? "webgpu",
    memory_gb: node.memory_gb ?? null,
    accelerator: node.accelerator ?? {},
    last_seen: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db
    .from("compute_mesh_nodes")
    .upsert(row, { onConflict: "node_id" })
    .select("*")
    .single();
  if (error) return json({ success: false, error: error.message }, 500);
  const mesh = await meshStatus();
  return json({
    success: true,
    type: "node.registered",
    node: data,
    recognized_capability: recognized,
    mesh,
  });
}

async function heartbeat(body: Record<string, unknown>, request?: Request) {
  const nodeId = String(pick(body, ["nodeId", "node_id"]) || "");
  if (!nodeId) return json({ success: false, error: "nodeId required" }, 400);
  const recognized = await recognize(body);
  const patch: Record<string, unknown> = {
    last_seen: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status:storedNodeStatus(body.status),
    available:body.available!==false&&!["PAUSED","STOPPED","OFFLINE"].includes(String(body.status||"").toUpperCase()),
    gpu: body.gpu === true || body.gpu === "true" || (body.webgpu === true && body.gpu !== false),
  };
  const platform = body.platform ?? request?.headers.get("user-agent");
  if (platform) patch.platform = platform;
  const { error } = await db.from("compute_mesh_nodes").update(patch).eq("node_id", nodeId);
  if (error) return json({ success: false, error: error.message }, 500);
  return json({
    success: true,
    type: "node.heartbeat",
    nodeId,
    recognized_capability: recognized,
    timestamp: new Date().toISOString(),
  });
}

async function modelAllowedInPool(modelId: string): Promise<boolean> {
  const { data, error } = await db.rpc("aivault_check_pool_model_access", { p_model_id: modelId });
  if (error) throw new Error("Model policy unavailable");
  return data === true;
}

async function poolStatus() {
  const [workerResult, registeredResult, benchmarkResult] = await Promise.all([
    db.from("compute_mesh_nodes").select("node_id,status,available,gpu,capability,platform,runtime,accelerator,last_seen", {count:"exact"}).order("last_seen", {ascending:false}).limit(1000),
    db.from("aivault_compute_nodes").select("id,node_name,platform,browser,webgpu_supported,status,paused_by_user,last_heartbeat_at", {count:"exact"}).order("last_heartbeat_at", {ascending:false}).limit(1000),
    db.from("compute_mesh_assignments").select("node_id,result,updated_at").eq("status","COMPLETED").order("updated_at",{ascending:false}).limit(3000),
  ]);
  if (workerResult.error || registeredResult.error || benchmarkResult.error) return json({success:false,error:"POOL_STATUS_UNAVAILABLE"},503);
  const nodes = new Map<string, unknown>();
  const now = Date.now();
  const ratings = new Map<string, unknown>();
  for(const row of benchmarkResult.data || []){
    if(ratings.has(row.node_id) || now-Date.parse(row.updated_at)>7*86400000 || !Number.isFinite(Date.parse(row.updated_at)))continue;
    const rating=poolGpuRating(row.result);
    if(rating)ratings.set(row.node_id,{...rating,measured_at:row.updated_at});
  }
  const onlineAt = (timestamp: unknown, ttl: number) => {
    const time = typeof timestamp === "string" ? Date.parse(timestamp) : NaN;
    return Number.isFinite(time) && time <= now + 5000 && now - time <= ttl;
  };
  for (const row of registeredResult.data || []) {
    nodes.set(row.id, { id:row.id, name:row.node_name || row.id, source:"registered", platform:row.platform, browser:row.browser, gpu_reported:row.webgpu_supported === true, online:onlineAt(row.last_heartbeat_at,60000) && !["offline","error"].includes(row.status), available:!row.paused_by_user && row.status === "online", status:row.status, last_seen:row.last_heartbeat_at, hardware:null,reason:!onlineAt(row.last_heartbeat_at,60000)?"心跳逾時（可能已關頁、鎖屏或斷線）":row.paused_by_user?"使用者已暫停":row.webgpu_supported!==true?"尚未回報可用 GPU":"" });
  }
  for (const row of workerResult.data || []) {
    const capability = row.capability || {};
    nodes.set(row.node_id, { id:row.node_id, name:row.node_id, source:"coordinator", gpu_rating:ratings.get(row.node_id) || null, video_rating:null, runtime:row.runtime, tensor_supported:capability.supported_task_types?.includes("gpu-tensor-stage")===true, tensor_reason:capability.tensor_failure_reason||null, platform:row.platform, gpu_reported:row.gpu === true || Boolean(row.gpu && typeof row.gpu === "object"), online:onlineAt(row.last_seen,120000) && !["OFFLINE","FAILED","ERROR"].includes(String(row.status).toUpperCase()), available:row.available === true, status:row.status, last_seen:row.last_seen, reason:!onlineAt(row.last_seen,120000)?"心跳逾時（可能已關頁、鎖屏或斷線）":capability.gpu_failure_reason || (["PAUSED","STOPPED","OFFLINE"].includes(String(row.status).toUpperCase())?"使用者已停止提供":""), hardware:{ gpu:typeof row.gpu === "object" ? row.gpu : null, accelerator:row.accelerator, gpu_info:capability.gpu_info || capability.gpu || capability.aivault_compute_capability || null } });
  }
  return json({success:true,nodes:[...nodes.values()], video_capacity:{version:"video-throughput-v1",status:"UNVALIDATED",unit:"standard_5s_videos_per_hour",scope:"pool",workload_id:null,units:null,reason:"自有影片模型與跨設備影片協作尚未通過驗證；PGU 僅為基礎 GPU 診斷",pricing:"UNSET",external_access:"CLOSED"}, fetched_at:new Date(now).toISOString(), truncated:(workerResult.count || 0)>1000 || (registeredResult.count || 0)>1000, policy:{mode:"FIRST_PARTY_ONLY",external_models:"CLOSED",pricing:"UNSET",gpu_inference_validated:false}, counting:"browser_nodes_not_unique_physical_devices"});
}

async function createTask(body: Record<string, unknown>) {
  const task = (body.task && typeof body.task === "object" ? body.task : body) as Record<string, unknown>;
  const taskId = String(pick(task, ["id", "task_id"]) || "");
  if (!taskId) return json({ success: false, error: "task.id required" }, 400);
  if(taskId.startsWith("tensor-chain-"))return json({success:false,error:"PIPELINE_TASKS_SERVER_ONLY"},403);
  if((task.type||task.task_type)==="gpu-tensor-stage")return json({success:false,error:"PIPELINE_TASKS_SERVER_ONLY"},403);
  const access = await checkPoolTaskAccess(task, modelAllowedInPool);
  if (!access.allowed) return json({success:false,error:access.reason},403);
  const elements = Number(task.elements ?? ((task.payload as Record<string, unknown> | undefined)?.elements ?? 0));
  const iterations = Number(task.iterations ?? task.iters ?? 1);
  if ((task.type || task.task_type) === "gpu-u32-mix" && (!Number.isInteger(elements) || elements < 1 || elements > 4096 || !Number.isInteger(iterations) || iterations < 1 || iterations > 16)) return json({success:false,error:"PORTABLE_GPU_WORKLOAD_OUT_OF_RANGE"},400);
  const taskType = String(task.type || task.task_type || "compute");
  if (isNnInferType(taskType)) {
    const mid = String(task.model_id || (task.payload as any)?.model_id || "");
    if (mid !== NN_MODEL_ID) return json({success:false,error:"NN_INFER_MODEL_NOT_WHITELISTED"},403);
    task.model_id = mid;
    task.input_ref = String(task.input_ref || "packaged-ref-100");
    // Forbid embedding weight blobs in the task (must load same-origin Stage b assets on the node).
    if ((task as any).weights || (task.payload as any)?.weights) return json({success:false,error:"NN_INFER_NO_INLINE_WEIGHTS"},400);
  }
  const row = {
    task_id: taskId,
    name: String(task.name || task.title || taskId),
    type: String(task.type || task.task_type || "compute"),
    elements,
    iterations,
    nodes_needed: Number(task.nodesNeeded || task.nodes_needed || 1),
    priority: String(task.priority || "NORMAL"),
    status: "WAITING",
    payload: {
      ...task,
      id: taskId,
      elements,
      iterations,
      gpu_required: task.gpu_required !== false,
      backend: task.backend || "webgpu",
      execution: task.execution || "remote",
      requirements: task.requirements || {},
    },
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db
    .from("compute_mesh_tasks")
    .upsert(row, { onConflict: "task_id" })
    .select("*")
    .single();
  if (error) return json({ success: false, error: error.message }, 500);
  if (data.status === "COMPLETED") {
    return json({ success: false, error: "refusing to create a task already COMPLETED" }, 409);
  }
  return json({ success: true, type: "task.created", task: data });
}

async function requestTask(body: Record<string, unknown>) {
  const nodeId = String(pick(body, ["nodeId", "node_id"]) || "");
  if (!nodeId) return json({ success: false, error: "nodeId required" }, 400);
  const { data: node, error: nodeErr } = await db
    .from("compute_mesh_nodes")
    .select("*")
    .eq("node_id", nodeId)
    .maybeSingle();
  if (nodeErr) return json({ success: false, error: nodeErr.message }, 500);
  if (!node) return json({ success: false, error: "node not registered" }, 404);
  if (body.gpu_available === false || node.gpu !== true || node.status === "OFFLINE" || node.status === "ERROR") {
    return json({ success: false, error: "no gpu worker" });
  }

  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(nodeId)) return json({success:false,error:"INVALID_NODE_ID"},400);
  if(node.capability?.supported_task_types?.includes("gpu-tensor-stage")){
    const stale=await db.from("compute_mesh_tasks").select("*").eq("type","gpu-tensor-stage").in("status",["QUEUED","RUNNING","FAILED"]).order("updated_at",{ascending:true}).limit(20);
    if(!stale.error)await recoverTensorLeases(db,stale.data||[]);
  }
  let waitingQuery = db.from("compute_mesh_tasks").select("*").eq("status","WAITING")
    .or("payload->>target_node_id.is.null,payload->>target_node_id.eq." + nodeId);
  const supportedTypes = node.capability?.supported_task_types;
  if (Array.isArray(supportedTypes) && supportedTypes.length > 0) waitingQuery = waitingQuery.in("type",supportedTypes.filter((v: unknown)=>typeof v === "string"));
  else if (node.runtime === "webgl2") waitingQuery = waitingQuery.eq("type","gpu-u32-mix");
  const {data:waiting,error:waitErr} = await waitingQuery.order("created_at",{ascending:true}).limit(20);
  if (waitErr) return json({ success: false, error: waitErr.message }, 500);
  let task: any = null;
  for (const row of waiting || []) {
    const payload = row.payload || {};
    if (payload.gpu_required === false || !compatibleGpuTask(node,row)) continue;
    const access = await checkPoolTaskAccess({ ...row, payload }, modelAllowedInPool);
    if (access.allowed) { task = row; break; }
  }
  if (!task) return json({ success: false, error: "no available task" });

  const claimPatch: Record<string, unknown> = {status:"QUEUED",updated_at:new Date().toISOString()};
  if(task.type==="gpu-tensor-stage")claimPatch.payload={...task.payload,lease_node_id:nodeId,lease_generation:crypto.randomUUID(),lease_expires_at:new Date(Date.now()+180000).toISOString()};
  const {data:claimed,error:claimError}=await db.from("compute_mesh_tasks").update(claimPatch).eq("task_id",task.task_id).eq("status","WAITING").select("task_id");
  if(claimError)return json({success:false,error:"TASK_CLAIM_FAILED"},503);
  if(!claimed?.length)return json({success:false,error:"task already claimed"});
  if(task.type==="gpu-tensor-stage")task.payload=claimPatch.payload;

  let existingQuery=db.from("compute_mesh_assignments").select("*").eq("task_id",task.task_id).eq("node_id",nodeId);
  if(task.type!=="gpu-tensor-stage")existingQuery=existingQuery.in("status",["ASSIGNED","RUNNING","COMPLETED"]);
  const {data:existing,error:existErr}=await existingQuery.maybeSingle();
  if (existErr) return json({ success: false, error: existErr.message }, 500);

  let assignment=existing;
  if(assignment&&task.type==="gpu-tensor-stage"){
    const refreshed=await db.from("compute_mesh_assignments").update({status:"ASSIGNED",progress:0,result:{},updated_at:new Date().toISOString()}).eq("id",assignment.id).select("*").single();
    if(refreshed.error)return json({success:false,error:"ASSIGNMENT_RENEW_FAILED"},503);
    assignment=refreshed.data;
  }
  if (!assignment) {
    const insert = {
      task_id: task.task_id,
      node_id: nodeId,
      status: "ASSIGNED",
      progress: 0,
      result: {},
    };
    const { data: created, error: insErr } = await db
      .from("compute_mesh_assignments")
      .insert(insert)
      .select("*")
      .single();
    if (insErr) {
      await db.from("compute_mesh_tasks").update({status:"WAITING",updated_at:new Date().toISOString()}).eq("task_id",task.task_id).eq("status","QUEUED");
      return json({
        success: false,
        error: "assignment insert failed",
        detail: insErr.message,
      }, 500);
    }
    assignment = created;
  }

  await db.from("compute_mesh_nodes").update({
    status: "RUNNING",
    available: false,
    updated_at: new Date().toISOString(),
  }).eq("node_id", nodeId);

  const payload = task.payload || {};
  return json({
    success: true,
    type: "task.assigned",
    task: {
      ...payload,
      id: task.task_id,
      task_id: task.task_id,
      elements: task.elements,
      iterations: task.iterations,
      status: "ASSIGNED",
    },
    assignment: {
      id: assignment.id,
      assignmentId: assignment.id,
      assignment_id: assignment.id,
      task_id: task.task_id,
      node_id: nodeId,
      status: assignment.status,
      progress: assignment.progress ?? 0,
      sliceIndex: 0,
      sliceCount: 1,
    },
    assignmentId: assignment.id,
    assignment_id: assignment.id,
    node_capability: node.capability?.aivault_compute_capability || null,
    worker_hardware: { gpu: node.gpu === true },
  });
}

function resultVerified(result: Record<string, unknown>) {
  return result.verified === true &&
    result.executed_on === "WebGPU" &&
    result.gpu === true &&
    result.gpu_time_ms != null &&
    result.checksum != null &&
    result.workgroups != null &&
    Number(result.elements) > 0;
}

async function taskProgress(body: Record<string, unknown>) {
  const taskId = String(pick(body, ["taskId", "task_id"]) || "");
  const nodeId = String(pick(body, ["nodeId", "node_id"]) || "");
  const assignmentId = pick(body, ["assignmentId", "assignment_id"]);
  if(taskId.startsWith("tensor-chain-")){
    const {data:task,error:taskError}=await db.from("compute_mesh_tasks").select("type,payload,status").eq("task_id",taskId).maybeSingle();
    if(taskError)return json({success:false,error:"TASK_VERIFICATION_UNAVAILABLE"},503);
    if(task?.type!=="gpu-tensor-stage"||task.payload?.lease_node_id!==nodeId||task.payload?.lease_generation!==body.lease_generation||!(Date.parse(task.payload?.lease_expires_at)>Date.now())||!["QUEUED","RUNNING"].includes(task.status))return json({success:false,error:"TENSOR_LEASE_MISMATCH"},409);
  }
  let query = db.from("compute_mesh_assignments").update({
    status: String(body.status || "RUNNING"),
    progress: Number(body.progress || 0),
    updated_at: new Date().toISOString(),
  });
  if (assignmentId) query = query.eq("id", assignmentId);
  else query = query.eq("task_id", taskId).eq("node_id", nodeId);
  const { data, error } = await query.select("*");
  if (error) return json({ success: false, error: error.message }, 500);
  if (!data || data.length === 0) {
    return json({ success: false, error: "assignment missing", taskStatus: "WAITING" }, 409);
  }
  if (taskId) {
    let progressQuery=db.from("compute_mesh_tasks").update({status:"RUNNING",updated_at:new Date().toISOString()}).eq("task_id",taskId).in("status",["WAITING","QUEUED","RUNNING"]);
    if(taskId.startsWith("tensor-chain-"))progressQuery=progressQuery.eq("payload->>lease_generation",body.lease_generation);
    const progressWrite=await progressQuery.select("task_id");
    if(progressWrite.error)return json({success:false,error:"TASK_PROGRESS_WRITE_FAILED"},503);
    if(taskId.startsWith("tensor-chain-")&&!progressWrite.data?.length)return json({success:false,error:"TENSOR_LEASE_MISMATCH"},409);
  }
  return json({ success: true, type: "task.progress", assignment: data[0] });
}

async function taskResult(body: Record<string, unknown>) {
  const taskId = String(pick(body, ["taskId", "task_id"]) || "");
  const nodeId = String(pick(body, ["nodeId", "node_id"]) || "");
  const assignmentId = pick(body, ["assignmentId", "assignment_id"]);
  const result = (body.result && typeof body.result === "object" ? body.result : {}) as Record<string, unknown>;
  if (!taskId || !nodeId) return json({ success: false, error: "taskId and nodeId required" }, 400);

  let query = db.from("compute_mesh_assignments").select("*").eq("task_id", taskId).eq("node_id", nodeId);
  if (assignmentId) query = query.eq("id", assignmentId);
  const { data: rows, error } = await query;
  if (error) return json({ success: false, error: error.message }, 500);
  const assignment = rows && rows[0];
  if (!assignment) {
    return json({
      success: false,
      error: "assignment missing; refusing COMPLETED",
      taskId,
      taskStatus: "FAILED",
      verified: false,
    }, 409);
  }

  let verified = resultVerified(result);
  let tensorTask: any=null;
  if (result.executed_on === "WebGL2" || result.executed_on === "WebGPU" || result.executed_on === "CPU" || taskId.startsWith("tensor-chain-") || isNnInferType((body as any).task_type)) {
    const { data: storedTask, error: loadError } = await db.from("compute_mesh_tasks").select("task_id,type,elements,iterations,payload,status,updated_at").eq("task_id",taskId).maybeSingle();
    if (loadError) return json({success:false,error:"TASK_VERIFICATION_UNAVAILABLE"},503);
    if(storedTask?.type==="gpu-tensor-stage"){
      if(storedTask.payload?.lease_node_id!==nodeId||storedTask.payload?.lease_generation!==body.lease_generation||(storedTask.status!=="COMPLETED"&&!(Date.parse(storedTask.payload?.lease_expires_at)>Date.now()))||!["QUEUED","RUNNING","COMPLETED"].includes(storedTask.status))return json({success:false,error:"TENSOR_LEASE_MISMATCH"},409);
      tensorTask=storedTask;verified=verifyTensorStage(storedTask,result);
      if(storedTask.status==="COMPLETED"){
        if(body.status==='FAILED'||assignment.status!=='COMPLETED'||!verifyTensorStage(storedTask,assignment.result))return json({success:false,error:"TENSOR_ALREADY_COMPLETED"},409);
        await enqueueTensorNext(db,storedTask,assignment.result,nodeId);
        return json({success:true,verified:true,taskStatus:"COMPLETED",taskId,idempotent:true});
      }
    }else if (storedTask?.type === "gpu-u32-mix") verified = verifyPortableGpuResult(storedTask,result);
    else if (storedTask && isNnInferType(storedTask.type)) verified = verifyNnInferResult(storedTask,result);
    else if (result.executed_on === "WebGL2") verified = false;
  }
  const ok = body.status !== "FAILED" && verified;
  const assignmentStatus = ok ? "COMPLETED" : "FAILED";
  const { error: updErr } = await db.from("compute_mesh_assignments").update({
    status: assignmentStatus,
    progress: ok ? 100 : Number(body.progress || assignment.progress || 0),
    result:tensorTask?{...result,lease_generation:tensorTask.payload.lease_generation}:result,
    updated_at: new Date().toISOString(),
  }).eq("id", assignment.id);
  if (updErr) return json({ success: false, error: updErr.message }, 500);

  const taskStatus = ok ? "COMPLETED" : "FAILED";
  const taskPatch: Record<string, unknown> = {
    status: taskStatus,
    updated_at: new Date().toISOString(),
  };
  // Results belong to assignments; compute_mesh_tasks has no result column.
  let completionQuery=db.from("compute_mesh_tasks").update(taskPatch).eq("task_id",taskId);
  if(tensorTask)completionQuery=completionQuery.eq("payload->>lease_generation",tensorTask.payload.lease_generation).in("status",["QUEUED","RUNNING"]);
  const {data:completedRows,error:taskError}=await completionQuery.select("task_id");
  if(taskError)return json({success:false,error:"TASK_STATUS_WRITE_FAILED",taskId},500);
  if(tensorTask&&!completedRows?.length)return json({success:false,error:"TENSOR_LEASE_MISMATCH"},409);
  await db.from("compute_mesh_nodes").update({
    status: "READY",
    available: true,
    updated_at: new Date().toISOString(),
  }).eq("node_id", nodeId);

  const nextStage=ok&&tensorTask?await enqueueTensorNext(db,tensorTask,result,nodeId):null;
  return json({
    success: ok,
    type: "task.result",
    assignmentId: assignment.id,
    taskId,
    taskStatus,
    verified: ok,
    completedAssignments: ok ? 1 : 0,
    requiredAssignments: 1,
    nextStage,
  });
}

async function evidence(body: Record<string, unknown>) {
  const taskId = String(pick(body, ["taskId", "task_id"]) || "");
  const [{ data: tasks }, { data: assignments }, { data: nodes }] = await Promise.all([
    db.from("compute_mesh_tasks").select("*").eq("task_id", taskId),
    db.from("compute_mesh_assignments").select("*").eq("task_id", taskId),
    db.from("compute_mesh_nodes").select("*").order("last_seen", { ascending: false }).limit(20),
  ]);
  return json({ success: true, type: "mesh.evidence", tasks, assignments, nodes });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "method" }, 405);
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "bad_json" }, 400);
  }
  const type = String(body.type || "");
  try {
    if(type==="pipeline.start"){const r=await tensorPipelineStart(db);return json(r.body,r.status);}
    if(type==="pipeline.status"){const r=await tensorPipelineStatus(db,String(body.pipeline_id||""));return json(r.body,r.status);}
    if(type==="enterprise.status")return json({success:true,access:"CLOSED",pricing:"UNSET",billing_enabled:false,required:["validated first-party video model","real cross-device GPU execution","tenant and node authentication","capacity/SLA validation","owner commercial approval"],available_for_rental:false});
    if(type==="enterprise.submit")return json({success:false,error:"ENTERPRISE_RENTAL_NOT_ENABLED"},403);
    if (type === "node.register") return await registerNode(body, req);
    if (type === "node.heartbeat") return await heartbeat(body, req);
    if (type === "node.capability") return await heartbeat(body, req);
    if (type === "task.create") return await createTask(body);
    if (type === "task.request") return await requestTask(body);
    if (type === "task.progress") return await taskProgress(body);
    if (type === "task.result" || type === "task.completion") return await taskResult(body);
    if (type === "task.failure") return await taskResult({ ...body, status: "FAILED" });
    if (type === "mesh.pool") return await poolStatus();
    if (type === "mesh.status") return json(await meshStatus());
    if (type === "mesh.evidence") return await evidence(body);
    return json({ success: false, error: "Unknown message type", received: type }, 400);
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

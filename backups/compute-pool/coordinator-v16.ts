// AIVAULT Compute Coordinator
// Minimal lifecycle fix: real assignment row, no COMPLETED without verified WebGPU result.
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

async function registerNode(body: Record<string, unknown>) {
  const node = (body.node && typeof body.node === "object" ? body.node : body) as Record<string, unknown>;
  const nodeId = String(pick(node, ["node_id", "id"]) || pick(body, ["nodeId", "node_id"]) || "");
  if (!nodeId) return json({ success: false, error: "node.id required" }, 400);
  const recognized = await recognize(node);
  const row = {
    node_id: nodeId,
    status: String(node.status || "READY"),
    available: node.available !== false,
    gpu: node.gpu === true || node.gpu === "true",
    capability: {
      ...(typeof node.capability === "object" && node.capability ? node.capability as object : {}),
      aivault_compute_capability: recognized,
    },
    platform: node.platform ?? null,
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

async function heartbeat(body: Record<string, unknown>) {
  const nodeId = String(pick(body, ["nodeId", "node_id"]) || "");
  if (!nodeId) return json({ success: false, error: "nodeId required" }, 400);
  const recognized = await recognize(body);
  const patch: Record<string, unknown> = {
    last_seen: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: String(body.status || "READY"),
    available: body.available !== false,
    gpu: body.gpu !== false,
  };
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

async function createTask(body: Record<string, unknown>) {
  const task = (body.task && typeof body.task === "object" ? body.task : body) as Record<string, unknown>;
  const taskId = String(pick(task, ["id", "task_id"]) || "");
  if (!taskId) return json({ success: false, error: "task.id required" }, 400);
  const elements = Number(task.elements ?? ((task.payload as Record<string, unknown> | undefined)?.elements ?? 0));
  const iterations = Number(task.iterations ?? task.iters ?? 1);
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
  if (body.gpu_available === false || node.gpu !== true) {
    return json({ success: false, error: "no gpu worker" });
  }

  const { data: waiting, error: waitErr } = await db
    .from("compute_mesh_tasks")
    .select("*")
    .eq("status", "WAITING")
    .order("created_at", { ascending: true })
    .limit(5);
  if (waitErr) return json({ success: false, error: waitErr.message }, 500);
  const task = (waiting || []).find((row) => {
    const payload = row.payload || {};
    return payload.gpu_required !== false;
  });
  if (!task) return json({ success: false, error: "no available task" });

  const { data: existing, error: existErr } = await db
    .from("compute_mesh_assignments")
    .select("*")
    .eq("task_id", task.task_id)
    .eq("node_id", nodeId)
    .in("status", ["ASSIGNED", "RECEIVED", "RUNNING", "COMPLETED"])
    .maybeSingle();
  if (existErr) return json({ success: false, error: existErr.message }, 500);

  let assignment = existing;
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
      return json({
        success: false,
        error: "assignment insert failed",
        detail: insErr.message,
      }, 500);
    }
    assignment = created;
  }

  await db.from("compute_mesh_tasks").update({
    status: "ASSIGNED",
    updated_at: new Date().toISOString(),
  }).eq("task_id", task.task_id).eq("status", "WAITING");
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
    await db.from("compute_mesh_tasks").update({
      status: "RUNNING",
      updated_at: new Date().toISOString(),
    }).eq("task_id", taskId).in("status", ["WAITING", "ASSIGNED", "RUNNING"]);
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
    await db.from("compute_mesh_tasks").update({
      status: "FAILED",
      updated_at: new Date().toISOString(),
    }).eq("task_id", taskId).neq("status", "COMPLETED");
    return json({
      success: false,
      error: "assignment missing; refusing COMPLETED",
      taskId,
      taskStatus: "FAILED",
      verified: false,
    }, 409);
  }

  const ok = body.status !== "FAILED" && resultVerified(result);
  const assignmentStatus = ok ? "COMPLETED" : "FAILED";
  const { error: updErr } = await db.from("compute_mesh_assignments").update({
    status: assignmentStatus,
    progress: ok ? 100 : Number(body.progress || assignment.progress || 0),
    result,
    updated_at: new Date().toISOString(),
  }).eq("id", assignment.id);
  if (updErr) return json({ success: false, error: updErr.message }, 500);

  const taskStatus = ok ? "COMPLETED" : "FAILED";
  const taskPatch: Record<string, unknown> = {
    status: taskStatus,
    updated_at: new Date().toISOString(),
  };
  if (ok) taskPatch.result = result;
  await db.from("compute_mesh_tasks").update(taskPatch).eq("task_id", taskId);
  await db.from("compute_mesh_nodes").update({
    status: "READY",
    available: true,
    updated_at: new Date().toISOString(),
  }).eq("node_id", nodeId);

  return json({
    success: ok,
    type: "task.result",
    assignmentId: assignment.id,
    taskId,
    taskStatus,
    verified: ok,
    completedAssignments: ok ? 1 : 0,
    requiredAssignments: 1,
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
    if (type === "node.register") return await registerNode(body);
    if (type === "node.heartbeat") return await heartbeat(body);
    if (type === "node.capability") return await heartbeat(body);
    if (type === "task.create") return await createTask(body);
    if (type === "task.request") return await requestTask(body);
    if (type === "task.progress") return await taskProgress(body);
    if (type === "task.result" || type === "task.completion") return await taskResult(body);
    if (type === "task.failure") return await taskResult({ ...body, status: "FAILED" });
    if (type === "mesh.status") return json(await meshStatus());
    if (type === "mesh.evidence") return await evidence(body);
    return json({ success: false, error: "Unknown message type", received: type }, 400);
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

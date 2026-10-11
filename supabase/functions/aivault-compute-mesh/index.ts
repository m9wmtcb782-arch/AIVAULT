// ============================================================
// AIVAULT Compute Mesh v0.1
// Edge Function
//
// File:
// supabase/functions/aivault-compute-mesh/index.ts
//
// Supported actions:
//
// POST /aivault-compute-mesh
//
// {
//   "action": "register"
// }
//
// {
//   "action": "heartbeat"
// }
//
// {
//   "action": "pause"
// }
//
// {
//   "action": "resume"
// }
//
// {
//   "action": "claim-task"
// }
//
// {
//   "action": "submit-result"
// }
//
// Security:
//
// - NEVER executes arbitrary JavaScript
// - NEVER executes Shell
// - NEVER executes remote WASM
// - ONLY accepts fixed compute_test tasks
// - Node identity comes from Supabase Auth
// - Database access uses server-side service role
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, x-aivault-client, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const NODE_OFFLINE_TIMEOUT_MS = 60_000;

const DEFAULT_CONTRIBUTION_LIMIT = 0.01;

const MAX_COMPUTE_TEST_ITERATIONS = 100_000;

const TASK_TYPE = "compute_test";
const TASK_VERSION = 1;


// ============================================================
// Utility
// ============================================================

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: corsHeaders,
    },
  );
}


function nowIso(): string {
  return new Date().toISOString();
}


function isValidUuid(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}


function clampNumber(
  value: unknown,
  min: number,
  max: number,
): number | null {
  if (typeof value !== "number") {
    return null;
  }

  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(min, Math.min(max, value));
}


// ============================================================
// Authentication
// ============================================================

async function getAuthenticatedUser(
  request: Request,
) {
  const authorization =
    request.headers.get("Authorization");

  if (!authorization) {
    return {
      user: null,
      error: "Missing Authorization header",
    };
  }

  const token = authorization.replace(
    /^Bearer\s+/i,
    "",
  ).trim();

  if (!token) {
    return {
      user: null,
      error: "Missing access token",
    };
  }

  const {
    data,
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user || data.user.is_anonymous === true) {
    return {
      user: null,
      error: "Invalid authentication token",
    };
  }

  return {
    user: data.user,
    error: null,
  };
}


// ============================================================
// Node lookup
// ============================================================

class NodeRequestError extends Error {
  constructor(message: string, public status: number = 400) { super(message); }
}

async function getNodeForUser(userId: string, body: any = {}) {
  const nodeId = body.node_id;
  if (nodeId !== undefined && !isValidUuid(nodeId)) {
    throw new NodeRequestError("Invalid node_id");
  }
  let query = supabaseAdmin.from("aivault_compute_nodes").select("*").eq("user_id", userId);
  if (nodeId !== undefined) {
    const { data, error } = await query.eq("id", nodeId).maybeSingle();
    if (error) throw new Error("Failed to load compute node");
    return data;
  }
  // Legacy callers remain usable only when their account has at most one node.
  // Never silently select another device when multiple nodes are registered.
  const { data, error } = await query.limit(2);
  if (error) throw new Error("Failed to load compute nodes");
  if (data && data.length > 1) throw new NodeRequestError("NODE_ID_REQUIRED_FOR_MULTIPLE_DEVICES");
  return data?.[0] ?? null;
}


// ============================================================
// Register Node
// ============================================================

async function registerNode(
  userId: string,
  body: any,
) {
  const cpuThreads =
    typeof body.cpu_threads === "number"
      ? Math.max(
          1,
          Math.min(256, Math.floor(body.cpu_threads)),
        )
      : null;

  const deviceMemory =
    typeof body.device_memory_gb === "number"
      ? Math.max(
          0,
          Math.min(1024, body.device_memory_gb),
        )
      : null;

  const batteryLevel = clampNumber(
    body.battery_level,
    0,
    100,
  );

  const webglSupported =
    body.webgl_supported === true;

  const webgpuSupported =
    body.webgpu_supported === true;

  const charging =
    body.charging === true
      ? true
      : body.charging === false
      ? false
      : null;

  const nodeName =
    typeof body.node_name === "string"
      ? body.node_name.slice(0, 100)
      : null;

  const platform =
    typeof body.platform === "string"
      ? body.platform.slice(0, 100)
      : null;

  const browser =
    typeof body.browser === "string"
      ? body.browser.slice(0, 100)
      : null;

  const browserVersion =
    typeof body.browser_version === "string"
      ? body.browser_version.slice(0, 100)
      : null;

  const now = nowIso();

  const existing = await getNodeForUser(userId, body);

  if (existing) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("aivault_compute_nodes")
      .update({
        node_name: nodeName,
        platform,
        browser,
        browser_version: browserVersion,
        cpu_threads: cpuThreads,
        device_memory_gb: deviceMemory,
        webgl_supported: webglSupported,
        webgpu_supported: webgpuSupported,
        battery_level: batteryLevel,
        charging,
        contribution_limit:
          DEFAULT_CONTRIBUTION_LIMIT,
        status:
          existing.paused_by_user
            ? "paused"
            : "online",
        last_heartbeat_at: now,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Failed to update node: ${error.message}`,
      );
    }

    await recordNodeEvent(
      data.id,
      "node_registered",
      {
        platform,
        browser,
        cpu_threads: cpuThreads,
        webgpu_supported: webgpuSupported,
      },
    );

    return data;
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("aivault_compute_nodes")
    .insert({
      ...(body.node_id ? { id: body.node_id } : {}),
      user_id: userId,
      node_name: nodeName,
      platform,
      browser,
      browser_version: browserVersion,
      cpu_threads: cpuThreads,
      device_memory_gb: deviceMemory,
      webgl_supported: webglSupported,
      webgpu_supported: webgpuSupported,
      battery_level: batteryLevel,
      charging,
      contribution_limit:
        DEFAULT_CONTRIBUTION_LIMIT,
      status: "online",
      paused_by_user: false,
      last_heartbeat_at: now,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") throw new NodeRequestError("NODE_ID_CONFLICT", 409);
    throw new Error("Node registration failed");
  }

  await recordNodeEvent(
    data.id,
    "node_registered",
    {
      platform,
      browser,
      cpu_threads: cpuThreads,
      webgpu_supported: webgpuSupported,
    },
  );

  return data;
}


// ============================================================
// Heartbeat
// ============================================================

async function heartbeat(
  userId: string,
  body: any,
) {
  const node = await getNodeForUser(userId, body);

  if (!node) {
    throw new Error(
      "Compute node not registered",
    );
  }

  const batteryLevel = clampNumber(
    body.battery_level,
    0,
    100,
  );

  const charging =
    body.charging === true
      ? true
      : body.charging === false
      ? false
      : node.charging;

  const now = nowIso();

  let nextStatus = node.status;

  // Low battery protection.
  //
  // We do NOT attempt to bypass the browser or OS.
  // Node simply becomes paused.
  if (
    batteryLevel !== null &&
    batteryLevel <= 10 &&
    charging !== true
  ) {
    nextStatus = "paused";
  } else if (
    node.paused_by_user
  ) {
    nextStatus = "paused";
  } else {
    nextStatus = "online";
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("aivault_compute_nodes")
    .update({
      battery_level:
        batteryLevel !== null
          ? batteryLevel
          : node.battery_level,

      charging,

      status: nextStatus,

      last_heartbeat_at: now,

      updated_at: now,
    })
    .eq("id", node.id)
    .select()
    .single();

  if (error) {
    throw new Error(
      `Heartbeat failed: ${error.message}`,
    );
  }

  return {
    node_id: data.id,
    status: data.status,
    paused_by_user:
      data.paused_by_user,
    battery_level:
      data.battery_level,
    server_time: now,
  };
}


// ============================================================
// Pause Node
// ============================================================

async function pauseNode(
  userId: string,
  body: any,
) {
  const node = await getNodeForUser(userId, body);

  if (!node) {
    throw new Error(
      "Compute node not registered",
    );
  }

  const now = nowIso();

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("aivault_compute_nodes")
    .update({
      paused_by_user: true,
      status: "paused",
      updated_at: now,
    })
    .eq("id", node.id)
    .select()
    .single();

  if (error) {
    throw new Error(
      `Failed to pause node: ${error.message}`,
    );
  }

  await recordNodeEvent(
    node.id,
    "node_paused",
    {
      source: "user",
    },
  );

  return {
    node_id: data.id,
    status: data.status,
    paused_by_user: true,
  };
}


// ============================================================
// Resume Node
// ============================================================

async function resumeNode(
  userId: string,
  body: any,
) {
  const node = await getNodeForUser(userId, body);

  if (!node) {
    throw new Error(
      "Compute node not registered",
    );
  }

  // Safety:
  // If battery is <= 10% and not charging,
  // do not allow resume.
  if (
    node.battery_level !== null &&
    node.battery_level <= 10 &&
    node.charging !== true
  ) {
    return {
      node_id: node.id,
      status: "paused",
      paused_by_user: true,
      reason:
        "Battery too low. Charge device before resuming.",
    };
  }

  const now = nowIso();

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("aivault_compute_nodes")
    .update({
      paused_by_user: false,
      status: "online",
      last_heartbeat_at: now,
      updated_at: now,
    })
    .eq("id", node.id)
    .select()
    .single();

  if (error) {
    throw new Error(
      `Failed to resume node: ${error.message}`,
    );
  }

  await recordNodeEvent(
    node.id,
    "node_resumed",
    {
      source: "user",
    },
  );

  return {
    node_id: data.id,
    status: data.status,
    paused_by_user: false,
  };
}


// ============================================================
// Create Compute Test Task
// ============================================================
//
// This is intentionally fixed.
//
// The node NEVER supplies executable code.
//
// ============================================================

async function createComputeTestTask() {
  const iterations = 10_000;

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("aivault_compute_tasks")
    .insert({
      task_type: TASK_TYPE,
      task_version: TASK_VERSION,
      status: "queued",
      payload: {
        operation: "sha256_test",
        iterations,
      },
      attempt_count: 0,
      max_attempts: 3,
    })
    .select()
    .single();

  if (error) {
    throw new Error(
      `Failed to create task: ${error.message}`,
    );
  }

  return data;
}


// ============================================================
// Claim Task
// ============================================================
//
// v0.1 uses a conservative query/update flow.
//
// Later version:
// atomic PostgreSQL leasing RPC.
//
// ============================================================

async function claimTask(
  userId: string,
  body: any,
) {
  const node = await getNodeForUser(userId, body);

  if (!node) {
    throw new Error(
      "Compute node not registered",
    );
  }

  // User paused node.
  if (node.paused_by_user) {
    return {
      task: null,
      status: "paused",
    };
  }

  // Battery safety.
  if (
    node.battery_level !== null &&
    node.battery_level <= 10 &&
    node.charging !== true
  ) {
    await supabaseAdmin
      .from("aivault_compute_nodes")
      .update({
        status: "paused",
        updated_at: nowIso(),
      })
      .eq("id", node.id);

    return {
      task: null,
      status: "paused",
      reason: "Battery too low",
    };
  }

  // Requeue expired tasks before assigning a new one.
  await requeueExpiredTasks();

  // Find one queued task.
  const {
    data: tasks,
    error: taskError,
  } = await supabaseAdmin
    .from("aivault_compute_tasks")
    .select("*")
    .eq("status", "queued")
    .eq("task_type", TASK_TYPE)
    .eq("task_version", TASK_VERSION)
    .order("queued_at", {
      ascending: true,
    })
    .limit(1);

  if (taskError) {
    throw new Error(
      `Failed to load queued task: ${taskError.message}`,
    );
  }

  let task = tasks?.[0] ?? null;

  // For testing, automatically create one task.
  if (!task) {
    task = await createComputeTestTask();
  }

  const leaseToken = crypto.randomUUID();

  const leaseStarted =
    new Date();

  const leaseExpires =
    new Date(
      leaseStarted.getTime() + 30_000,
    );

  const {
    data: leasedTask,
    error: leaseError,
  } = await supabaseAdmin
    .from("aivault_compute_tasks")
    .update({
      status: "leased",
      assigned_node_id: node.id,
      lease_token: leaseToken,
      lease_started_at:
        leaseStarted.toISOString(),
      lease_expires_at:
        leaseExpires.toISOString(),
      attempt_count:
        (task.attempt_count ?? 0) + 1,
      started_at:
        leaseStarted.toISOString(),
      updated_at: nowIso(),
    })
    .eq("id", task.id)
    .eq("status", "queued")
    .select()
    .maybeSingle();

  if (leaseError) {
    throw new Error(
      `Failed to lease task: ${leaseError.message}`,
    );
  }

  if (!leasedTask) {
    return {
      task: null,
      status: "no_task",
    };
  }

  await supabaseAdmin
    .from("aivault_compute_nodes")
    .update({
      status: "busy",
      updated_at: nowIso(),
    })
    .eq("id", node.id);

  await recordNodeEvent(
    node.id,
    "task_leased",
    {
      task_id: leasedTask.id,
      lease_expires_at:
        leasedTask.lease_expires_at,
    },
  );

  return {
    task: {
      id: leasedTask.id,
      task_type: leasedTask.task_type,
      task_version:
        leasedTask.task_version,
      payload: leasedTask.payload,

      // The node needs this token when returning.
      lease_token:
        leasedTask.lease_token,

      lease_expires_at:
        leasedTask.lease_expires_at,
    },

    status: "leased",
  };
}


// ============================================================
// Submit Result
// ============================================================

async function submitResult(
  userId: string,
  body: any,
) {
  const node = await getNodeForUser(userId, body);

  if (!node) {
    throw new Error(
      "Compute node not registered",
    );
  }

  const taskId = body.task_id;

  const leaseToken =
    body.lease_token;

  if (!isValidUuid(taskId)) {
    throw new Error(
      "Invalid task_id",
    );
  }

  if (!isValidUuid(leaseToken)) {
    throw new Error(
      "Invalid lease_token",
    );
  }

  if (
    typeof body.result_sha256 !== "string"
  ) {
    throw new Error(
      "result_sha256 is required",
    );
  }

  const resultSha256 =
    body.result_sha256.trim();

  if (
    !/^[0-9a-fA-F]{64}$/.test(
      resultSha256,
    )
  ) {
    throw new Error(
      "Invalid SHA-256 format",
    );
  }

  const {
    data: task,
    error: taskError,
  } = await supabaseAdmin
    .from("aivault_compute_tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) {
    throw new Error(
      `Failed to load task: ${taskError.message}`,
    );
  }

  if (!task) {
    throw new Error(
      "Task not found",
    );
  }

  // Verify node ownership.
  if (
    task.assigned_node_id !== node.id
  ) {
    throw new Error(
      "Task is not assigned to this node",
    );
  }

  // Verify lease token.
  if (
    task.lease_token !== leaseToken
  ) {
    throw new Error(
      "Invalid lease token",
    );
  }

  // Verify lease expiration.
  if (
    task.lease_expires_at &&
    new Date(task.lease_expires_at)
      .getTime() < Date.now()
  ) {
    await supabaseAdmin
      .from("aivault_compute_tasks")
      .update({
        status: "expired",
        updated_at: nowIso(),
      })
      .eq("id", task.id);

    return {
      accepted: false,
      status: "expired",
      reason:
        "Task lease has expired",
    };
  }

  // Only our fixed task is accepted.
  if (
    task.task_type !== TASK_TYPE ||
    task.task_version !== TASK_VERSION
  ) {
    throw new Error(
      "Unsupported task type",
    );
  }

  const executionMs =
    typeof body.execution_ms === "number"
      ? Math.max(
          0,
          Math.min(
            60_000,
            Math.floor(body.execution_ms),
          ),
        )
      : null;

  // ----------------------------------------------------------
  // Store result
  //
  // v0.1:
  // format verification happens here.
  //
  // True server recomputation is a later security upgrade.
  // ----------------------------------------------------------

  const {
    data: resultRow,
    error: resultError,
  } = await supabaseAdmin
    .from("aivault_compute_results")
    .insert({
      task_id: task.id,
      node_id: node.id,
      result:
        body.result ?? null,
      result_sha256:
        resultSha256,
      execution_ms:
        executionMs,
      verification_status:
        "pending",
    })
    .select()
    .single();

  if (resultError) {
    throw new Error(
      `Failed to store result: ${resultError.message}`,
    );
  }

  // ----------------------------------------------------------
  // v0.1 format verification
  // ----------------------------------------------------------

  const formatValid =
    body.result !== undefined &&
    body.result !== null &&
    typeof body.result === "object";

  if (!formatValid) {
    await supabaseAdmin
      .from("aivault_compute_results")
      .update({
        verification_status:
          "rejected",
        verification_error:
          "Result must be a JSON object",
        verified_at: nowIso(),
      })
      .eq("id", resultRow.id);

    await supabaseAdmin
      .from("aivault_compute_tasks")
      .update({
        status: "failed",
        completed_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq("id", task.id);

    await recordNodeEvent(
      node.id,
      "task_result_rejected",
      {
        task_id: task.id,
        reason:
          "Invalid result format",
      },
    );

    return {
      accepted: false,
      verification_status:
        "rejected",
      task_id: task.id,
    };
  }

  // ----------------------------------------------------------
  // Accept v0.1 result.
  // ----------------------------------------------------------

  await supabaseAdmin
    .from("aivault_compute_results")
    .update({
      verification_status:
        "accepted",
      verified_at: nowIso(),
    })
    .eq("id", resultRow.id);

  await supabaseAdmin
    .from("aivault_compute_tasks")
    .update({
      status: "completed",
      completed_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", task.id);

  // Update node statistics.
  await supabaseAdmin
    .from("aivault_compute_nodes")
    .update({
      status:
        node.paused_by_user
          ? "paused"
          : "online",

      total_tasks_completed:
        (node.total_tasks_completed ?? 0) + 1,

      total_compute_ms:
        (node.total_compute_ms ?? 0) +
        (executionMs ?? 0),

      updated_at: nowIso(),
    })
    .eq("id", node.id);

  await recordNodeEvent(
    node.id,
    "task_completed",
    {
      task_id: task.id,
      execution_ms: executionMs,
    },
  );

  return {
    accepted: true,
    verification_status:
      "accepted",
    task_id: task.id,
    result_id: resultRow.id,
  };
}


// ============================================================
// Requeue Expired Tasks
// ============================================================

async function requeueExpiredTasks() {
  const now = nowIso();

  const {
    data: expiredTasks,
    error,
  } = await supabaseAdmin
    .from("aivault_compute_tasks")
    .select(
      "id, assigned_node_id, attempt_count, max_attempts",
    )
    .in("status", [
      "leased",
      "running",
    ])
    .lt("lease_expires_at", now);

  if (error) {
    console.error(
      "Failed to find expired tasks:",
      error.message,
    );

    return;
  }

  if (!expiredTasks?.length) {
    return;
  }

  for (
    const task of expiredTasks
  ) {
    const attemptCount =
      task.attempt_count ?? 0;

    const maxAttempts =
      task.max_attempts ?? 3;

    if (
      attemptCount >= maxAttempts
    ) {
      await supabaseAdmin
        .from("aivault_compute_tasks")
        .update({
          status: "failed",
          updated_at: now,
        })
        .eq("id", task.id);

      if (task.assigned_node_id) {
        await supabaseAdmin
          .from("aivault_compute_nodes")
          .update({
            status: "online",
            total_tasks_failed:
              undefined,
            updated_at: now,
          })
          .eq(
            "id",
            task.assigned_node_id,
          );
      }

      continue;
    }

    await supabaseAdmin
      .from("aivault_compute_tasks")
      .update({
        status: "queued",
        assigned_node_id: null,
        lease_token: null,
        lease_started_at: null,
        lease_expires_at: null,
        started_at: null,
        queued_at: now,
        updated_at: now,
      })
      .eq("id", task.id)
      .in("status", [
        "leased",
        "running",
      ]);

    if (task.assigned_node_id) {
      await recordNodeEvent(
        task.assigned_node_id,
        "task_lease_expired",
        {
          task_id: task.id,
          requeued: true,
        },
      );

      await supabaseAdmin
        .from("aivault_compute_nodes")
        .update({
          status: "online",
          updated_at: now,
        })
        .eq(
          "id",
          task.assigned_node_id,
        );
    }
  }
}


// ============================================================
// Node Event
// ============================================================

async function recordNodeEvent(
  nodeId: string,
  eventType: string,
  eventData: Record<string, unknown> = {},
) {
  const {
    error,
  } = await supabaseAdmin
    .from("aivault_compute_node_events")
    .insert({
      node_id: nodeId,
      event_type: eventType,
      event_data: eventData,
    });

  if (error) {
    console.error(
      "Failed to record node event:",
      error.message,
    );
  }
}


// ============================================================
// Main Router
// ============================================================

Deno.serve(
  async (request: Request) => {
    if (
      request.method === "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers: corsHeaders,
        },
      );
    }

    if (
      request.method !== "POST"
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Only POST is supported",
        },
        405,
      );
    }

    try {
      const {
        user,
        error: authError,
      } =
        await getAuthenticatedUser(
          request,
        );

      if (!user) {
        return jsonResponse(
          {
            success: false,
            error: authError ??
              "Unauthorized",
          },
          401,
        );
      }

      let body: any;

      try {
        body =
          await request.json();
      } catch {
        return jsonResponse(
          {
            success: false,
            error:
              "Invalid JSON body",
          },
          400,
        );
      }

      const action =
        body?.action;

      if (
        typeof action !==
        "string"
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Missing action",
          },
          400,
        );
      }

      // --------------------------------------------------------
      // REGISTER
      // --------------------------------------------------------

      if (
        action === "register"
      ) {
        const node =
          await registerNode(
            user.id,
            body,
          );

        return jsonResponse({
          success: true,
          action,
          node: {
            id: node.id,
            status:
              node.status,
            contribution_limit:
              node.contribution_limit,
            last_heartbeat_at:
              node.last_heartbeat_at,
          },
        });
      }

      // --------------------------------------------------------
      // HEARTBEAT
      // --------------------------------------------------------

      if (
        action === "heartbeat"
      ) {
        const result =
          await heartbeat(
            user.id,
            body,
          );

        return jsonResponse({
          success: true,
          action,
          ...result,
        });
      }

      // --------------------------------------------------------
      // PAUSE
      // --------------------------------------------------------

      if (
        action === "pause"
      ) {
        const result =
          await pauseNode(
            user.id,
            body,
          );

        return jsonResponse({
          success: true,
          action,
          ...result,
        });
      }

      // --------------------------------------------------------
      // RESUME
      // --------------------------------------------------------

      if (
        action === "resume"
      ) {
        const result =
          await resumeNode(
            user.id,
            body,
          );

        return jsonResponse({
          success: true,
          action,
          ...result,
        });
      }

      // --------------------------------------------------------
      // CLAIM TASK
      // --------------------------------------------------------

      if (
        action === "claim-task"
      ) {
        const result =
          await claimTask(
            user.id,
            body,
          );

        return jsonResponse({
          success: true,
          action,
          ...result,
        });
      }

      // --------------------------------------------------------
      // SUBMIT RESULT
      // --------------------------------------------------------

      if (
        action ===
        "submit-result"
      ) {
        const result =
          await submitResult(
            user.id,
            body,
          );

        return jsonResponse({
          success: true,
          action,
          ...result,
        });
      }

      // --------------------------------------------------------
      // Unknown action
      // --------------------------------------------------------

      return jsonResponse(
        {
          success: false,
          error:
            "Unsupported action",
          supported_actions: [
            "register",
            "heartbeat",
            "pause",
            "resume",
            "claim-task",
            "submit-result",
          ],
        },
        400,
      );
    } catch (error) {
      console.error(
        "AIVAULT Compute Mesh error:",
        error,
      );

      return jsonResponse(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Internal server error",
        },
        error instanceof NodeRequestError ? error.status : 500,
      );
    }
  },
);
import { json } from "../_shared/contract.ts";
import { requireInternal } from "../_shared/auth.ts";
import { serviceClient, snapshotLedger, transition } from "../_shared/db.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  const denied = requireInternal(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const sb = serviceClient();
  const body = await req.json();
  const taskId = body.task_id as string;
  if (!taskId) return json({ error: "task_id_required" }, 400);

  const { data: task, error } = await sb.from("aivault_tasks").select("*").eq("task_id", taskId).single();
  if (error || !task) return json({ error: "task_not_found" }, 404);
  if (task.state !== "executing") return json({ error: "wrong_state", state: task.state }, 409);

  const { data: attempt } = await sb
    .from("aivault_task_attempts")
    .select("*")
    .eq("task_id", taskId)
    .eq("attempt", task.attempt_count)
    .single();
  if (!attempt) return json({ error: "attempt_missing" }, 409);
  if (body.provider_id && body.provider_id !== attempt.provider_id) {
    return json({ error: "provider_mismatch" }, 403);
  }

  const items = body.items;
  if (!Array.isArray(items)) return json({ error: "items_required" }, 400);

  const claimed = Number(body.compute_units_claimed ?? 0);
  if (!Number.isFinite(claimed) || claimed < 0) return json({ error: "claimed_invalid" }, 400);
  const accepted = Math.min(claimed, Number(attempt.reserved_exec));

  const { data: result, error: rerr } = await sb
    .from("aivault_task_results")
    .insert({
      task_id: taskId,
      execution_id: body.execution_id ?? crypto.randomUUID(),
      attempt: task.attempt_count,
      provider_id: attempt.provider_id,
      started_at: body.started_at ?? attempt.started_at,
      finished_at: body.finished_at ?? new Date().toISOString(),
      model_id: body.model_id ?? null,
      model_version: body.model_version ?? null,
      runtime: body.runtime ?? null,
      device_class: body.device_class ?? null,
      input_hash: body.input_hash ?? null,
      items,
      output_hash: body.output_hash ?? null,
      compute_units_claimed: claimed,
      compute_units_accepted: accepted,
      execution_cost_minor: 0,
      retry_count: task.attempt_count - 1,
      capability_snapshot: body.capability_snapshot ?? null,
    })
    .select("*")
    .single();
  if (rerr) return json({ error: rerr.message }, 500);

  await sb.from("aivault_task_attempts").update({
    state: "result_received",
    finished_at: new Date().toISOString(),
    claimed_compute_units: claimed,
    accepted_compute_units: accepted,
  }).eq("attempt_id", attempt.attempt_id);

  const unusedExec = Number(attempt.reserved_exec) - accepted;
  const newReservedExec = accepted;
  const newReserved = Number(task.reserved) - unusedExec;

  const next = await transition(sb, taskId, "executing", "result_received", "result", "ingested", task.attempt_count, {
    reserved: newReserved,
    reserved_exec: newReservedExec,
  });
  await snapshotLedger(sb, next, "result_accepted_units", task.attempt_count);

  return json({ ok: true, task: next, result, compute_units_accepted: accepted });
});

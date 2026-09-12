import { json } from "../_shared/contract.ts";
import { serviceClient, snapshotLedger, transition } from "../_shared/db.ts";
import { selectProvider } from "../_shared/router.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const sb = serviceClient();
  const body = await req.json();
  const taskId = body.task_id as string;
  if (!taskId) return json({ error: "task_id_required" }, 400);

  const { data: task0, error } = await sb.from("aivault_tasks").select("*").eq("task_id", taskId).single();
  if (error || !task0) return json({ error: "task_not_found" }, 404);
  let task = task0;

  if (task.state === "queued") {
    if (task.attempt_count >= task.max_attempts) {
      task = await transition(sb, taskId, "queued", "settlement_blocked", "coordinator", "max_attempts");
      await snapshotLedger(sb, task, "max_attempts_block");
      return json({ ok: true, task, blocked: true });
    }

    const { provider } = await selectProvider(sb, task);
    if (!provider) {
      task = await transition(sb, taskId, "queued", "unmatched_no_provider", "coordinator", "unmatched_no_provider");
      return json({ ok: true, task });
    }

    const n = Number(task.item_count);
    const quoted = Number(provider.quoted_estimate ?? n * Number(provider.reward_units_per_item ?? 8));
    const needExec = Math.min(quoted, n * Number(provider.reward_units_per_item ?? 8));
    const sc = sampleCount(n, Number(task.resample_fraction));
    const needVerify = sc * Number(task.verification_compute_units_per_item);
    const remaining = Number(task.remaining);

    if (needExec + needVerify > remaining) {
      task = await transition(sb, taskId, "queued", "settlement_blocked", "coordinator", "insufficient_remaining");
      await snapshotLedger(sb, task, "retry_blocked_budget", task.attempt_count);
      return json({ ok: true, task, blocked: true, need_exec: needExec, need_verify: needVerify, remaining });
    }

    const attemptNo = Number(task.attempt_count) + 1;
    const reservedExec = needExec;
    const reservedVerify = needVerify;
    const newReserved = Number(task.reserved) + reservedExec + reservedVerify;

    const { data: attempt, error: aerr } = await sb
      .from("aivault_task_attempts")
      .insert({
        task_id: taskId,
        attempt: attemptNo,
        provider_id: provider.provider_id,
        capability_id: provider.capability_id,
        state: "matched",
        quoted_estimate: quoted,
        need_exec: needExec,
        need_verify: needVerify,
        reserved_exec: reservedExec,
        reserved_verify: reservedVerify,
      })
      .select("*")
      .single();
    if (aerr) return json({ error: aerr.message }, 500);

    task = await transition(sb, taskId, "queued", "matched", "coordinator", "matched", attemptNo, {
      reserved: newReserved,
      reserved_exec: reservedExec,
      reserved_verify: reservedVerify,
      attempt_count: attemptNo,
    });
    await snapshotLedger(sb, task, "reserve_before_dispatch", attemptNo);

    task = await transition(sb, taskId, "matched", "accepted", "coordinator", "auto_accept", attemptNo);
    task = await transition(sb, taskId, "accepted", "executing", "coordinator", "dispatch", attemptNo);

    await sb.from("aivault_task_attempts").update({
      state: "executing",
      accepted_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
    }).eq("attempt_id", attempt.attempt_id);

    return json({
      ok: true,
      task,
      attempt,
      dispatch: {
        provider_id: provider.provider_id,
        items: task.items,
        reserved_exec: reservedExec,
        reserved_verify: reservedVerify,
      },
    });
  }

  if (body.action === "timeout_exec" && task.state === "executing") {
    task = await transition(sb, taskId, "executing", "exec_timeout", "coordinator", "exec_timeout");
    const rel = Number(task.reserved);
    task = await sb.from("aivault_tasks").update({
      reserved: 0,
      reserved_exec: 0,
      reserved_verify: 0,
      updated_at: new Date().toISOString(),
    }).eq("task_id", taskId).select("*").single().then((r) => r.data);
    await snapshotLedger(sb, task!, "release_on_timeout");
    if (task!.attempt_count < task!.max_attempts && Number(task!.remaining) > 0) {
      task = await transition(sb, taskId, "exec_timeout", "queued", "coordinator", "retry");
    } else {
      task = await transition(sb, taskId, "exec_timeout", "settlement_blocked", "coordinator", "no_retry_budget");
    }
    return json({ ok: true, task });
  }

  return json({ ok: true, task, note: "no_action_for_state" });
});

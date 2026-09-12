import { json, sampleCount } from "../_shared/contract.ts";
import { requireInternal } from "../_shared/auth.ts";
import { serviceClient, snapshotLedger, transition } from "../_shared/db.ts";
import { selectProvider } from "../_shared/router.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  const denied = requireInternal(req);
  if (denied) return denied;
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

    const { data: reserved, error: rerr } = await sb.rpc("aivault_reserve_attempt", {
      p_task_id: taskId,
      p_provider_id: provider.provider_id,
      p_capability_id: provider.capability_id,
      p_quoted: quoted,
      p_need_exec: needExec,
      p_need_verify: needVerify,
    });
    if (rerr) return json({ error: rerr.message }, 500);

    if (!reserved?.ok) {
      if (reserved?.block || reserved?.reason === "insufficient_remaining" || reserved?.reason === "max_attempts") {
        if (task.state === "queued") {
          task = await transition(sb, taskId, "queued", "settlement_blocked", "coordinator", reserved.reason);
          await snapshotLedger(sb, task, reserved.reason);
        }
        return json({ ok: true, task, blocked: true, reserve: reserved });
      }
      return json({ ok: false, reserve: reserved }, 409);
    }

    const attempt = reserved.attempt;
    task = await transition(sb, taskId, "matched", "accepted", "coordinator", "auto_accept", attempt.attempt);
    task = await transition(sb, taskId, "accepted", "executing", "coordinator", "dispatch", attempt.attempt);

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
        reserved_exec: needExec,
        reserved_verify: needVerify,
      },
    });
  }

  if (body.action === "timeout_exec" && task.state === "executing") {
    task = await transition(sb, taskId, "executing", "exec_timeout", "coordinator", "exec_timeout");
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

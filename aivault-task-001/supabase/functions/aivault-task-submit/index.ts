import { CONTRACT, ROUTER, TASK_TYPE, defaultBudget, json, validateItems } from "../_shared/contract.ts";
import { emitEvent, serviceClient } from "../_shared/db.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const sb = serviceClient();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (body.task_id || body.deadline_at || body.state || body.created_at) {
    return json({ error: "client_must_not_supply_system_fields", reason_code: "rejected_invalid_contract" }, 400);
  }
  if (body.task_type && body.task_type !== TASK_TYPE) {
    return json({ error: "unsupported_task_type" }, 400);
  }
  if (body.contract_version && body.contract_version !== CONTRACT) {
    return json({ error: "unsupported_contract" }, 400);
  }

  const v = validateItems(body.items);
  if (!v.ok) {
    return json({ error: "rejected_invalid_contract", reason_code: v.reason }, 400);
  }

  const n = v.items.length;
  let budget = typeof body.max_compute_units === "number" ? (body.max_compute_units as number) : defaultBudget(n);
  if (!Number.isInteger(budget) || budget < n * 10) {
    return json({ error: "rejected_invalid_contract", reason_code: "max_compute_units_too_small" }, 400);
  }

  const payerId = (body.payer_id as string) || "anonymous-research";
  const deadline = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const allowed = v.items[0].allowed_labels;

  const { data: task, error } = await sb
    .from("aivault_tasks")
    .insert({
      task_type: TASK_TYPE,
      contract_version: CONTRACT,
      router_version: ROUTER,
      payer_id: payerId,
      state: "submitted",
      items: v.items,
      item_count: n,
      allowed_labels: allowed,
      max_compute_units: budget,
      spent: 0,
      reserved: 0,
      reserved_exec: 0,
      reserved_verify: 0,
      max_attempts: 3,
      verification_mode: body.verification_mode === "dual_model" ? "dual_model" : "resample",
      resample_fraction: typeof body.resample_fraction === "number" ? body.resample_fraction : 0.1,
      require_different_provider: body.require_different_provider !== false,
      deadline_at: deadline,
      research_currency: true,
      max_currency_minor: 0,
      metadata: body.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) return json({ error: "insert_failed", detail: error.message }, 500);

  await emitEvent(sb, task.task_id, null, "submitted", "submit", "created");

  const { error: e2 } = await sb.from("aivault_tasks").update({ state: "contract_validated", updated_at: new Date().toISOString() }).eq("task_id", task.task_id);
  if (e2) return json({ error: e2.message }, 500);
  await emitEvent(sb, task.task_id, "submitted", "contract_validated", "submit", "contract_ok");

  const { error: e3 } = await sb.from("aivault_tasks").update({ state: "queued", updated_at: new Date().toISOString() }).eq("task_id", task.task_id);
  if (e3) return json({ error: e3.message }, 500);
  await emitEvent(sb, task.task_id, "contract_validated", "queued", "submit", "enqueued");

  const { data: ready } = await sb.from("aivault_tasks").select("*").eq("task_id", task.task_id).single();
  return json({ ok: true, task: ready });
});

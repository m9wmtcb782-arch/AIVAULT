import { json, sampleCount } from "../_shared/contract.ts";
import { serviceClient } from "../_shared/db.ts";
import { selectProvider } from "../_shared/router.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  const sb = serviceClient();
  const body = await req.json();
  const taskId = body.task_id as string;
  const { data: task, error } = await sb.from("aivault_tasks").select("*").eq("task_id", taskId).single();
  if (error || !task) return json({ error: "task_not_found" }, 404);
  const result = await selectProvider(sb, task);
  return json({
    ok: true,
    ...result,
    need_verify: sampleCount(task.item_count, Number(task.resample_fraction)) * Number(task.verification_compute_units_per_item),
  });
});

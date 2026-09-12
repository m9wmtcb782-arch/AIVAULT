import { OWN_VERIFIER_MODEL, json, ownWeightClassify, sampleCount } from "../_shared/contract.ts";
import { requireInternal } from "../_shared/auth.ts";
import { recomputeContentHash } from "../_shared/hash.ts";
import { serviceClient, snapshotLedger, transition } from "../_shared/db.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  const denied = requireInternal(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const sb = serviceClient();
  const body = await req.json();
  const taskId = body.task_id as string;
  const { data: task, error } = await sb.from("aivault_tasks").select("*").eq("task_id", taskId).single();
  if (error || !task) return json({ error: "task_not_found" }, 404);

  let current = task;
  if (current.state === "result_received") {
    current = await transition(sb, taskId, "result_received", "verifying", "verify", "start", current.attempt_count);
  }
  if (current.state !== "verifying") return json({ error: "wrong_state", state: current.state }, 409);

  const { data: result } = await sb
    .from("aivault_task_results")
    .select("*")
    .eq("task_id", taskId)
    .eq("attempt", current.attempt_count)
    .single();
  if (!result) return json({ error: "result_missing" }, 409);

  const inputItems = current.items as Array<{ item_id: string; image_uri: string; content_hash: string; allowed_labels: string[] }>;
  const outItems = result.items as Array<{ item_id: string; label?: string; confidence?: number; content_hash?: string }>;
  const map = new Map(outItems.map((x) => [x.item_id, x]));

  const sc = sampleCount(inputItems.length, Number(current.resample_fraction));
  const sampled = inputItems.slice(0, sc);
  let hashOk = true;
  let schemaOk = true;
  let labelOk = true;
  let confOk = true;
  let agree = 0;

  const details: unknown[] = [];
  for (const it of sampled) {
    const out = map.get(it.item_id);
    let recomputed = "";
    let hashMatch = false;
    try {
      recomputed = await recomputeContentHash(it.image_uri);
      hashMatch = recomputed === it.content_hash;
    } catch (e) {
      hashMatch = false;
      details.push({ item_id: it.item_id, hash_error: String(e) });
    }
    if (!hashMatch) hashOk = false;
    if (!out || typeof out.label !== "string" || typeof out.confidence !== "number") schemaOk = false;
    const allowed = it.allowed_labels;
    if (out && (!allowed.includes(out.label as string))) labelOk = false;
    if (out && Number(out.confidence) < Number(current.min_confidence)) confOk = false;
    const own = ownWeightClassify(it.content_hash, allowed);
    const matchLabel = out && out.label === own.label;
    if (matchLabel) agree += 1;
    details.push({ item_id: it.item_id, hashMatch, recomputed, expected: it.content_hash, own, provider: out ?? null, matchLabel });
  }
  const ratio = sampled.length ? agree / sampled.length : 0;
  const pass =
    hashOk &&
    schemaOk &&
    labelOk &&
    confOk &&
    ratio >= Number(current.resample_agree_ratio_threshold);

  const verifyUnits = sc * Number(current.verification_compute_units_per_item);

  await sb.from("aivault_task_verifications").insert({
    task_id: taskId,
    attempt: current.attempt_count,
    mode: current.verification_mode,
    sample_count: sc,
    sampled_item_ids: sampled.map((s) => s.item_id),
    content_hash_match: hashOk,
    schema_valid: schemaOk,
    label_in_allowed: labelOk,
    min_confidence_ok: confOk,
    resample_agree_ratio: ratio,
    verification_status: pass ? "verified_passed" : "verified_failed",
    verification_compute_units: verifyUnits,
    verifier_model: OWN_VERIFIER_MODEL,
    details,
  });

  const spentAdd = verifyUnits + Number(current.reserved_exec);
  const nextSpent = Number(current.spent) + spentAdd;

  const extra = {
    spent: nextSpent,
    reserved: 0,
    reserved_exec: 0,
    reserved_verify: 0,
  };

  const nextState = pass ? "verified_passed" : "verified_failed";
  const next = await transition(sb, taskId, "verifying", nextState, "verify", pass ? "quality_pass" : "quality_fail", current.attempt_count, extra);
  await snapshotLedger(sb, next, "verification_accounted", current.attempt_count);

  await sb.from("aivault_task_results").update({
    verification_status: nextState,
    verification_score: ratio,
    verification_compute_units: verifyUnits,
    failure_reason: pass ? null : "verified_failed",
  }).eq("result_id", result.result_id);

  if (!pass && next.attempt_count < next.max_attempts) {
    const remaining = next.max_compute_units - next.spent - next.reserved;
    if (remaining > 0) {
      const queued = await transition(sb, taskId, "verified_failed", "queued", "verify", "retry", next.attempt_count);
      return json({ ok: true, task: queued, passed: false, ratio, verifyUnits, retry: true });
    }
    const blocked = await transition(sb, taskId, "verified_failed", "settlement_blocked", "verify", "insufficient_remaining", next.attempt_count);
    return json({ ok: true, task: blocked, passed: false, ratio, verifyUnits, retry: false });
  }

  return json({ ok: true, task: next, passed: pass, ratio, verifyUnits, hashOk, schemaOk, labelOk, confOk });
});

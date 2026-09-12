import { PROVIDER_REWARD_PER_PASSED, VERIFIER_UNITS_PER_SAMPLED, json } from "../_shared/contract.ts";
import { serviceClient, snapshotLedger, transition } from "../_shared/db.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const sb = serviceClient();
  const body = await req.json();
  const taskId = body.task_id as string;
  const { data: task, error } = await sb.from("aivault_tasks").select("*").eq("task_id", taskId).single();
  if (error || !task) return json({ error: "task_not_found" }, 404);

  if (task.state === "settlement_blocked") {
    const closed = await transition(sb, taskId, "settlement_blocked", "closed", "settle", "blocked_close");
    return json({ ok: true, task: closed, settled: false });
  }
  if (task.state !== "verified_passed") {
    return json({ error: "settlement_only_on_verified_passed", state: task.state }, 409);
  }

  const { data: result } = await sb
    .from("aivault_task_results")
    .select("*")
    .eq("task_id", taskId)
    .eq("attempt", task.attempt_count)
    .single();
  const { data: ver } = await sb
    .from("aivault_task_verifications")
    .select("*")
    .eq("task_id", taskId)
    .eq("attempt", task.attempt_count)
    .single();

  const passedItems = Number(task.item_count);
  const sampled = Number(ver?.sample_count ?? 0);
  const acceptedProvider = Number(result?.compute_units_accepted ?? 0);
  const verifyUnits = Number(ver?.verification_compute_units ?? sampled * VERIFIER_UNITS_PER_SAMPLED);
  let providerCredit = passedItems * PROVIDER_REWARD_PER_PASSED;
  if (providerCredit > acceptedProvider) providerCredit = acceptedProvider;
  const verifierCredit = sampled * VERIFIER_UNITS_PER_SAMPLED;
  const payerDebit = acceptedProvider + verifyUnits;

  await sb.from("aivault_task_settlements").insert({
    task_id: taskId,
    attempt: task.attempt_count,
    status: "settled",
    passed_items: passedItems,
    sampled_items: sampled,
    provider_credit_units: providerCredit,
    verifier_credit_units: verifierCredit,
    payer_debit_units: payerDebit,
    accepted_provider_units: acceptedProvider,
    verification_units: verifyUnits,
    currency_minor: 0,
  });

  let next = await transition(sb, taskId, "verified_passed", "settled", "settle", "settled", task.attempt_count);
  await snapshotLedger(sb, next, "settled", task.attempt_count);

  if (result?.provider_id) {
    const capId = result.provider_id + ":batch.image.classify:task.batch.image.classify.v0.1";
    await sb.from("aivault_capability_result_window").insert({
      capability_id: capId,
      task_id: taskId,
      agree_ratio: ver?.resample_agree_ratio ?? null,
      p95_ms: null,
      available: true,
      unit_cost: acceptedProvider / Math.max(1, passedItems),
      hash_mismatch: ver?.content_hash_match === false,
    });

    const { data: win } = await sb
      .from("aivault_capability_result_window")
      .select("*")
      .eq("capability_id", capId)
      .order("created_at", { ascending: false })
      .limit(100);

    const rows = win ?? [];
    const n = rows.length;
    const agree = n ? rows.reduce((s, r) => s + Number(r.agree_ratio ?? 0), 0) / n : 0;
    const recent20 = rows.slice(0, 20);
    const recentAgree = recent20.length ? recent20.reduce((s, r) => s + Number(r.agree_ratio ?? 0), 0) / recent20.length : 1;
    const mismatches = rows.filter((r) => r.hash_mismatch).length;

    const { data: cap } = await sb.from("aivault_compute_capabilities").select("*").eq("capability_id", capId).maybeSingle();
    if (cap) {
      let tier = cap.capability_tier as string;
      let trust = cap.trust_level as string;
      if (mismatches >= 3 || (agree < 0.5 && n >= 10)) {
        tier = "disabled";
      } else if (recentAgree < 0.9) {
        if (tier === "production") tier = "limited";
        else if (tier === "limited") tier = "research";
      } else if (n >= 100 && agree >= 0.98) {
        tier = "production";
        trust = "trusted";
      } else if (n >= 30 && agree >= 0.95) {
        tier = "limited";
        trust = "observed";
      } else if (n < 10) {
        trust = "untrusted";
        tier = "research";
      }

      await sb.from("aivault_compute_capabilities").update({
        sample_n: n,
        observed_agree_ratio: agree,
        trust_level: trust,
        capability_tier: tier,
        updated_at: new Date().toISOString(),
      }).eq("capability_id", capId);
    }
  }

  next = await transition(sb, taskId, "settled", "capability_updated", "settle", "window_updated", task.attempt_count);
  next = await transition(sb, taskId, "capability_updated", "closed", "settle", "done", task.attempt_count);
  return json({
    ok: true,
    task: next,
    settlement: {
      provider_credit_units: providerCredit,
      verifier_credit_units: verifierCredit,
      payer_debit_units: payerDebit,
      currency_minor: 0,
    },
  });
});

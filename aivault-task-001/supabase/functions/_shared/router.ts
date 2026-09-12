import { CONTRACT, TASK_TYPE, W_COST, W_LAT, W_RISK, riskOf } from "./contract.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type Cap = Record<string, unknown>;

function rejectReason(cap: Cap, task: Record<string, unknown>, failedProviders: string[], itemTimeoutMs: number): string | null {
  const versions = (cap.contract_versions as string[]) || [];
  if (cap.task_type !== TASK_TYPE || !versions.includes(CONTRACT)) return "unsupported_task_version";
  const tier = String(cap.capability_tier);
  if (tier === "disabled") return "tier_too_low";
  const vlevel = String(cap.verification_level);
  if (vlevel !== "resample" && vlevel !== "dual_model" && vlevel !== "human") {
    return "verification_level_invalid";
  }
  const sampleN = Number(cap.sample_n ?? 0);
  const observedAvailable = sampleN >= 10;
  if (observedAvailable) {
    if (Number(cap.observed_latency_p95) > itemTimeoutMs) return "observed_p95_gt_timeout";
    if (Number(cap.observed_availability) < 0.8) return "availability_lt_0_8";
  }
  const n = Number(task.item_count);
  const reward = Number(cap.reward_units_per_item ?? 8);
  const price = Number(cap.price_per_compute_unit ?? 0);
  const estUnits = n * reward;
  const remaining = Number(task.remaining);
  if (price * estUnits > remaining && price > 0) return "price_times_units_gt_remaining";
  if (failedProviders.includes(String(cap.provider_id))) return "provider_already_failed_task";
  if (!cap.online) return "offline";
  const hb = cap.heartbeat_at || cap.last_seen_at;
  if (hb) {
    const age = Date.now() - new Date(String(hb)).getTime();
    if (age > 60_000) return "heartbeat_gt_60s";
  } else {
    return "offline";
  }
  return null;
}

function score(cap: Cap, pool: Cap[]): number {
  const prices = pool.map((c) => Number(c.price_per_compute_unit ?? 0));
  const p95s = pool.map((c) => {
    const n = Number(c.sample_n ?? 0);
    if (n < 10) return Number(c.advertised_latency_p95 ?? 0);
    return Number(c.observed_latency_p95 ?? 0);
  });
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const minL = Math.min(...p95s);
  const maxL = Math.max(...p95s);
  const price = Number(cap.price_per_compute_unit ?? 0);
  const sampleN = Number(cap.sample_n ?? 0);
  const lat = sampleN < 10 ? Number(cap.advertised_latency_p95 ?? 0) : Number(cap.observed_latency_p95 ?? 0);
  const normP = maxP === minP ? 0 : (price - minP) / (maxP - minP);
  const normL = maxL === minL ? 0 : (lat - minL) / (maxL - minL);
  const risk = riskOf(String(cap.trust_level));
  return W_COST * normP + W_LAT * normL + W_RISK * risk;
}

export async function selectProvider(sb: SupabaseClient, task: Record<string, unknown>) {
  const failed: string[] = [];
  if (task.require_different_provider) {
    const { data: attempts } = await sb
      .from("aivault_task_attempts")
      .select("provider_id,state")
      .eq("task_id", task.task_id);
    for (const a of attempts ?? []) {
      if (a.provider_id) failed.push(String(a.provider_id));
    }
  }
  const uniqueFailed = [...new Set(failed)];
  const { data: caps } = await sb.from("aivault_compute_capabilities").select("*").eq("task_type", TASK_TYPE);
  const itemTimeoutMs = 30_000;
  const accepted: Cap[] = [];
  const rejections: { provider_id: string; reason: string }[] = [];
  for (const cap of caps ?? []) {
    const r = rejectReason(cap as Cap, task, uniqueFailed, itemTimeoutMs);
    if (r) rejections.push({ provider_id: String(cap.provider_id), reason: r });
    else accepted.push(cap as Cap);
  }
  if (accepted.length === 0) return { provider: null as Cap | null, rejections };
  accepted.sort((a, b) => score(a, accepted) - score(b, accepted));
  return { provider: accepted[0], rejections };
}

// Quota guard adapter: calls Base1 RPC aivault_ai_quota_reserve BEFORE any AI call. Fail-closed.
// LocalQuotaLedger mirrors the SQL rules exactly for LOCAL tests / offline.
export const POOL = new Set(["pool_discussion", "pool_learning"]);
export function decide({ dailyTotal, poolShare = 0.5, used, consumer, units = 1 }) {
  if (!POOL.has(consumer)) return { allowed: true, reason: "NOT_POOL_CONSUMER" };
  if (!dailyTotal) return { allowed: false, reason: "QUOTA_SOURCE_UNKNOWN" };
  if (poolShare > 0.5) throw new Error("POOL_SHARE_ABOVE_HALF");
  const poolCap = Math.floor(dailyTotal * poolShare), dsReserveLeft = Math.max(0, dailyTotal - poolCap - used.darkstar);
  if (used.pool + units > poolCap) return { allowed: false, reason: "POOL_HALF_EXHAUSTED", poolCap };
  if (used.total + units > dailyTotal - dsReserveLeft) return { allowed: false, reason: "DARKSTAR_RESERVE_PROTECTED", poolCap };
  return { allowed: true, reason: "WITHIN_POOL_HALF", poolCap };
}
export class LocalQuotaLedger {
  constructor({ totals = {}, poolShare = 0.5 }) { this.totals = totals; this.poolShare = poolShare; this.rows = []; }
  used(provider) { const r = this.rows.filter(x => x.provider === provider && x.decision === "ALLOWED");
    const s = (f) => r.filter(f).reduce((a, b) => a + b.units, 0);
    return { pool: s(x => POOL.has(x.consumer)), darkstar: s(x => x.consumer === "darkstar"), total: s(() => true) }; }
  async reserve({ provider, consumer, units = 1, ref }) {
    const d = decide({ dailyTotal: this.totals[provider], poolShare: this.poolShare, used: this.used(provider), consumer, units });
    this.rows.push({ provider, consumer, units, ref, decision: d.allowed ? "ALLOWED" : "DENIED", reason: d.reason, at: new Date().toISOString() });
    return d;
  }
}
export class SupabaseQuotaGuard {
  constructor({ url, serviceKey, fetchImpl = fetch }) { if (!url || !serviceKey) throw new Error("BACKEND_ONLY_CONFIG_REQUIRED"); Object.assign(this, { url, serviceKey, fetchImpl }); }
  async reserve({ provider, consumer, units = 1, ref }) {
    try {
      const r = await this.fetchImpl(`${this.url}/rest/v1/rpc/aivault_ai_quota_reserve`, { method: "POST", headers: { apikey: this.serviceKey, Authorization: "Bearer " + this.serviceKey, "Content-Type": "application/json" },
        body: JSON.stringify({ p_provider: provider, p_consumer: consumer, p_units: units, p_ref: ref ?? null }) });
      if (!r.ok) return { allowed: false, reason: "QUOTA_GUARD_HTTP_" + r.status };
      return await r.json();
    } catch (e) { return { allowed: false, reason: "QUOTA_GUARD_UNREACHABLE" }; }
  }
}

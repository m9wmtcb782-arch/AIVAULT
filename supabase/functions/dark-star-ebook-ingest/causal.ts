// ce0：因果引擎掛勾（只在 CAUSAL_ENGINE_ON=1 時生效；關閉時 lab.ts 直接呼叫原本 callModel，行為不變）。
// 額度：呼叫 aivault_ai_quota_reserve（feat/aivault-pool-learning-quota 的 RPC），失敗或不存在一律拒絕（fail-closed）。
// 備援模型：CAUSAL_FALLBACK_MODEL（未設定則只退避重試，不換模型）。
// @ts-ignore .mjs
import * as core0 from "./causal-core.mjs";
const { recordOutcome, guidance, guardedCall } = core0 as any;
export const causalOn = () => Deno.env.get("CAUSAL_ENGINE_ON") === "1";
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const H = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
const store = {
  async insert(r: any) { await fetch(URL0 + "/rest/v1/aivault_causal_events", { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(r) }).catch(() => {}); },
  async recent(t: string, limit = 50) { try { const r = await fetch(URL0 + `/rest/v1/aivault_causal_events?task_type=eq.${encodeURIComponent(t)}&order=created_at.desc&limit=${limit}`, { headers: H }); return r.ok ? await r.json() : []; } catch { return []; } },
};
const quota = { async reserve(p: any) { try { const r = await fetch(URL0 + "/rest/v1/rpc/aivault_ai_quota_reserve", { method: "POST", headers: H, body: JSON.stringify({ p_provider: p.provider, p_consumer: p.consumer, p_units: p.units, p_ref: p.ref ?? null }) }); if (!r.ok) return { allowed: false, reason: "QUOTA_GUARD_HTTP_" + r.status }; return await r.json(); } catch { return { allowed: false, reason: "QUOTA_GUARD_UNREACHABLE" }; } } };
export async function causalCallModel(callModel: (s: string, u: string, m?: number) => Promise<any>, system: string, user: string, maxTokens = 4000) {
  const g = await guidance(store, "lab");
  // 註：floor.ts 的 callModel 目前固定 gpt-oss-120b；備援模型需要 floor.ts 另開參數，v0 只做退避重試（不改 floor.ts）。
  try { return await guardedCall({ call: (s: string, u: string, m: number) => callModel(s, u, m), system, user, maxTokens, quota, g, ref: "lab" }); }
  catch (e) { if (!(e as any)?.quotaDenied) await recordOutcome(store, { task_type: "lab", input: user.slice(0, 2000), pass: false, error: e, detail: String((e as any)?.message || e).slice(0, 200), ref: "lab:call" }).catch(() => {}); throw e; }
}
export async function causalRecord(e: any, pass: boolean, detail = "") {
  try { await recordOutcome(store, { agent_id: e.lead_id, district: e.sandbox || "code", task_type: "lab", input: (e.title || "") + "\n" + (e.spec || ""), decision: { iterations: (e.iterations || []).length }, pass, error: pass ? null : "tests failed", detail, ref: "lab:" + e.id }); } catch (_) { /* best-effort */ }
}

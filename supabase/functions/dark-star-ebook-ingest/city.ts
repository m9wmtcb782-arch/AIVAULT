// city1：自主 AI 城市第一階段邏輯（不呼叫任何付費服務）。
// ① 額度管理：Groq 回「每日 token 上限」429 時，記錄 quota:sleep（直到 Groq 給的重試時間），全部 READY 代理改 SLEEPING；睡眠期間 callModel 直接不打 Groq（不浪費），醒來自動改回 READY。
//    關閉：aivault_floor_state k='quota:off' v={"off":"1"}（關閉後照舊直接呼叫）
// ② 知識庫 KB：通過驗收的實驗自動寫一筆（sha256 去重、verified=true、連到 lab_id）；製作者開工前用全文搜尋帶入相關條目。
// ③ 求助：實驗最後失敗時開一張求助單，指派同沙盒 2 位其他代理；之後同題重試通過才由驗收員關單。
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
async function rest(path: string, init: RequestInit = {}) { const r = await fetch(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } }); const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null; }
const MIN = { Prefer: "return=minimal" };
async function getK(k: string) { const [x] = await rest(`aivault_floor_state?k=eq.${encodeURIComponent(k)}&select=v`); return x?.v || null; }
async function setK(k: string, v: any) { await rest("aivault_floor_state?on_conflict=k", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ k, v }) }); }
async function audit(actor: string, action: string, target: string, detail: any) { try { await rest("aivault_audit_events", { method: "POST", headers: MIN, body: JSON.stringify({ actor, action, target, detail }) }); } catch (_) { /* audit best-effort */ } }
export const PER_ACTIVITY = 1300; // 一次活動（分班、一輪學習）約用 token
let CACHE: { at: number; until: number } = { at: 0, until: 0 };
// 回傳睡到何時（ms），0 = 醒著。醒來時把 SLEEPING 改回 READY。
export async function quotaSleeping(): Promise<number> {
  if (Date.now() - CACHE.at < 30000) return CACHE.until > Date.now() ? CACHE.until : 0;
  let until = 0; try { const off = await getK("quota:off"); const q = await getK("quota:sleep"); if (!(off && off.off === "1") && q?.until) until = Date.parse(q.until) || 0;
    if (q?.until && until && until <= Date.now() && !q.woke) { await setK("quota:sleep", { ...q, woke: new Date().toISOString() }); await rest("aivault_agent_state?state=eq.SLEEPING", { method: "PATCH", headers: MIN, body: JSON.stringify({ state: "READY", reason: "額度恢復", since: new Date().toISOString() }) }); await audit("system", "quota_wake", "groq", { until: q.until }); }
  } catch (_) { until = 0; }
  CACHE = { at: Date.now(), until }; return until > Date.now() ? until : 0;
}
// 解析 Groq 429：只在「每日」上限（TPD/RPD）時睡；每分鐘上限不睡。
export async function quotaHit(text: string) {
  try { if (!/per day|TPD|RPD/i.test(text)) return; const m = text.match(/try again in\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:([\d.]+)s)?/i); let ms = m ? ((+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0))) * 1000 : 30 * 60000; ms = Math.max(60000, Math.min(ms, 24 * 3600000));
    const lim = text.match(/Limit\s*(\d+)/i), used = text.match(/Used\s*(\d+)/i); const until = new Date(Date.now() + ms).toISOString();
    await setK("quota:sleep", { until, limit: lim ? +lim[1] : null, used: used ? +used[1] : null, at: new Date().toISOString() }); CACHE = { at: Date.now(), until: Date.parse(until) };
    await rest("aivault_agent_state?state=eq.READY", { method: "PATCH", headers: MIN, body: JSON.stringify({ state: "SLEEPING", reason: "Groq 每日免費額度用完，等到 " + until, since: new Date().toISOString() }) }); await audit("system", "quota_sleep", "groq", { until });
  } catch (_) { /* never break caller */ }
}
export async function quotaState() {
  const q = (await getK("quota:sleep")) || {}; const until = await quotaSleeping(); const st = await rest("aivault_agent_state?select=state");
  const counts: Record<string, number> = {}; st.forEach((x: any) => counts[x.state] = (counts[x.state] || 0) + 1);
  const left = q.limit && q.used != null && !until ? null : 0; // 醒著時無法免費得知剩多少，不猜
  return { sleeping: !!until, until: until ? new Date(until).toISOString() : null, limit: q.limit || null, used_at_sleep: q.used ?? null, last_sleep: q.at || null, woke: q.woke || null, activities_left: until ? 0 : left, per_activity: PER_ACTIVITY, states: counts };
}
async function sha(s: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
export async function kbFromLab(e: any) {
  try { const summary = `${e.spec}\nAPI：${String(e.api || "").slice(0, 600)}\n通過：${e.sandbox || "code"} 沙盒，自動測試＋${e.verifier_id ? e.verifier_id + " 隱藏驗收" : "無獨立驗收"}。`;
    await rest("aivault_kb?on_conflict=sha256", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ sha256: await sha(e.title + "\n" + summary), agent_id: e.lead_id, title: e.title, summary, source: "lab#" + e.id, verified: !!e.verifier_id, lab_id: e.id }) });
    await rest(`aivault_help_requests?lab_id=eq.${e.id}&status=eq.open`, { method: "PATCH", headers: MIN, body: JSON.stringify({ status: "closed", result: "重試通過", verified_by: e.verifier_id || null, closed_at: new Date().toISOString() }) });
  } catch (_) { /* best-effort */ }
}
export async function kbSearch(q: string, n = 3) {
  const words = String(q || "").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1).slice(0, 6); if (!words.length) return [];
  try { return await rest(`aivault_kb?select=id,title,summary,source,verified&tsv=wfts(simple).${encodeURIComponent(words.join(" or "))}&limit=${n}`); } catch (_) { return []; }
}
export async function helpFromFail(e: any) {
  try { const [box] = await rest(`aivault_sandboxes?key=eq.${e.sandbox || "code"}&select=lo,hi`); const ids: string[] = []; if (box) for (let i = box.lo; i <= box.hi; i++) ids.push("ag-" + String(i).padStart(4, "0"));
    const helpers = ids.filter((x) => x !== e.lead_id && x !== e.tester_id).sort(() => Math.random() - .5).slice(0, 2);
    await rest("aivault_help_requests", { method: "POST", headers: MIN, body: JSON.stringify({ lab_id: e.id, requester: e.lead_id, helpers, status: "open" }) }); await audit(e.lead_id, "help_request", "lab#" + e.id, { helpers });
  } catch (_) { /* best-effort */ }
}
export async function cityPublic() {
  const [boxes, mem, quota, kb, help, labs, repl, deg] = await Promise.all([
    rest("aivault_sandboxes?select=*&order=lo"), rest("aivault_sandbox_members?select=sandbox"), quotaState(), rest("aivault_kb?select=id,title,source,verified,created_at&order=created_at.desc&limit=10"),
    rest("aivault_help_requests?select=id,lab_id,requester,helpers,status,created_at&order=created_at.desc&limit=10"), rest("aivault_lab_experiments?select=id,title,sandbox,status,tokens,cost_usd,lead_id,verifier_id,created_at&order=created_at.desc&limit=200"),
    getK("replication:off"), rest("aivault_pool_agent_degree?select=tier"),
  ]);
  const mc: Record<string, number> = {}; mem.forEach((m: any) => mc[m.sandbox] = (mc[m.sandbox] || 0) + 1);
  const sb = boxes.map((b: any) => { const L = labs.filter((l: any) => (l.sandbox || "code") === b.key); return { ...b, members: mc[b.key] || 0, labs: L.length, passed: L.filter((l: any) => l.status === "passed").length, failed: L.filter((l: any) => l.status === "failed").length, running: L.filter((l: any) => l.status === "running").length, tokens: L.reduce((s: number, l: any) => s + (l.tokens || 0), 0) }; });
  return { ok: true, at: new Date().toISOString(), sandboxes: sb, quota, kb, help, recent: labs.slice(0, 12), replication_off: !!(repl && repl.off === "1"), degrees: deg.length, cost_usd: labs.reduce((s: number, l: any) => s + Number(l.cost_usd || 0), 0) };
}
// 便宜探針（約 20 token）：只在 quota:sleep 已過期時才真的打一次；仍 429 就重新睡。
export async function quotaProbe() {
  const q = (await getK("quota:sleep")) || {}; if (q.until && Date.parse(q.until) > Date.now()) return { ok: true, probed: false, sleeping: true, until: q.until };
  const k = Deno.env.get("GROQ_API_KEY") || ""; if (!k) return { ok: false, error: "no key" };
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + k, "Content-Type": "application/json" }, body: JSON.stringify({ model: "openai/gpt-oss-120b", messages: [{ role: "user", content: "ok" }], max_tokens: 1 }) });
  const t = r.ok ? "" : await r.text(); if (r.status === 429) { await quotaHit("groq:429:" + t.slice(0, 300)); CACHE.at = 0; }
  else if (r.ok) { CACHE.at = 0; await quotaSleeping(); }
  return { ok: true, probed: true, status: r.status, sleeping: r.status === 429 && /per day|TPD|RPD/i.test(t), detail: r.ok ? "" : t.slice(0, 160).replace(/org_\w+/g, "org_…") };
}

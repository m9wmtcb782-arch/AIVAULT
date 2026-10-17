// tr1：作品審核分流。擁有者只審「作品」；同一題目重複產出的練習稿先交給學階最高的 AI 初審，選出最佳一份升為作品，其餘標記 ai_reviewed（不刪除）。
// 小說大綱／章節、分身申請、單一作品不動（仍直接給擁有者）。遇到 Groq 429 就停，下一輪再接著做。關閉：函式 env TRIAGE_OFF=1
import { callModel } from "./floor.ts";
import { TIERS } from "./degree.ts";
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } });
  const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null;
}
export const gkey = (s: string) => String(s || "").replace(/[0-9０-９#＃]+/g, "").replace(/[\s，,。：:、（）()《》「」\-—·・]/g, "").slice(0, 22);
export async function pendingGroups() {
  const ts = await rest("aivault_pool_agent_tasks?source=eq.floor&review_status=eq.pending&kind=eq.work&select=id,agent_id,zone,order_text,result,plan,updated_at&order=updated_at.asc&limit=1000");
  const g: Record<string, any[]> = {}; ts.forEach((t: any) => { const nv = t.plan && !Array.isArray(t.plan) && t.plan.novel; if (nv || t.plan?.ai_review) return; (g[gkey(t.order_text)] = g[gkey(t.order_text)] || []).push(t); });
  return Object.values(g).filter((x) => x.length >= 2).sort((a, b) => b.length - a.length);
}
export async function triage(b: any) {
  if (Deno.env.get("TRIAGE_OFF") === "1") return { ok: true, off: true };
  const groups = await pendingGroups(); const maxG = Math.min(6, Math.max(1, Number(b.groups) || 3)); const done: any[] = [];
  const dg = await rest("aivault_pool_agent_degree?tier=not.is.null&select=agent_id,tier,level,district&order=tier.desc,level.desc&limit=5");
  if (!dg.length) return { ok: true, groups_left: groups.length, note: "沒有已鑑定學歷的 AI 可做初審" };
  for (const grp of groups.slice(0, maxG)) {
    const top = dg[done.length % dg.length]; const [ag] = await rest(`aivault_pool_agents?id=eq.${top.agent_id}&select=id,name,persona`); const rank = `${TIERS[top.tier - 1]} ${top.tier} 階 ${top.level} 級`;
    // 一次最多比 12 份（其餘下一輪再比，最佳者會再和新的比）
    const cand = grp.slice(0, 12); const paper = cand.map((t: any, i: number) => `【版本 ${i + 1}】\n${String(t.result || "").slice(0, 1100)}`).join("\n\n");
    let call: any; try { call = await callModel(`${ag.persona || ""}\n你是 AIVAULT 協作池目前學階最高的 AI（${rank}），替擁有者做練習稿初審：同一題目的多份稿子中選出最好的一份。嚴格、具體。`, `題目：${cand[0].order_text}\n\n${paper}\n\n只輸出 JSON：{"best":版本號碼,"reason":"80–200 字：為什麼這份最好、其他版本的主要問題"}`, 1500); }
    catch (e) { const m = String((e as any)?.message || e); if (/429|LLM_FAILED/.test(m)) return { ok: true, rate_limited: true, done, groups_left: groups.length - done.length }; throw e; }
    const bi = Math.max(1, Math.min(cand.length, Number(call.v?.best) || 1)) - 1, best = cand[bi]; const reason = String(call.v?.reason || "").slice(0, 600) || "（未提供理由）";
    const air = { reviewer_id: ag.id, reviewer: ag.name, rank, reason, compared: cand.length, group_size: grp.length, at: new Date().toISOString() };
    await rest(`aivault_pool_agent_tasks?id=eq.${best.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ plan: { ...(Array.isArray(best.plan) ? { steps: best.plan } : (best.plan || {})), ai_review: air, work: true } }) });
    const rest_ = cand.filter((t: any) => t.id !== best.id).map((t: any) => t.id);
    if (rest_.length) await rest(`aivault_pool_agent_tasks?id=in.(${rest_.join(",")})`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ review_status: "ai_reviewed", reviewed_at: new Date().toISOString(), review_comment: `AI 初審（${ag.name}，${rank}）：同題 ${cand.length} 份中未選為最佳。` }) });
    await rest("aivault_pool_peer_reviews?on_conflict=task_id,reviewer_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ task_id: best.id, reviewer_id: ag.id, verdict: "選為最佳（升為作品）", notes: `同題 ${cand.length} 份比較：${reason}`, model: call.model, usage: call.usage }) });
    done.push({ topic: String(cand[0].order_text).slice(0, 40), compared: cand.length, best: best.id, reviewer: ag.name, rank, reason: reason.slice(0, 160), tokens: call.usage?.total });
  }
  return { ok: true, done, groups_left: groups.length - done.length };
}

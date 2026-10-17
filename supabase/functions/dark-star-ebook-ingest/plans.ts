// pl1：每日學習計畫。每區學階最高的 1 位 AI 寫當天計畫 → 審核 AI（Groq gpt-oss-120b；不是暗星本體，所以不標成暗星）審核：核准才用來決定當天該區的學習主題；退回就用預設課程。
// 存在 aivault_floor_state（k = plan:YYYY-MM-DD:區）。關閉：函式 env PLAN_OFF=1
import { callModel } from "./floor.ts";
import { TIERS, DIST, districtOf } from "./degree.ts";
import { markSpecial } from "./special.ts";
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
async function rest(path: string, init: RequestInit = {}) { const r = await fetch(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } }); const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null; }
export const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const REVIEWER = "你是 AIVAULT 協作池的學習計畫審核 AI。冷靜、嚴格、重視實用：計畫必須真的能讓代理學到可以拿來開發 AIVAULT 的東西（尤其口語化即時語音模組），主題要具體、來源要可信（官方文件、GitHub、arXiv、公開演講），不能空泛或重複。";
export async function getPlans(day = today()) { return (await rest(`aivault_floor_state?k=like.plan:${day}:*&select=k,v,updated_at`)) || []; }
export async function approvedTopics(d: string) { const [x] = await rest(`aivault_floor_state?k=eq.plan:${today()}:${d}&select=v`); return x?.v?.decision === "approve" ? (x.v.plan?.topics || []).map((t: any) => String(t.topic || t)).filter(Boolean) : []; }
export async function dailyPlans(b: any = {}) {
  if (Deno.env.get("PLAN_OFF") === "1") return { ok: true, off: true };
  const day = today(); const have = new Set((await getPlans(day)).map((x: any) => x.k.split(":")[2])); const res: any[] = [];
  const all = await rest("aivault_pool_agents?select=id,domain,name,persona&limit=1400"); const byId: Record<string, any> = {}; all.forEach((a: any) => byId[a.id] = a);
  const dg = await rest("aivault_pool_agent_degree?tier=not.is.null&select=agent_id,tier,level&order=tier.desc,level.desc&limit=1400");
  for (const d of ["av", "code", "llm", "img"]) { if (have.has(d) && !b.redo) continue;
    const top = dg.filter((x: any) => byId[x.agent_id] && districtOf(byId[x.agent_id].domain) === d)[0]; if (!top) { res.push({ d, skip: "no placed agent" }); continue; }
    const ag = byId[top.agent_id], rank = `${TIERS[top.tier - 1]} ${top.tier} 階 ${top.level} 級`; const peers = dg.filter((x: any) => byId[x.agent_id] && districtOf(byId[x.agent_id].domain) === d).slice(1, 9).map((x: any) => x.agent_id);
    const p = await callModel(`${ag.persona || ""}\n你是 ${DIST[d]} 學階最高的 AI（${rank}），要為本區寫今天（${day}）的學習計畫。重點課程：口語化即時語音模組（串流 ASR、VAD、插話、低延遲 TTS、WebRTC、全雙工語音模型、中文／台語口語、Web Audio）。`,
      `可指派的同區代理：${peers.join(", ")}\n只輸出 JSON：{"goal":"一句今天的目標","topics":[{"topic":"具體主題（10–30 字）","why":"為什麼","sources":["建議來源類型或網站"]}]（3–5 個）,"assign":{"代理id":"主題"}}`, 1500);
    const plan = p.v || {}; let decision = "pending", reason = "", reviewer = "暗星（呼叫失敗，未審核）", rmodel = "";
    // 審核走暗星真正的路徑：ai-gateway agent_id=technical-dark-star（暗星本身的人設與模型路由）。成功才標「暗星」；失敗就維持 pending、當天用預設課程。
    try { const gr = await fetch(URL0 + "/functions/v1/ai-gateway", { method: "POST", headers: { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" }, signal: AbortSignal.timeout(90000),
        body: JSON.stringify({ agent_id: "technical-dark-star", engine: "technical-dark-star", stream: false, messages: [{ role: "user", content: `暗星，請以協作池統籌者身分審核 ${DIST[d]} 的 ${ag.name}（${rank}）提交的今天學習計畫。標準：主題具體、來源可信（官方文件、GitHub、arXiv、公開演講）、真的有助於開發 AIVAULT 口語化即時語音模組。\n\n${JSON.stringify(plan).slice(0, 3000)}\n\n只回 JSON：{"decision":"approve 或 reject","reason":"60–150 字理由"}` }] }) });
      const gj = await gr.json().catch(() => ({})); const txt = String(gj.content || gj.text || ""); const m = txt.match(/\{[\s\S]*\}/); const v = m ? JSON.parse(m[0]) : null;
      if (gr.ok && gj.success !== false && v && /approve|reject/.test(String(v.decision))) { decision = /approve/.test(String(v.decision)) ? "approve" : "reject"; reason = String(v.reason || "").slice(0, 400); reviewer = "暗星"; rmodel = `${gj.provider || "?"}:${gj.model || "?"}`; await markSpecial("darkstar", "審核計畫"); }
      else reason = "暗星沒有回傳可用的審核結果（HTTP " + gr.status + "）";
    } catch (e) { reason = "暗星呼叫失敗：" + String((e as any)?.message || e).slice(0, 120); }
    const rv = { usage: { total: 0 } };
    const v = { day, district: d, author_id: ag.id, author: ag.name, rank, plan, reviewer, reviewer_model: rmodel, decision, reason, tokens: (Number(p.usage?.total) || 0), at: new Date().toISOString() };
    await rest("aivault_floor_state", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ k: `plan:${day}:${d}`, v, updated_at: new Date().toISOString() }) });
    res.push({ d, author: ag.name, rank, reviewer, reviewer_model: rmodel, decision, reason: v.reason.slice(0, 120), topics: (plan.topics || []).map((t: any) => t.topic), tokens: v.tokens }); }
  return { ok: true, day, res };
}

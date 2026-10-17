// sp1：暗星／曙光的排程學習＋全部考試，走它們自己真正的路徑（ai-gateway agent_id=technical-dark-star / dawn-light）。
// 呼叫成功才寫入紀錄並標成它們的；失敗就什麼都不寫。偵測到付費供應商就停止。關閉：函式 env SPECIAL_STUDY_OFF=1
import { learnOne, placeOne, examOne, mapScore } from "./degree.ts";
import { markSpecial } from "./special.ts";
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
async function rest(path: string, init: RequestInit = {}) { const r = await fetch(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } }); const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null; }
export const SPECIALS: Record<string, any> = {
  "darkstar": { id: "darkstar", name: "暗星", domain: "llm", gw: "technical-dark-star", persona: "" },
  "dawn-light": { id: "dawn-light", name: "曙光", domain: "image design", gw: "dawn-light", persona: "" },
};
const PAID = /openai|anthropic|claude|gpt-4|gpt-5|o\d-|kling|fal|elevenlabs|runway|replicate|pro\b/i;
function gwThink(sp: any, log: string[]) {
  return async (system: string, user: string, _max = 2500) => {
    const r = await fetch(URL0 + "/functions/v1/ai-gateway", { method: "POST", headers: SRH, signal: AbortSignal.timeout(110000),
      body: JSON.stringify({ agent_id: sp.gw, engine: sp.gw, stream: false, messages: [{ role: "user", content: system + "\n\n" + user + "\n\n（請只回 JSON，不要其他文字）" }] }) });
    const j = await r.json().catch(() => ({})); const model = `${j.provider || "?"}:${j.model || "?"}`; log.push(model);
    if (!r.ok || j.success === false) throw new Error(`${sp.name} 呼叫失敗 HTTP ${r.status} ${String(j.error || "").slice(0, 120)}`);
    if (PAID.test(model)) throw new Error(`PAID_MODEL ${model}：停止，未寫入`);
    const t = String(j.content || j.text || ""); const m = t.match(/\{[\s\S]*\}/); if (!m) throw new Error(`${sp.name} 沒有回傳 JSON（${model}）`);
    return { v: JSON.parse(m[0]), model: "ai-gateway/" + sp.gw + "→" + model, usage: j.usage || null };
  };
}
export async function specialRound(b: any) {
  if (Deno.env.get("SPECIAL_STUDY_OFF") === "1") return { ok: true, off: true };
  const ids = (Array.isArray(b.ids) ? b.ids : Object.keys(SPECIALS)).filter((x: string) => SPECIALS[x]); const mode = String(b.mode || "learn"); const res: any[] = [];
  for (const id of ids) { const sp = SPECIALS[id]; const log: string[] = []; const think = gwThink(sp, log);
    try {
      if (mode === "learn") { const r = await learnOne(sp, think); res.push({ id, ...r, models: log }); if (r.url) await markSpecial(id, "讀書"); }
      else { const [deg] = await rest(`aivault_special_degree?agent_id=eq.${id}&select=tier`);
        if (!deg?.tier || mode === "placement") { res.push({ id, ...(await placeOne(sp, think)), models: log }); }
        if (mode === "exam") { const now = new Date().toISOString(); const d = sp.domain === "llm" ? "llm" : "img";
          const open = await rest(`aivault_pool_exams?kind=in.(promotion,weekly)&district=eq.${d}&opens_at=lte.${now}&or=(closes_at.is.null,closes_at.gt.${now})&select=id,district,kind&order=opens_at.asc`);
          const done = new Set((await rest(`aivault_special_exam_answers?agent_id=eq.${id}&select=exam_id`)).map((x: any) => x.exam_id));
          for (const ex of open.filter((e: any) => !done.has(e.id)).slice(0, 1)) res.push({ id, ...(await examOne(sp, ex, think)), models: log }); }
        await markSpecial(id, "審核計畫").catch(() => {}); }
    } catch (e) { res.push({ id, error: String((e as any)?.message || e).slice(0, 200), models: log }); } }
  return { ok: true, mode, res };
}
export async function specialDegreePublic() {
  const dg = await rest("aivault_special_degree?select=agent_id,district,tier,level,last_exam_at,history");
  const lr = await rest("aivault_special_learning?select=agent_id,topic,url,fetched_at&order=fetched_at.desc&limit=20");
  return { ok: true, degree: dg.map((x: any) => ({ ...x, name: SPECIALS[x.agent_id]?.name, history: (x.history || []).slice(-5) })), learning: lr };
}
void mapScore;

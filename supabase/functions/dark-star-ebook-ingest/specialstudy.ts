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
      if (mode === "learn") { await markSpecial(id, "學習中").catch(() => {}); const r = await learnOne(sp, think); res.push({ id, ...r, models: log }); if (r.url) await markSpecial(id, "讀書"); }
      else { await markSpecial(id, "考試中").catch(() => {}); const [deg] = await rest(`aivault_special_degree?agent_id=eq.${id}&select=tier`);
        if (!deg?.tier || mode === "placement") { res.push({ id, ...(await placeOne(sp, think)), models: log }); }
        if (mode === "exam") { const now = new Date().toISOString(); const d = sp.domain === "llm" ? "llm" : "img";
          const open = await rest(`aivault_pool_exams?kind=in.(promotion,weekly)&district=eq.${d}&opens_at=lte.${now}&or=(closes_at.is.null,closes_at.gt.${now})&select=id,district,kind&order=opens_at.asc`);
          const done = new Set((await rest(`aivault_special_exam_answers?agent_id=eq.${id}&select=exam_id`)).map((x: any) => x.exam_id));
          for (const ex of open.filter((e: any) => !done.has(e.id)).slice(0, 1)) res.push({ id, ...(await examOne(sp, ex, think)), models: log }); }
        const last = res.filter((x: any) => x.id === id && x.max).pop(); if (last) await markSpecial(id, last.score / last.max >= .6 ? "考試通過" : "考完").catch(() => {}); }
    } catch (e) { res.push({ id, error: String((e as any)?.message || e).slice(0, 200), models: log }); } }
  return { ok: true, mode, res };
}
export async function specialDegreePublic() {
  const dg = await rest("aivault_special_degree?select=agent_id,district,tier,level,last_exam_at,history");
  const lr = await rest("aivault_special_learning?select=agent_id,topic,url,fetched_at&order=fetched_at.desc&limit=20");
  let roster: any = null; try { const cnt = async (q: string) => { const r = await fetch(URL0 + "/rest/v1/" + q, { headers: { ...SRH, Prefer: "count=exact", Range: "0-0" } }); return Number((r.headers.get("content-range") || "/0").split("/")[1]) || 0; };
    roster = { working: await cnt("aivault_pool_agents?select=id"), special: await cnt("aivault_pool_special?select=id"), inactive: await cnt("agent_registry?roster_status=eq.registered-inactive&select=agent_id"), duplicates: await cnt("agent_registry?roster_status=in.(alias,simulated-duplicate)&select=agent_id") }; } catch (_) {}
  return { ok: true, roster, degree: dg.map((x: any) => ({ ...x, name: SPECIALS[x.agent_id]?.name, history: (x.history || []).slice(-5) })), learning: lr };
}
void mapScore;
// sm1：擁有者召集暗星／曙光到協作池。先真的呼叫它自己的路徑（打招呼＋說要做的事），成功才寫入召集紀錄（全城同步）；失敗回報錯誤、不動畫。
// 抵達後在背景做一次真實學習（learnOne）。請回：寫 leaving 狀態，城裡飛出城門。關閉：函式 env AI_SUMMON_OFF=1；前端 localStorage.aiSummonOff=1
const SUMMON_MIN = 30;
async function setState(id: string, v: any) { await rest("aivault_floor_state", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ k: "summon:" + id, v, updated_at: new Date().toISOString() }) }); }
export async function summon(b: any, by: string | null, via = "town") {
  if (Deno.env.get("AI_SUMMON_OFF") === "1") return { ok: false, error: "召集功能已關閉" };
  const id = String(b.id || ""); const sp = SPECIALS[id]; if (!sp) return { ok: false, error: "bad id" };
  const now = new Date();
  if (b.op === "dismiss") { await setState(id, { state: "leaving", at: now.toISOString(), by, via }); await markSpecial(id, "回去").catch(() => {}); return { ok: true, state: "leaving" }; }
  const log: string[] = []; let g: any;
  try { g = await gwThink(sp, log)(`你是${sp.name}。擁有者剛剛把你叫到 AIVAULT 協作池（一座有石牆、城門和中央指揮殿的城）。`, `用一兩句繁體中文跟大家打招呼，說你接下來 ${SUMMON_MIN} 分鐘會在協作池做的一件真實的事（例如讀書學習「${sp.domain === "llm" ? "大型語言模型" : "圖像生成"}」相關資料）。只輸出 JSON：{"reply":"...","task":"10 字內任務名"}`); }
  catch (e) { return { ok: false, error: String((e as any)?.message || e).slice(0, 200), models: log }; }
  const v = { state: "arrived", at: now.toISOString(), until: new Date(now.getTime() + SUMMON_MIN * 60e3).toISOString(), by, via, reply: String(g.v?.reply || "").slice(0, 300), task: String(g.v?.task || "學習").slice(0, 20), model: g.model };
  await setState(id, v); await markSpecial(id, "協作池任務").catch(() => {});
  const work = (async () => { try { await markSpecial(id, "學習中"); const r = await learnOne(sp, gwThink(sp, [])); await markSpecial(id, r.url ? "讀書" : "協作池任務"); } catch (_) { await markSpecial(id, "協作池任務").catch(() => {}); } })();
  try { (globalThis as any).EdgeRuntime?.waitUntil?.(work); } catch (_) {}
  return { ok: true, ...v };
}
export async function summonState() { const r = await rest("aivault_floor_state?k=like.summon:*&select=k,v"); const o: any = {}; r.forEach((x: any) => o[x.k.slice(7)] = x.v); return o; }

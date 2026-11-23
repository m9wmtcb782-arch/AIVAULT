// t280/t281：後台協作池小模型（HF Space aivault3d/darkstar-llm 池模式）。暗星本人（technical-dark-star）不使用這個路徑。
// 失敗一律回 null → 呼叫端沿用既有路徑（Groq）。不呼叫任何付費 API。
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
const SPACE = () => (Deno.env.get("DARKSTAR_SPACE_URL") || "https://aivault3d-darkstar-llm.hf.space").replace(/\/$/, "");
const KEY = () => Deno.env.get("DARKSTAR_POOL_KEY") || "";
const DARKSTAR = new Set(["technical-dark-star", "darkstar"]);
export const REASONING = /(比.{0,8}(高|矮|大|小|多|少|快|慢|重|輕|長|短|早|晚)|誰最|哪.{0,3}最|推理|推論|推斷|如果.{0,40}(那麼|則)|假設|幾(個|隻|人|天|次|歲|元)|多少|計算|等於|總共|平均|機率|百分之|[0-9]+\s*[-+*/×÷=^%]\s*[0-9]|因果|比較|對比|差異|證明|判斷|為什麼|邏輯|排序)/;
export const LEGAL = /(法律|法條|法規|民法|刑法|憲法|契約|合約|侵權|債務|債權|時效|訴訟|判決|判例|賠償|違法|合法|請求權|繼承|租賃|著作權|專利|商標|醫|診斷|藥)/;
export const FRESH = /(最新|即時|新聞|股價|匯率|天氣|今天|今日|現在幾點|第.{1,5}條|跨國)/;
export const NOVEL = /(小說|章節|第\s*\d+\s*章|大綱|篇章弧)/;
async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } });
  const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null;
}
let cfgAt = 0, cfg: any = null, writers: Set<string> | null = null, rolesOk = false;
async function config() {
  if (cfg && Date.now() - cfgAt < 60000) return cfg;
  try {
    const rows = await rest("aivault_floor_state?k=in.(pool_smallmodel,novel_gemini,bot_posts)&select=k,v");
    cfg = Object.fromEntries(rows.map((r: any) => [r.k, r.v || {}]));
    writers = new Set((await rest("aivault_pool_agent_roles?role=eq.novel_writer&select=agent_id")).map((r: any) => r.agent_id));
    rolesOk = writers.size > 0;
  } catch { cfg = cfg || {}; writers = writers || new Set(); rolesOk = false; }
  cfgAt = Date.now(); return cfg;
}
export async function poolConfig() { return await config(); }
export async function isNovelWriter(agentId?: string | null) { await config(); return !!(agentId && writers?.has(agentId)); }
// t286：前 100 位（大模型組）永不使用小模型；名單讀不到時一律視為「不能用小模型」（fail-closed）
export async function mayUseSmall(agentId?: string | null) { await config(); return !!agentId && rolesOk && !writers!.has(agentId) && !DARKSTAR.has(agentId); }
export async function smallModelOn() { const c = await config(); return !!KEY() && c.pool_smallmodel?.enabled !== false; }
// 簡單任務：短、非推理、非法律醫療、非即時、非小說
export function isSimple(text: string, maxTokens = 1500, ignoreBudget = false) {
  const t = String(text || ""); if (t.length > 3000) return false; if (!ignoreBudget && maxTokens > 1500) return false;
  return !(REASONING.test(t) || LEGAL.test(t) || FRESH.test(t) || NOVEL.test(t));
}
let bumpOk = true;
async function bump(p: string) { if (!bumpOk) return; try { await rest("rpc/aivault_pool_usage_bump", { method: "POST", body: JSON.stringify({ p }) }); } catch { bumpOk = false; } }
export async function spaceTask(body: Record<string, unknown>, timeoutMs = 120000): Promise<any | null> {
  const agent = String(body.agent_id || ""); if (!agent || DARKSTAR.has(agent)) return null; // 暗星不用小模型
  if (!(await mayUseSmall(agent))) return null; // t286：大模型組（前 100 位）不得使用小模型，也不當備援
  if (!(await smallModelOn())) return null;
  try {
    const r = await fetch(SPACE() + "/task", { method: "POST", headers: { "Content-Type": "application/json", "x-darkstar-pool-key": KEY() }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null; const j = await r.json(); if (!j?.ok || j.route !== "local") return null;
    await bump("space-smallmodel"); return j;
  } catch { return null; }
}
// 給 callModelRaw / llm 用：JSON 任務先試小模型
export async function smallJson(system: string, user: string, maxTokens: number, agentId: string) {
  if (await isNovelWriter(agentId)) return null;
  const j = await spaceTask({ task: "json", agent_id: agentId, system: system.slice(0, 4000), text: user.slice(0, 3000), max_tokens: Math.min(maxTokens, 1024) });
  if (!j?.json || typeof j.json !== "object") return null;
  const v = j.json; v.__model = "space:" + j.model_key + "@" + j.version; return { v, model: v.__model, usage: j.usage ? { prompt: j.usage.prompt_tokens, completion: j.usage.completion_tokens, total: j.usage.total_tokens, request_id: j.id } : null };
}
// 網搜 → 小模型摘要（來源網址只來自搜尋結果，不由模型產生）
export async function searchSummary(q: string, agentId: string, search: (q: string) => Promise<any[]>) {
  const results = (await search(q)).slice(0, 6);
  if (!results.length) return { ok: false, error: "no_results", sources: [] };
  const j = await spaceTask({ task: "summarize", agent_id: agentId, text: q, sources: results, max_tokens: 500 });
  if (!j) return { ok: false, error: "small_model_unavailable", sources: results };
  return { ok: true, summary: j.output, sources: j.sources, model: "space:" + j.model_key + "@" + j.version, latency_ms: j.latency_ms };
}

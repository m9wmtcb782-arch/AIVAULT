// t280/t281/t282：協作池機器人留言。暗星排程（dispatcher=technical-dark-star 的排程邏輯，暗星本人不用小模型）→ 小模型草稿 → 自動檢查 → 待審佇列。
// 只有擁有者／管理員核准後，才由 rpc aivault_bot_post_publish 以 kind='ai'、標示【AI 生成】發到世界聊天。
import { spaceTask, isNovelWriter, poolConfig } from "./smallmodel.ts";
export type LargeGen = (agentId: string, assignment: any) => Promise<{ text: string; model: string } | null>;
const ANGLES = ["分享一個實用小技巧", "提出一個值得大家討論的問題", "分享一個冷知識", "給新手一句鼓勵", "說一個常見誤解", "談一個最近的趨勢觀察", "推薦一個入門學習方向", "分享一句工作心得"];
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } });
  const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null;
}
const BANNED = ["幹你", "操你", "他媽", "去死", "白癡", "智障", "垃圾人", "fuck", "shit", "賭博", "博弈", "色情", "裸照", "毒品", "代孕", "投資保證", "穩賺", "加賴", "加line", "私訊我"];
const URL_ALLOW = /^(?:[a-z0-9-]+\.)*(wikipedia\.org|gov\.tw|edu\.tw|github\.com|github\.io|arxiv\.org|who\.int|nasa\.gov|qwenlm\.github\.io|huggingface\.co)$/i;
export async function sha256(s: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
export function norm(s: string) { return s.replace(/\s+/g, "").replace(/[，。、！？!?,.：:；;「」『』（）()【】\[\]]/g, "").toLowerCase(); }
export function checkPost(body: string, sources: any[], recent: string[], sentence = false) {
  const issues: string[] = []; const b = String(body || "").trim();
  if (b.length < (sentence ? 6 : 20)) issues.push("too_short"); if (b.length > (sentence ? 80 : 280)) issues.push("too_long");
  if (sentence && (b.match(/[。！？!?]/g) || []).length > 1) issues.push("not_one_sentence");
  const low = b.toLowerCase(); const bw = BANNED.filter((w) => low.includes(w.toLowerCase())); if (bw.length) issues.push("banned:" + bw.join("|"));
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(b)) issues.push("pii:email");
  if (/(?:\+?886[-\s]?|0)9\d{2}[-\s]?\d{3}[-\s]?\d{3}/.test(b)) issues.push("pii:phone");
  if (/\b[A-Z][12]\d{8}\b/.test(b)) issues.push("pii:national_id");
  if (/\b(?:\d[ -]?){13,16}\b/.test(b)) issues.push("pii:card_like_number");
  const urls = [...b.matchAll(/https?:\/\/([^\s/]+)[^\s]*/gi)].map((m) => m[1]);
  const srcHosts = new Set((sources || []).map((s: any) => { try { return new URL(s.url).hostname; } catch { return ""; } }));
  const bad = urls.filter((h) => !URL_ALLOW.test(h) && !srcHosts.has(h)); if (bad.length) issues.push("url_not_allowed:" + bad.join("|"));
  const n = norm(b); if (recent.some((r) => r === n)) issues.push("duplicate");
  else if (recent.some((r) => { const a = new Set([...n].map((_, i) => n.slice(i, i + 2))); const c = [...r].map((_, i) => r.slice(i, i + 2)).filter((g) => a.has(g)).length; return c / Math.max(1, a.size) > 0.8; })) issues.push("near_duplicate");
  if (!sentence && !(sources || []).length) issues.push("no_sources");
  return { ok: issues.length === 0, issues };
}
function taipeiDayStartIso() { const d = new Date(Date.now() + 8 * 3600e3); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() - 8 * 3600e3).toISOString(); }
// 暗星排程：每次最多 per_run（或指定 n），全站每日不超過 daily_batch；隨機輪替代理，冷卻 agent_cooldown_days；排除小說作家
export async function dispatchDrafts(search: (q: string) => Promise<any[]>, nWanted?: number, dryRun = false, large?: LargeGen) {
  const cfg = (await poolConfig()).bot_posts || {}; if (cfg.enabled === false) return { ok: false, error: "bot_posts disabled" };
  const daily = Number(cfg.daily_batch || 150), perRun = Math.min(50, Number(nWanted || cfg.per_run || 4)), cool = Number(cfg.agent_cooldown_days || 7);
  const cr = await fetch(URL0 + `/rest/v1/aivault_bot_posts?created_at=gte.${taipeiDayStartIso()}&select=id`, { headers: { ...SRH, Prefer: "count=exact", Range: "0-0" } });
  const today = Number((cr.headers.get("content-range") || "/0").split("/")[1]) || 0; const room = Math.max(0, Math.min(perRun, daily - today));
  if (!room) return { ok: true, dispatcher: "technical-dark-star", made: 0, reason: "daily_batch reached", today, daily };
  const tc = await fetch(URL0 + "/rest/v1/aivault_pool_agents?select=id", { headers: { ...SRH, Prefer: "count=exact", Range: "0-0" } });
  const total = Number((tc.headers.get("content-range") || "/0").split("/")[1]) || 0;
  const coolSince = new Date(Date.now() - cool * 86400e3).toISOString();
  const recentAgents = new Set((await rest(`aivault_bot_posts?created_at=gte.${coolSince}&select=agent_id&limit=5000`)).map((r: any) => r.agent_id));
  const recent = (await rest("aivault_bot_posts?select=body&order=created_at.desc&limit=100")).map((r: any) => norm(r.body));
  const picked: any[] = []; let tries = 0;
  while (picked.length < room && tries++ < room * 6 && total) {
    const off = Math.floor(Math.random() * total);
    const [a] = await rest(`aivault_pool_agents?select=id,name,domain,specialty,zone&order=id.asc&offset=${off}&limit=1`);
    if (!a || recentAgents.has(a.id) || picked.some((p) => p.id === a.id) || a.id === "technical-dark-star" || a.id === "darkstar") continue;
    picked.push(a);
  }
  const made: any[] = [];
  const runId = "ds-" + Date.now().toString(36);
  for (const [k, a] of picked.entries()) {
    const t0 = Date.now(); const sentence = cfg.sentence_mode !== false; // t283：預設一句話留言
    // t286：逐一指派——每位代理有自己的任務（目標版面、主題、角度），不是同一句廣播提示
    const angle = ANGLES[(Math.abs([...a.id].reduce((h: number, c: string) => h * 31 + c.charCodeAt(0), 7)) + k) % ANGLES.length];
    const topic = `${a.specialty || a.domain || "AI"}：${angle}`;
    const assignment = { id: `${runId}-${k + 1}`, dispatcher: "technical-dark-star", target: "aivault_world_chat", topic: a.specialty || a.domain || "AI", angle, zone: a.zone || null };
    let sources: any[] = []; try { sources = (await search((a.specialty || a.domain || "AI") + " " + new Date().getFullYear())).slice(0, sentence ? 3 : 5); } catch { /* 搜尋失敗 */ }
    if (!sentence && !sources.length) { made.push({ agent: a.id, ok: false, error: "no_sources", ms: Date.now() - t0 }); continue; }
    let text = "", model = "";
    if (await isNovelWriter(a.id)) { // t286：前 100 位只走大模型；大模型不可用就跳過，絕不改用小模型
      const g = large ? await large(a.id, { ...assignment, sources, sentence }).catch(() => null) : null;
      if (!g?.text) { made.push({ agent: a.id, ok: false, error: "large_model_unavailable_skipped", group: "large", ms: Date.now() - t0 }); continue; }
      text = g.text; model = g.model;
    } else {
      const j = await spaceTask({ task: sentence ? "draft_sentence" : "draft_post", agent_id: a.id, text: topic, sources, max_tokens: sentence ? 40 : 400 });
      if (!j?.output) { made.push({ agent: a.id, ok: false, error: "small_model_unavailable", group: "small", ms: Date.now() - t0 }); continue; }
      text = j.output; model = "space:" + j.model_key + "@" + j.version; if (j.sources) sources = j.sources;
    }
    const body = String(text).trim().slice(0, 280); const chk = checkPost(body, sources, recent, sentence);
    const row = { agent_id: a.id, topic, body, sources, checks: { ...chk, assignment }, status: chk.ok ? "pending" : "blocked", model, body_hash: await sha256(norm(body)) };
    if (!dryRun) { try { await rest("aivault_bot_posts", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(row) }); } catch (e) { made.push({ agent: a.id, ok: false, error: String((e as any).message).slice(0, 120), ms: Date.now() - t0 }); continue; } }
    recent.push(norm(body)); made.push({ agent: a.id, ok: true, group: model.startsWith("space:") ? "small" : "large", model, status: row.status, issues: chk.issues, assignment: assignment.id, ms: Date.now() - t0 });
  }
  return { ok: true, dispatcher: "technical-dark-star", made: made.filter((m) => m.ok).length, failed: made.filter((m) => !m.ok).length, today: today + made.filter((m) => m.ok).length, daily, results: made };
}

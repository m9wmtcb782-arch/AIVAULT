// ?feature=degree：協作池學歷制度（國小1階 → 博士6階，每階10級）。
// 誠實規則：學歷只來自真實考試紀錄；沒考過＝未鑑定。題目與答案只在伺服器（表 aivault_pool_exams，owner-only），代理作答時只看得到題目與自己的學習筆記（閉卷）。
// 學習證明：代理用 web-search 找網頁、真的抓回內容（記錄 URL、HTTP 狀態、位元組、sha256、時間），再由代理自己寫筆記。
import { callModel } from "./floor.ts";
import { cityPublic, quotaState, quotaProbe } from "./city.ts";
import { memFix } from "./mem.ts";
import { commGameStart, commGameTurn, commPendingTests, commTestResult, commPublic } from "./comm.ts";
import { webSearch } from "./web-search.ts";
import { learnRound } from "./learn10.ts";
import { triage, pendingGroups } from "./triage.ts";
import { watch } from "./watch.ts";
import { dailyPlans, getPlans } from "./plans.ts";
import { special } from "./special.ts";
import { orders } from "./orders.ts";
import { labStart, labReport, labPublic, agentLabStats } from "./lab.ts";
import { specialRound, specialDegreePublic, summon, summonState, specialDaily } from "./specialstudy.ts";
const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } });
  const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null;
}
export const TIERS = ["國小", "國中", "高中", "大學", "碩士", "博士"];
export const DIST: Record<string, string> = { llm: "🧠 大型語言模型", img: "🎨 圖像生成模型", av: "🎬 影片與語音模型", code: "💻 程式與代理人工具" };
export const districtOf = (d: string) => { d = String(d || ""); if (/coding|code|data|guard|security|defen|hack|agent|devops|資安|衛士/.test(d)) return "code"; if (/image|3d|design|art/.test(d)) return "img"; if (/video|voice|music|audio|speech/.test(d)) return "av"; return "llm"; };
// 碩士／博士還必須有真實學習紀錄（防止沒讀書只靠底層模型考高分）
export const LEARN_REQ: Record<number, number> = { 5: 5, 6: 15 };
export function mapScore(pct: number, learned: number) {
  let idx = Math.max(1, Math.min(60, Math.round(pct * 60)));
  const cap = learned >= LEARN_REQ[6] ? 60 : learned >= LEARN_REQ[5] ? 50 : 40; const capped = idx > cap; idx = Math.min(idx, cap);
  const tier = Math.ceil(idx / 10); return { tier, level: idx - (tier - 1) * 10, capped };
}
const shuffle = <T>(a: T[]) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// 週考新鮮題：伺服器隨機產生數值，正解由程式計算（不會被背答案）
function freshQs(d: string): any[] {
  const r = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1)); const q: any[] = [];
  if (d === "llm") { const p = r(1, 5), s = r(90, 99), f = r(1, 9); const pp = p / 100, se = s / 100, fp = f / 100; q.push({ id: `gen-llm-bayes-${p}-${s}-${f}`, lv: 4, tp: "機率統計", t: "num", q: `盛行率 ${p}%、敏感度 ${s}%、偽陽性率 ${f}%，陽性者真正患病機率是幾 %？（1 位小數）`, a: Math.round(1000 * pp * se / (pp * se + (1 - pp) * fp)) / 10, tol: 0.6 });
    const n = [25, 64, 100, 144, 400][r(0, 4)], sd = r(5, 40); q.push({ id: `gen-llm-se-${n}-${sd}`, lv: 5, tp: "機率統計", t: "num", q: `n=${n}、標準差 ${sd}，平均數標準誤是多少？（2 位小數）`, a: Math.round(100 * sd / Math.sqrt(n)) / 100, tol: 0.011 }); }
  if (d === "img") { const w = [640, 1280, 2048][r(0, 2)], h = [480, 720, 1536][r(0, 2)]; q.push({ id: `gen-img-px-${w}-${h}`, lv: 2, tp: "影像處理", t: "num", q: `${w}×${h} 的 RGB 8-bit 影像未壓縮佔多少 bytes？`, a: w * h * 3, tol: 0 });
    const b = [0.01, 0.02, 0.05][r(0, 2)], t = r(2, 4); q.push({ id: `gen-img-abar-${b}-${t}`, lv: 6, tp: "擴散模型", t: "num", q: `DDPM 中 β 固定 ${b}，ᾱ_${t} = ?（4 位小數）`, a: Math.round(10000 * Math.pow(1 - b, t)) / 10000, tol: 0.0006 }); }
  if (d === "av") { const f = [24, 25, 30, 60][r(0, 3)], s = r(5, 90); q.push({ id: `gen-av-fr-${f}-${s}`, lv: 2, tp: "影片基礎", t: "num", q: `${f} fps 的影片 ${s} 秒共有幾幀？`, a: f * s, tol: 0 });
    const sr = [16000, 22050, 24000, 48000][r(0, 3)], wn = [256, 512, 1024, 2048][r(0, 3)]; q.push({ id: `gen-av-stft-${sr}-${wn}`, lv: 6, tp: "訊號處理", t: "num", q: `取樣率 ${sr} Hz、STFT 窗長 ${wn} 點，頻率解析度幾 Hz？（3 位小數）`, a: Math.round(1000 * sr / wn) / 1000, tol: 0.01 }); }
  if (d === "code") { const x = r(20, 250); q.push({ id: `gen-code-bin-${x}`, lv: 2, tp: "計算機基礎", t: "num", q: `二進位 ${x.toString(2)} 等於十進位多少？`, a: x, tol: 0 });
    const nn = [3, 5, 7, 9][r(0, 3)]; q.push({ id: `gen-code-raft-${nn}`, lv: 6, tp: "分散式系統", t: "num", q: `Raft 叢集 ${nn} 個節點，最多容忍幾個節點故障？`, a: Math.floor((nn - 1) / 2), tol: 0 }); }
  return q;
}
async function bank(d: string) { const [e] = await rest(`aivault_pool_exams?id=eq.bank-${d}&select=questions`); return (e?.questions || []) as any[]; }
// sp1：暗星／曙光不在一般代理表，紀錄寫進同結構的 aivault_special_* 表（同一套考題、同樣評分、同一學階尺度）
export const SPECIAL_IDS = ["darkstar", "dawn-light"];
const TB = (a: any, k: string) => { const id = typeof a === "string" ? a : a?.id; const sp = SPECIAL_IDS.includes(id); return ({ learning: sp ? "aivault_special_learning" : "aivault_pool_agent_learning", exam: sp ? "aivault_special_exam_answers" : "aivault_pool_exam_answers", degree: sp ? "aivault_special_degree" : "aivault_pool_agent_degree", memory: sp ? "aivault_special_memory" : "aivault_pool_agent_memory" } as any)[k]; };
export async function learnedCount(agent: string, sinceIso?: string) {
  const r = await fetch(URL0 + `/rest/v1/${TB(agent,"learning")}?agent_id=eq.${agent}&http_status=eq.200${sinceIso ? "&fetched_at=gte." + sinceIso : ""}&select=id`, { headers: { ...SRH, Prefer: "count=exact", Range: "0-0" } });
  return Number((r.headers.get("content-range") || "/0").split("/")[1]) || 0;
}
// 閉卷作答：代理只看到題目＋自己真實學過的筆記
export async function sitExam(agent: any, exam: any, qs: any[], think = callModel) {
  const d = districtOf(agent.domain); const tps = [...new Set(qs.map((q) => q.tp))];
  const notes = await rest(`${TB(agent,"learning")}?agent_id=eq.${agent.id}&http_status=eq.200&topic=in.(${tps.map((t) => '"' + t + '"').join(",")})&select=id,topic,notes,url&order=created_at.desc&limit=12`);
  const view = qs.map((q, i) => { const perm: number[] | null = q.c ? shuffle<number>(q.c.map((_: any, k: number) => k)) : null; return { q, i, perm }; });
  const paper = view.map((v) => `Q${v.i + 1}［${v.q.tp}］${v.q.q}` + (v.perm ? "\n" + v.perm.map((k: number, j: number) => "ABCD"[j] + ". " + v.q.c[k]).join("\n") : "（填數值）")).join("\n\n");
  const sys = `${agent.persona || ""}\n你是 AIVAULT 協作池 ${DIST[d]} 的 AI，正在參加 Grok Bot 出題的閉卷考試。只能依靠你自己的知識與下列你自己寫的學習筆記，不得編造。不會就猜，但要誠實。`;
  const user = `【你的學習筆記】\n${notes.map((n: any) => `- [${n.topic}] ${String(n.notes).slice(0, 300)}`).join("\n") || "（你還沒有學習筆記）"}\n\n【考卷】\n${paper}\n\n只輸出 JSON：{"answers":{"Q1":"A 或數值",...}}`;
  const call = await think(sys, user, 2500); const ans = call.v?.answers || {};
  let score = 0, max = 0; const correct: any[] = [], given: any[] = [];
  for (const v of view) { const raw = String(ans["Q" + (v.i + 1)] ?? "").trim(); max += v.q.lv; let ok = false;
    if (v.perm) { const L = raw.toUpperCase().replace(/[^A-D]/g, "").slice(0, 1); const j = L ? "ABCD".indexOf(L) : -1; ok = j >= 0 && v.perm[j] === v.q.a; given.push(j >= 0 ? v.q.c[v.perm[j]] : raw.slice(0, 40)); }
    else { const x = raw === "" ? NaN : parseFloat(raw.replace(/[,，\s]/g, "").replace(/[^\d.\-eE]/g, "")); ok = isFinite(x) && Math.abs(x - v.q.a) <= (v.q.tol || 0) + 1e-9; given.push(raw.slice(0, 40)); }
    if (ok) score += v.q.lv; correct.push(ok); }
  const used = notes.filter((n: any) => tps.includes(n.topic)).map((n: any) => n.id);
  return { score, max, correct, given, used, model: call.model, usage: call.usage, qids: qs.map((q) => q.id) };
}
// lb2：實作門檻。碩士（第 5 階）需 ≥2 件實驗工廠通過的作品，博士（第 6 階）需 ≥5 件；正式／週考升級需至少 1 件通過作品（只讀書沒有作品不能升）。關閉：函式 env LAB_GATE_OFF=1
export async function labPassed(id: string) { if (SPECIAL_IDS.includes(id)) return 0; const r = await fetch(URL0 + `/rest/v1/aivault_lab_experiments?lead_id=eq.${id}&status=eq.passed&select=id`, { headers: { ...SRH, Prefer: "count=exact", Range: "0-0" } }); return Number((r.headers.get("content-range") || "/0").split("/")[1]) || 0; }
// cm3：協作證據（交接協定 handoff 品質＋合併被接受數）。只寫進考試／升級紀錄當證據，不改學階計算、不當門檻。關閉：COLLAB_EVIDENCE_OFF=1
export async function collabEvidence(id: string) {
  if (Deno.env.get("COLLAB_EVIDENCE_OFF") === "1") return null;
  try { const h = await rest(`aivault_comm_handoffs?recipient=eq.${id}&select=handoff_id,accept_id,reject_id,report_id,report_quality`); const g = await rest(`aivault_comm_merges?proposer=eq.${id}&select=status`); const sent = await rest(`aivault_comm_handoffs?sender=eq.${id}&select=handoff_id`);
    const rep = h.filter((x: any) => x.report_id); const q = rep.length ? rep.reduce((s: number, x: any) => s + (x.report_quality || 0), 0) / rep.length : 0;
    return { handoffs_received: h.length, accepted: h.filter((x: any) => x.accept_id).length, rejected: h.filter((x: any) => x.reject_id).length, reported: rep.length, report_quality_avg: Math.round(q * 100) / 100, handoffs_sent: sent.length, merges_proposed: g.length, merges_accepted: g.filter((x: any) => x.status === "accepted").length };
  } catch (_) { return null; }
}
const collabNote = (c: any) => c && (c.handoffs_received || c.handoffs_sent || c.merges_proposed) ? `；協作證據：收到交接 ${c.handoffs_received}（接 ${c.accepted}／回報 ${c.reported}，回報品質 ${c.report_quality_avg}/4）、發出交接 ${c.handoffs_sent}、合併被接受 ${c.merges_accepted}/${c.merges_proposed}` : "";
function labCap(m: any, built: number) { if (Deno.env.get("LAB_GATE_OFF") === "1") return { m, note: "" }; const max = built >= 5 ? 6 : built >= 2 ? 5 : 4; if (m.tier <= max) return { m, note: "" }; return { m: { tier: max, level: 10, capped: true }, note: `；實驗工廠通過作品 ${built} 件（碩士需 2、博士需 5），暫列 ${TIERS[max - 1]}` }; }
export async function placeOne(agent: any, think = callModel) {
  const d = districtOf(agent.domain); const exId = "placement-" + d; const B = await bank(d); if (!B.length) throw new Error("bank missing " + d);
  const qs: any[] = []; for (let lv = 1; lv <= 6; lv++) qs.push(...shuffle(B.filter((q) => q.lv === lv)).slice(0, 2));
  const r = await sitExam(agent, { id: exId }, qs, think); const learned = await learnedCount(agent.id); const built = await labPassed(agent.id); const lc = labCap(mapScore(r.score / r.max, learned), built); const m = lc.m;
  await rest(`${TB(agent,"exam")}?on_conflict=exam_id,agent_id`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ exam_id: exId, agent_id: agent.id, qids: r.qids, answers: r.given, correct: r.correct, score: r.score, max_score: r.max, tier: m.tier, level: m.level, notes_used: r.used, grader: "auto-key", grader_notes: `學習紀錄 ${learned} 筆${m.capped && !lc.note ? "；分數達更高學階但學習紀錄不足，暫列 " + TIERS[m.tier - 1] : ""}${lc.note}${collabNote(await collabEvidence(agent.id))}`, model: r.model, usage: r.usage }) });
  const hist = [{ exam: exId, at: new Date().toISOString(), score: r.score, max: r.max, tier: m.tier, level: m.level }];
  await rest(`${TB(agent,"degree")}?on_conflict=agent_id`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ agent_id: agent.id, district: d, tier: m.tier, level: m.level, placed_at: new Date().toISOString(), last_exam_at: new Date().toISOString(), history: hist, updated_at: new Date().toISOString() }) });
  return { agent: agent.id, kind: "placement", score: r.score, max: r.max, tier: m.tier, level: m.level, capped: m.capped, usage: r.usage };
}
// 正式考／週考：升級需「本週有學習紀錄」；降級照實
export async function examOne(agent: any, exam: any, think = callModel) {
  const d = districtOf(agent.domain); const B = await bank(d); const [deg] = await rest(`${TB(agent,"degree")}?agent_id=eq.${agent.id}&select=*`);
  const prev = await rest(`${TB(agent,"exam")}?agent_id=eq.${agent.id}&select=qids`); const seen = new Set(prev.flatMap((p: any) => p.qids || []));
  const qs: any[] = []; for (let lv = 1; lv <= 6; lv++) { const pool = shuffle(B.filter((q) => q.lv === lv)); qs.push(...[...pool.filter((q) => !seen.has(q.id)), ...pool.filter((q) => seen.has(q.id))].slice(0, exam.kind === "weekly" ? 1 : 2)); }
  qs.push(...freshQs(d));
  const r = await sitExam(agent, exam, qs, think); const week = new Date(Date.now() - 7 * 864e5).toISOString();
  const learnedAll = await learnedCount(agent.id), learnedWeek = await learnedCount(agent.id, week); let m = mapScore(r.score / r.max, learnedAll); const built = await labPassed(agent.id); const lc = labCap(m, built); m = lc.m;
  const old = deg?.tier ? (deg.tier - 1) * 10 + deg.level : 0, nw = (m.tier - 1) * 10 + m.level; let note = `本週學習 ${learnedWeek} 筆／累計 ${learnedAll} 筆／通過作品 ${built} 件` + lc.note + collabNote(await collabEvidence(agent.id));
  if (nw > old && built === 0 && Deno.env.get("LAB_GATE_OFF") !== "1" && deg?.tier) { m = { tier: deg.tier, level: deg.level, capped: true }; note += "；還沒有實驗工廠通過的作品，不得升級"; }
  if (nw > old && learnedWeek === 0) { m = { tier: deg.tier, level: deg.level, capped: true }; note += "；本週沒有學習紀錄，不得升級"; }
  if (exam.kind === "weekly" && old && nw > old + 3) { const k = old + 3; m = { tier: Math.ceil(k / 10), level: k - (Math.ceil(k / 10) - 1) * 10, capped: true }; note += "；週考每次最多升 3 級"; }
  await rest(`${TB(agent,"exam")}?on_conflict=exam_id,agent_id`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ exam_id: exam.id, agent_id: agent.id, qids: r.qids, answers: r.given, correct: r.correct, score: r.score, max_score: r.max, tier: m.tier, level: m.level, notes_used: r.used, grader: "auto-key", grader_notes: note, model: r.model, usage: r.usage }) });
  const hist = [...(deg?.history || []), { exam: exam.id, at: new Date().toISOString(), score: r.score, max: r.max, tier: m.tier, level: m.level }].slice(-30);
  await rest(`${TB(agent,"degree")}?on_conflict=agent_id`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ agent_id: agent.id, district: d, tier: m.tier, level: m.level, placed_at: deg?.placed_at || new Date().toISOString(), last_exam_at: new Date().toISOString(), history: hist, updated_at: new Date().toISOString() }) });
  return { agent: agent.id, kind: exam.kind, exam: exam.id, score: r.score, max: r.max, tier: m.tier, level: m.level, note, usage: r.usage };
}
function strip(html: string) { return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim(); }
async function sha(s: string) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
// 上網學習：挑自己最少讀的課綱主題 → 搜尋 → 真的抓網頁 → 代理自己寫筆記
export async function learnOne(agent: any, think = callModel, fetcher = fetch, search = webSearch) {
  const d = districtOf(agent.domain); const B = await bank(d); const topics = [...new Set(B.map((q) => q.tp))];
  const mine = await rest(`${TB(agent,"learning")}?agent_id=eq.${agent.id}&select=topic,url`); const cnt: Record<string, number> = {}; mine.forEach((x: any) => cnt[x.topic] = (cnt[x.topic] || 0) + 1);
  const topic = topics.sort((a, b) => (cnt[a] || 0) - (cnt[b] || 0) || Math.random() - .5)[0]; const urlsSeen = new Set(mine.map((x: any) => x.url));
  const sub = B.filter((q) => q.tp === topic).map((q) => q.lv).sort().pop() || 3; const query = `${topic} ${["基礎", "入門", "原理", "進階", "研究", "論文"][sub - 1]} ${d === "llm" ? "" : DIST[d].slice(2)}`.trim();
  const sr = await (await search(new Request("http://local", { method: "POST", body: JSON.stringify({ q: query, n: 8 }) }))).json(); const cands = (sr.results || []).filter((x: any) => !urlsSeen.has(x.url) && !/news\.google\.com/.test(x.url));
  for (const c of cands.slice(0, 4)) {
    let res: Response; try { res = await fetcher(c.url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; AIVAULT-learner/1.0)", "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.6" }, redirect: "follow", signal: AbortSignal.timeout(10000) }); } catch { continue; }
    const ct = res.headers.get("content-type") || ""; if (!res.ok || !/html|text/.test(ct)) continue; const raw = (await res.text()).slice(0, 600000); const text = strip(raw); if (text.length < 400) continue;
    const fetched_at = new Date().toISOString(); const excerpt = text.slice(0, 3500);
    const call = await think(`${agent.persona || ""}\n你是 AIVAULT ${DIST[d]} 的 AI，正在上網自學「${topic}」。只能根據下面真的抓回來的網頁內容寫筆記，網頁沒寫的不要編。`, `網址：${res.url || c.url}\n標題：${c.title}\n內容節錄：\n${excerpt}\n\n只輸出 JSON：{"notes":"200–350 字的繁體中文學習筆記：重點概念、公式或數字、可考的事實","relevant":true 或 false（內容是否真的和「${topic}」有關）}`, 1200);
    const notes = String(call.v?.notes || "").trim(); if (!notes) continue;
    const [row] = await rest(`${TB(agent,"learning")}`, { method: "POST", body: JSON.stringify({ agent_id: agent.id, district: d, topic, query, url: res.url || c.url, title: String(c.title || "").slice(0, 200), http_status: res.status, bytes: raw.length, sha256: await sha(raw), excerpt: excerpt.slice(0, 600), notes: (call.v?.relevant === false ? "［自評：此頁與主題關聯低］" : "") + notes.slice(0, 900), model: call.model, usage: call.usage, fetched_at }) });
    await rest(`${TB(agent,"memory")}`, { method: "POST", body: JSON.stringify({ agent_id: agent.id, kind: "learning", content: `上網學習「${topic}」：${notes.slice(0, 300)}（${res.url || c.url}）` }) });
    return { agent: agent.id, kind: "learn", topic, url: row.url, status: res.status, usage: call.usage };
  }
  return { agent: agent.id, kind: "learn", topic, url: null, error: "沒有抓到可用網頁（" + (sr.engine || "no engine") + "）" };
}
async function who(r: Request) {
  const tok = (r.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""); if (SR && tok === SR) return { id: null, cron: true };
  try { const pl = JSON.parse(atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); if (pl.role === "service_role") { const ck = await fetch(URL0 + "/rest/v1/aivault_pool_agents?select=id&limit=1", { headers: { apikey: tok, Authorization: "Bearer " + tok } }); return ck.ok ? { id: null, cron: true } : null; } } catch { /* */ }
  const u = await fetch(URL0 + "/auth/v1/user", { headers: { apikey: SR, Authorization: "Bearer " + tok } }).then((x) => x.ok ? x.json() : null).catch(() => null);
  const role = u?.app_metadata?.role; return u?.id && (role === "owner" || role === "admin") ? { id: u.id as string, cron: false } : null;
}
let PUB: { t: number; d: any } | null = null;
export async function degree(r: Request) {
  if (r.method === "OPTIONS") return new Response("ok", { headers: H });
  try {
    const b = await r.json().catch(() => ({})); const a = String(b.action || "");
    if (a === "ai_presence" || a === "ai_beat") return out(await special(a, b, r)); // ai1：真暗星／曙光活動
    if (a === "plans_public") { const rows = await getPlans(String(b.day || "").match(/^\d{4}-\d{2}-\d{2}$/) ? b.day : undefined); return out({ ok: true, plans: rows.map((x: any) => x.v) }); } // pl1：每日學習計畫＋暗星審核（公開唯讀）
    if (a === "public") { // 公開：只有學階分佈與每位代理的學階（無作答、無名字）
      if (PUB && Date.now() - PUB.t < 30000) return out(PUB.d);
      const ag = await rest("aivault_pool_agents?or=(id.lt.ag-1,id.gte.ah)&select=id,domain&limit=1400"); const dg = await rest("aivault_pool_agent_degree?select=agent_id,tier,level&limit=1400");
      const m: Record<string, any> = {}; dg.forEach((x: any) => m[x.agent_id] = x); const dist: any = {}; let untested = 0;
      const list = ag.map((x: any) => { const g = m[x.id], d = districtOf(x.domain); dist[d] = dist[d] || { untested: 0, tiers: [0, 0, 0, 0, 0, 0], levels: {} };
        if (!g?.tier) { untested++; dist[d].untested++; return [x.id, 0, 0, d]; } dist[d].tiers[g.tier - 1]++; const k = g.tier + "-" + g.level; dist[d].levels[k] = (dist[d].levels[k] || 0) + 1; return [x.id, g.tier, g.level, d]; });
      const as = (await rest("aivault_floor_state?k=eq.assembly&select=v").catch(() => []))[0]?.v; const assembly = as && Date.parse(as.until) > Date.now() ? as : null;
      PUB = { t: Date.now(), d: { ok: true, tiers: TIERS, districts: DIST, list, dist, untested, total: ag.length, assembly: assembly ? { ids: assembly.ids, label: assembly.label, until: assembly.until } : null, next_exam: "2026-10-20T10:00:00+08:00" } }; return out(PUB.d);
    }
    if (a === "lab_public") return out(await labPublic(b));
    if (a === "city_public") return out(await cityPublic()); // city1
    if (a === "comm_public") return out(await commPublic(b)); // cm2
    if (a === "quota_state") return out({ ok: true, ...(await quotaState()) });
    if (a === "agent_lab") { const id = String(b.id || ""); if (!/^ag-\d{4}$/.test(id)) return out({ error: "bad id" }, 400); return out({ ok: true, learned: await learnedCount(id), ...(await agentLabStats(id)), collab: await collabEvidence(id) }); } // lb2：學了→做了→通過
    if (a === "summon_state") return out({ ok: true, now: new Date().toISOString(), s: await summonState() });
    if (a === "learning_now") { // cr1：此刻真的在上網學習的代理（學習鎖還沒到期，或 10 分鐘內有學習紀錄）；只回 id、區、主題
      const now = Date.now(); const locks = await rest("aivault_floor_state?k=like.learnlock:*&select=k,v&limit=2000"); const live = new Map<string, any>();
      locks.forEach((x: any) => { if (Date.parse(x.v?.until) > now && Date.parse(x.v?.until) - now < 30 * 60e3) live.set(x.k.slice(10), { src: "lock" }); });
      const rec = await rest(`aivault_pool_agent_learning?created_at=gte.${new Date(now - 10 * 60e3).toISOString()}&select=agent_id,district,topic,created_at&order=created_at.desc&limit=300`);
      rec.forEach((x: any) => { const o = live.get(x.agent_id) || {}; if (!o.topic) live.set(x.agent_id, { ...o, src: o.src || "record", d: x.district, topic: String(x.topic || "").slice(0, 24), at: x.created_at }); });
      return out({ ok: true, now: new Date().toISOString(), rows: [...live.entries()].map(([id, o]) => [id, o.d || null, o.topic || null, o.src]) }); }
    if (a === "special_daily") return out(await specialDaily(b)); // sd2
    if (a === "special_public") return out(await specialDegreePublic()); // sp1：暗星／曙光學階（公開唯讀，無作答內容）
    const u = await who(r); if (!u) return out({ error: "owner only" }, 403);
    if (a === "agent") { const id = String(b.id || "").replace(/[^\w-]/g, "");
      const [g] = await rest(`aivault_pool_agent_degree?agent_id=eq.${id}&select=*`); const ex = await rest(`aivault_pool_exam_answers?agent_id=eq.${id}&select=id,exam_id,score,max_score,tier,level,grader_notes,model,usage,created_at,notes_used&order=created_at.desc&limit=8`);
      const ln = await rest(`aivault_pool_agent_learning?agent_id=eq.${id}&select=id,topic,url,title,http_status,bytes,sha256,notes,fetched_at,model&order=created_at.desc&limit=30`);
      ln.forEach((l: any) => l.used_in = ex.filter((e: any) => (e.notes_used || []).includes(l.id)).map((e: any) => e.exam_id));
      const sup = (await rest(`aivault_pool_agents?id=eq.${id}&select=supervisor_id`))[0]?.supervisor_id || null; const subs = await rest(`aivault_pool_agents?supervisor_id=eq.${id}&select=id&limit=200`);
      return out({ ok: true, degree: g || null, exams: ex, learning: ln, supervisor_id: sup, subordinates: subs.length }); }
    if (a === "learning_feed") { const lim = Math.min(100, Number(b.limit) || 40), off = Math.max(0, Number(b.offset) || 0);
      let q = `aivault_pool_agent_learning?select=id,agent_id,district,topic,query,url,title,http_status,bytes,sha256,notes,model,usage,fetched_at&order=created_at.desc`; if (b.district) q += "&district=eq." + String(b.district).replace(/\W/g, "");
      const rr = await fetch(URL0 + "/rest/v1/" + q, { headers: { ...SRH, Prefer: "count=exact", Range: `${off}-${off + lim - 1}` } }); const rows = rr.ok ? await rr.json() : [];
      const ids = [...new Set(rows.map((x: any) => x.agent_id))]; const ns = ids.length ? await rest(`aivault_pool_agents?id=in.(${ids.join(",")})&select=id,name`) : [];
      const lids = rows.map((x: any) => x.id); const ex = lids.length ? await rest(`aivault_pool_exam_answers?agent_id=in.(${ids.join(",")})&select=exam_id,agent_id,notes_used,qids,created_at`) : [];
      rows.forEach((x: any) => { x.agent_name = ns.find((n: any) => n.id === x.agent_id)?.name; x.used_in = ex.filter((e: any) => (e.notes_used || []).includes(x.id)).map((e: any) => ({ exam: e.exam_id, at: e.created_at, qids: (e.qids || []).filter((q: string) => q.includes("-")).slice(0, 12) })); });
      return out({ ok: true, total: Number((rr.headers.get("content-range") || "/0").split("/")[1]) || 0, rows }); }
    if (a === "stats") { const dg = await rest("aivault_pool_agent_degree?select=district,tier,level&limit=1400"); const t: any = {}; dg.forEach((x: any) => { const k = x.district + ":" + TIERS[x.tier - 1]; t[k] = (t[k] || 0) + 1; });
      const lc = await fetch(URL0 + "/rest/v1/aivault_pool_agent_learning?http_status=eq.200&select=id", { headers: { ...SRH, Prefer: "count=exact", Range: "0-0" } });
      return out({ ok: true, placed: dg.length, by: t, learning_rows: Number((lc.headers.get("content-range") || "/0").split("/")[1]) || 0 }); }
    if (a === "convene") { if (u.cron) return out({ error: "owner only" }, 403); // 召集：學階範圍 → 走到指揮殿集合；可派任務、可設為管理者
      const lo = Math.max(1, Math.min(60, Number(b.from) || 51)), hi = Math.max(lo, Math.min(60, Number(b.to) || 60)); const dd = b.district && DIST[b.district] ? b.district : null;
      const dg = await rest(`aivault_pool_agent_degree?tier=not.is.null&select=agent_id,district,tier,level&limit=1400`); const pick = dg.filter((x: any) => { const k = (x.tier - 1) * 10 + x.level; return k >= lo && k <= hi && (!dd || x.district === dd); }).sort((x: any, y: any) => (y.tier * 10 + y.level) - (x.tier * 10 + x.level)).slice(0, 120);
      const lab = (k: number) => TIERS[Math.ceil(k / 10) - 1] + Math.ceil(k / 10) + "階" + (k - (Math.ceil(k / 10) - 1) * 10) + "級"; const label = `${lab(lo)}～${lab(hi)}${dd ? "（" + DIST[dd] + "）" : ""}`;
      await rest("aivault_floor_state", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ k: "assembly", v: { ids: pick.map((x: any) => x.agent_id), label, until: new Date(Date.now() + 30 * 60e3).toISOString() }, updated_at: new Date().toISOString() }) }); PUB = null;
      let tasks = 0, supervised = 0; const text = String(b.task || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 600);
      if (text && pick.length) { const ags = await rest(`aivault_pool_agents?id=in.(${pick.slice(0, 10).map((x: any) => x.agent_id).join(",")})&select=id,zone`);
        for (const g of ags) { await rest("aivault_pool_agent_tasks", { method: "POST", body: JSON.stringify({ agent_id: g.id, order_text: `🎓 召集任務（${label}）：${text}`, zone: g.zone, source: "floor", kind: "work", status: "queued", max_steps: 1, created_by: u.id, plan: { command: "convene" } }) }); tasks++; } }
      if (b.supervise && pick.length) { const low = dg.filter((x: any) => (x.tier - 1) * 10 + x.level < lo && (!dd || x.district === dd)); const bosses: Record<string, string[]> = {};
        pick.forEach((p: any) => (bosses[p.district] = bosses[p.district] || []).push(p.agent_id));
        const plan: Record<string, string[]> = {}; low.forEach((x: any, i: number) => { const bs = bosses[x.district]; if (!bs) return; const s = bs[i % bs.length]; (plan[s] = plan[s] || []).push(x.agent_id); });
        for (const s in plan) { for (let i = 0; i < plan[s].length; i += 150) await rest(`aivault_pool_agents?id=in.(${plan[s].slice(i, i + 150).join(",")})`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ supervisor_id: s }) }); supervised += plan[s].length; } }
      return out({ ok: true, label, convened: pick.length, tasks, supervised }); }
    if (a === "cycle") { // 排程：學習＋考試交錯，遇到 Groq 限流就停
      const n = Math.min(12, Math.max(1, Number(b.n) || 4)); const results: any[] = []; const now = new Date().toISOString();
      const UNPL = 1000 - (await rest("aivault_pool_agent_degree?select=agent_id&limit=1400")).length;
      if (b.mode === "place" && b.src === "pg_cron") { const k = "placecall:lock"; const [x] = await rest(`aivault_floor_state?k=eq.${k}&select=v`); if (x && Date.parse(x.v?.until) > Date.now()) return out({ ok: true, skipped_round: true, results: [] });
        await rest("aivault_floor_state", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ k, v: { until: new Date(Date.now() + 4 * 60e3).toISOString(), src: "pg_cron" }, updated_at: new Date().toISOString() }) }); } // pc1
      if (b.mode === "place") { // pd1：平行鑑定（每位代理仍各自一份考卷、各自閉卷作答；一次呼叫就是一整份 12 題考卷）
        const placed = new Set((await rest("aivault_pool_agent_degree?select=agent_id&limit=1400")).map((x: any) => x.agent_id)); const all = await rest("aivault_pool_agents?or=(id.lt.ag-1,id.gte.ah)&select=id,domain,persona&order=id.asc&limit=1400");
        const left = all.filter((x: any) => !placed.has(x.id)).sort(() => Math.random() - .5).slice(0, Math.min(8, n));
        const rs = await Promise.allSettled(left.map((ag: any) => placeOne(ag))); let rl = false;
        rs.forEach((x) => { if (x.status === "fulfilled") results.push(x.value); else { const m = String((x.reason as any)?.message || x.reason); results.push({ error: m.slice(0, 200) }); if (/429|LLM_FAILED/.test(m)) rl = true; } });
        PUB = null; return out({ ok: true, rate_limited: rl && !results.some((x: any) => x.kind === "placement"), partial_429: rl, left: left.length ? UNPL - results.filter((x: any) => x.kind === "placement").length : 0, results });
      }
      const open = await rest(`aivault_pool_exams?kind=in.(promotion,weekly)&opens_at=lte.${now}&or=(closes_at.is.null,closes_at.gt.${now})&select=id,district,kind&order=opens_at.asc`);
      for (let i = 0; i < n; i++) { let job: any = null;
        try {
          // pd1：還有未鑑定代理時，鑑定優先（每 4 個工作只有 1 個學習）；mode=place 只做鑑定。關閉：PLACE_PRIORITY_OFF=1
          const pri = UNPL > 0 && Deno.env.get("PLACE_PRIORITY_OFF") !== "1"; const learnTurn = b.mode === "learn" || (b.mode !== "exam" && b.mode !== "place" && (pri ? i % 4 === 3 : i % 2 === 1));
          if (!learnTurn) { for (const e of (b.mode === "place" ? [] : open)) { const took = await rest(`aivault_pool_exam_answers?exam_id=eq.${e.id}&select=agent_id&limit=1400`); const ids = took.map((x: any) => x.agent_id);
              const c = await rest(`aivault_pool_agent_degree?district=eq.${e.district}&tier=not.is.null${ids.length ? "&agent_id=not.in.(" + ids.join(",") + ")" : ""}&select=agent_id&order=updated_at.asc&limit=1`);
              if (c[0]) { const [ag] = await rest(`aivault_pool_agents?id=eq.${c[0].agent_id}&select=id,domain,persona`); job = await examOne(ag, e); break; } }
            if (!job) { const placed = await rest("aivault_pool_agent_degree?select=agent_id&limit=1400"); const ps = new Set(placed.map((x: any) => x.agent_id));
              const all = await rest("aivault_pool_agents?or=(id.lt.ag-1,id.gte.ah)&select=id,domain,persona&order=id.asc&limit=1400"); const left = all.filter((x: any) => !ps.has(x.id));
              if (left.length) job = await placeOne(left[Math.floor(Math.random() * left.length)]); } }
          if (!job) { const all = await rest("aivault_pool_agents?or=(id.lt.ag-1,id.gte.ah)&select=id,domain,persona,updated_at&order=id.asc&limit=1400"); const ln = await rest(`aivault_pool_agent_learning?created_at=gte.${new Date(Date.now() - 7 * 864e5).toISOString()}&select=agent_id&limit=5000`);
            const c: Record<string, number> = {}; ln.forEach((x: any) => c[x.agent_id] = (c[x.agent_id] || 0) + 1); const ag = all.sort((x: any, y: any) => (c[x.id] || 0) - (c[y.id] || 0) || Math.random() - .5)[0]; job = await learnOne(ag); }
          results.push(job);
        } catch (e) { const msg = String((e as any)?.message || e); results.push({ error: msg.slice(0, 200) }); if (/429|LLM_FAILED/.test(msg)) return out({ ok: true, rate_limited: true, results }); }
      }
      PUB = null; return out({ ok: true, rate_limited: false, results });
    }
    if (/^watch_/.test(a)) { const u3 = await who(r); if (!u3) return out({ error: "owner only" }, 403); try { return out(await watch(a, b)); } catch (e) { return out({ error: String((e as any)?.message || e).slice(0, 400) }, 500); } } // wt1：看影片測試
    if (a === "daily_plan") { const u4 = await who(r); if (!u4) return out({ error: "owner only" }, 403); try { return out(await dailyPlans(b)); } catch (e) { return out({ error: String((e as any)?.message || e).slice(0, 300) }, 500); } }
    if (a === "triage") { const u1 = await who(r); if (!u1) return out({ error: "owner only" }, 403); return out(await triage(b)); } // tr1：練習稿 AI 初審
    if (a === "triage_stats") { const u2 = await who(r); if (!u2) return out({ error: "owner only" }, 403); const g = await pendingGroups(); return out({ ok: true, groups: g.length, items: g.reduce((s, x) => s + x.length, 0), top: g.slice(0, 8).map((x) => [String(x[0].order_text).slice(0, 30), x.length]) }); }
    if (a === "special_round") { const u0 = await who(r); if (!u0) return out({ error: "owner only" }, 403); return out(await specialRound(b)); } // sp1
    if (/^order(s_list|_log|_save|_approve|_revoke)$/.test(a)) { const uo = await who(r); if (!uo || uo.cron) return out({ error: "owner only" }, 403); return out(await orders(a, b, uo.id)); } // so1 長期命令
    if (["comm_game_start", "comm_game_turn", "comm_pending_tests", "comm_test_result"].includes(a)) { const u2 = await who(r); if (!u2) return out({ error: "owner only" }, 403); return out(a === "comm_game_start" ? await commGameStart() : a === "comm_game_turn" ? await commGameTurn(b) : a === "comm_pending_tests" ? await commPendingTests(b) : await commTestResult(b)); }
    if (a === "mem_fix") { const u3 = await who(r); if (!u3) return out({ error: "owner only" }, 403); return out(await memFix(b)); }
    if (a === "quota_probe") { const u1 = await who(r); if (!u1) return out({ error: "owner only" }, 403); return out(await quotaProbe()); }
    if (a === "lab_start" || a === "lab_report") { const u0 = await who(r); if (!u0) return out({ error: "owner only" }, 403); return out(a === "lab_start" ? await labStart(b) : await labReport(b)); } // lb1 實驗工廠
    if (a === "summon") { const u0 = await who(r); if (!u0) return out({ error: "owner only" }, 403); return out(await summon(b, u0.id, String(b.via || "town"))); } // sm1
    if (a === "learn_round") { const u0 = await who(r); if (!u0) return out({ error: "owner only" }, 403); return out(await learnRound(b, (ag: any) => learnOne(ag))); } // ln10：每 10 分鐘四區學習（含學習鎖、每日 token 上限）
    if (a === "peer_review") { // 博士 10 級初審（擁有者仍做最終核准）
      const docs = await rest("aivault_pool_agent_degree?tier=eq.6&level=eq.10&select=agent_id&limit=20"); if (!docs.length) return out({ ok: true, reviewed: 0, note: "目前沒有博士 10 級的 AI" });
      const ts = await rest("aivault_pool_agent_tasks?source=eq.floor&review_status=eq.pending&select=id,agent_id,order_text,result&order=updated_at.asc&limit=10"); const done = await rest(`aivault_pool_peer_reviews?task_id=in.(${ts.map((t: any) => t.id).join(",") || "00000000-0000-0000-0000-000000000000"})&select=task_id`);
      const todo = ts.filter((t: any) => !done.some((d: any) => d.task_id === t.id) && !docs.some((d: any) => d.agent_id === t.agent_id)).slice(0, Math.min(3, Number(b.n) || 2)); const res = [];
      for (const t of todo) { const rv = docs[Math.floor(Math.random() * docs.length)].agent_id; const [ag] = await rest(`aivault_pool_agents?id=eq.${rv}&select=persona,name`);
        const call = await callModel(`${ag.persona}\n你是 AIVAULT 協作池博士 10 級審查員，替擁有者做初審。嚴格、具體、不客套。`, `任務：${t.order_text}\n\n成果：\n${String(t.result || "").slice(0, 6000)}\n\n只輸出 JSON：{"verdict":"建議核准|建議退回|需修改","notes":"150–300 字具體審查意見：錯誤、遺漏、待查證處"}`, 1500);
        await rest("aivault_pool_peer_reviews", { method: "POST", body: JSON.stringify({ task_id: t.id, reviewer_id: rv, verdict: String(call.v?.verdict || "需修改").slice(0, 20), notes: String(call.v?.notes || "").slice(0, 1500), model: call.model, usage: call.usage }) }); res.push({ task: t.id, reviewer: ag.name, verdict: call.v?.verdict }); }
      return out({ ok: true, reviewed: res.length, res }); }
    if (a === "peer_reviews") { const rows = await rest(`aivault_pool_peer_reviews?select=*&order=created_at.desc&limit=${Math.min(100, Number(b.limit) || 30)}`); return out({ ok: true, rows }); }
    return out({ error: "unknown action" }, 400);
  } catch (e) { return out({ error: String((e as any)?.message || e).slice(0, 300) }, 500); }
}

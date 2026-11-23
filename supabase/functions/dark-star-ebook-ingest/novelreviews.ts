// t295/t296：AI 小說書評——暗星逐一指派「固定書評員名冊」中的代理讀章節（或指定片段）→ 一句書評＋引用原文 → 待審佇列 → 擁有者核准 → 暗星指令批次釋出。
// 作者（前 100 位大模型組＋寫過章節／大綱的代理）永不書評：程式與 DB 觸發器雙重把關。書評員不在前 100 位，因此一律走小模型；小模型不可用就跳過。
import { spaceTask, isNovelWriter } from "./smallmodel.ts";
import { checkPost, norm, sha256 } from "./botposts.ts";
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } });
  const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null;
}
export const REVIEW_ANGLES = ["人物刻畫", "情節推進", "文筆與節奏", "對話", "場景氣氛", "伏筆與懸念", "情感張力", "世界觀設定"];
const nz = (x: string) => String(x || "").replace(/[\s，。、！？!?,.：:；;「」『』“”"]/g, "");
// 依段落切塊（每塊約 size 字）
export function chunkText(text: string, size = 1200): string[] {
  const paras = String(text || "").split(/\n+/).map((p) => p.trim()).filter(Boolean); const out: string[] = []; let cur = "";
  for (const p of paras) { if (cur && cur.length + p.length + 1 > size) { out.push(cur); cur = ""; } cur += (cur ? "\n" : "") + p; while (cur.length > size * 1.5) { out.push(cur.slice(0, size)); cur = cur.slice(size); } }
  if (cur) out.push(cur); return out.length ? out : [""];
}
export async function cfgNR() { const [r] = await rest("aivault_floor_state?k=eq.novel_reviews&select=v"); return r?.v || {}; }
// 是否作者（程式端檢查；DB 觸發器另有一道）
export async function isAuthor(agentId: string) {
  if (await isNovelWriter(agentId)) return true;
  const a = await rest(`aivault_novel_chapters?agent_id=eq.${encodeURIComponent(agentId)}&select=ch&limit=1`);
  const b = await rest(`aivault_novel_books?outline_agent=eq.${encodeURIComponent(agentId)}&select=id&limit=1`);
  return a.length > 0 || b.length > 0;
}
// 長章節：切塊摘要一次並快取（所有書評員共用）
async function digestFor(book: string, ch: number, text: string, agentId: string, chunkSize: number) {
  const h = await sha256(text);
  const [c] = await rest(`aivault_novel_chapter_digests?book_id=eq.${book}&ch=eq.${ch}&select=digest,text_hash`);
  if (c && c.text_hash === h) return c.digest as string;
  const parts: string[] = [];
  for (const ck of chunkText(text, chunkSize)) { const j = await spaceTask({ task: "chunk_digest", agent_id: agentId, text: ck, max_tokens: 120 }); if (!j?.output) return null; parts.push(j.output); }
  const digest = parts.join(" ").slice(0, 1200);
  await rest("aivault_novel_chapter_digests?on_conflict=book_id,ch", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ book_id: book, ch, text_hash: h, digest, model: "space:darkstar-qwen3-1.7b" }) }).catch(() => null);
  return digest;
}
export function checkReview(review: string, quote: string, chapterText: string, recent: string[]) {
  const c = checkPost(review, [], recent, true); const issues = [...c.issues];
  if (!quote || nz(quote).length < 6) issues.push("no_quote"); else if (!nz(chapterText).includes(nz(quote))) issues.push("quote_not_in_text");
  return { ok: issues.length === 0, issues };
}
// 暗星派工：每位書評員各自一個 (書, 章, 片段, 角度)
export type LargeReview = (agentId: string, a: { title: string; ch: number; angle: string; text: string }) => Promise<{ review: string; quote: string; model: string } | null>;
export async function dispatchReviews(nWanted?: number, dryRun = false, large?: LargeReview) {
  const cfg = await cfgNR(); if (cfg.enabled === false) return { ok: false, error: "novel_reviews disabled" };
  const perRun = Math.min(50, Number(nWanted || cfg.per_run || 6)), daily = Number(cfg.daily_batch || 120), cool = Number(cfg.agent_cooldown_days || 7);
  const fullMax = Number(cfg.full_text_max_chars || 2400), chunkSize = Number(cfg.chunk_chars || 1200);
  const dayStart = new Date(Date.now() - 86400e3).toISOString();
  const today = (await rest(`aivault_bot_posts?target=eq.novel&created_at=gte.${dayStart}&select=id&limit=5000`)).length;
  const room = Math.max(0, Math.min(perRun, daily - today)); if (!room) return { ok: true, made: 0, reason: "daily_batch reached" };
  const bks = await rest("aivault_novel_books?approved=eq.true&select=id,title");
  if (!bks.length) return { ok: true, made: 0, reason: "no approved books" };
  const chs = await rest(`aivault_novel_chapters?book_id=in.(${bks.map((x: any) => x.id).join(",")})&or=(review_status.is.null,review_status.eq.approved)&select=book_id,ch,chars&order=book_id.asc,ch.asc&limit=5000`);
  if (!chs.length) return { ok: true, made: 0, reason: "no readable chapters" };
  const roster = await rest("aivault_novel_reviewers?select=agent_id,rank,model_tier&order=rank.asc&limit=10000");
  const coolSince = new Date(Date.now() - cool * 86400e3).toISOString();
  const busy = new Set((await rest(`aivault_bot_posts?target=eq.novel&created_at=gte.${coolSince}&select=agent_id&limit=10000`)).map((r: any) => r.agent_id));
  const avail = roster.filter((r: any) => !busy.has(r.agent_id)); const picked: string[] = []; const tier = new Map<string, string>();
  while (picked.length < room && avail.length) { const r = avail.splice(Math.floor(Math.random() * avail.length), 1)[0]; picked.push(r.agent_id); tier.set(r.agent_id, r.model_tier === "large" ? "large" : "small"); }
  const recent = (await rest("aivault_bot_posts?target=eq.novel&select=body&order=created_at.desc&limit=200")).map((r: any) => norm(r.body));
  const runId = "nr-" + Date.now().toString(36); const made: any[] = [];
  for (const [k, agent] of picked.entries()) {
    const t0 = Date.now();
    if (await isAuthor(agent)) { made.push({ agent, ok: false, error: "author_cannot_review" }); continue; } // t296
    const c = chs[Math.floor(Math.random() * chs.length)]; const bk = bks.find((x: any) => x.id === c.book_id);
    const [full] = await rest(`aivault_novel_chapters?book_id=eq.${c.book_id}&ch=eq.${c.ch}&select=text`); const text = String(full?.text || "");
    const angle = REVIEW_ANGLES[(k + c.ch) % REVIEW_ANGLES.length];
    let excerpt = text, digest: string | null = null, chunk = 0;
    if (tier.get(agent) === "large") { // t297：大模型書評員——整章交給大模型（上下文足夠，不切塊）；不可用就跳過，永不改用小模型
      const g = large ? await large(agent, { title: bk?.title || "", ch: c.ch, angle, text: text.slice(0, 12000) }).catch(() => null) : null;
      if (!g?.review) { made.push({ agent, tier: "large", ok: false, error: "large_model_unavailable_skipped", ms: Date.now() - t0 }); continue; }
      const chk = checkReview(g.review, g.quote, text, recent);
      const row = { agent_id: agent, target: "novel", topic: `《${bk?.title || ""}》第${c.ch}章：${angle}`, body: String(g.review).slice(0, 120), sources: [], ref: { book_id: c.book_id, ch: c.ch, chunk: null, quote: g.quote, tier: "large", assignment: { id: `${runId}-${k + 1}`, angle } },
        checks: { ...chk }, status: chk.ok ? "pending" : "blocked", model: g.model, body_hash: await sha256("novel:" + norm(g.review)) };
      if (!dryRun) { try { await rest("aivault_bot_posts", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(row) }); } catch (e) { made.push({ agent, ok: false, error: String((e as any).message).slice(0, 160) }); continue; } }
      recent.push(norm(g.review)); made.push({ agent, tier: "large", ok: true, status: row.status, issues: chk.issues, book: c.book_id, ch: c.ch, angle, review: row.body, quote: g.quote, ms: Date.now() - t0 }); continue;
    }
    if (text.length > fullMax) { const cks = chunkText(text, chunkSize); chunk = Math.floor(Math.random() * cks.length); excerpt = cks[chunk]; digest = await digestFor(c.book_id, c.ch, text, agent, chunkSize); if (!digest) { made.push({ agent, ok: false, error: "small_model_unavailable", ms: Date.now() - t0 }); continue; } }
    const assignment = { id: `${runId}-${k + 1}`, dispatcher: "technical-dark-star", book_id: c.book_id, ch: c.ch, chunk, angle };
    const j = await spaceTask({ task: "review_sentence", agent_id: agent, text: excerpt, meta: { title: bk?.title, ch: c.ch, angle, digest }, max_tokens: 160 });
    if (!j?.output) { made.push({ agent, ok: false, error: "small_model_unavailable", ms: Date.now() - t0 }); continue; }
    const chk = checkReview(j.output, j.quote, text, recent);
    const row = { agent_id: agent, target: "novel", topic: `《${bk?.title || ""}》第${c.ch}章：${angle}`, body: String(j.output).slice(0, 120), sources: [], ref: { book_id: c.book_id, ch: c.ch, chunk, quote: j.quote, assignment },
      checks: { ...chk, assignment }, status: chk.ok ? "pending" : "blocked", model: "space:" + j.model_key + "@" + j.version, body_hash: await sha256("novel:" + norm(j.output)) };
    if (!dryRun) { try { await rest("aivault_bot_posts", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(row) }); } catch (e) { made.push({ agent, ok: false, error: String((e as any).message).slice(0, 160) }); continue; } }
    recent.push(norm(j.output)); made.push({ agent, tier: "small", ok: true, status: row.status, issues: chk.issues, book: c.book_id, ch: c.ch, chunk, angle, review: row.body, quote: j.quote, ms: Date.now() - t0 });
  }
  return { ok: true, dispatcher: "technical-dark-star", run: runId, made: made.filter((m) => m.ok).length, results: made };
}
// 公開讀：只回已核准書籍的 approved 留言（不回 user_id）
export async function listComments(book: string, ch?: number) {
  const id = String(book || "").replace(/[^0-9a-f-]/g, ""); const [bk] = await rest(`aivault_novel_books?id=eq.${id}&approved=eq.true&select=id`); if (!bk) return { ok: false, error: "not found" };
  const since = new Date(Date.now() - 7 * 86400e3).toISOString(); // t297：只顯示 7 天內
  const q = `aivault_novel_comments?book_id=eq.${id}&status=eq.approved&created_at=gt.${since}` + (ch ? `&or=(ch.eq.${Number(ch)},ch.is.null)` : "") + "&select=id,ch,author_kind,agent_id,display_name,body,ai_label,model,quote,created_at&order=created_at.desc&limit=100";
  return { ok: true, comments: await rest(q) };
}
// 人類留言：登入會員；限流；自動檢查通過→approved（可由 human_auto_approve 關閉），否則 pending 待審
export async function humanComment(user: { id: string; email?: string; user_metadata?: any }, b: any) {
  const cfg = await cfgNR(); const id = String(b.book_id || "").replace(/[^0-9a-f-]/g, ""); const ch = b.ch ? Math.max(1, Number(b.ch) || 1) : null;
  const body = String(b.body || "").trim(); if (body.length < 1 || body.length > 500) return { ok: false, error: "length" };
  const [bk] = await rest(`aivault_novel_books?id=eq.${id}&approved=eq.true&select=id`); if (!bk) return { ok: false, error: "not found" };
  const hit = async (k: string, lim: number, win: number) => await rest("rpc/aivault_rate_hit", { method: "POST", body: JSON.stringify({ p_bucket: k, p_limit: lim, p_window_s: win }) });
  if (!(await hit("nc:min:" + user.id, Number(cfg.human_per_min || 3), 60)) || !(await hit("nc:day:" + user.id, Number(cfg.human_per_day || 30), 86400))) return { ok: false, error: "rate_limited" };
  const chk = checkPost(body, [], [], false); const issues = chk.issues.filter((i) => i !== "no_sources" && i !== "too_short");
  const status = issues.length === 0 && cfg.human_auto_approve !== false ? "approved" : "pending";
  const name = String(user.user_metadata?.display_name || user.user_metadata?.full_name || "AIVAULT 會員").slice(0, 40);
  const [row] = await rest("aivault_novel_comments", { method: "POST", body: JSON.stringify({ book_id: id, ch, author_kind: "human", user_id: user.id, display_name: name, body, status }) });
  return { ok: true, id: row?.id, status, issues };
}

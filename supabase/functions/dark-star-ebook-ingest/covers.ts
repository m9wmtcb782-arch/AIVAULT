// t310–t317：小說封面——暗星管理的 Gemini 畫封面佇列（預設關閉）。沒有硬性出版閘門：無 Gemini 封面照常上架、標記 cover_pending，暗星每日在免費額度內重試，成功自動綁定。
// 每次 Gemini 嘗試都寫入 aivault_novel_cover_attempts（novel_id、時間、模型、HTTP 狀態、錯誤分類、去除金鑰的錯誤訊息）。
// 只用 Gemini 圖像模型（設定表指定一個），不備援任何付費或其他供應商；每日上限可調；遇 429／配額錯誤立即停止，隔天（台北時間）續跑。
// 產出轉 JPG 後存第一基地 Storage 公開 bucket novel-covers；綁定只寫 dark_star_ebooks.cover_url／cover_storage_path／cover_source='gemini'。
// 啟用需「兩把鎖」同時打開：函式密鑰 NOVEL_COVER_GEMINI_ENABLED=1 與 aivault_novel_cover_config.enabled=true（確認免費層後由創辦人決定）。
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
const URL0 = Deno.env.get("SUPABASE_URL") || "", SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SRH = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
export const BUCKET = "novel-covers";
type F = typeof fetch; let F0: F = (...a) => fetch(...a); export function _setFetch(f: F) { F0 = f; }
async function rest(path: string, init: RequestInit = {}) {
  const r = await F0(URL0 + "/rest/v1/" + path, { ...init, headers: { ...SRH, Prefer: "return=representation", ...(init.headers || {}) } });
  const t = await r.text(); if (!r.ok) throw new Error("DB " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null;
}
const geminiKey = () => Deno.env.get("NOVEL_COVER_GEMINI_KEY_ENV") ? (Deno.env.get(Deno.env.get("NOVEL_COVER_GEMINI_KEY_ENV")!) || "") : (Deno.env.get("GEMINI_API_KEY") || "");
export const taipeiDay = (d = new Date()) => new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
export function coverPrompt(n: { title: string; genre?: string; outline?: string; chapters?: string[] }) {
  const ctx = (String(n.outline || "").slice(0, 1200) + "\n" + (n.chapters || []).map((c) => c.slice(0, 600)).join("\n")).replace(/\s+/g, " ").trim();
  return `為一本繁體中文${n.genre || ""}小說《${n.title}》繪製直式書籍封面插畫（2:3 直幅）。依下列故事摘要與章節內容，畫出最能代表本書的場景、主角與意象，風格精緻、構圖有層次、色調符合類型氛圍。` +
    `畫面上方留出書名區域；不要出現任何文字、浮水印或標誌。\n故事內容：${ctx}`;
}
export async function toJpeg(b64: string, mime: string) {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (/jpe?g/.test(mime)) return raw;
  const img = await Image.decode(raw); return await img.encodeJPEG(88);
}
export class QuotaError extends Error {}
export class CoverError extends Error { constructor(public category: string, public status: number | null, msg: string) { super(msg); } }
// 去除金鑰：實際金鑰值與任何 AIza… 形式
export function redact(s: string) { let t = String(s || ""); const k = geminiKey(); if (k.length >= 12) t = t.split(k).join("[REDACTED]"); return t.replace(/AIza[0-9A-Za-z_\-]{20,}/g, "[REDACTED]").replace(/key=[^&\s"]+/gi, "key=[REDACTED]").slice(0, 500); }
// 錯誤分類：quota_exhausted／model_not_allowed／safety_block／timeout／other
export function classify(status: number | null, body: string) {
  const b = body || "";
  if (/limit:\s*0\b|free[_ ]tier|not available on the free|billing|not found for API version|is not supported|not supported for generateContent|PERMISSION_DENIED|does not have access/i.test(b) || status === 403 || status === 404) return "model_not_allowed";
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(b)) return "quota_exhausted";
  if (/SAFETY|PROHIBITED_CONTENT|IMAGE_SAFETY|blockReason|RECITATION/i.test(b)) return "safety_block";
  return "other";
}
async function logAttempt(bookId: string, model: string, status: number | null, category: string, message: string) {
  await rest("aivault_novel_cover_attempts", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ book_id: bookId, model, http_status: status, category, message: redact(message) }) }).catch(() => null);
}
// 呼叫 Gemini 圖像（單一模型，無任何備援）。每次結果都記錄；配額／不允許 → 立即停整批
export async function geminiImage(model: string, prompt: string, bookId = "") {
  const key = geminiKey(); if (!key) { await logAttempt(bookId, model, null, "other", "no_gemini_key"); throw new CoverError("other", null, "no_gemini_key"); }
  let r: Response, t = "";
  try {
    r = await F0(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "2:3" } } }), signal: AbortSignal.timeout(90000) });
    t = await r.text();
  } catch (e) { const to = /timeout|abort/i.test(String((e as any)?.name) + String((e as any)?.message)); await logAttempt(bookId, model, null, to ? "timeout" : "other", String((e as any)?.message || e)); throw new CoverError(to ? "timeout" : "other", null, String((e as any)?.message || e)); }
  if (!r.ok) { const c = classify(r.status, t); await logAttempt(bookId, model, r.status, c, t); if (c === "quota_exhausted" || c === "model_not_allowed") throw new QuotaError(c + " " + r.status); throw new CoverError(c, r.status, t.slice(0, 200)); }
  const j = JSON.parse(t); const p = (j.candidates?.[0]?.content?.parts || []).find((x: any) => x.inlineData?.data);
  if (!p) { const c = classify(r.status, JSON.stringify({ f: j.candidates?.[0]?.finishReason, b: j.promptFeedback?.blockReason }) ) === "safety_block" ? "safety_block" : "other"; await logAttempt(bookId, model, r.status, c, "no_image " + JSON.stringify({ finishReason: j.candidates?.[0]?.finishReason, blockReason: j.promptFeedback?.blockReason })); throw new CoverError(c, r.status, "gemini_no_image"); }
  await logAttempt(bookId, model, r.status, "ok", "image " + String(p.inlineData.mimeType || ""));
  return { b64: p.inlineData.data as string, mime: String(p.inlineData.mimeType || "image/png") };
}
async function sha(b: Uint8Array) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(b)))].map((x) => x.toString(16).padStart(2, "0")).join(""); }
async function bookContext(id: string) {
  const [b] = await rest(`aivault_novel_books?id=eq.${id}&select=id,title,genre,outline`); if (!b || !b.title) return null;
  const chs = await rest(`aivault_novel_chapters?book_id=eq.${id}&select=text&order=ch.asc&limit=3`);
  return { id, title: b.title, genre: b.genre, outline: typeof b.outline === "string" ? b.outline : JSON.stringify(b.outline || ""), chapters: chs.map((c: any) => String(c.text || "")) };
}
export async function coverConfig() {
  const [c] = await rest("aivault_novel_cover_config?id=eq.1&select=*").catch(() => [null]);
  return { enabled: !!c?.enabled && Deno.env.get("NOVEL_COVER_GEMINI_ENABLED") === "1", cap: Math.max(0, Number(c?.daily_cap ?? 0)), model: String(c?.model || "gemini-3.1-flash-lite-image"), pausedUntil: c?.quota_paused_until || null, raw: c };
}
// 暗星排程入口：補排入缺封面的小說 → 依佇列處理到每日上限或遇配額錯誤
export async function runCoverJobs(opts: { dryRun?: boolean } = {}) {
  const cfg = await coverConfig(); const day = taipeiDay();
  await rest("rpc/aivault_novel_cover_enqueue_missing", { method: "POST", body: "{}" }).catch(() => null);
  const queue = await rest("aivault_novel_cover_jobs?status=in.(queued,quota_wait)&select=book_id,attempts&order=created_at.asc&limit=50");
  if (opts.dryRun || !cfg.enabled) return { ok: true, enabled: cfg.enabled, reason: cfg.enabled ? "dry_run" : "disabled（未確認 Gemini 免費層，維持關閉）", queued: queue.length, cap: cfg.cap, model: cfg.model };
  if (cfg.pausedUntil && cfg.pausedUntil >= day) return { ok: true, paused: true, until: cfg.pausedUntil, queued: queue.length };
  const used = (await rest(`aivault_novel_cover_jobs?attempt_day=eq.${day}&select=book_id`)).length;
  let left = cfg.cap - used; const done: any[] = [];
  for (const j of queue) {
    if (left <= 0) { done.push({ stop: "daily_cap", cap: cfg.cap }); break; }
    const n = await bookContext(j.book_id); if (!n) { await rest(`aivault_novel_cover_jobs?book_id=eq.${j.book_id}`, { method: "PATCH", body: JSON.stringify({ status: "failed", error: "no_title_or_book" }) }); continue; }
    const prompt = coverPrompt(n); left--;
    await rest(`aivault_novel_cover_jobs?book_id=eq.${j.book_id}`, { method: "PATCH", body: JSON.stringify({ status: "running", attempts: (j.attempts || 0) + 1, attempt_day: day, prompt, model: cfg.model }) });
    try {
      const img = await geminiImage(cfg.model, prompt, j.book_id); const jpg = await toJpeg(img.b64, img.mime); const h = (await sha(jpg)).slice(0, 16);
      const dupe = await rest(`aivault_novel_cover_jobs?image_sha=eq.${h}&select=book_id`); if (dupe.length) throw new Error("duplicate_image");
      const path = `${j.book_id}-${h}.jpg`;
      const up = await F0(`${URL0}/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers: { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "max-age=31536000" }, body: new Blob([new Uint8Array(jpg)], { type: "image/jpeg" }) });
      if (!up.ok) throw new Error("upload " + up.status);
      const url = `${URL0}/storage/v1/object/public/${BUCKET}/${path}`;
      await rest(`aivault_novel_cover_jobs?book_id=eq.${j.book_id}`, { method: "PATCH", body: JSON.stringify({ status: "done", url, storage_path: `${BUCKET}/${path}`, image_sha: h, error: null }) });
      await rest(`dark_star_ebooks?id=eq.${j.book_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ cover_url: url, cover_storage_path: `${BUCKET}/${path}`, cover_source: "gemini" }) }); // 電子書列尚未建立時，由 DB 觸發器在建立時補綁
      done.push({ book: j.book_id, title: n.title, url, sha: h });
    } catch (e) {
      if (e instanceof QuotaError) { // 配額用盡或模型不允許（免費層 limit 0）：本筆退回佇列、暫停到明天，絕不改用付費或其他模型
        await rest(`aivault_novel_cover_jobs?book_id=eq.${j.book_id}`, { method: "PATCH", body: JSON.stringify({ status: "quota_wait", attempt_day: null, error: String(e.message) }) });
        await rest("aivault_novel_cover_config?id=eq.1", { method: "PATCH", body: JSON.stringify({ quota_paused_until: day }) });
        done.push({ stop: "quota", book: j.book_id }); break;
      }
      await rest(`aivault_novel_cover_jobs?book_id=eq.${j.book_id}`, { method: "PATCH", body: JSON.stringify({ status: (j.attempts || 0) + 1 >= 3 ? "failed" : "queued", error: String((e as any).message).slice(0, 200) }) });
      done.push({ book: j.book_id, error: String((e as any).message).slice(0, 120) });
    }
  }
  return { ok: true, day, cap: cfg.cap, used_before: used, results: done };
}

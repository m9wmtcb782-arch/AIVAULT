// ce0：因果引擎 v0（不二過）。純 JS，Deno 與 Node 共用；不含任何金鑰、不直接連資料庫（store 由呼叫端注入）。
// 預設關閉：CAUSAL_ENGINE_ON !== "1" 時 lab.ts 完全不呼叫本檔。
export const ERROR_CLASSES = ["rate_limit_429", "quality_fail", "timeout", "parse_error", "other"];
export function classify(err) {
  const m = String(err?.message ?? err ?? "");
  if (/\b429\b|rate.?limit|QUOTA_SLEEP|RESOURCE_EXHAUSTED/i.test(m)) return "rate_limit_429";
  if (/timeout|timed out|AbortError|ETIMEDOUT/i.test(m)) return "timeout";
  if (/nojson|JSON|parse|returned no (code|tests)|Unexpected token/i.test(m)) return "parse_error";
  if (/assert|test(s)? (failed|未通過)|not ok|quality|verify/i.test(m)) return "quality_fail";
  return "other";
}
const LESSON = {
  rate_limit_429: "上次被限流：先退避再重試，或改用設定的免費備援模型",
  timeout: "上次逾時：縮短輸出、降低 max_tokens",
  parse_error: "上次輸出不是合法 JSON：只輸出單一 JSON 物件，不加說明文字",
  other: "上次發生未分類錯誤：照規格逐條檢查",
};
export function rootCauseAndLesson(cls, detail = "") {
  const d = String(detail).replace(/(sk|gsk|key)[-_][A-Za-z0-9]{6,}/g, "[redacted]").slice(0, 300);
  if (cls === "quality_fail") return { root_cause: d || "tests failed", lesson: "避免重犯：" + (d || "上次測試未通過，逐條對照規格") };
  return { root_cause: d || cls, lesson: LESSON[cls] || LESSON.other };
}
export async function sha256(s) {
  const b = new TextEncoder().encode(String(s)); const h = await crypto.subtle.digest("SHA-256", b);
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export class MemoryStore { constructor() { this.rows = []; } async insert(r) { this.rows.push({ ...r, created_at: new Date().toISOString() }); } async recent(task_type, limit = 50) { return this.rows.filter((r) => r.task_type === task_type).slice(-limit).reverse(); } }
export async function recordOutcome(store, { agent_id = null, district = null, task_type, input, decision = {}, pass, error, detail, ref = null }) {
  const input_hash = await sha256(input ?? "");
  if (pass) return store.insert({ agent_id, district, task_type, input_hash, decision, outcome: "pass", error_class: null, root_cause: null, lesson: null, ref });
  const error_class = classify(error ?? detail); const { root_cause, lesson } = rootCauseAndLesson(error_class, detail ?? error?.message ?? error);
  return store.insert({ agent_id, district, task_type, input_hash, decision, outcome: "fail", error_class, root_cause, lesson, ref });
}
// 新任務前：查過去教訓，回傳建議
export async function guidance(store, task_type, { maxLessons = 3 } = {}) {
  const rows = await store.recent(task_type, 50); const fails = rows.filter((r) => r.outcome === "fail");
  const recent429 = fails.filter((r) => r.error_class === "rate_limit_429").length;
  const seen = new Set(); const lessons = [];
  for (const r of fails) if (r.error_class !== "rate_limit_429" && r.lesson && !seen.has(r.lesson)) { seen.add(r.lesson); lessons.push(r.lesson); if (lessons.length >= maxLessons) break; }
  return { retryOn429: true, maxRetries: recent429 ? 3 : 2, backoffMs: recent429 ? 2000 : 1000, useFallbackOn429: true, promptAddendum: lessons.length ? "\n【不二過：過去同類任務的失敗教訓】\n- " + lessons.join("\n- ") : "", lessons, recent429 };
}
// 包裝一次模型呼叫：先過額度守門（fail-closed），429 時退避重試／改用備援模型；每次嘗試都要先 reserve。
export async function guardedCall({ call, system, user, maxTokens, quota, provider = "groq", fallbackModel = null, g, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), ref }) {
  const sys = system + (g?.promptAddendum || ""); let lastErr; const tries = 1 + (g?.retryOn429 ? g.maxRetries : 0);
  for (let i = 0; i < tries; i++) {
    const model = i > 0 && g?.useFallbackOn429 && fallbackModel ? fallbackModel : null;
    const q = quota ? await quota.reserve({ provider, consumer: "pool_learning", units: 1, ref }) : { allowed: false, reason: "QUOTA_GUARD_MISSING" };
    if (!q?.allowed) { const e = new Error("CAUSAL_QUOTA_DENIED " + (q?.reason || "unknown")); e.quotaDenied = true; throw e; }
    try { return await call(sys, user, maxTokens, model); }
    catch (e) { lastErr = e; if (classify(e) !== "rate_limit_429") throw e; if (i < tries - 1) await sleep(g.backoffMs * 2 ** i); }
  }
  throw lastErr;
}

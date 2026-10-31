// 比對：exact hash 快速路徑 → 向量相似度。決策 HIT_CORRECT / HIT_ERROR / MISS。
import { normalize, qhash } from "./memory.mjs";
import { extractSignature } from "./signature.mjs";
export const DEFAULTS = { correctThreshold: Number(process.env.EXP_CORRECT_THRESHOLD) || 0.9, errorThreshold: Number(process.env.EXP_ERROR_THRESHOLD) || 0.85, numberGuard: process.env.EXP_NUMBER_GUARD !== "0", autoReuseEmbedding: process.env.EXP_AUTO_REUSE_EMBEDDING === "1", sigGuard: process.env.EXP_SIG_GUARD === "1" };
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const nums = (s) => (normalize(s).match(/\d+(\.\d+)?/g) || []).sort().join("|");
export async function match(store, embed, task_type, question, opts = {}) {
  const o = { ...DEFAULTS, ...opts }; const t0 = performance.now();
  const ex = store.byHash.get(qhash(task_type, question));
  if (ex?.length) { const c = ex.find((x) => x.bank === "correct_experience"), er = ex.filter((x) => x.bank === "error_experience");
    if (c) return { decision: "HIT_CORRECT", via: "exact", sim: 1, entry: c.e, avoid: er.map((x) => x.e.answer), ms: performance.now() - t0 }; }
  const [v] = await embed([normalize(question)]);
  const best = (bank) => { let b = null, s = -1; for (const e of store.mem[bank]) if (e.task_type === task_type) { const d = dot(v, e.vec); if (d > s) { s = d; b = e; } } return { e: b, sim: s }; };
  const sk = (q) => extractSignature({ task_type, question: q }).key; // v2：推理簽章（方向）不同就不算同一題
  const sigOk = (e) => { if (!o.sigGuard) return true; const a = sk(e.question), b = sk(question); return a.includes("|other|") || b.includes("|other|") || a === b; };
  const guard = (e) => (!o.numberGuard || nums(e.question) === nums(question)) && sigOk(e);
  const c = best("correct_experience"), er = best("error_experience");
  const ms = () => performance.now() - t0;
  if (c.e && c.sim >= o.correctThreshold && guard(c.e)) return { decision: "HIT_CORRECT", via: "embedding", sim: c.sim, entry: c.e, requiresVerification: !o.autoReuseEmbedding, ms: ms() }; // v1 評測：語意命中仍有 ~12% 誤用，預設要先驗證才可重用
  if (er.e && er.sim >= o.errorThreshold && guard(er.e)) return { decision: "HIT_ERROR", via: "embedding", sim: er.sim, entry: er.e, avoid: [er.e.answer], ms: ms() };
  return { decision: "MISS", sim: c.sim, nearest: c.e?.id ?? null, ms: ms() };
}
// MISS → 升級大模型：只定義介面。先過額度守門（fail-closed），v1 不實作真正呼叫。
export async function escalate({ quota, provider, question, avoid = [], callBigModel }) {
  const q = quota ? await quota.reserve({ provider, consumer: "pool_learning", units: 1, ref: "experience-miss" }) : { allowed: false, reason: "QUOTA_GUARD_MISSING" };
  if (!q?.allowed) return { ok: false, reason: q?.reason || "QUOTA_DENIED" };
  if (!callBigModel) return { ok: false, reason: "BIG_MODEL_NOT_CONFIGURED" };
  return { ok: true, result: await callBigModel(question, { avoid }) };
}

// 回想：先查錯誤庫（不二過）→ exact → semantic（MiniLM）→ 推理簽章。回傳 { decision, warn[], reuse }
import { match } from "../../experience-memory/src/matcher.mjs"; import { extractSignature } from "../../experience-memory/src/signature.mjs";
export async function recall(store, embed, { task_type, question }, opts = {}) {
  const sig = extractSignature({ task_type, question }); const warn = [];
  // 1) 錯誤庫優先：簽章相同的錯誤經驗
  if (!sig.key.includes("|other|")) for (const e of store.mem.error_experience) if (e.task_type === task_type && extractSignature({ task_type, question: e.question }).key === sig.key) warn.push({ via: "signature", id: e.id, answer: e.answer });
  // 2) exact → semantic（含數字與方向保護）
  const m = await match(store, embed, task_type, question, { numberGuard: true, sigGuard: true, ...opts });
  if (m.decision === "HIT_ERROR") warn.push({ via: "semantic", id: m.entry.id, answer: m.entry.answer });
  const reuse = m.decision === "HIT_CORRECT" && !warn.some((w) => w.answer === m.entry.answer) ? m : null;
  return { decision: reuse ? (reuse.via === "exact" ? "REUSE" : "CANDIDATE_VERIFY") : warn.length ? "WARN_KNOWN_ERROR" : "MISS", warn, reuse, sig: sig.key };
}

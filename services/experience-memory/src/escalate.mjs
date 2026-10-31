// v2：師徒升級順序 memory → 免費 Groq → Gemini（最後）。只有 stub；每一步先過額度守門（fail-closed）；不做真實呼叫。
export const ORDER = ["memory", "groq", "gemini"];
export async function askMaster({ level, quota, question, avoid = [], impl = {} }) {
  const q = quota ? await quota.reserve({ provider: level, consumer: "pool_learning", units: 1, ref: "master:" + level }) : { allowed: false, reason: "QUOTA_GUARD_MISSING" };
  if (!q?.allowed) return { ok: false, reason: q?.reason || "QUOTA_DENIED" };
  if (!impl[level]) return { ok: false, reason: "MASTER_NOT_CONFIGURED" };
  return { ok: true, ...(await impl[level](question, { avoid })) };
}

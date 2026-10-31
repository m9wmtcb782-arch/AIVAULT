// Identity helpers: rank code (U/T/H/K/W) and mailbox local part. No randomness, no renaming.
export function rankCode(n) {
  if (!Number.isSafeInteger(n) || n < 1 || n > 100000) throw new Error("INVALID_AGENT_NO");
  if (n === 100000) return "10W";
  return [[10000,"W"],[1000,"K"],[100,"H"],[10,"T"],[1,"U"]]
    .map(([p,u]) => { const d = Math.floor(n/p)%10; return d ? `${d}${u}` : ""; }).join("");
}
export function mailLocal({ pinyin, agentNo }) {
  const p = String(pinyin || "").toLowerCase().replace(/\s+/g, "");
  if (!/^[a-z]{2,40}$/.test(p)) throw new Error("PINYIN_REQUIRED_ASCII");
  return p + rankCode(agentNo).toLowerCase();
}
export function assertUnique(locals) {
  const seen = new Set();
  for (const l of locals) { if (seen.has(l)) throw new Error("DUPLICATE_MAIL_LOCAL:" + l); seen.add(l); }
  return true;
}

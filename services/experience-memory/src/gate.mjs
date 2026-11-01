// v2：決策前閘門。先查錯誤庫（題目＋候選答案的推理簽章），命中已知錯誤類別就擋下並改走替代方案或升級師父，並記錄。
import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs"; import { join } from "node:path";
import { extractSignature } from "./signature.mjs"; import { confidence, painCooldown, W } from "./weights.mjs";
export class ApproachLedger { // 以「推理方法鍵 key + 做法 approach」為單位的 append-only 結果紀錄
  constructor({ dir = null } = {}) { this.ev = new Map(); this.log = []; this.dir = dir; if (dir) { mkdirSync(dir, { recursive: true }); const f = join(dir, "outcomes.jsonl"); if (existsSync(f)) for (const l of readFileSync(f, "utf8").split("\n")) if (l.trim()) this._add(JSON.parse(l)); } }
  _add(e) { const k = e.key + "#" + e.approach; if (!this.ev.has(k)) this.ev.set(k, []); this.ev.get(k).push(e); }
  record(e) { this._add(e); if (this.dir) appendFileSync(join(this.dir, "outcomes.jsonl"), JSON.stringify(e) + "\n"); }
  events(key, approach) { return this.ev.get(key + "#" + approach) || []; }
  logBlock(x) { this.log.push(x); if (this.dir) appendFileSync(join(this.dir, "gate-log.jsonl"), JSON.stringify(x) + "\n"); }
}
export const GATE = { blockConf: Number(process.env.EXP_BLOCK_CONF) || -0.3, reuseConf: Number(process.env.EXP_REUSE_CONF) || 0.3 };
export function assess(ledger, key, approach, now, ctx, g = GATE) {
  const ev = ledger.events(key, approach); const c = confidence(ev, now, ctx); const cd = painCooldown(ev, now);
  // 不二過：最近一次結果是失敗 → 直接視為已知錯誤（不管過去成功多少次），直到探測期（2×半衰期）過後才允許重新驗證
  const last = ev[ev.length - 1]; const lastFail = !!last && !last.ok && (now - last.t) / 3600e3 < 2 * W.halfLifeH;
  return { ...c, cooldownUntil: cd, lastFail, blocked: cd > 0 || lastFail || (c.neg > 0 && c.conf <= g.blockConf), trusted: c.conf >= g.reuseConf && !cd && !!last?.ok };
}
// 回傳 { action: "COMMIT"|"BLOCK", reason, assess }
export function preDecision(ledger, { key, approach, now, ctx, question }, g = GATE) {
  const a = assess(ledger, key, approach, now, ctx, g);
  if (a.blocked) { ledger.logBlock({ t: now, key, approach, reason: a.cooldownUntil ? "PAIN_COOLDOWN" : "KNOWN_ERROR_CLASS", conf: +a.conf.toFixed(3), question: String(question || "").slice(0, 120) }); return { action: "BLOCK", reason: a.cooldownUntil ? "PAIN_COOLDOWN" : "KNOWN_ERROR_CLASS", assess: a }; }
  return { action: "COMMIT", assess: a };
}
export { extractSignature, W };

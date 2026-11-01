// 反繞圈總控：偵測（1）同一任務內重複相同嘗試（2）跨任務 A↔B 震盪（3）卡住重試；強制換策略並記錄 diff；
// 統計「改正後復發」(post-correction recurrence)。所有門檻可調，不是寫死的固定迴圈：策略選擇依當下證據排序，且每次改正都必須產生不同的動作。
export const META = { maxIter: Number(process.env.V3_MAX_ITER) || 4, oscWindow: 6, oscMinFails: 3, stuckFails: 3, reprobeEvery: Number(process.env.V3_REPROBE_EVERY) || 4 };
export const STRATEGIES = ["memory", "apprentice", "alt_approach", "groq", "decompose", "gemini", "agreement", "abstain"];
export class MetaController {
  constructor(opts = {}) { this.o = { ...META, ...opts }; this.hist = new Map(); this.corrections = []; this.incidents = []; this.recurrence = { corrected: 0, recurred: 0 }; this.correctedSet = new Map(); this.abstains = new Map(); }
  _h(key) { if (!this.hist.has(key)) this.hist.set(key, []); return this.hist.get(key); }
  observe(key, approach, ok, t) {
    const h = this._h(key); h.push({ approach, ok, t }); if (h.length > 50) h.shift();
    const ck = key + "#" + approach; if (!ok && this.correctedSet.has(ck)) { this.recurrence.recurred++; this.correctedSet.delete(ck); }
  }
  // 跨任務狀態：oscillating（同一 key 最近失敗在 ≥2 種做法間來回）、stuck（連續失敗）
  state(key) {
    const h = this._h(key).slice(-this.o.oscWindow); const fails = h.filter((x) => !x.ok);
    const failApproaches = new Set(fails.map((x) => x.approach)); let switches = 0; for (let i = 1; i < h.length; i++) if (h[i].approach !== h[i - 1].approach) switches++;
    const osc = fails.length >= this.o.oscMinFails && failApproaches.size >= 2 && switches >= 2;
    let tail = 0; for (let i = h.length - 1; i >= 0 && !h[i].ok; i--) tail++;
    return { oscillating: osc, stuck: tail >= this.o.stuckFails, failedApproaches: failApproaches, tailFails: tail };
  }
  // 改正：必須是「不同的動作」，否則拒絕（避免嘴上說改、行為不變）
  correct(key, from, to, reason, t) {
    if (from && to && from.strategy === to.strategy && from.approach === to.approach) throw new Error("CORRECTION_WITHOUT_CHANGE");
    const diff = { t, key, reason, from, to }; this.corrections.push(diff);
    if (from?.approach != null) { this.correctedSet.set(key + "#" + from.approach, t); this.recurrence.corrected++; }
    return diff;
  }
  incident(kind, key, t, detail = {}) { this.incidents.push({ kind, key, t, ...detail }); }
}

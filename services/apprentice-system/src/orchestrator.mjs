// v3 認知迴圈（每個任務一次）：感知 → 回想（先查錯誤庫）→ 學徒（注入教訓）→ 自我驗證 → 必要時升級師父（Groq 先、Gemini 最後；高風險多師父一致）
// → 學習 → 反繞圈總控 → 蒸餾匯出。老二哲學：不跟大模型爭；學徒只在有把握時自己答，否則跟師父學，且只存驗證過的答案。
// 全部元件注入；預設 APPRENTICE_V3_ON 關閉（線上沒有任何呼叫點）。
import { preDecision, assess } from "../../experience-memory/src/gate.mjs";
export const V3 = { commitConf: Number(process.env.V3_COMMIT_CONF) || 0.6 };
export class Orchestrator {
  constructor({ ledger, meta, apprentice, masters = {}, verify, decompose = null, quota = null, distill = null, approachesOf = null, opts = {} }) {
    Object.assign(this, { ledger, meta, apprentice, masters, verify, decompose, quota, distill, approachesOf }); this.o = { ...V3, ...opts };
    this.stats = { masterCalls: { groq: 0, gemini: 0 }, quotaDenied: 0, blocks: 0, repeatPrevented: 0, loopIncidents: 0, abstain: 0 };
  }
  async _master(level, task, avoid) {
    if (this.quota) { const q = await this.quota.reserve({ provider: level, consumer: "pool_learning", units: 1, ref: "v3:" + task.key }); if (!q?.allowed) { this.stats.quotaDenied++; return null; } }
    else { this.stats.quotaDenied++; return null; } // fail-closed：沒有額度守門就不叫師父
    this.stats.masterCalls[level]++; try { const r = await this.masters[level]?.(task, { avoid }); return r ? { ...r, strategy: level, master: level } : null; } catch { return null; }
  }
  plan(task, st) {
    // 依當下證據動態排序策略，不是固定順序：震盪/卡住時跳過已在打轉的做法
    if (st.oscillating || st.stuck) return ["groq", "gemini", "decompose", "agreement", "abstain"];
    const p = ["memory", "apprentice", "alt_approach", "groq", "decompose", "gemini"]; if (task.highStakes) p.push("agreement"); p.push("abstain"); return p;
  }
  async runTask(task, now) {
    const key = task.key, ctx = task.ctx || { task_type: task.task_type }; const st = this.meta.state(key);
    if (st.oscillating || st.stuck) { this.stats.loopIncidents++; this.meta.incident(st.oscillating ? "oscillation" : "stuck", key, now, { failed: [...st.failedApproaches] }); }
    const approaches = this.approachesOf ? this.approachesOf(task) : [];
    const ab = this.meta.abstains.get(key); // 已知的未知：近期已多次窮盡仍無解 → 直接 unknown；每 reprobeEvery 次重新探測一次（情況可能改變，不是寫死）
    if (ab && ab.n >= (Number(process.env.V3_KNOWN_UNKNOWN_N) || 3)) { ab.skip = (ab.skip || 0) + 1; if (ab.skip % this.meta.o.reprobeEvery !== 0) { this.meta.incident("known_unknown", key, now, { cached: true }); this.stats.abstain++; this.stats.abstainCached = (this.stats.abstainCached || 0) + 1; return { answer: "unknown", approach: null, strategy: "abstain_known_unknown", abstained: true }; } }
    const avoid = new Set();
    if (st.oscillating || st.stuck) { // 自適應仲裁：結果有雜訊時「最後一次失敗就封鎖」會造成 A↔B 來回；改用長期成功率（Beta 平均）判斷
      const rate = (a) => { const ev = this.ledger.events(key, a); const s1 = ev.filter((e) => e.ok).length; return { n: ev.length, p: (s1 + 1) / (ev.length + 2) }; };
      const rs = approaches.map((a) => ({ a, ...rate(a) })).sort((x, y) => y.p - x.p);
      for (const x of rs) if (x.n >= 2 && x.p < 0.3) avoid.add(x.a);
      if (rs.length && rs.every((x) => x.n >= 2 && x.p < 0.3)) { // 已知的未知：所有做法都被證實失敗 → 直接回答「不知道」，不再燒師父額度
        this.meta.incident("known_unknown", key, now); this.stats.abstain++; return { answer: "unknown", approach: null, strategy: "abstain_known_unknown", abstained: true }; }
      const best = rs[0]; if (best && best.n >= 4 && best.p >= 0.55 && !(rs[1] && rs[1].n >= 4 && rs[1].p >= best.p - 0.1)) {
        this.meta.correct(key, { strategy: "last-outcome-gate", approach: null }, { strategy: "arbitration", approach: best.a }, "oscillation→success-rate arbitration", now);
        return { answer: best.a, approach: best.a, strategy: "arbitration", master: null, verified: false, abstained: false }; }
    }
    if (!(st.oscillating || st.stuck)) for (const a of approaches) if (assess(this.ledger, key, a, now, ctx).blocked) { avoid.add(a);
      if (!this.meta.correctedSet.has(key + "#" + a)) this.meta.correct(key, { strategy: "previous", approach: a }, { strategy: "avoid+lesson", approach: null }, "known_error_lesson", now); }
    const lessons = [...avoid].map((a) => `不二過：做法 ${a} 在此類任務已驗證失敗`);
    const tried = new Set(); let prev = null, iter = 0, masterAnswers = [];
    for (const s of this.plan(task, st)) {
      if (s === "abstain") break; if (iter >= this.meta.o.maxIter) { this.meta.incident("iter_cap", key, now); break; }
      let cand = null;
      if (s === "memory") { const tr = approaches.find((a) => !avoid.has(a) && assess(this.ledger, key, a, now, ctx).trusted); if (tr) cand = { approach: tr, strategy: "memory", conf: 0.9, memConf: assess(this.ledger, key, tr, now, ctx).conf }; }
      else if (s === "apprentice") { iter++; const r = await this.apprentice(task, { lessons, avoid: [...avoid] }); if (r) cand = { ...r, strategy: "apprentice" }; }
      else if (s === "alt_approach") { const alt = approaches.find((a) => !avoid.has(a) && !tried.has(a) && assess(this.ledger, key, a, now, ctx).trusted); if (alt) cand = { approach: alt, strategy: "alt_approach", conf: 0.7 }; }
      else if (s === "groq" || s === "gemini") { iter++; cand = await this._master(s, task, [...avoid, ...tried]); if (cand) masterAnswers.push(cand); }
      else if (s === "decompose" && this.decompose) { iter++; if (this.quota) { const q = await this.quota.reserve({ provider: "groq", consumer: "pool_learning", units: 2, ref: "v3:decompose" }); if (!q?.allowed) { this.stats.quotaDenied++; continue; } this.stats.masterCalls.groq += 2; const r = await this.decompose(task, { avoid: [...avoid, ...tried] }); if (r) cand = { ...r, strategy: "decompose", master: "groq" }; } }
      else if (s === "agreement") { const a = masterAnswers.filter((m) => !avoid.has(m.approach)); if (a.length >= 2 && a.every((m) => m.approach === a[0].approach)) cand = { ...a[0], strategy: "agreement", conf: 0.9 }; }
      if (!cand) continue;
      if (tried.has(cand.approach) && cand.strategy !== "agreement") { this.stats.repeatPrevented++; continue; } // 同一任務不重複相同嘗試
      if (avoid.has(cand.approach) || (!(st.oscillating || st.stuck) && preDecision(this.ledger, { key, approach: cand.approach, now, ctx, question: task.question }).action === "BLOCK")) {
        this.stats.blocks++; tried.add(cand.approach); avoid.add(cand.approach); if (prev) this.meta.correct(key, prev, { strategy: s, approach: cand.approach }, "blocked_known_error", now); prev = { strategy: s, approach: cand.approach }; continue; }
      tried.add(cand.approach);
      const v = await this.verify(task, cand);
      if (v.verdict === "fail") { this.ledger.record({ t: now, key, approach: cand.approach, ok: false, ctx, src: "self-verify" }); avoid.add(cand.approach);
        this.meta.correct(key, { strategy: s, approach: cand.approach }, { strategy: "next", approach: null }, "self_verify_fail", now); prev = { strategy: s, approach: cand.approach }; continue; }
      const conf = v.verdict === "pass" ? 1 : (cand.conf ?? (cand.master ? 0.75 : 0.3));
      if (v.verdict !== "pass" && task.highStakes && cand.strategy !== "agreement" && !(cand.strategy === "memory" && cand.memConf >= 0.6)) continue; // 高風險：要驗證通過或多師父一致
      if (conf < this.o.commitConf) continue;
      return { answer: cand.answer ?? cand.approach, approach: cand.approach, strategy: cand.strategy, master: cand.master || null, verified: v.verdict === "pass", abstained: false };
    }
    const a0 = this.meta.abstains.get(key) || { n: 0 }; a0.n++; this.meta.abstains.set(key, a0);
    this.stats.abstain++; return { answer: "unknown", approach: null, strategy: "abstain", abstained: true }; // 寧可說不知道，也不給錯答案
  }
  feedback(task, res, ok, now) {
    if (res.abstained) return; if (ok) this.meta.abstains.delete(task.key); const ctx = task.ctx || { task_type: task.task_type };
    this.ledger.record({ t: now, key: task.key, approach: res.approach, ok, ctx, src: "outcome" }); this.meta.observe(task.key, res.approach, ok, now);
    if (ok && res.master && this.distill) this.distill.add({ task_type: task.task_type, prompt: task.question || task.key, answer: res.answer, master: res.master, evidence: { verified: true, via: res.verified ? "test" : "outcome" } });
  }
}

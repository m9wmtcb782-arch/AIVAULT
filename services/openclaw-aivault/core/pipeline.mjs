// 學徒管線（OpenClaw 模型呼叫都走這裡）：共同記憶 → 不二過閘門 → 學徒自試 → 驗證 → 額度守門 → 師父(Groq stub) → 寫回共同記憶 → 反繞圈 → AI 標示
import { LocalQuotaLedger } from "../../pool-learning/src/quota-guard.mjs";
import { CommonMemory } from "./memory.mjs";
import IDS from "./identities.mjs";
export const getIdentity = (code) => IDS.find((i) => i.agent_code.toLowerCase() === String(code || "").toLowerCase()) || null;
export const identities = () => IDS;
export const aiLabel = (id) => `【AI・${id.agent_code} ${id.name}｜AIVAULT 人工智慧，非真人】`;

// 本機任務集：每題有 family（推論方法類別）、學徒的「直覺錯誤做法」、驗證器。真實環境換成 lab 無網路測試容器。
export const TASKS = {
  "js 字串轉整數": { family: "程式/轉換/字串→整數", trap: 'Number.toString("42")', verify: (a) => /parseInt\(\s*"42"\s*,\s*10\s*\)|Number\("42"\)/.test(a), master: 'parseInt("42", 10)' },
  "js 整數轉字串": { family: "程式/轉換/整數→字串", trap: 'parseInt(42)', verify: (a) => /String\(42\)|\(42\)\.toString\(\)/.test(a), master: "String(42)" },
  "12乘以9": { family: "算術/乘法", trap: "96", verify: (a) => /\b108\b/.test(a), master: "108" },
  "國慶日是幾月幾日": { family: "常識/台灣節日", trap: "1月1日", verify: (a) => /10月10日/.test(a), master: "10月10日" },
};
const groqStub = async (task) => { const t = TASKS[task]; return t ? t.master : `（Groq stub 回覆：${task}）`; };

export class Pipeline {
  constructor({ stateDir, quotaTotals = { groq: 100, gemini: 0 }, poolShare = 0.5, maxAttempts = 3 }) {
    this.mem = new CommonMemory(stateDir); this.quota = new LocalQuotaLedger({ totals: quotaTotals, poolShare }); this.maxAttempts = maxAttempts;
    this.hasRealGroq = Boolean(process.env.GROQ_API_KEY); // 只檢查是否存在，絕不輸出值
    this.stats = { memoryHits: 0, masterCalls: 0, quotaDenied: 0, notTwiceBlocks: 0, loopStops: 0, lessonsLearned: 0 };
    this.log = [];
  }
  async run(code, question) {
    const id = getIdentity(code); if (!id) return { text: "IDENTITY_UNKNOWN", outcome: "reject" };
    const q = String(question).trim(); const task = Object.keys(TASKS).find((k) => k === q) || q; const T = TASKS[task];
    const trace = [];
    // 1) 共同記憶：已驗證正確 → 直接用（不呼叫任何模型）
    const hit = this.mem.findCorrect(task);
    if (hit) { this.stats.memoryHits++; trace.push(`memory_hit(${hit.id} by ${hit.learned_by})`); return this._out(id, task, hit.answer, "common_memory", trace); }
    // 2) 不二過：先查錯誤經驗（同題 + 同推論類別）
    const banned = new Set([...this.mem.wrongFor(task), ...(T ? this.mem.wrongByFamily(T.family) : [])].map((w) => w.answer));
    const attempts = []; let n = 0;
    const tryAnswer = async (src, ans) => {
      n++; if (n > this.maxAttempts) return "stop";
      if (banned.has(ans)) { this.stats.notTwiceBlocks++; trace.push(`not_twice_block(${src}:${ans})`); return "blocked"; }
      if (attempts.includes(ans)) { this.stats.loopStops++; trace.push(`anti_loop(repeat ${ans})`); return "stop"; } // 同答案重試 = 繞圈 → 強制換做法
      attempts.push(ans);
      const ok = T ? T.verify(ans) : null;
      if (ok === false) { this.mem.add("wrong", { question: task, family: T.family, answer: ans, why: "verify_fail", learned_by: id.agent_code }); this.stats.lessonsLearned++; banned.add(ans); trace.push(`verify_fail→lesson(${src}:${ans})`); return "fail"; }
      return ok ? "pass" : "unknown";
    };
    // 3) 學徒自試（小模型直覺；本機以 trap 模擬常見錯誤）
    if (T) { const r = await tryAnswer("apprentice", T.trap); if (r === "pass") return this._commit(id, task, T.trap, "apprentice", trace); }
    // 4) 額度守門（fail-closed）→ 師父
    const qd = await this.quota.reserve({ provider: "groq", consumer: "pool_learning", units: 1, ref: `${id.agent_code}:${task}` });
    if (!qd.allowed) { this.stats.quotaDenied++; trace.push(`quota_denied(${qd.reason})`); return this._out(id, task, "不確定（額度保護：學習額度已用完，留給暗星）", "abstain_quota", trace); }
    this.stats.masterCalls++; const m = await groqStub(task); trace.push(`master(groq_${this.hasRealGroq ? "key_present_but_stub_used" : "stub"})`);
    const r2 = await tryAnswer("groq", m);
    if (r2 === "pass" || (r2 === "unknown" && !T)) return this._commit(id, task, m, "groq", trace, r2 === "pass");
    return this._out(id, task, "不確定（已窮盡做法，不給錯誤答案）", "abstain", trace);
  }
  _commit(id, task, ans, src, trace, verified = true) { if (verified) { this.mem.add("correct", { question: task, answer: ans, source: src, learned_by: id.agent_code }); trace.push("commit_common_memory"); } return this._out(id, task, ans, src, trace); }
  _out(id, task, ans, src, trace) { const rec = { identity: id.agent_code, task, answer: ans, source: src, trace }; this.log.push(rec); return { text: `${aiLabel(id)}\n${ans}`, ...rec }; }
}

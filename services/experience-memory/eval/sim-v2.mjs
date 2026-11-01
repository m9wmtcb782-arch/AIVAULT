// 本機模擬（無真實 API）：30 種推理類別 × 50 種表面問法；學徒有系統性錯誤；師父 Groq/Gemini 為 mock，錯誤率可調。
// 情境翻轉：t=1000 有 5 類「原本對的變錯」，t=2000 再翻 5 類（含翻回去）。1 step = 1 小時。
import { ApproachLedger, preDecision, assess } from "../src/gate.mjs";
const ARG = Object.fromEntries(process.argv.slice(2).map((a) => a.split("=")));
const GROQ_ERR = Number(ARG.groqErr ?? 0.15), GEM_ERR = Number(ARG.gemErr ?? 0.05), T = 3000, C = 30, V = 50;
function rng(s) { return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); }
function run(policy, seed) {
  const r = rng(seed), truth = [], appr = []; for (let c = 0; c < C; c++) { truth[c] = r() < 0.5 ? "A" : "B"; appr[c] = r() < 0.4 ? (truth[c] === "A" ? "B" : "A") : truth[c]; }
  const flip1 = [0, 1, 2, 3, 4], flip2 = [0, 1, 5, 6, 7]; const epoch = Array(C).fill(0); const other = (x) => x === "A" ? "B" : "A";
  const L = new ApproachLedger(), v1 = new Map(); const st = { correct: 0, groq: 0, gemini: 0, blocks: 0, errors: 0, repeat: 0, postFlipErr: 0 }; const errKeys = new Map();
  const mr = rng(seed + 99); const master = (lvl, c) => (mr() < (lvl === "groq" ? GROQ_ERR : GEM_ERR) ? other(truth[c]) : truth[c]);
  for (let t = 0; t < T; t++) {
    if (t === 1000) flip1.forEach((c) => { truth[c] = other(truth[c]); epoch[c]++; }); if (t === 2000) flip2.forEach((c) => { truth[c] = other(truth[c]); epoch[c]++; });
    const c = Math.floor(r() * C), v = Math.floor(r() * V), now = t * 3600e3, key = "k" + c, ctx = { task_type: "lab" }; let ans;
    if (policy === "noMem") ans = appr[c];
    else if (policy === "noMemMaster") { st.groq++; ans = master("groq", c); }
    else if (policy === "v1") { const m = v1.get(c + ":" + v); if (m) ans = m; else { st.groq++; ans = master("groq", c); } }
    else { // v2
      const trusted = ["A", "B"].find((a) => assess(L, key, a, now, ctx).trusted); let cand = trusted || appr[c];
      if (preDecision(L, { key, approach: cand, now, ctx }).action === "BLOCK") { st.blocks++; const alt = other(cand); const a2 = assess(L, key, alt, now, ctx);
        if (a2.trusted) cand = alt; else { st.groq++; cand = master("groq", c);
          if (preDecision(L, { key, approach: cand, now, ctx }).action === "BLOCK") { st.blocks++; st.gemini++; const g2 = master("gemini", c);
            cand = preDecision(L, { key, approach: g2, now, ctx }).action === "BLOCK" && preDecision(L, { key, approach: other(g2), now, ctx }).action === "COMMIT" ? other(g2) : g2; } } }
      ans = cand; }
    const ok = ans === truth[c]; if (ok) st.correct++; else { st.errors++; const ek = c + ":" + ans + ":" + epoch[c]; const n = (errKeys.get(ek) || 0) + 1; errKeys.set(ek, n); if (n > 1) st.repeat++; if (epoch[c] > 0) st.postFlipErr++; }
    if (policy === "v1" && ok && !v1.has(c + ":" + v)) v1.set(c + ":" + v, ans); // v1：只存驗證過的正確答案，不會失效
    if (policy === "v2") L.record({ t: now, key, approach: ans, ok, ctx });
  }
  return { ...st, acc: st.correct / T, repeatRate: st.errors ? st.repeat / st.errors : 0, classesWithError: errKeys.size };
}
const P = ["noMem", "noMemMaster", "v1", "v2"], seeds = [1, 2, 3, 4, 5], agg = {};
for (const p of P) { const rs = seeds.map((s) => run(p, s)); const avg = (k) => rs.reduce((a, b) => a + b[k], 0) / rs.length;
  agg[p] = { acc: +avg("acc").toFixed(4), errors: avg("errors"), repeat: avg("repeat"), repeatRate: +avg("repeatRate").toFixed(4), errorClasses: avg("classesWithError"), groq: avg("groq"), gemini: avg("gemini"), blocks: avg("blocks"), postFlipErr: avg("postFlipErr") }; }
console.log(JSON.stringify({ T, C, V, GROQ_ERR, GEM_ERR, seeds: seeds.length, agg }, null, 1));

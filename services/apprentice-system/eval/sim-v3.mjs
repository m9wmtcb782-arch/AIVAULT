// SIMULATED（模擬）評測：mock 學徒/師父/驗證，無任何真實 API。
// 類別：normal 70%（3 種做法 A/B/C，學徒 40% 系統性錯）、noMaster 10%（師父都答錯，只有拆解可能對）、
// flaky 10%（結果訊號有雜訊：正確做法 80% 回報成功、錯誤做法 15%）→ 專門讓 v2 在 A↔B 間震盪、unanswerable 5%（沒有正確答案，應回答 unknown）、
// highStakes 5%（normal 但要求驗證或多師父一致）。t=1000、2000 翻轉部分 normal 類別的正解。
import { ApproachLedger, preDecision, assess } from "../../experience-memory/src/gate.mjs";
import { MetaController } from "../src/metacontroller.mjs"; import { Orchestrator } from "../src/orchestrator.mjs"; import { SftExporter } from "../src/distill.mjs";
import { LocalQuotaLedger } from "../src/adapters.mjs";
const ARG = Object.fromEntries(process.argv.slice(2).map((a) => a.split("=")));
const GROQ_ERR = Number(ARG.groqErr ?? 0.15), GEM_ERR = Number(ARG.gemErr ?? 0.05), VERIFIABLE = Number(ARG.verifiable ?? 0.6), T = 3000, C = 40, AP = ["A", "B", "C"];
function rng(s) { return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); }
function world(seed) {
  const r = rng(seed); const cls = [];
  for (let c = 0; c < C; c++) { const u = r(); const kind = u < 0.70 ? "normal" : u < 0.80 ? "noMaster" : u < 0.90 ? "flaky" : u < 0.95 ? "unanswerable" : "highStakes";
    const truth = kind === "unanswerable" ? null : kind === "noMaster" ? "C" : AP[Math.floor(r() * 3)];
    const appr = truth && r() < 0.6 ? truth : AP.filter((a) => a !== truth)[Math.floor(r() * 2)]; cls.push({ kind, truth, appr, epoch: 0 }); }
  return { cls, r };
}
async function runPolicy(policy, seed) {
  const { cls, r } = world(seed); const nr = rng(seed + 7), mr = rng(seed + 99), vr = rng(seed + 333);
  const flips = [cls.findIndex((x) => x.kind === "normal"), ...cls.map((x, i) => [x, i]).filter(([x]) => x.kind === "normal").slice(1, 5).map(([, i]) => i)];
  const wrongOf = (c) => AP.filter((a) => a !== cls[c].truth);
  const masterAns = (lvl, c, avoid = []) => { const k = cls[c]; let a;
    if (k.kind === "unanswerable" || k.kind === "noMaster") a = ["A", "B"][Math.floor(mr() * 2)];
    else a = mr() < (lvl === "groq" ? GROQ_ERR : GEM_ERR) ? wrongOf(c)[Math.floor(mr() * 2)] : k.truth;
    if (avoid.includes(a)) { const opts = AP.filter((x) => !avoid.includes(x)); if (opts.length && (k.kind === "normal" || k.kind === "highStakes" || k.kind === "flaky")) a = opts.includes(k.truth) && mr() < 0.8 ? k.truth : opts[Math.floor(mr() * opts.length)]; }
    return a; };
  const signal = (c, a) => { const k = cls[c]; if (!k.truth) return false; if (k.kind === "flaky") return a === k.truth ? nr() < 0.8 : nr() < 0.15; return a === k.truth; };
  const st = { correct: 0, wrong: 0, abstain: 0, abstainJustified: 0, groq: 0, gemini: 0, repeat: 0, loopExposure: 0 }; const errKeys = new Map(); const shadow = new MetaController();
  const L = new ApproachLedger(); let orch = null; const sft = new SftExporter(null);
  if (policy === "v3") { const meta = new MetaController(); const quota = new LocalQuotaLedger({ totals: { groq: 1e6, gemini: 1e6 } });
    orch = new Orchestrator({ ledger: L, meta, quota, distill: sft, approachesOf: () => AP,
      apprentice: async (t, { avoid }) => { const a = cls[t.c].appr; return avoid.includes(a) ? null : { approach: a }; },
      masters: { groq: async (t, { avoid }) => ({ approach: masterAns("groq", t.c, avoid) }), gemini: async (t, { avoid }) => ({ approach: masterAns("gemini", t.c, avoid) }) },
      decompose: async (t, { avoid }) => { const k = cls[t.c]; if (!k.truth) return null; const a = vr() < 0.6 ? k.truth : AP[Math.floor(vr() * 3)]; return avoid.includes(a) ? null : { approach: a }; },
      verify: async (t, cand) => (t.verifiable ? { verdict: signal(t.c, cand.approach) ? "pass" : "fail" } : { verdict: "unknown" }) }); }
  for (let t = 0; t < T; t++) {
    if (t === 1000 || t === 2000) for (const c of flips) { const k = cls[c]; k.truth = wrongOf(c)[0]; k.epoch++; }
    const c = Math.floor(r() * C), now = t * 3600e3, key = "k" + c, ctx = { task_type: "lab" }, k = cls[c]; const verifiable = r() < VERIFIABLE; let ans = null;
    if (shadow.state(key).oscillating) st.loopExposure++;
    if (policy === "apprenticeOnly") ans = k.appr;
    else if (policy === "alwaysGroq") { st.groq++; ans = masterAns("groq", c); }
    else if (policy === "v2") {
      const trusted = AP.find((a) => assess(L, key, a, now, ctx).trusted); let cand = trusted || k.appr;
      if (preDecision(L, { key, approach: cand, now, ctx }).action === "BLOCK") { const alt = AP.find((a) => a !== cand && assess(L, key, a, now, ctx).trusted);
        if (alt) cand = alt; else { st.groq++; cand = masterAns("groq", c);
          if (preDecision(L, { key, approach: cand, now, ctx }).action === "BLOCK") { st.gemini++; const g = masterAns("gemini", c); cand = preDecision(L, { key, approach: g, now, ctx }).action === "BLOCK" ? (AP.find((a) => preDecision(L, { key, approach: a, now, ctx }).action === "COMMIT") || g) : g; } } }
      ans = cand; }
    let res = null;
    if (policy === "v3") { res = await orch.runTask({ c, key, task_type: "lab", ctx, verifiable, highStakes: k.kind === "highStakes", question: key }, now); ans = res.abstained ? null : res.approach; }
    if (ans === null) { st.abstain++; if (!k.truth || k.kind === "noMaster") st.abstainJustified++; if (!k.truth) st.correct++; continue; }
    const ok = ans === k.truth; if (ok) st.correct++; else { st.wrong++; const ek = c + ":" + ans + ":" + k.epoch; const n = (errKeys.get(ek) || 0) + 1; errKeys.set(ek, n); if (n > 1) st.repeat++; }
    const sig = signal(c, ans) && (ok || k.kind === "flaky"); // 回饋＝實際觀察到的結果訊號（flaky 會說謊）
    shadow.observe(key, ans, sig, now);
    if (policy === "v2") L.record({ t: now, key, approach: ans, ok: sig, ctx });
    if (policy === "v3") orch.feedback({ c, key, task_type: "lab", ctx, question: key }, res, sig, now);
  }
  const distinctFailed = errKeys.size;
  return { ...st, groq: orch ? orch.stats.masterCalls.groq : st.groq, gemini: orch ? orch.stats.masterCalls.gemini : st.gemini, acc: st.correct / T, wrongRate: st.wrong / T,
    abstainPrecision: st.abstain ? st.abstainJustified / st.abstain : null, postCorrectionRecurrence: distinctFailed ? st.repeat / distinctFailed : 0,
    v3: orch ? { ...orch.stats, corrections: orch.meta.corrections.length, incidents: orch.meta.incidents.length, sft: sft.n, metaRecurrence: orch.meta.recurrence } : undefined };
}
const P = ["apprenticeOnly", "alwaysGroq", "v2", "v3"], seeds = [1, 2, 3, 4, 5], agg = {};
for (const p of P) { const rs = []; for (const s of seeds) rs.push(await runPolicy(p, s)); const avg = (f) => +(rs.reduce((a, b) => a + (f(b) ?? 0), 0) / rs.length).toFixed(4);
  agg[p] = { acc: avg((x) => x.acc), wrongRate: avg((x) => x.wrongRate), wrong: avg((x) => x.wrong), abstain: avg((x) => x.abstain), abstainPrecision: avg((x) => x.abstainPrecision), groq: avg((x) => x.groq), gemini: avg((x) => x.gemini), sameClassRepeats: avg((x) => x.repeat), postCorrectionRecurrence: avg((x) => x.postCorrectionRecurrence), loopExposureTasks: avg((x) => x.loopExposure), ...(p === "v3" ? { corrections: avg((x) => x.v3.corrections), loopIncidentsHandled: avg((x) => x.v3.loopIncidents), repeatPrevented: avg((x) => x.v3.repeatPrevented), sftRows: avg((x) => x.v3.sft) } : {}) }; }
console.log(JSON.stringify({ SIMULATED: true, T, C, GROQ_ERR, GEM_ERR, VERIFIABLE, seeds: seeds.length, agg }, null, 1));

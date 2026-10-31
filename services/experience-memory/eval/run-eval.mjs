import { mkdtempSync, writeFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { ExperienceStore } from "../src/memory.mjs"; import { loadEmbedder } from "../src/embed.mjs"; import { match } from "../src/matcher.mjs";
import { SEEDS, QUERIES } from "./dataset.mjs";
const MODELS = [["Xenova/paraphrase-multilingual-MiniLM-L12-v2", ""], ["Xenova/multilingual-e5-small", "query: "]];
const TH = [0.75, 0.8, 0.85, 0.9, 0.93, 0.95]; const out = {};
for (const [model, prefix] of MODELS) {
  const t0 = performance.now(); const embed = await loadEmbedder(model, { prefix }); const loadMs = performance.now() - t0;
  const store = new ExperienceStore({ dir: mkdtempSync(join(tmpdir(), "expmem-")) }); const idOf = new Map();
  const vecs = await embed(SEEDS.map((s) => s[3]));
  SEEDS.forEach((s, i) => { const e = store.append(s[1] === "correct" ? "correct_experience" : "error_experience", { task_type: s[2], question: s[3], embedding: vecs[i], answer: s[4], source_model: "eval-seed", evidence: { test_passed: s[1] === "correct", note: "hand-labeled" } }); idOf.set(e.id, s[0]); });
  out[model] = { loadMs: Math.round(loadMs), rows: [] };
  for (const [guard, sigGuard] of [[true, false], [false, false], [true, true]]) for (const th of TH) {
    let hc = 0, hcWrong = 0, he = 0, heRight = 0, expectedHits = 0, gotRightHits = 0, ms = [], wrong = [];
    for (const [q, tt, exp, cat] of QUERIES) {
      const r = await match(store, embed, tt, q, { correctThreshold: th, errorThreshold: th, numberGuard: guard, sigGuard }); ms.push(r.ms);
      const got = r.entry ? idOf.get(r.entry.id) : null;
      if (exp?.startsWith("c")) expectedHits++;
      if (r.decision === "HIT_CORRECT") { hc++; if (got !== exp) { hcWrong++; wrong.push(`${q}→${got}(${r.sim.toFixed(3)})`); } else gotRightHits++; }
      if (r.decision === "HIT_ERROR") { he++; if (got === exp) heRight++; }
    }
    ms.sort((a, b) => a - b);
    out[model].rows.push({ guard, sigGuard, th, hitCorrect: hc, wrongReuse: hcWrong, precision: hc ? +(1 - hcWrong / hc).toFixed(3) : null, recall: +(gotRightHits / expectedHits).toFixed(3), hitError: he, hitErrorRight: heRight, p50ms: +ms[ms.length >> 1].toFixed(1), p95ms: +ms[Math.floor(ms.length * 0.95)].toFixed(1), wrong });
  }
}
writeFileSync(new URL("./results.json", import.meta.url), JSON.stringify({ queries: QUERIES.length, seeds: SEEDS.length, at: new Date().toISOString(), out }, null, 1));
for (const [m, r] of Object.entries(out)) { console.log(m, "load", r.loadMs, "ms"); for (const x of r.rows) console.log(` guard=${x.guard} sig=${x.sigGuard} th=${x.th} HIT_C=${x.hitCorrect} wrong=${x.wrongReuse} prec=${x.precision} recall=${x.recall} HIT_E=${x.hitError}/${x.hitErrorRight}ok p50=${x.p50ms}ms p95=${x.p95ms}ms ${x.wrong.slice(0,4).join("; ")}`); }

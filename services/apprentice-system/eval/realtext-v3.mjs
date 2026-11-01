// REAL TEXT（真實文字，本機 MiniLM）：v1 題庫 + v2 錯誤類別題庫，經 v3 recall（錯誤庫優先）。
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { ExperienceStore } from "../../experience-memory/src/memory.mjs"; import { loadEmbedder } from "../../experience-memory/src/embed.mjs";
import { SEEDS, QUERIES } from "../../experience-memory/eval/dataset.mjs"; import { recall } from "../src/recall.mjs";
const embed = await loadEmbedder(); const store = new ExperienceStore({ dir: mkdtempSync(join(tmpdir(), "v3-")) }); const idOf = new Map();
const ERR2 = [["E1","code","JavaScript 怎麼把字串轉成整數？","用 String(n)"],["E2","code","How do I convert an integer to a string in JS?","use parseInt"],["E3","math","JavaScript 中 0.1 + 0.2 是否等於 0.3？","浮點數直接用 === 比較"],["E4","code","Python 怎麼讀取 JSON 檔？","json.dump"],["E5","code","JavaScript 的 typeof null 是什麼？","回傳 'null'"],["E6","qa","澳洲的首都是哪裡？","最大城市就是首都"]];
const all = [...SEEDS.map((s) => [s[0], s[1], s[2], s[3], s[4]]), ...ERR2.map((e) => [e[0], "error", e[1], e[2], e[3]])];
const vs = await embed(all.map((s) => s[3]));
all.forEach((s, i) => { const e = store.append(s[1] === "correct" ? "correct_experience" : "error_experience", { task_type: s[2], question: s[3], embedding: vs[i], answer: s[4], source_model: "eval", evidence: { test_passed: s[1] === "correct" } }); idOf.set(e.id, s[0]); });
const Q2 = [["在 Node 裡把文字 '42' 變成數字型別要用什麼？","code","E1"],["convert a string like '7' into an integer in TypeScript","code","E1"],["怎麼把整數 5 轉成字串？","code","E2"],["Is 1.1 + 2.2 equal to 3.3 in JS?","math","E3"],["How to read a JSON file into a dict in Python","code","E4"],["typeof undefined 會得到什麼型別","code","E5"],["What is the capital of Brazil?","qa","E6"]];
let reuseWrong = 0, reuse = 0, cand = 0, candWrong = 0, warnHit = 0, warnExp = 0, falseWarn = 0, t0 = performance.now();
for (const [q, tt, exp] of QUERIES) { const r = await recall(store, embed, { task_type: tt, question: q }, { correctThreshold: 0.85, errorThreshold: 0.85 });
  if (r.reuse) { const got = idOf.get(r.reuse.entry.id); if (r.decision === "REUSE") { reuse++; if (got !== exp) reuseWrong++; } else { cand++; if (got !== exp) candWrong++; } }
  if (exp?.startsWith("e")) { warnExp++; if (r.warn.length) warnHit++; } else if (r.warn.length && !exp?.startsWith("e")) falseWarn++; }
for (const [q, tt, exp] of Q2) { warnExp++; const r = await recall(store, embed, { task_type: tt, question: q }); if (r.warn.some((w) => idOf.get(w.id) === exp)) warnHit++; }
const ms = (performance.now() - t0) / (QUERIES.length + Q2.length);
console.log(JSON.stringify({ REAL_TEXT: true, model: "Xenova/paraphrase-multilingual-MiniLM-L12-v2", queries: QUERIES.length + Q2.length, autoReuse: reuse, autoReuseWrong: reuseWrong, candidatesNeedingVerify: cand, candidateWrong: candWrong, knownErrorWarned: warnHit + "/" + warnExp, falseWarnings: falseWarn, avgMs: +ms.toFixed(2) }, null, 1));

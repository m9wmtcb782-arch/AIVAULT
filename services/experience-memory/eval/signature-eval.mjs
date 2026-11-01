// 真實文字：錯誤推理類別比對。比較 v1（題目向量 ≥0.85）與 v2（推理簽章 key）。
import { extractSignature } from "../src/signature.mjs"; import { loadEmbedder } from "../src/embed.mjs"; import { normalize } from "../src/memory.mjs";
const ERR = [ // [id, task, question, faulty reasoning]
 ["E1","code","JavaScript 怎麼把字串轉成整數？","用 String(n)"],
 ["E2","code","How do I convert an integer to a string in JS?","use parseInt"],
 ["E3","math","JavaScript 中 0.1 + 0.2 是否等於 0.3？","浮點數直接用 === 比較"],
 ["E4","code","Python 怎麼讀取 JSON 檔？","json.dump"],
 ["E5","code","JavaScript 的 typeof null 是什麼？","回傳 'null'"],
 ["E6","qa","澳洲的首都是哪裡？","最大城市就是首都"],
];
const Q = [ // [query, task, expected error id | null]
 ["在 Node 裡把文字 '42' 變成數字型別要用什麼？","code","E1"],["convert a string like '7' into an integer in TypeScript","code","E1"],["把字串 \"100\" 轉為整數的方法","code","E1"],
 ["怎麼把整數 5 轉成字串？","code","E2"],["Turn the number 3 into a string in JavaScript","code","E2"],
 ["0.3 + 0.6 是否等於 0.9（JavaScript）","math","E3"],["Is 1.1 + 2.2 equal to 3.3 in JS?","math","E3"],
 ["Python 載入 config.json 的方式","code","E4"],["How to read a JSON file into a dict in Python","code","E4"],
 ["typeof undefined 會得到什麼型別","code","E5"],
 ["加拿大的首都是哪裡？","qa","E6"],["What is the capital of Brazil?","qa","E6"],
 // 不同類別（不該被擋）
 ["Python 怎麼寫入 JSON 檔？","code",null],["How do I sort an array in JavaScript?","code",null],["12 乘以 8 等於多少？","math",null],
 ["What is 15% of 200?","math",null],["台灣最高的山是哪一座？","qa",null],["怎麼把陣列反轉？","code",null],["羅馬數字 1994 怎麼寫？","math",null],["身分證字號檢查碼怎麼算？","code",null],
];
const embed = await loadEmbedder(); const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const ev = await embed(ERR.map((e) => normalize(e[2]))); const qv = await embed(Q.map((q) => normalize(q[0])));
const sig = ERR.map((e) => extractSignature({ task_type: e[1], question: e[2], reasoning: "" }).key);
const res = {};
for (const [name, fn] of [["v1_question_embedding@0.85", (i) => { let b = -1, bi = -1; ev.forEach((v, j) => { if (ERR[j][1] !== Q[i][1]) return; const d = dot(qv[i], v); if (d > b) { b = d; bi = j; } }); return b >= 0.85 ? ERR[bi][0] : null; }],
  ["v2_signature_key", (i) => { const k = extractSignature({ task_type: Q[i][1], question: Q[i][0] }).key; const j = sig.indexOf(k); return j >= 0 && !k.includes("|other|") ? ERR[j][0] : null; }]]) {
  let tp = 0, fp = 0, fnn = 0, tn = 0; const bad = [];
  Q.forEach((q, i) => { const got = fn(i); if (q[2]) { if (got === q[2]) tp++; else { fnn++; bad.push("miss:" + q[0] + "→" + got); } } else { if (got) { fp++; bad.push("FP:" + q[0] + "→" + got); } else tn++; } });
  res[name] = { tp, fp, fn: fnn, tn, recall: +(tp / (tp + fnn)).toFixed(3), precision: tp + fp ? +(tp / (tp + fp)).toFixed(3) : null, bad };
}
console.log(JSON.stringify({ sigs: Object.fromEntries(ERR.map((e, i) => [e[0], sig[i]])), res }, null, 1));

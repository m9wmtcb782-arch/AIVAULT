// v2：推理規則簽章（本機、免費、規則式）。簽章 = task|op|from->to|mode。
// 讓「表面不同、但用同一套錯誤推理」的題目對到同一個錯誤類別。大模型抽取只留 stub（經額度守門）。
import { normalize } from "./memory.mjs";
const TYPES = [["int", /整數|integer|\bint\b|數字|number/], ["string", /字串|string|文字|text/], ["float", /浮點|float|小數|decimal/], ["array", /陣列|array|list|串列/], ["json", /json/], ["roman", /羅馬|roman/], ["date", /日期|date/], ["bool", /布林|boolean|bool/]];
const OPS = [
  ["read_file", /讀取|讀|載入|read|load/],
  ["convert", /轉成|轉為|轉換|變成|convert|to an? |into|cast|parse/],
  ["compare_eq", /是否等於|是否相等|equal to|===|==/],
  ["percent", /%|percent|百分/],
  ["multiply", /乘|×|\bx\b|\*|times|multipl/],
  ["capital_lookup", /首都|capital/],
  ["typeof", /typeof|型別|type of/],
  ["write_file", /寫入|write|dump|save/],
  ["sort", /排序|sort/], ["reverse", /反轉|reverse/],
  ["checksum", /檢查碼|checksum|check digit/],
];
function typesInOrder(s) { const hits = []; for (const [t, re] of TYPES) { const m = re.exec(s); if (m) hits.push([m.index, t]); } return hits.sort((a, b) => a[0] - b[0]).map((x) => x[1]); }
export function extractSignature({ task_type, question, reasoning = "", failure_mode = null }) {
  const s = normalize(question + " " + reasoning); const op = (OPS.find(([, re]) => re.test(s)) || ["other"])[0];
  let dir = "-"; const ts = typesInOrder(normalize(question));
  if (op === "convert" && ts.length >= 2) { // 「把 X 轉成 Y」/「convert X to Y」：先出現的是來源
    const m = normalize(question).match(/把(.+?)(轉|變)|convert(?:ing)? (?:an? )?(\w+)/); dir = ts[0] + "->" + ts[1]; if (m) dir = ts[0] + "->" + ts[1]; }
  else if (ts.length) dir = ts.join("+");
  const sig = [task_type, op, dir, failure_mode || "*"].join("|");
  const desc = `task ${task_type}; operation ${op}; direction ${dir}; failure ${failure_mode || "unknown"}`;
  return { sig, op, dir, failure_mode, desc, key: [task_type, op, dir].join("|") };
}
export async function extractSignatureBigModel({ quota }) { // stub：只有額度守門允許時才可能呼叫；v2 不實作
  const q = quota ? await quota.reserve({ provider: "groq", consumer: "pool_learning", units: 1, ref: "sig-extract" }) : { allowed: false, reason: "QUOTA_GUARD_MISSING" };
  return q?.allowed ? { ok: false, reason: "NOT_IMPLEMENTED" } : { ok: false, reason: q?.reason };
}

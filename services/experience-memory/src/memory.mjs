// AIVAULT 經驗記憶庫 v1：雙庫（correct_experience / error_experience），SSD 上 append-only JSONL。
// 不存任何金鑰；寫入前把疑似金鑰字串遮蔽。資料目錄：EXPERIENCE_DATA_DIR（預設 ./.data）。
import { mkdirSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
export const BANKS = ["correct_experience", "error_experience"];
export function normalize(q) {
  return String(q ?? "").normalize("NFKC").toLowerCase()
    .replace(/[\s\u3000]+/g, " ").replace(/[。．.，,！!？?、；;：:「」『』"'（）()\[\]【】]/g, " ").replace(/ +/g, " ").trim();
}
export const qhash = (task_type, q) => createHash("sha256").update(task_type + "\u0000" + normalize(q)).digest("hex");
const redact = (s) => typeof s === "string" ? s.replace(/\b(sk|gsk|pk|rk|key|ghp|eyJ)[-_A-Za-z0-9.]{12,}/g, "[redacted]") : s;
const scrub = (o) => JSON.parse(JSON.stringify(o, (_, v) => redact(v)));
export class ExperienceStore {
  constructor({ dir = process.env.EXPERIENCE_DATA_DIR || "./.data" } = {}) {
    this.dir = dir; mkdirSync(dir, { recursive: true }); this.mem = { correct_experience: [], error_experience: [] }; this.byHash = new Map();
    for (const b of BANKS) { const f = this.file(b); if (existsSync(f)) for (const l of readFileSync(f, "utf8").split("\n")) if (l.trim()) this._index(b, JSON.parse(l)); }
  }
  file(b) { return join(this.dir, b + ".jsonl"); }
  _index(bank, e) { e.vec = Float32Array.from(e.embedding); this.mem[bank].push(e); const k = e.qhash; if (!this.byHash.has(k)) this.byHash.set(k, []); this.byHash.get(k).push({ bank, e }); }
  append(bank, { task_type, question, embedding, answer, source_model, evidence, score = null }) {
    if (!BANKS.includes(bank)) throw new Error("BAD_BANK");
    if (!task_type || !question || !embedding?.length) throw new Error("MISSING_FIELDS");
    if (!evidence || !(evidence.test_passed !== undefined || evidence.agreement)) throw new Error("EVIDENCE_REQUIRED");
    const e = scrub({ id: this.count() + 1, task_type, question: normalize(question), qhash: qhash(task_type, question), embedding: Array.from(embedding, (x) => +x.toFixed(6)), answer, source_model, evidence, score, created_at: new Date().toISOString() });
    appendFileSync(this.file(bank), JSON.stringify(e) + "\n", { flag: "a" }); // append-only，從不改寫
    this._index(bank, e); return e;
  }
  count() { return this.mem.correct_experience.length + this.mem.error_experience.length; }
}

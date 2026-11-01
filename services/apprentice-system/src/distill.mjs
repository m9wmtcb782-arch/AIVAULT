// 蒸餾匯出：只有「已驗證」的師父答案才寫成 SFT JSONL（之後訓練工廠用；現在不訓練）。不寫金鑰。
import { appendFileSync, mkdirSync } from "node:fs"; import { dirname } from "node:path";
const redact = (s) => String(s).replace(/\b(sk|gsk|pk|rk|key|ghp|eyJ)[-_A-Za-z0-9.]{12,}/g, "[redacted]");
export class SftExporter {
  constructor(file = null) { this.file = file; this.n = 0; if (file) mkdirSync(dirname(file), { recursive: true }); }
  add({ task_type, prompt, answer, master, evidence }) {
    if (!evidence?.verified) return false; // 未驗證不收
    const row = { messages: [{ role: "user", content: redact(prompt) }, { role: "assistant", content: redact(answer) }], meta: { task_type, master, evidence, at: new Date().toISOString() } };
    if (this.file) appendFileSync(this.file, JSON.stringify(row) + "\n"); this.n++; return true;
  }
}

// Node 服務用（services/*）。NEURAL_BUS_ON !== "1" → no-op。開啟時：寫本機 append-only JSONL（NEURAL_BUS_DIR），不連網。
import { appendFileSync, mkdirSync } from "node:fs"; import { join } from "node:path";
export function neuralEmit(ev) { if (process.env.NEURAL_BUS_ON !== "1") return null; const dir = process.env.NEURAL_BUS_DIR || "./.neural"; mkdirSync(dir, { recursive: true });
  const e = { v: 1, ts: new Date().toISOString(), base: process.env.NEURAL_BASE || "base1", ...ev }; appendFileSync(join(dir, "neural_events.jsonl"), JSON.stringify(e) + "\n"); return e; }
// 把一個結果訊號轉成經驗記憶／不二過帳本的 outcome 事件
export function toOutcome(ev) { return ev && ev.outcome ? { t: Date.parse(ev.ts || new Date().toISOString()), key: ev.program + "|" + ev.kind, approach: ev.payload?.approach || "default", ok: ev.outcome === "pass", ctx: { task_type: ev.kind, district: ev.base } } : null; }

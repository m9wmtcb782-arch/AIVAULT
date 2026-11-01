import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { Pipeline, getIdentity } from "../core/pipeline.mjs";
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "aivault-oc-"));
test("一個身分學到的教訓，其他 9 個身分透過共同記憶直接使用", async () => {
  const p = new Pipeline({ stateDir: tmp() });
  const a = await p.run("Worker-001", "js 字串轉整數"); assert.equal(a.source, "groq");
  for (let i = 2; i <= 10; i++) { const r = await p.run(`Worker-${String(i).padStart(3, "0")}`, "js 字串轉整數"); assert.equal(r.source, "common_memory"); assert.match(r.text, /【AI・/); }
  assert.equal(p.stats.masterCalls, 1); assert.equal(p.stats.memoryHits, 9);
});
test("不二過：同推論類別的錯誤做法被擋（錯誤經驗共用）", async () => {
  const p = new Pipeline({ stateDir: tmp() }); await p.run("Worker-001", "12乘以9");
  const d = p.mem.load(); d.correct = []; fs.writeFileSync(p.mem.f, JSON.stringify(d)); // 移除正確答案，強迫重新推論
  const r = await p.run("Worker-005", "12乘以9"); assert.ok(r.trace.some((t) => t.startsWith("not_twice_block(apprentice:96)"))); assert.equal(r.answer, "108");
});
test("額度守門：Groq 每日 20 → 學習最多 10 次，第 11 次起擋下", async () => {
  const p = new Pipeline({ stateDir: tmp(), quotaTotals: { groq: 20, gemini: 0 } });
  for (let i = 0; i < 15; i++) await p.run(`Worker-00${(i % 9) + 1}`, `新題目 ${i}`);
  assert.equal(p.stats.masterCalls, 10); assert.equal(p.stats.quotaDenied, 5);
  assert.ok(p.quota.rows.filter((r) => r.decision === "DENIED").every((r) => r.reason === "POOL_HALF_EXHAUSTED"));
});
test("額度未知 → fail-closed", async () => { const p = new Pipeline({ stateDir: tmp(), quotaTotals: {} }); const r = await p.run("Worker-001", "新題目"); assert.equal(r.source, "abstain_quota"); });
test("暗星單獨記憶：其他身分讀寫一律拒絕", () => {
  const p = new Pipeline({ stateDir: tmp() });
  assert.throws(() => p.mem.readPrivate(getIdentity("Worker-001")), /DARKSTAR_ONLY/);
  p.mem.writePrivate(getIdentity("DarkStar"), "私人筆記"); assert.equal(p.mem.readPrivate(getIdentity("DarkStar")).notes.length, 1);
});
test("防繞圈：師父給的答案已被證實錯誤時不重複，改回答不確定", async () => {
  const p = new Pipeline({ stateDir: tmp() }); p.mem.add("wrong", { question: "國慶日是幾月幾日", family: "常識/台灣節日", answer: "10月10日", learned_by: "test" });
  const r = await p.run("Worker-003", "國慶日是幾月幾日"); assert.equal(r.source, "abstain"); assert.match(r.answer, /不確定/);
});

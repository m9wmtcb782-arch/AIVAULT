import test from "node:test"; import assert from "node:assert/strict";
import { planFor, DegreeLearningRunner } from "../src/degree-learning.mjs";
import { LocalQuotaLedger } from "../src/quota-guard.mjs";
test("plan by degree; insert-only memory; stops at quota (MOCK gateway)", async () => {
  assert.match(planFor({ agent_id: "ag-0001", district: "llm", tier: 4, level: 9 }).objective, /大學4階9級.*Transformer.*精熟/);
  assert.equal(planFor({ agent_id: "x", district: "zzz", tier: 1, level: 1 }), null);
  const mem = [{ id: 1, agent_id: "ag-0001", content: "既有記憶" }], status = [];
  const store = { async recentMemory(a) { return mem.filter(m => m.agent_id === a); }, async insertMemory(m) { const id = mem.length + 1; mem.push({ id, ...m }); return id; }, async setPlanStatus(p, s, e, id) { status.push([p.topic, s, e]); } };
  const r = new DegreeLearningRunner({ store, quota: new LocalQuotaLedger({ totals: { gemini: 4 } }), gateway: { async generate() { return "重點：注意力機制讓模型權衡上下文。例子：翻譯時對齊詞。疑問：長上下文成本？"; } } });
  const plans = [1, 2, 3].map(l => planFor({ agent_id: "ag-0001", district: "llm", tier: 4, level: l }));
  const out = []; for (const p of plans) out.push((await r.runOne(p)).status);
  assert.deepEqual(out, ["done", "done", "skipped_quota"]);     // 4 × 50% = 2
  assert.equal(mem[0].content, "既有記憶"); assert.equal(mem.length, 3);
  assert.ok(mem.slice(1).every(m => m.kind === "degree_learning"));
});

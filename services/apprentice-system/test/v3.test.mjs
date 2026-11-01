import { test } from "node:test"; import assert from "node:assert/strict";
import { ApproachLedger } from "../../experience-memory/src/gate.mjs"; import { MetaController } from "../src/metacontroller.mjs";
import { Orchestrator } from "../src/orchestrator.mjs"; import { SftExporter } from "../src/distill.mjs"; import { LocalQuotaLedger } from "../src/adapters.mjs";
const H = 3600e3; const mk = (o = {}) => new Orchestrator({ ledger: new ApproachLedger(), meta: new MetaController(), quota: new LocalQuotaLedger({ totals: { groq: 100, gemini: 100 } }), approachesOf: () => ["A", "B", "C"],
  apprentice: async () => ({ approach: "A" }), masters: { groq: async () => ({ approach: "B" }), gemini: async () => ({ approach: "C" }) }, verify: async () => ({ verdict: "unknown" }), ...o });
test("apprentice unverified is not committed; escalates to Groq first (老二哲學)", async () => {
  const o = mk(); const r = await o.runTask({ key: "k", task_type: "lab" }, 0); assert.equal(r.strategy, "groq"); assert.equal(o.stats.masterCalls.gemini, 0);
});
test("behavior provably changes after an error: failed approach is never re-committed next time", async () => {
  const o = mk(); const r1 = await o.runTask({ key: "k", task_type: "lab" }, 0); o.feedback({ key: "k", task_type: "lab" }, r1, false, 0);
  const r2 = await o.runTask({ key: "k", task_type: "lab" }, H); assert.notEqual(r2.approach, r1.approach); assert.ok(o.meta.corrections.length >= 1);
});
test("correction without a changed action is rejected", () => {
  const m = new MetaController(); assert.throws(() => m.correct("k", { strategy: "x", approach: "A" }, { strategy: "x", approach: "A" }, "r", 0), /CORRECTION_WITHOUT_CHANGE/);
});
test("A↔B oscillation is detected and escapes (no infinite loop)", async () => {
  const o = mk({ masters: { groq: async () => ({ approach: "A" }), gemini: async () => ({ approach: "B" }) } });
  let t = 0; for (let i = 0; i < 12; i++) { const r = await o.runTask({ key: "k", task_type: "lab" }, (t += H)); o.feedback({ key: "k", task_type: "lab" }, r, false, t); }
  assert.ok(o.meta.incidents.some((x) => x.kind === "oscillation" || x.kind === "stuck" || x.kind === "known_unknown"));
  const last = await o.runTask({ key: "k", task_type: "lab" }, (t += H)); assert.equal(last.abstained, true); // 都錯 → 回答 unknown，而不是繼續繞
});
test("no quota guard → no master call (fail-closed); pool half respected", async () => {
  const o = mk({ quota: null }); const r = await o.runTask({ key: "k", task_type: "lab" }, 0); assert.equal(r.abstained, true); assert.equal(o.stats.masterCalls.groq, 0);
  const q = new LocalQuotaLedger({ totals: { groq: 2, gemini: 2 } }); const o2 = mk({ quota: q }); for (let i = 0; i < 5; i++) await o2.runTask({ key: "k" + i, task_type: "lab" }, i);
  assert.ok(q.used("groq").pool <= 1 && q.used("gemini").pool <= 1);
});
test("iteration cap enforced", async () => {
  let n = 0; const o = mk({ apprentice: async () => { n++; return { approach: "A" }; }, verify: async () => ({ verdict: "fail" }), decompose: async () => ({ approach: "C" }) });
  await o.runTask({ key: "k", task_type: "lab" }, 0); assert.ok(o.stats.masterCalls.groq + o.stats.masterCalls.gemini + n <= 6);
});
test("SFT export only takes verified master answers", () => {
  const s = new SftExporter(null); assert.equal(s.add({ prompt: "q", answer: "a", evidence: {} }), false); assert.equal(s.add({ prompt: "q", answer: "a", evidence: { verified: true } }), true);
});

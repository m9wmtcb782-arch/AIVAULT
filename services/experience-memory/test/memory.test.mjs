import { test } from "node:test"; import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { ExperienceStore, normalize } from "../src/memory.mjs"; import { match, escalate } from "../src/matcher.mjs";
const fakeEmbed = async (t) => t.map((s) => { const v = new Float32Array(8); for (const ch of s) v[ch.codePointAt(0) % 8] += 1; const n = Math.hypot(...v) || 1; return v.map((x) => x / n); });
const dir = () => mkdtempSync(join(tmpdir(), "em-"));
test("append-only JSONL persists and reloads from disk", async () => {
  const d = dir(); const s = new ExperienceStore({ dir: d }); const [v] = await fakeEmbed(["a"]);
  s.append("correct_experience", { task_type: "qa", question: "台灣首都？", embedding: v, answer: "臺北", source_model: "m", evidence: { test_passed: true } });
  s.append("error_experience", { task_type: "qa", question: "澳洲首都？", embedding: v, answer: "雪梨", source_model: "m", evidence: { agreement: "0/3" } });
  const s2 = new ExperienceStore({ dir: d }); assert.equal(s2.count(), 2);
  assert.throws(() => s.append("correct_experience", { task_type: "qa", question: "x", embedding: v, answer: "y" }), /EVIDENCE_REQUIRED/);
});
test("secrets redacted before hitting disk", async () => {
  const d = dir(); const s = new ExperienceStore({ dir: d }); const [v] = await fakeEmbed(["a"]);
  s.append("correct_experience", { task_type: "qa", question: "q", embedding: v, answer: "use gsk_ABCDEFGHIJKLMNOP", source_model: "m", evidence: { test_passed: true } });
  assert.ok(!readFileSync(join(d, "correct_experience.jsonl"), "utf8").includes("ABCDEFGHIJKLMNOP"));
});
test("exact-hash fast path, normalization (full-width/punct)", async () => {
  const s = new ExperienceStore({ dir: dir() }); const [v] = await fakeEmbed(["x"]);
  s.append("correct_experience", { task_type: "qa", question: "What is 2+2?", embedding: v, answer: "4", source_model: "m", evidence: { test_passed: true } });
  const r = await match(s, fakeEmbed, "qa", "ＷＨＡＴ is 2+2 ？"); assert.equal(r.decision, "HIT_CORRECT"); assert.equal(r.via, "exact");
  assert.equal(normalize("台灣，首都？"), "台灣 首都");
});
test("number guard blocks reuse when numbers differ", async () => {
  const s = new ExperienceStore({ dir: dir() }); const e = async (t) => t.map(() => Float32Array.from([1, 0]));
  s.append("correct_experience", { task_type: "math", question: "12 乘以 8", embedding: [1, 0], answer: "96", source_model: "m", evidence: { test_passed: true } });
  assert.equal((await match(s, e, "math", "12 乘以 9")).decision, "MISS");
  assert.equal((await match(s, e, "math", "12 乘 8")).decision, "HIT_CORRECT");
});
test("escalate is fail-closed on quota", async () => {
  let called = 0; const big = async () => { called++; };
  assert.equal((await escalate({ quota: null, provider: "groq", question: "q", callBigModel: big })).reason, "QUOTA_GUARD_MISSING");
  assert.equal((await escalate({ quota: { reserve: async () => ({ allowed: false, reason: "POOL_HALF_EXHAUSTED" }) }, provider: "groq", question: "q", callBigModel: big })).ok, false);
  assert.equal(called, 0);
});

import { test } from "node:test"; import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { extractSignature } from "../src/signature.mjs"; import { ApproachLedger, preDecision, assess } from "../src/gate.mjs";
import { confidence, painCooldown } from "../src/weights.mjs"; import { askMaster } from "../src/escalate.mjs";
const H = 3600e3, ctx = { task_type: "lab" };
test("signature separates direction, merges surface variants", () => {
  const k = (q) => extractSignature({ task_type: "code", question: q }).key;
  assert.equal(k("JavaScript 怎麼把字串轉成整數？"), k("convert a string like '7' into an integer"));
  assert.notEqual(k("怎麼把整數轉成字串"), k("怎麼把字串轉成整數"));
  assert.ok(!k("12 乘以 8 等於多少").includes("compare_eq"));
});
test("gate blocks known error class after first failure and logs it", () => {
  const L = new ApproachLedger({ dir: mkdtempSync(join(tmpdir(), "g-")) }); L.record({ t: 0, key: "k", approach: "A", ok: false, ctx });
  const d = preDecision(L, { key: "k", approach: "A", now: H, ctx, question: "q" }); assert.equal(d.action, "BLOCK"); assert.equal(L.log.length, 1);
  assert.equal(preDecision(L, { key: "k", approach: "B", now: H, ctx }).action, "COMMIT");
});
test("flip: trusted approach fails once → blocked immediately (correct can become wrong)", () => {
  const L = new ApproachLedger(); for (let i = 0; i < 20; i++) L.record({ t: i * H, key: "k", approach: "A", ok: true, ctx });
  assert.ok(assess(L, "k", "A", 21 * H, ctx).trusted); L.record({ t: 21 * H, key: "k", approach: "A", ok: false, ctx });
  assert.ok(assess(L, "k", "A", 22 * H, ctx).blocked);
});
test("reverse flip: an old error decays and can be re-verified (wrong can become right)", () => {
  const L = new ApproachLedger(); L.record({ t: 0, key: "k", approach: "B", ok: false, ctx });
  assert.ok(assess(L, "k", "B", 10 * H, ctx).blocked); assert.ok(!assess(L, "k", "B", 1000 * H, ctx).blocked);
});
test("time decay and context weighting", () => {
  const e = [{ t: 0, ok: true, ctx }]; assert.ok(confidence(e, 0, ctx).pos > confidence(e, 72 * H, ctx).pos * 1.9);
  assert.ok(confidence(e, 0, { task_type: "lab", model: "m" }).pos >= confidence(e, 0, { task_type: "other" }).pos);
});
test("pain reflex: 2 same-class fails within window → cooldown", () => {
  assert.ok(painCooldown([{ t: 0, ok: false }, { t: H, ok: false }], 2 * H) > 0);
  assert.equal(painCooldown([{ t: 0, ok: false }], 2 * H), 0);
});
test("escalation stubs are quota fail-closed, no real calls", async () => {
  assert.equal((await askMaster({ level: "groq", quota: null })).reason, "QUOTA_GUARD_MISSING");
  assert.equal((await askMaster({ level: "gemini", quota: { reserve: async () => ({ allowed: true }) } })).reason, "MASTER_NOT_CONFIGURED");
});

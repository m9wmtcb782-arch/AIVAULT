import test from "node:test"; import assert from "node:assert/strict";
import { rankCode, mailLocal, assertUnique } from "../src/identity.mjs";
import { EncryptedMemoryVault, generatePassword } from "../src/vault.mjs";
import { RateLimiter } from "../src/rate-limit.mjs";
import { classifyInbound } from "../src/mail-engine.mjs";
import { GovernanceAdapter, CausalFeedback } from "../src/governance.mjs";
import { TaskScheduler, TASK_TYPES } from "../src/scheduler.mjs";
import { CommunicationEngine, similarity } from "../src/communication.mjs";
import { GitHubConnector } from "../src/github-connector.mjs";
import { randomBytes } from "node:crypto";

test("rank codes + 100k uniqueness", () => {
  const cases = { 1:"1U",10:"1T",25:"2T5U",100:"1H",1234:"1K2H3T4U",10000:"1W",99999:"9W9K9H9T9U",100000:"10W" };
  for (const [n, c] of Object.entries(cases)) assert.equal(rankCode(+n), c);
  assert.throws(() => rankCode(0)); assert.throws(() => rankCode(100001));
  const s = new Set(); for (let i = 1; i <= 100000; i++) s.add(rankCode(i)); assert.equal(s.size, 100000);
  assert.equal(mailLocal({ pinyin: "Ling An An", agentNo: 1 }), "linganan1u");
  assert.throws(() => assertUnique(["a1u", "a1u"]), /DUPLICATE/);
});
test("vault encrypts, isolates agents, audits", async () => {
  const log = []; const v = new EncryptedMemoryVault({ keyB64: randomBytes(32).toString("base64"), audit: e => log.push(e.action) });
  const pw = generatePassword(); assert.ok(pw.length >= 43);
  const ref = await v.put({ owner: "Worker-001", secret: pw });
  assert.ok(!v.dumpForTest().includes(Buffer.from(pw).toString("hex")));
  assert.equal(await v.get(ref, { requester: "Worker-001" }), pw);
  await assert.rejects(v.get(ref, { requester: "Worker-002" }), /DENIED/);
  assert.deepEqual(log, ["VAULT_PUT", "VAULT_GET", "VAULT_DENIED"]);
});
test("rate limiter", () => { let t = 0; const r = new RateLimiter({ limit: 2, windowMs: 1000, now: () => t });
  assert.ok(r.take("a").ok); assert.ok(r.take("a").ok); assert.ok(!r.take("a").ok); t = 1000; assert.ok(r.take("a").ok); });
test("bounce/complaint classify", () => {
  assert.equal(classifyInbound({ from: "MAILER-DAEMON@x", subject: "Undelivered" }), "BOUNCE");
  assert.equal(classifyInbound({ headers: { "content-type": "multipart/report; report-type=feedback-report" } }), "COMPLAINT");
  assert.equal(classifyInbound({ from: "a@b", subject: "hi" }), "NORMAL");
});
test("governance denies impersonation + revoked", async () => {
  const g = new GovernanceAdapter();
  assert.equal((await g.check({ agentId: "x", content: "I am a real human" })).allow, false);
  g.revoked.add("y"); assert.equal((await g.check({ agentId: "y", content: "ok" })).reason, "AGENT_REVOKED");
  assert.equal((await g.check({ agentId: "x", content: "hello" })).remote, "NOT_CONNECTED");
});
test("scheduler: 10 types, dedupe, review gate, quota, 不二過", async () => {
  assert.equal(TASK_TYPES.length, 10);
  const causal = new CausalFeedback(); let fails = 0;
  const s = new TaskScheduler({ governance: new GovernanceAdapter(), causal, permissions: () => ({ allowed: true, dailyQuota: 2 }),
    handlers: { CHECK_MAIL: async () => "ok", SEND_MAIL: async () => { fails++; throw new Error("SMTP_DOWN"); } } });
  const a = s.enqueue({ agentId: "Worker-001", type: "CHECK_MAIL" });
  assert.equal(s.enqueue({ agentId: "Worker-001", type: "CHECK_MAIL" }).duplicate, true);
  const bulk = s.enqueue({ agentId: "Worker-001", type: "SEND_MAIL", payload: { to: "x", text: "t" }, recipients: 10 });
  assert.equal(bulk.task.status, "AWAITING_REVIEW");
  let r = await s.runOnce(); assert.equal(r.length, 1); assert.equal(r[0].status, "DONE");
  s.approve(bulk.task.id, "founder"); r = await s.runOnce(); assert.equal(r[0].reason, "SMTP_DOWN");
  s.tasks.clear(); s.enqueue({ agentId: "Worker-001", type: "SEND_MAIL", payload: { to: "x", text: "t" } });
  r = await s.runOnce(); assert.equal(r[0].reason, "REPEAT_OF_KNOWN_FAILURE"); assert.equal(fails, 1);
  s.tasks.clear(); s.revoke("Worker-001", "founder"); s.enqueue({ agentId: "Worker-001", type: "CHECK_MAIL", payload: { n: 2 } });
  r = await s.runOnce(); assert.equal(r[0].reason, "AGENT_REVOKED");
});
test("communication: calls gateway, guards (MOCK gateway — not a real AI call)", async () => {
  let n = 0; const replies = ["我是 AIVAULT 的 AI 凌安安，關於任務 A 的進度如下：已完成資料整理。", "我是 AIVAULT 的 AI 凌安安，關於任務 A 的進度如下：已完成資料整理。", "I am a real human."];
  const fetchImpl = async (_u, o) => { JSON.parse(o.body).messages.length > 0 || assert.fail(); return { ok: true, json: async () => ({ success: true, content: replies[n++] }) }; };
  const c = new CommunicationEngine({ gatewayUrl: "http://mock", fetchImpl });
  const input = { founderInstruction: "報告進度", agent: { agent_id: "Worker-001", name_zh: "凌安安" }, recipient: "founder", platform: "email" };
  assert.ok((await c.compose(input)).text.length > 0);
  await assert.rejects(c.compose(input), /TEMPLATE_DUPLICATE/);
  await assert.rejects(c.compose(input), /IMPERSONATION/);
  assert.ok(similarity("abcdefgh", "abcdefgh") === 1);
});
test("github connector: governance blocks before network (MOCK fetch)", async () => {
  let calls = 0; const gh = new GitHubConnector({ tokenProvider: async () => "t", governance: new GovernanceAdapter(), fetchImpl: async () => { calls++; } });
  await assert.rejects(gh.comment({ agentId: "a", repo: "o/r", issue: 1, body: "I am a real human" }), /GOVERNANCE_DENIED/);
  assert.equal(calls, 0);
});

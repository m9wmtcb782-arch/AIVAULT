// LOCAL real-protocol test: real SMTP + IMAP wire protocols on 127.0.0.1. NOT internet delivery.
import test from "node:test"; import assert from "node:assert/strict";
import { startLocalMail } from "./local-mail-harness.mjs";
import { SmtpImapProvider, MailEngine } from "../src/mail-engine.mjs";
import { EncryptedMemoryVault, generatePassword } from "../src/vault.mjs";
import { randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";

test("LOCAL: Worker-001 receives from external, reads, replies via SMTP/IMAP", async () => {
  const agent = "linganan1u@aivault.local.test", ext = "external@outside.local.test";
  const pw = generatePassword(), extPw = generatePassword();
  const mail = await startLocalMail({ [agent]: pw, [ext]: extPw });
  const vault = new EncryptedMemoryVault({ keyB64: randomBytes(32).toString("base64") });
  const ref = await vault.put({ owner: "Worker-001", secret: pw });
  const msgs = [], audit = [];
  const mkProvider = (addr) => new SmtpImapProvider({ name: "local-test", smtp: { host: "127.0.0.1", port: mail.smtpPort, secure: false }, imap: { host: "127.0.0.1", port: mail.imapPort(addr), secure: false }, allowInsecureLocal: true });
  const store = { async getMailbox() { return { id: 1, address: agent, credential_ref: ref, status: "PENDING" }; }, async logMessage(m) { msgs.push(m); } };
  const engine = new MailEngine({ provider: mkProvider(agent), vault, store, audit: async e => audit.push(e.action) });
  try {
    const extP = mkProvider(ext);
    const inbound = await extP.send({ address: ext, password: extPw, to: agent, subject: "Hello AI 001", text: "please reply" });
    const got = await engine.check("Worker-001");
    assert.equal(got.length, 1); assert.equal(got[0].subject, "Hello AI 001");
    const out = await engine.send("Worker-001", { to: ext, subject: "Re: Hello AI 001", text: "reply from AI 001 (AIVAULT AI agent)", inReplyTo: got[0].messageId });
    const extInbox = await extP.fetchNew({ address: ext, password: extPw });
    assert.equal(extInbox.length, 1); assert.equal(extInbox[0].headers["in-reply-to"], got[0].messageId);
    await assert.rejects(engine.provider.fetchNew({ address: agent, password: "wrong" }));
    const evidence = { label: "LOCAL", at: new Date().toISOString(), inbound_message_id: inbound.messageId, read_by_agent: got[0].messageId, outbound_message_id: out.messageId, external_received: extInbox[0].messageId, messages_logged: msgs.length, audit };
    mkdirSync(new URL("../evidence/", import.meta.url), { recursive: true });
    writeFileSync(new URL("../evidence/local-mail-test.json", import.meta.url), JSON.stringify(evidence, null, 2));
    assert.deepEqual(msgs.map(m => m.direction), ["IN", "OUT"]);
  } finally { await mail.close(); }
});

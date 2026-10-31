// LOCAL ONLY end-to-end against a self-hosted Stalwart bound to 127.0.0.1 (not exposed, no public MX).
// Env: STALWART_URL, STALWART_ADMIN (user:secret, backend only), AIVAULT_VAULT_KEY (base64 32B).
import { StalwartProvider, provisionAgent } from "../src/stalwart-provider.mjs";
import { EncryptedMemoryVault } from "../src/vault.mjs";
import { SmtpImapProvider, MailEngine } from "../src/mail-engine.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
const DOMAIN = "aivault.net.eu.org";
const audit = []; const log = async (e) => audit.push({ at: new Date().toISOString(), ...e });
const vault = new EncryptedMemoryVault({ audit: (e) => audit.push(e) });
const sp = new StalwartProvider({ baseUrl: process.env.STALWART_URL, adminAuth: process.env.STALWART_ADMIN, domain: DOMAIN });
const ev = { label: "LOCAL", note: "Stalwart on 127.0.0.1; domain not delegated; no public MX; real_mailbox_count=0", domain: DOMAIN, startedAt: new Date().toISOString() };

ev.resetDestroyed = await sp.resetLocalAccounts({ allowDestructiveLocal: true });
// 1) Worker-001 (real name 凌安安 / linganan) + agents 2..100 with PLACEHOLDER pinyin (real names not accessible: no Supabase access)
const agents = [{ agent_no: 1, agent_id: "Worker-001", pinyin: "linganan", name_zh: "凌安安" }];
for (let n = 2; n <= 100; n++) agents.push({ agent_no: n, agent_id: `Worker-${String(n).padStart(3, "0")}`, pinyin: "placeholder", placeholder: true });
const t0 = Date.now(); const provisioned = [];
for (const a of agents) provisioned.push(await provisionAgent({ agent: a, provider: sp, vault, audit: log }));
ev.first100 = { ms: Date.now() - t0, created: provisioned.filter(p => !p.reused).length, reused: provisioned.filter(p => p.reused).length,
  sample: provisioned.slice(0, 3).concat(provisioned.slice(9, 10), provisioned.slice(24, 25), provisioned.slice(99)).map(p => ({ agent_id: p.agent_id, rank: p.rank_code, address: p.address, placeholder: p.agent_id !== "Worker-001" })) };
// Idempotency check: second run must reuse, not duplicate
const again = await provisionAgent({ agent: agents[0], provider: sp, vault, audit: log });
ev.idempotent = again.reused === true;

// 2) Simulated external mailbox = another LOCAL account
const ext = await provisionAgent({ agent: { agent_no: 1, agent_id: "EXT-TEST", pinyin: "externaltest" }, provider: sp, vault, audit: log }).catch(e => ({ error: e.message }));
const w1 = provisioned[0];
const tls = { smtp: { host: "127.0.0.1", port: 2587, secure: false }, imap: { host: "127.0.0.1", port: 2143, secure: false }, allowInsecureLocal: true };
const prov = new SmtpImapProvider({ name: "stalwart-local", ...tls });
const store = (p) => ({ async getMailbox() { return { id: p.mailboxId, address: p.address, credential_ref: p.credential_ref, status: "PENDING" }; }, async logMessage(m) { (ev.messages ||= []).push({ ...m, mailbox: p.address }); } });
const extPw = ext.credential_ref ? await vault.get(ext.credential_ref, { requester: "EXT-TEST" }) : null;
if (!ext.credential_ref) throw new Error("EXTERNAL_TEST_ACCOUNT_REUSED_WITHOUT_CREDENTIAL — reset data dir to rerun");
const eng = new MailEngine({ provider: prov, vault, store: store(w1), audit: log });
const inbound = await prov.send({ address: ext.address, password: extPw, to: w1.address, subject: "LOCAL test → AI 001", text: "Hello 凌安安, please confirm receipt." });
let got = []; for (let i = 0; i < 20 && !got.length; i++) { await new Promise(r => setTimeout(r, 500)); got = await eng.check("Worker-001"); }
const reply = got.length ? await eng.send("Worker-001", { to: ext.address, subject: "Re: " + got[0].subject, text: "凌安安（AIVAULT AI agent）已收到。LOCAL test reply.", inReplyTo: got[0].messageId }) : null;
let extGot = []; for (let i = 0; i < 20 && !extGot.length; i++) { await new Promise(r => setTimeout(r, 500)); extGot = await prov.fetchNew({ address: ext.address, password: extPw }); }
ev.worker001 = { address: w1.address, inbound_message_id: inbound.messageId, read_by_agent: got[0]?.messageId, read_subject: got[0]?.subject,
  outbound_message_id: reply?.messageId, external_received: extGot[0]?.messageId, external_in_reply_to: extGot[0]?.headers?.["in-reply-to"],
  pass: !!(got[0]?.messageId === inbound.messageId && extGot[0]?.messageId === reply?.messageId) };
// wrong password must fail
ev.wrongPasswordRejected = await prov.fetchNew({ address: w1.address, password: "wrong-password" }).then(() => false, () => true);
// cross-agent vault isolation
ev.vaultIsolation = await vault.get(w1.credential_ref, { requester: "Worker-002" }).then(() => false, () => true);
ev.totalAccountsOnServer = await sp.countAccounts();
ev.auditEvents = audit.length; ev.auditSample = audit.slice(0, 4);
ev.finishedAt = new Date().toISOString();
mkdirSync(new URL("../evidence/", import.meta.url), { recursive: true });
writeFileSync(new URL("../evidence/stalwart-local-e2e.json", import.meta.url), JSON.stringify(ev, null, 2));
console.log(JSON.stringify({ first100: ev.first100.created, idempotent: ev.idempotent, w1pass: ev.worker001.pass, wrongPw: ev.wrongPasswordRejected, isolation: ev.vaultIsolation, total: ev.totalAccountsOnServer }));

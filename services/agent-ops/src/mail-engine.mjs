// AIVAULT Mail Engine — provider interface + real SMTP/IMAP adapter (nodemailer / imapflow).
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { RateLimiter } from "./rate-limit.mjs";

/** Provider interface: createMailbox?, send, fetchNew. Mailbox creation is provider-specific (admin API); SMTP/IMAP cannot create mailboxes. */
export class SmtpImapProvider {
  constructor({ name, smtp, imap, secure = true, allowInsecureLocal = false }) {
    Object.assign(this, { name, smtp, imap, secure, allowInsecureLocal });
  }
  tlsOpts() { return this.allowInsecureLocal ? { rejectUnauthorized: false } : {}; }
  async send({ address, password, to, subject, text, inReplyTo }) {
    const t = nodemailer.createTransport({ host: this.smtp.host, port: this.smtp.port, secure: this.smtp.secure ?? this.secure,
      auth: { user: address, pass: password }, tls: this.tlsOpts() });
    const info = await t.sendMail({ from: address, to, subject, text, ...(inReplyTo ? { inReplyTo, references: inReplyTo } : {}) });
    return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected, response: info.response };
  }
  async fetchNew({ address, password, sinceUid = 0, markSeen = false }) {
    const c = new ImapFlow({ host: this.imap.host, port: this.imap.port, secure: this.imap.secure ?? this.secure,
      auth: { user: address, pass: password }, logger: false, tls: this.tlsOpts() });
    await c.connect(); const out = [];
    const lock = await c.getMailboxLock("INBOX");
    try {
      for await (const m of c.fetch(`${sinceUid + 1}:*`, { uid: true, source: true }, { uid: true })) {
        if (m.uid <= sinceUid) continue;
        const p = await simpleParser(m.source);
        out.push({ uid: m.uid, messageId: p.messageId, from: p.from?.text, subject: p.subject, text: p.text, headers: Object.fromEntries(p.headers) });
        if (markSeen) await c.messageFlagsAdd({ uid: m.uid }, ["\\Seen"], { uid: true });
      }
    } finally { lock.release(); await c.logout(); }
    return out;
  }
}

/** Classify inbound DSN / feedback-loop messages. */
export function classifyInbound(msg) {
  const ct = String(msg.headers?.["content-type"]?.value || msg.headers?.["content-type"] || "").toLowerCase();
  const from = String(msg.from || "").toLowerCase(), subj = String(msg.subject || "").toLowerCase();
  if (ct.includes("report-type=delivery-status") || /mailer-daemon|postmaster/.test(from) || /undeliver|delivery status|returned mail/.test(subj)) return "BOUNCE";
  if (ct.includes("report-type=feedback-report") || /abuse report|complaint/.test(subj)) return "COMPLAINT";
  return "NORMAL";
}

export class MailEngine {
  constructor({ provider, vault, store, audit = async () => {}, perAgentDaily = 20, globalPerMinute = 30, now }) {
    Object.assign(this, { provider, vault, store, audit });
    this.agentLimit = new RateLimiter({ limit: perAgentDaily, windowMs: 86400000, now });
    this.globalLimit = new RateLimiter({ limit: globalPerMinute, windowMs: 60000, now });
  }
  async creds(agentId) {
    const mb = await this.store.getMailbox(agentId);
    if (!mb || !mb.credential_ref) throw new Error("MAILBOX_NOT_PROVISIONED");
    if (["SUSPENDED", "REVOKED"].includes(mb.status)) throw new Error("MAILBOX_" + mb.status);
    return { mb, password: await this.vault.get(mb.credential_ref, { requester: agentId }) };
  }
  async send(agentId, { to, subject, text, inReplyTo }) {
    if (!text || !subject) throw new Error("CONTENT_REQUIRED");
    const g = this.globalLimit.take("global"); if (!g.ok) throw new Error("RATE_LIMIT_GLOBAL");
    const a = this.agentLimit.take(agentId); if (!a.ok) throw new Error("RATE_LIMIT_AGENT");
    const { mb, password } = await this.creds(agentId);
    if ((await this.store.complaintCount?.(mb.id)) > 0) throw new Error("SENDING_PAUSED_COMPLAINT");
    try {
      const r = await this.provider.send({ address: mb.address, password, to, subject, text, inReplyTo });
      await this.store.logMessage({ mailbox_id: mb.id, direction: "OUT", message_id: r.messageId, peer: [].concat(to).join(","), subject, status: r.rejected?.length ? "FAILED" : "OK" });
      await this.audit({ actor: agentId, action: "MAIL_SENT", target: r.messageId });
      return r;
    } catch (e) {
      await this.store.logMessage({ mailbox_id: mb.id, direction: "OUT", message_id: null, peer: [].concat(to).join(","), subject, status: "FAILED", detail: { error: e.message } });
      await this.audit({ actor: agentId, action: "MAIL_SEND_FAILED", detail: { error: e.message } }); throw e;
    }
  }
  async check(agentId) {
    const { mb, password } = await this.creds(agentId);
    const msgs = await this.provider.fetchNew({ address: mb.address, password, sinceUid: mb.last_uid || 0 });
    for (const m of msgs) {
      const cls = classifyInbound(m);
      await this.store.logMessage({ mailbox_id: mb.id, direction: "IN", message_id: m.messageId, peer: m.from, subject: m.subject,
        status: cls === "BOUNCE" ? "BOUNCED" : cls === "COMPLAINT" ? "COMPLAINT" : "OK" });
      m.class = cls;
    }
    if (msgs.length) await this.store.setLastUid?.(mb.id, Math.max(...msgs.map(m => m.uid)));
    await this.audit({ actor: agentId, action: "MAIL_CHECKED", detail: { count: msgs.length } });
    return msgs;
  }
}

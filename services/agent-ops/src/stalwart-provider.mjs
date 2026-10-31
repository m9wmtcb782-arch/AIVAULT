// StalwartProvider — mailbox self-provisioning on OUR OWN domain via Stalwart v1.x official management API (JMAP /jmap/, x:Account/set).
// Admin credential is backend-only (env STALWART_ADMIN="user:secret"), never logged, never sent to frontend.
import { generatePassword } from "./vault.mjs";
import { mailLocal, rankCode } from "./identity.mjs";
const USING = ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export class StalwartProvider {
  constructor({ baseUrl, adminAuth, domain, fetchImpl = fetch, maxRetries = 4, backoffMs = 200, defaultQuotaBytes = 256 * 1024 * 1024 }) {
    if (!baseUrl || !adminAuth || !domain) throw new Error("STALWART_CONFIG_REQUIRED");
    Object.assign(this, { baseUrl, domain, fetchImpl, maxRetries, backoffMs, defaultQuotaBytes });
    this.authHeader = "Basic " + Buffer.from(adminAuth).toString("base64");
    this.name = "stalwart-self-hosted"; this.approved = true; this.costApproved = true; // $0 self-hosted
  }
  async jmap(calls) {
    let last;
    for (let i = 0; i <= this.maxRetries; i++) {
      try {
        const r = await this.fetchImpl(this.baseUrl + "/jmap/", { method: "POST", headers: { Authorization: this.authHeader, "Content-Type": "application/json" }, body: JSON.stringify({ using: USING, methodCalls: calls }) });
        if (r.status === 429 || r.status >= 500) throw Object.assign(new Error("STALWART_HTTP_" + r.status), { retry: true });
        if (!r.ok) throw new Error("STALWART_HTTP_" + r.status);
        return (await r.json()).methodResponses;
      } catch (e) { last = e; if (e.retry === false || (!e.retry && e.message.startsWith("STALWART_HTTP_4"))) throw e; await sleep(this.backoffMs * 2 ** i); }
    }
    throw last;
  }
  async domainId() {
    if (this._domainId) return this._domainId;
    const [[, res]] = await this.jmap([["x:Domain/get", { ids: null, properties: ["name"] }, "d"]]);
    const d = res.list.find(x => x.name === this.domain); if (!d) throw new Error("DOMAIN_NOT_CONFIGURED:" + this.domain);
    return (this._domainId = d.id);
  }
  async findAccount(name) {
    const [[, q]] = await this.jmap([["x:Account/query", { filter: { name } }, "q"]]);
    if (!q.ids?.length) return null;
    const [[, g]] = await this.jmap([["x:Account/get", { ids: q.ids, properties: ["name", "domainId"] }, "g"]]);
    const did = await this.domainId();
    return g.list.find(a => a.name === name && a.domainId === did) || null;
  }
  /** Idempotent: if the account exists, returns {reused:true} and does NOT reset its password. */
  async createMailbox({ localPart, password, quotaBytes = this.defaultQuotaBytes, description }) {
    if (!/^[a-z]{2,40}([1-9]w|10w)?([1-9]k)?([1-9]h)?([1-9]t)?([1-9]u)?$/.test(localPart)) throw new Error("INVALID_LOCAL_PART");
    const existing = await this.findAccount(localPart);
    if (existing) return { mailboxId: existing.id, address: `${localPart}@${this.domain}`, reused: true };
    const did = await this.domainId();
    const [[, res]] = await this.jmap([["x:Account/set", { create: { n: { "@type": "User", name: localPart, domainId: did, description: description || localPart,
      credentials: { "0": { "@type": "Password", secret: password } }, roles: { "@type": "User" }, permissions: { "@type": "Inherit" },
      quotas: { maxDiskQuota: quotaBytes }, encryptionAtRest: { "@type": "Disabled" } } } }, "c"]]);
    if (res.notCreated?.n) { const err = res.notCreated.n; if (/exist|same key/i.test(JSON.stringify(err))) { const ex = await this.findAccount(localPart); if (ex) return { mailboxId: ex.id, address: `${localPart}@${this.domain}`, reused: true }; } throw new Error("STALWART_CREATE_FAILED:" + JSON.stringify(err).slice(0, 200)); }
    return { mailboxId: res.created.n.id, address: `${localPart}@${this.domain}`, reused: false };
  }
  /** LOCAL test cleanup only: destroy all accounts except admin. Refuses unless allowDestructiveLocal. */
  async resetLocalAccounts({ allowDestructiveLocal = false } = {}) {
    if (!allowDestructiveLocal || !/^http:\/\/127\.0\.0\.1:/.test(this.baseUrl)) throw new Error("RESET_REFUSED_NOT_LOCAL");
    const [[, q]] = await this.jmap([["x:Account/query", { limit: 5000 }, "q"]]);
    const [[, g]] = await this.jmap([["x:Account/get", { ids: q.ids, properties: ["name"] }, "g"]]);
    const ids = g.list.filter(a => a.name !== "admin").map(a => a.id);
    for (let i = 0; i < ids.length; i += 200) await this.jmap([["x:Account/set", { destroy: ids.slice(i, i + 200) }, "d"]]);
    return ids.length;
  }
  async countAccounts() { const [[, q]] = await this.jmap([["x:Account/query", { calculateTotal: true, limit: 1 }, "q"]]); return q.total ?? q.ids.length; }
}

/** Provision one agent end-to-end: rank-code prefix → password → Stalwart → vault → audit. */
export async function provisionAgent({ agent, provider, vault, audit = async () => {}, quotaBytes }) {
  const localPart = mailLocal({ pinyin: agent.pinyin, agentNo: agent.agent_no });
  await audit({ actor: agent.agent_id, action: "MAILBOX_PROVISION_STARTED", target: localPart });
  const password = generatePassword(32);
  try {
    const r = await provider.createMailbox({ localPart, password, quotaBytes, description: `${agent.agent_id}${agent.placeholder ? " [PLACEHOLDER NAME]" : ""}` });
    let credential_ref = agent.credential_ref || null;
    if (!r.reused) credential_ref = await vault.put({ owner: agent.agent_id, secret: password, kind: "mailbox" });
    await audit({ actor: agent.agent_id, action: r.reused ? "MAILBOX_REUSED" : "MAILBOX_CREATED", target: r.address });
    return { agent_id: agent.agent_id, agent_no: agent.agent_no, rank_code: rankCode(agent.agent_no), address: r.address, mailboxId: r.mailboxId, reused: r.reused, credential_ref, status: "PENDING" };
  } catch (e) { await audit({ actor: agent.agent_id, action: "MAILBOX_PROVISION_FAILED", target: localPart, detail: { error: e.message } }); throw e; }
}

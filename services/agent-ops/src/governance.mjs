// Adapters to EXISTING engines — they are called, never rebuilt.
// GovernanceAdapter: local hard rules first, then optional remote Governance Engine endpoint (configured by founder).
// CausalFeedback: posts outcomes to an existing Causal Engine endpoint if configured; otherwise records locally as NOT_CONNECTED.
const HARD_DENY = [
  [/\b(i am|i'm) (a )?(real )?(human|person)\b|我是真人/i, "IMPERSONATION"],
  [/(buy now|click here|limited offer|免費領取|限時優惠)/i, "SPAM_PATTERN"],
];
export class GovernanceAdapter {
  constructor({ endpoint = null, fetchImpl = fetch, internalSecret = null, revoked = new Set() } = {}) { Object.assign(this, { endpoint, fetchImpl, internalSecret, revoked }); }
  async check({ agentId, action, target, content = "" }) {
    if (this.revoked.has(agentId)) return { allow: false, reason: "AGENT_REVOKED" };
    for (const [re, reason] of HARD_DENY) if (re.test(content)) return { allow: false, reason };
    if (!this.endpoint) return { allow: true, reason: "LOCAL_RULES_ONLY", remote: "NOT_CONNECTED" };
    const r = await this.fetchImpl(this.endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...(this.internalSecret ? { "x-aivault-internal": this.internalSecret } : {}) },
      body: JSON.stringify({ agent_id: agentId, action, target, content }) });
    if (!r.ok) return { allow: false, reason: "GOVERNANCE_UNAVAILABLE_" + r.status };
    const j = await r.json(); return { allow: j.allow === true, reason: j.reason || "REMOTE", remote: "CONNECTED" };
  }
}
export class CausalFeedback {
  constructor({ endpoint = null, fetchImpl = fetch } = {}) { Object.assign(this, { endpoint, fetchImpl }); this.local = []; }
  async record(evt) {
    if (!this.endpoint) { this.local.push(evt); return { delivered: false, status: "NOT_CONNECTED" }; }
    const r = await this.fetchImpl(this.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(evt) });
    return { delivered: r.ok, status: r.status };
  }
  /** 不二過: was the same failure seen before for this agent+action+target? */
  seenFailure({ agentId, type, target }) { return this.local.some(e => e.agentId === agentId && e.type === type && e.target === target && e.outcome === "FAILED"); }
}

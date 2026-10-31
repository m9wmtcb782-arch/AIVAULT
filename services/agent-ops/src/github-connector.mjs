// Platform Connector Engine — GitHub REST (official API) with a user-authorized token held in the vault.
// No account creation, no fake accounts. All writes pass governance + rate limit first.
import { RateLimiter } from "./rate-limit.mjs";
export class GitHubConnector {
  constructor({ tokenProvider, governance, audit = async () => {}, writesPerHour = 10, fetchImpl = fetch, api = "https://api.github.com" }) {
    Object.assign(this, { tokenProvider, governance, audit, fetchImpl, api });
    this.writeLimit = new RateLimiter({ limit: writesPerHour, windowMs: 3600000 });
  }
  async req(method, path, body) {
    const token = await this.tokenProvider();
    const r = await this.fetchImpl(this.api + path, { method, headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "aivault-agent-ops" }, body: body ? JSON.stringify(body) : undefined });
    const remaining = r.headers.get?.("x-ratelimit-remaining");
    if (remaining !== null && remaining !== undefined && Number(remaining) < 50) throw new Error("GITHUB_RATE_BUDGET_LOW");
    const data = r.status === 204 ? null : await r.json();
    if (!r.ok) throw new Error(`GITHUB_${r.status}:${data?.message || ""}`);
    return { data, remaining: remaining == null ? null : Number(remaining) };
  }
  async whoami() { return (await this.req("GET", "/user")).data.login; }
  async notifications({ all = false } = {}) {
    const { data } = await this.req("GET", `/notifications?all=${all}&per_page=50`);
    return data.map(n => ({ id: n.id, reason: n.reason, repo: n.repository?.full_name, title: n.subject?.title, type: n.subject?.type, url: n.subject?.url }));
  }
  async listComments(repo, issue) { return (await this.req("GET", `/repos/${repo}/issues/${issue}/comments?per_page=50`)).data; }
  async comment({ agentId, repo, issue, body, inReplyTo }) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !Number.isInteger(issue)) throw new Error("INVALID_TARGET");
    const decision = await this.governance.check({ agentId, action: inReplyTo ? "REPLY_COMMENT" : "PUBLISH_COMMENT", target: `${repo}#${issue}`, content: body });
    if (!decision.allow) { await this.audit({ actor: agentId, action: "GITHUB_COMMENT_BLOCKED", target: `${repo}#${issue}`, detail: decision }); throw new Error("GOVERNANCE_DENIED:" + decision.reason); }
    if (!this.writeLimit.take(agentId).ok) throw new Error("RATE_LIMIT_PLATFORM");
    const text = inReplyTo ? `> ${String(inReplyTo.quote || "").split("\n").slice(0, 3).join("\n> ")}\n\n${body}` : body;
    const { data } = await this.req("POST", `/repos/${repo}/issues/${issue}/comments`, { body: text });
    await this.audit({ actor: agentId, action: "GITHUB_COMMENT_POSTED", target: data.html_url });
    return { id: data.id, url: data.html_url };
  }
}

// Task Scheduler — 10 task types, permission/quota/dedupe checks, review gate, governance hook, causal feedback, audit.
import { createHash } from "node:crypto";
export const TASK_TYPES = ["CHECK_MAIL","READ_MAIL","DRAFT_MAIL","SEND_MAIL","REPLY_MAIL","AUTHORIZE_PLATFORM","PUBLISH_COMMENT","REPLY_COMMENT","SYNC_ACCOUNT","VERIFY_STATUS"];
const OUTBOUND = new Set(["SEND_MAIL","REPLY_MAIL","PUBLISH_COMMENT","REPLY_COMMENT","AUTHORIZE_PLATFORM"]);
export function dedupeKey(t) { return createHash("sha256").update(JSON.stringify([t.agentId, t.type, t.payload])).digest("hex").slice(0, 32); }

export class TaskScheduler {
  constructor({ handlers = {}, permissions, governance, causal, audit = async () => {}, bulkThreshold = 5, batchSize = 500 }) {
    Object.assign(this, { handlers, permissions, governance, causal, audit, bulkThreshold, batchSize });
    this.tasks = new Map(); this.used = new Map(); this.stopped = false; this.revoked = new Set();
  }
  enqueue({ agentId, type, payload = {}, recipients = 1, public: isPublic = false }) {
    if (!TASK_TYPES.includes(type)) throw new Error("UNKNOWN_TASK_TYPE");
    const key = dedupeKey({ agentId, type, payload });
    if (this.tasks.has(key)) return { duplicate: true, task: this.tasks.get(key) };
    const requiresReview = OUTBOUND.has(type) && (isPublic || recipients >= this.bulkThreshold);
    const task = { id: key, agentId, type, payload, status: requiresReview ? "AWAITING_REVIEW" : "QUEUED", requiresReview, attempts: 0 };
    this.tasks.set(key, task); this.audit({ actor: agentId, action: "TASK_ENQUEUED", target: key, detail: { type, requiresReview } });
    return { duplicate: false, task };
  }
  approve(id, reviewer) { const t = this.tasks.get(id); if (t?.status !== "AWAITING_REVIEW") throw new Error("NOT_AWAITING_REVIEW"); t.status = "QUEUED"; t.reviewedBy = reviewer; this.audit({ actor: reviewer, action: "TASK_APPROVED", target: id }); }
  reject(id, reviewer) { const t = this.tasks.get(id); t.status = "REJECTED"; this.audit({ actor: reviewer, action: "TASK_REJECTED", target: id }); }
  stopAll(by) { this.stopped = true; this.audit({ actor: by, action: "SCHEDULER_STOPPED" }); }
  revoke(agentId, by) { this.revoked.add(agentId); this.governance?.revoked?.add(agentId); this.audit({ actor: by, action: "AGENT_REVOKED", target: agentId }); }
  quotaOk(agentId, type) {
    const p = this.permissions(agentId, type); if (!p?.allowed) return { ok: false, reason: "PERMISSION_DENIED" };
    const k = agentId + ":" + type, n = this.used.get(k) || 0; if (n >= p.dailyQuota) return { ok: false, reason: "QUOTA_EXCEEDED" };
    this.used.set(k, n + 1); return { ok: true };
  }
  async runOnce() {
    const results = [];
    const batch = [...this.tasks.values()].filter(t => t.status === "QUEUED").slice(0, this.batchSize);
    for (const t of batch) {
      if (this.stopped) break;
      const fail = async (reason, status = "FAILED") => { t.status = status; t.lastError = reason; await this.audit({ actor: t.agentId, action: "TASK_" + status, target: t.id, detail: { reason } }); await this.causal?.record({ agentId: t.agentId, type: t.type, target: JSON.stringify(t.payload), outcome: "FAILED", reason }); results.push({ id: t.id, status, reason }); };
      if (this.revoked.has(t.agentId)) { await fail("AGENT_REVOKED", "REJECTED"); continue; }
      if (this.causal?.seenFailure?.({ agentId: t.agentId, type: t.type, target: JSON.stringify(t.payload) })) { await fail("REPEAT_OF_KNOWN_FAILURE", "REJECTED"); continue; }
      const q = this.quotaOk(t.agentId, t.type); if (!q.ok) { await fail(q.reason, "REJECTED"); continue; }
      if (OUTBOUND.has(t.type)) {
        const d = await this.governance.check({ agentId: t.agentId, action: t.type, target: t.payload.to || t.payload.repo, content: t.payload.text || t.payload.body || "" });
        if (!d.allow) { await fail("GOVERNANCE:" + d.reason, "REJECTED"); continue; }
      }
      const h = this.handlers[t.type]; if (!h) { await fail("NO_HANDLER"); continue; }
      t.status = "RUNNING"; t.attempts++;
      try { const out = await h(t); t.status = "DONE"; await this.audit({ actor: t.agentId, action: "TASK_DONE", target: t.id }); await this.causal?.record({ agentId: t.agentId, type: t.type, target: JSON.stringify(t.payload), outcome: "DONE" }); results.push({ id: t.id, status: "DONE", out }); }
      catch (e) { await fail(e.message); }
    }
    return results;
  }
}

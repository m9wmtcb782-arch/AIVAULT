/**
 * AIVAULT autonomous runtime v0.2 — fail-closed approval boundary.
 * Standalone; NOT DEPLOYED. No API calls or production side effects.
 * This is a new runtime implementation, not a wrapper around v0.1:
 * untrusted callers cannot invoke a public (requestId, boolean) approval method.
 */
import type { AgentConfig, AgentState, AuditEvent, Planner, RuntimeSnapshot, ToolAdapter, ToolRequest, ToolResult } from "./agent-runtime-v0.1.ts";
import type { ApprovalDecision, ApprovalDecisionStore, ApprovalRequest, TrustedApprovalPrincipal } from "./approval-authority-v0.1.ts";
import { authorizeApproval } from "./approval-authority-v0.1.ts";

export type TrustedApprovalContext = {
  ownerId: string;
  /** Obtained from verified server-side session, not model/browser input. */
  resolvePrincipal(): Promise<TrustedApprovalPrincipal>;
  /** Atomic durable consume-once store required in production. */
  decisions: ApprovalDecisionStore;
};
export class AutonomousAgentRuntimeV2 {
  private state: AgentState = "CREATED";
  private steps = 0;
  private pending?: ToolRequest;
  private result?: string;
  private history: ToolResult[] = [];
  private events: AuditEvent[] = [];
  private busy = false;
  constructor(
    private readonly config: AgentConfig,
    private readonly planner: Planner,
    private readonly tools: ToolAdapter,
    private readonly approval: TrustedApprovalContext
  ) {
    if (!config.agentId.trim() || !approval.ownerId.trim() || !Number.isInteger(config.maxSteps) || config.maxSteps < 1 || config.maxSteps > 100) throw new Error("INVALID_CONFIG");
    this.record("created");
  }
  private record(action: string, toolId?: string) {
    this.events.push({ agentId: this.config.agentId, sequence: this.events.length + 1, state: this.state, action, toolId });
  }
  snapshot(): RuntimeSnapshot {
    return { state: this.state, steps: this.steps, pending: this.pending ? structuredClone(this.pending) : undefined, events: this.events.map(x => ({ ...x })), result: this.result };
  }
  authorize() {
    if (this.state !== "CREATED") throw new Error("INVALID_STATE");
    this.state = "AUTHORIZED"; this.record("authorized");
  }
  pause() {
    if (this.busy) throw new Error("BUSY");
    if (this.state === "COMPLETED" || this.state === "FAILED") return;
    this.pending = undefined; this.state = "PAUSED"; this.record("paused");
  }
  private async execute(req: ToolRequest) {
    this.state = "EXECUTING"; this.record("execute", req.id);
    try {
      const outcome = await this.tools.execute(structuredClone(req));
      this.history.push(structuredClone(outcome));
      this.state = "OBSERVING"; this.record(outcome.ok ? "tool_success" : "tool_failure", req.id);
    } catch {
      this.history.push({ ok: false, error: "TOOL_EXECUTION_FAILED" });
      this.state = "OBSERVING"; this.record("tool_failure", req.id);
    }
  }
  async step(): Promise<RuntimeSnapshot> {
    if (this.busy) throw new Error("BUSY");
    this.busy = true;
    try {
      if (this.state !== "AUTHORIZED" && this.state !== "OBSERVING") throw new Error("INVALID_STATE");
      if (this.steps >= this.config.maxSteps) { this.state = "FAILED"; this.record("step_limit"); return this.snapshot(); }
      this.state = "PLANNING"; this.record("planning");
      let plan;
      try { plan = await this.planner.next(this.history.map(x => structuredClone(x))); }
      catch { this.state = "FAILED"; this.record("planner_failed"); return this.snapshot(); }
      this.steps++;
      if (plan.type === "complete") { this.state = "COMPLETED"; this.result = plan.summary; this.record("completed"); return this.snapshot(); }
      const req = plan.request;
      if (!req || !req.id || !req.name || !req.input || !["read","external_write","spend","commitment"].includes(req.kind) || !this.config.allowedTools.includes(req.name)) {
        this.state = "FAILED"; this.record("invalid_tool_request"); return this.snapshot();
      }
      this.state = "TOOL_PENDING"; this.record("tool_pending", req.id);
      if (req.kind !== "read") { this.pending = structuredClone(req); this.state = "APPROVAL_REQUIRED"; this.record("approval_required", req.id); return this.snapshot(); }
      await this.execute(req);
      return this.snapshot();
    } finally { this.busy = false; }
  }
  /** Only verified server code may construct the approval context. */
  async decide(request: ApprovalRequest, decision: ApprovalDecision): Promise<RuntimeSnapshot> {
    if (this.busy) throw new Error("BUSY");
    this.busy = true;
    try {
      const pending = this.pending;
      if (this.state !== "APPROVAL_REQUIRED" || !pending) throw new Error("NO_PENDING_APPROVAL");
      if (request.requestId !== pending.id || request.agentId !== this.config.agentId ||
          request.ownerId !== this.approval.ownerId || request.toolName !== pending.name ||
          request.kind !== pending.kind) throw new Error("APPROVAL_SCOPE_MISMATCH");
      // Canonical digest of pending input is derived locally, never accepted on trust.
      const encoded = new TextEncoder().encode(JSON.stringify(pending.input));
      const hash = await crypto.subtle.digest("SHA-256", encoded);
      const digest = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,"0")).join("");
      if (request.inputDigest !== digest) throw new Error("APPROVAL_INPUT_MISMATCH");
      const principal = await this.approval.resolvePrincipal();
      const approved = await authorizeApproval(request, principal, decision, this.approval.decisions);
      this.pending = undefined;
      if (!approved) {
        this.history.push({ ok: false, error: "APPROVAL_DENIED" });
        this.state = "OBSERVING"; this.record("approval_denied", pending.id);
        return this.snapshot();
      }
      this.record("approval_granted", pending.id);
      await this.execute(pending);
      return this.snapshot();
    } finally { this.busy = false; }
  }
}

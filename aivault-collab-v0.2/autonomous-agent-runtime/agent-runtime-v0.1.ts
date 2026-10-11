/**
 * AIVAULT autonomous agent runtime v0.1 (standalone, NOT DEPLOYED).
 * Pure TypeScript; no network, provider calls, DB writes, or background tasks.
 * Existing worker registry and production behavior remain unchanged.
 */
export type AgentState = "CREATED" | "AUTHORIZED" | "PLANNING" | "TOOL_PENDING" |
  "APPROVAL_REQUIRED" | "EXECUTING" | "OBSERVING" | "COMPLETED" | "FAILED" | "PAUSED";
export type ToolKind = "read" | "external_write" | "spend" | "commitment";
export type ToolRequest = { id: string; name: string; kind: ToolKind; input: Record<string, unknown> };
export type ToolResult = { ok: boolean; output?: unknown; error?: string };
export type PlanDecision = { type: "tool"; request: ToolRequest } | { type: "complete"; summary: string };
export type AgentConfig = { agentId: string; allowedTools: readonly string[]; maxSteps: number };
export type AuditEvent = { agentId: string; sequence: number; state: AgentState; action: string; toolId?: string };
export type RuntimeSnapshot = { state: AgentState; steps: number; pending?: ToolRequest; events: readonly AuditEvent[]; result?: string };
export type ToolAdapter = { execute: (request: ToolRequest) => Promise<ToolResult> };
export type Planner = { next: (history: readonly ToolResult[]) => Promise<PlanDecision> };
export class AutonomousAgentRuntime {
  private state: AgentState = "CREATED";
  private steps = 0;
  private pending?: ToolRequest;
  private result?: string;
  private readonly history: ToolResult[] = [];
  private readonly events: AuditEvent[] = [];
  private busy = false;
  constructor(private readonly config: AgentConfig, private readonly planner: Planner, private readonly tools: ToolAdapter) {
    if (!config.agentId || !Number.isInteger(config.maxSteps) || config.maxSteps < 1 || config.maxSteps > 100) throw new Error("INVALID_CONFIG");
    this.record("created");
  }
  private record(action: string, toolId?: string) { this.events.push({ agentId: this.config.agentId, sequence: this.events.length + 1, state: this.state, action, toolId }); }
  snapshot(): RuntimeSnapshot { return { state: this.state, steps: this.steps, pending: this.pending ? structuredClone(this.pending) : undefined, events: this.events.map(x => ({...x})), result: this.result }; }
  authorize() { if (this.state !== "CREATED") throw new Error("INVALID_STATE"); this.state = "AUTHORIZED"; this.record("authorized"); }
  pause() { if (this.state === "COMPLETED" || this.state === "FAILED") return; this.state = "PAUSED"; this.pending = undefined; this.record("paused"); }
  private async guardedExecute(request: ToolRequest) {
    this.state = "EXECUTING"; this.record("execute", request.id);
    try {
      const response = await this.tools.execute(structuredClone(request));
      this.history.push(structuredClone(response));
      this.state = "OBSERVING"; this.record(response.ok ? "tool_success" : "tool_failure", request.id);
    } catch {
      this.history.push({ ok: false, error: "TOOL_EXECUTION_FAILED" });
      this.state = "OBSERVING"; this.record("tool_failure", request.id);
    }
  }
  async step(): Promise<RuntimeSnapshot> {
    if (this.busy) throw new Error("BUSY");
    this.busy = true;
    try {
      if (this.state !== "AUTHORIZED" && this.state !== "OBSERVING") throw new Error("INVALID_STATE");
      if (this.steps >= this.config.maxSteps) { this.state = "FAILED"; this.record("step_limit"); return this.snapshot(); }
      this.state = "PLANNING"; this.record("planning");
      let decision: PlanDecision;
      try { decision = await this.planner.next(this.history.map(x => structuredClone(x))); }
      catch { this.state = "FAILED"; this.record("planner_failed"); return this.snapshot(); }
      this.steps++;
      if (decision.type === "complete") { this.state = "COMPLETED"; this.result = decision.summary; this.record("completed"); return this.snapshot(); }
      const req = decision.request;
      if (!req || !req.id || !this.config.allowedTools.includes(req.name)) { this.state = "FAILED"; this.record("tool_not_allowed"); return this.snapshot(); }
      this.state = "TOOL_PENDING"; this.record("tool_pending", req.id);
      if (req.kind !== "read") { this.pending = structuredClone(req); this.state = "APPROVAL_REQUIRED"; this.record("approval_required", req.id); return this.snapshot(); }
      await this.guardedExecute(req);
      return this.snapshot();
    } finally { this.busy = false; }
  }
  async resolveApproval(requestId: string, approved: boolean): Promise<RuntimeSnapshot> {
    if (this.busy) throw new Error("BUSY");
    this.busy = true;
    try {
      if (this.state !== "APPROVAL_REQUIRED" || !this.pending || this.pending.id !== requestId) throw new Error("INVALID_APPROVAL");
      const req = this.pending; this.pending = undefined;
      if (!approved) { this.history.push({ ok: false, error: "APPROVAL_DENIED" }); this.state = "OBSERVING"; this.record("approval_denied", req.id); return this.snapshot(); }
      this.record("approval_granted", req.id);
      await this.guardedExecute(req);
      return this.snapshot();
    } finally { this.busy = false; }
  }
}

/** Server-side approval adapter v0.1 — NOT DEPLOYED.
 * Guards the v0.2 runtime by requiring an immutable server-issued challenge.
 * Production must provide durable, atomic IssuedApprovalStore and
 * ApprovalDecisionStore, and must never expose the raw runtime object.
 */
import type { ApprovalDecision, ApprovalRequest } from "./approval-authority-v0.1.ts";
import type { RuntimeSnapshot } from "./agent-runtime-v0.1.ts";
import { AutonomousAgentRuntimeV2 } from "./agent-runtime-v0.2.ts";
import { digestToolInput, issueApproval, requireIssuedApproval, type IssuedApprovalStore } from "./trusted-approval-issuer-v0.1.ts";

export class IssuedApprovalRuntime {
  constructor(
    private readonly runtime: AutonomousAgentRuntimeV2,
    private readonly agentId: string,
    private readonly ownerId: string,
    private readonly issued: IssuedApprovalStore
  ) {}
  async issue(): Promise<ApprovalRequest> {
    const snapshot = this.runtime.snapshot();
    if (snapshot.state !== "APPROVAL_REQUIRED" || !snapshot.pending) throw new Error("NO_PENDING_APPROVAL");
    const previous = await this.issued.get(snapshot.pending.id);
    if (previous) {
      const digest = await digestToolInput(snapshot.pending.input);
      if (previous.agentId !== this.agentId ||
          previous.ownerId !== this.ownerId ||
          previous.toolName !== snapshot.pending.name ||
          previous.kind !== snapshot.pending.kind ||
          previous.inputDigest !== digest) {
        throw new Error("APPROVAL_CHALLENGE_COLLISION");
      }
      return previous;
    }
    return issueApproval(this.agentId, this.ownerId, snapshot.pending, this.issued);
  }
  async decide(presented: ApprovalRequest, decision: ApprovalDecision): Promise<RuntimeSnapshot> {
    // Do not use user-supplied expiry or identity as authority.
    const original = await requireIssuedApproval(presented, this.issued);
    if (original.agentId !== this.agentId || original.ownerId !== this.ownerId) throw new Error("APPROVAL_SCOPE_MISMATCH");
    return this.runtime.decide(original, decision);
  }
  snapshot(): RuntimeSnapshot { return this.runtime.snapshot(); }
}

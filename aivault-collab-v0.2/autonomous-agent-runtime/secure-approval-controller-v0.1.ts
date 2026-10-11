/** AIVAULT secure approval controller v0.1 — NOT DEPLOYED.
 * Integration boundary for trusted server code. Never expose the underlying
 * runtime's resolveApproval() to untrusted clients or agent-generated plans.
 * TODO: replace low-level public approval API with injected authorizer.
 */
import { AutonomousAgentRuntime, type RuntimeSnapshot } from "./agent-runtime-v0.1.ts";
import { authorizeApproval, type ApprovalDecision, type ApprovalDecisionStore, type ApprovalRequest, type TrustedApprovalPrincipal } from "./approval-authority-v0.1.ts";

export interface TrustedPrincipalResolver {
  /** Must authenticate server-side session/token; do not accept claimed identity. */
  resolve(): Promise<TrustedApprovalPrincipal>;
}
export class SecureApprovalController {
  constructor(
    private readonly runtime: AutonomousAgentRuntime,
    private readonly principalResolver: TrustedPrincipalResolver,
    private readonly store: ApprovalDecisionStore
  ) {}
  async decide(request: ApprovalRequest, decision: ApprovalDecision): Promise<RuntimeSnapshot> {
    const snapshot = this.runtime.snapshot();
    if (snapshot.state !== "APPROVAL_REQUIRED" || !snapshot.pending) throw new Error("NO_PENDING_APPROVAL");
    if (snapshot.pending.id !== request.requestId ||
        snapshot.pending.name !== request.toolName ||
        snapshot.pending.kind !== request.kind) throw new Error("PENDING_ACTION_MISMATCH");
    // The digest must be computed and checked against the canonical pending input
    // by trusted server code. No externally supplied digest is trusted by itself.
    const principal = await this.principalResolver.resolve();
    const approved = await authorizeApproval(request, principal, decision, this.store);
    return this.runtime.resolveApproval(request.requestId, approved);
  }
}

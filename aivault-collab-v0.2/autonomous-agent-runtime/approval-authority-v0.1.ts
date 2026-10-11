/**
 * AIVAULT approval authority guard v0.1 — standalone / NOT DEPLOYED.
 * Use this guard before calling AutonomousAgentRuntime.resolveApproval().
 * In production, verify the principal and signed authorization in trusted server code;
 * never trust identity or scope values directly from a browser/model response.
 */
export type ApprovalKind = "external_write" | "spend" | "commitment";
export type ApprovalRequest = {
  requestId: string;
  agentId: string;
  ownerId: string;
  toolName: string;
  kind: ApprovalKind;
  inputDigest: string;
  expiresAt: string;
};
export type TrustedApprovalPrincipal = {
  principalId: string;
  ownerId: string;
  permissions: readonly string[];
};
export type ApprovalDecision = {
  requestId: string;
  agentId: string;
  ownerId: string;
  toolName: string;
  inputDigest: string;
  approved: boolean;
  decidedAt: string;
};
export interface ApprovalDecisionStore {
  consumeOnce(requestId: string, decision: ApprovalDecision): Promise<boolean>;
}
export async function authorizeApproval(
  request: ApprovalRequest,
  principal: TrustedApprovalPrincipal,
  decision: ApprovalDecision,
  store: ApprovalDecisionStore,
  now = new Date()
): Promise<boolean> {
  if (!request.requestId || !request.agentId || !request.ownerId || !request.toolName || !request.inputDigest) throw new Error("INVALID_APPROVAL_REQUEST");
  if (!Number.isFinite(Date.parse(request.expiresAt)) || Date.parse(request.expiresAt) <= now.getTime()) throw new Error("APPROVAL_EXPIRED");
  if (!principal.principalId || principal.ownerId !== request.ownerId || !principal.permissions.includes("agent:approve:" + request.kind)) throw new Error("APPROVER_UNAUTHORIZED");
  if (decision.requestId !== request.requestId || decision.agentId !== request.agentId || decision.ownerId !== request.ownerId || decision.toolName !== request.toolName || decision.inputDigest !== request.inputDigest) throw new Error("APPROVAL_MISMATCH");
  if (!Number.isFinite(Date.parse(decision.decidedAt)) || Date.parse(decision.decidedAt) > now.getTime() || Date.parse(decision.decidedAt) < now.getTime() - 300000) throw new Error("APPROVAL_DECISION_STALE");
  const consumed = await store.consumeOnce(request.requestId, decision);
  if (!consumed) throw new Error("APPROVAL_REPLAY");
  return decision.approved;
}

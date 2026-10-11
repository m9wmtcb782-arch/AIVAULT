/** AIVAULT trusted approval issuance v0.1 — NOT DEPLOYED.
 * Only a trusted server may create approval challenges. The client must not
 * choose expiry, owner, agent, tool kind, or request digest.
 */
import type { ApprovalRequest } from "./approval-authority-v0.1.ts";
import type { ToolRequest } from "./agent-runtime-v0.1.ts";
export interface IssuedApprovalStore {
  /** Must be an atomic, durable insert with a unique key in production. */
  issue(request: ApprovalRequest): Promise<void>;
  /** Must return the original immutable server-issued record. */
  get(requestId: string): Promise<ApprovalRequest | null>;
}
export async function digestToolInput(input: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}
export async function issueApproval(
  agentId: string,
  ownerId: string,
  pending: ToolRequest,
  store: IssuedApprovalStore,
  now = new Date(),
  ttlMs = 60000
): Promise<ApprovalRequest> {
  if (!agentId.trim() || !ownerId.trim() || !pending.id.trim() || !pending.name.trim()) throw new Error("INVALID_ISSUANCE");
  if (pending.kind === "read") throw new Error("READ_DOES_NOT_REQUIRE_APPROVAL");
  if (!Number.isInteger(ttlMs) || ttlMs < 1000 || ttlMs > 300000) throw new Error("INVALID_TTL");
  const request: ApprovalRequest = {
    requestId: pending.id, agentId, ownerId, toolName: pending.name,
    kind: pending.kind, inputDigest: await digestToolInput(pending.input),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString()
  };
  await store.issue(request);
  return request;
}
export async function requireIssuedApproval(
  presented: ApprovalRequest,
  store: IssuedApprovalStore
): Promise<ApprovalRequest> {
  const issued = await store.get(presented.requestId);
  if (!issued) throw new Error("APPROVAL_NOT_ISSUED");
  const fields = ["requestId", "agentId", "ownerId", "toolName", "kind", "inputDigest", "expiresAt"] as const;
  if (fields.some(field => presented[field] !== issued[field])) throw new Error("ISSUED_APPROVAL_MISMATCH");
  return issued;
}

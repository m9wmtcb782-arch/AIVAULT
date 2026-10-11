/** AIVAULT Postgres approval store adapter — NOT DEPLOYED.
 * A trusted backend must inject a transaction-capable database connection.
 * Do not expose this adapter to browsers or untrusted agent code.
 */
import type { ApprovalDecision, ApprovalDecisionStore, ApprovalRequest } from "./approval-authority-v0.1.ts";
import type { IssuedApprovalStore } from "./trusted-approval-issuer-v0.1.ts";

export interface SqlExecutor {
  query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<{ rows: T[] }>;
}
type ChallengeRow = {
  request_id: string; agent_id: string; owner_id: string; tool_name: string;
  kind: ApprovalRequest["kind"]; input_digest: string; expires_at: string | Date;
};
const columns = "request_id,agent_id,owner_id,tool_name,kind,input_digest,expires_at";
export class PostgresApprovalStore implements IssuedApprovalStore, ApprovalDecisionStore {
  constructor(private readonly db: SqlExecutor) {}
  async issue(request: ApprovalRequest): Promise<void> {
    const result = await this.db.query<{request_id: string}>(
      `insert into aivault_agent_security.approval_challenges
      (${columns}) values ($1,$2,$3,$4,$5,$6,$7)
      on conflict (request_id) do nothing returning request_id`,
      [request.requestId,request.agentId,request.ownerId,request.toolName,request.kind,request.inputDigest,request.expiresAt]
    );
    if (result.rows.length !== 1) throw new Error("APPROVAL_ALREADY_ISSUED");
  }
  async get(requestId: string): Promise<ApprovalRequest | null> {
    const result = await this.db.query<ChallengeRow>(
      `select ${columns} from aivault_agent_security.approval_challenges where request_id=$1`,
      [requestId]
    );
    const row = result.rows[0];
    return row ? {
      requestId: row.request_id,agentId: row.agent_id,ownerId: row.owner_id,
      toolName: row.tool_name,kind: row.kind,inputDigest: row.input_digest,
      expiresAt: new Date(row.expires_at).toISOString()
    } : null;
  }
  async consumeOnce(requestId: string, decision: ApprovalDecision): Promise<boolean> {
    // Never take kind or expiry from a browser-supplied decision.
    // The database reads kind from the original immutable challenge.
    const result = await this.db.query<{ consumed: boolean }>(
      `with challenge as (
         select kind from aivault_agent_security.approval_challenges
         where request_id=$1 and agent_id=$2 and owner_id=$3
           and tool_name=$4 and input_digest=$5
       )
       select aivault_agent_security.consume_approval(
         $1,$2,$3,$4,kind,$5,$6
       ) as consumed from challenge`,
      [requestId,decision.agentId,decision.ownerId,decision.toolName,
       decision.inputDigest,decision.approved ? "approved" : "denied"]
    );
    return result.rows.length === 1 && result.rows[0].consumed === true;
  }
}

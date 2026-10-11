/** Offline contract tests for PostgresApprovalStore; no real DB or network. */
import { PostgresApprovalStore, type SqlExecutor } from "./postgres-approval-store-v0.1.ts";
import type { ApprovalRequest, ApprovalDecision } from "./approval-authority-v0.1.ts";
const request: ApprovalRequest = {
 requestId:"request-1",agentId:"agent-1",ownerId:"owner-1",toolName:"publish",
 kind:"external_write",inputDigest:"a".repeat(64),expiresAt:"2099-01-01T00:00:00.000Z"
};
const decision: ApprovalDecision = {
 requestId:request.requestId,agentId:request.agentId,ownerId:request.ownerId,
 toolName:request.toolName,inputDigest:request.inputDigest,approved:true,decidedAt:"2099-01-01T00:00:00.000Z"
};
Deno.test("postgres adapter uses parameterized insert and rejects duplicate", async () => {
 const calls: {sql:string;params:readonly unknown[]}[] = [];
 const db:SqlExecutor={async query<T extends Record<string,unknown>>(sql:string,params:readonly unknown[]){
  calls.push({sql,params});return {rows:(calls.length===1?[{request_id:"request-1"}]:[]) as T[]};
 }};
 const store=new PostgresApprovalStore(db);
 await store.issue(request);
 if(!calls[0].sql.includes("$1")||calls[0].params[0]!==request.requestId) throw new Error("NOT_PARAMETERIZED");
 let duplicateRejected=false;
 try {await store.issue(request);}catch(e){duplicateRejected=String(e).includes("APPROVAL_ALREADY_ISSUED");}
 if(!duplicateRejected) throw new Error("DUPLICATE_NOT_REJECTED");
});
Deno.test("postgres adapter returns original challenge fields",async()=>{
 const db:SqlExecutor={async query<T extends Record<string,unknown>>(){
  return {rows:[{request_id:request.requestId,agent_id:request.agentId,owner_id:request.ownerId,
   tool_name:request.toolName,kind:request.kind,input_digest:request.inputDigest,
   expires_at:new Date(request.expiresAt)}] as T[]};
 }};
 const found=await new PostgresApprovalStore(db).get(request.requestId);
 if(JSON.stringify(found)!==JSON.stringify(request)) throw new Error("RECORD_MISMATCH");
});
Deno.test("postgres adapter consumes once with database-owned kind",async()=>{
 const calls:readonly unknown[][]=[];
 let count=0;
 const db:SqlExecutor={async query<T extends Record<string,unknown>>(sql:string,params:readonly unknown[]){
  (calls as unknown[][]).push([...params]);count++;
  if(!sql.includes("select kind from aivault_agent_security.approval_challenges")) throw new Error("KIND_NOT_DATABASE_OWNED");
  return {rows:[{consumed:count===1}] as T[]};
 }};
 const store=new PostgresApprovalStore(db);
 if(!await store.consumeOnce(request.requestId,decision)) throw new Error("FIRST_FAILED");
 if(await store.consumeOnce(request.requestId,decision)) throw new Error("REPLAY_ACCEPTED");
 if(calls[0][5]!=="approved") throw new Error("WRONG_DECISION");
});

/** Offline tests for approval issuance retries; no database or provider. */
import { IssuedApprovalRuntime } from "./issued-approval-runtime-v0.1.ts";
import { AutonomousAgentRuntimeV2 } from "./agent-runtime-v0.2.ts";
import type { ApprovalRequest } from "./approval-authority-v0.1.ts";
import type { IssuedApprovalStore } from "./trusted-approval-issuer-v0.1.ts";
function fixture() {
 const records = new Map<string, ApprovalRequest>();
 let issued = 0;
 const store: IssuedApprovalStore = {
   async issue(request) { if(records.has(request.requestId)) throw new Error("DUPLICATE"); records.set(request.requestId,request); issued++; },
   async get(id) { return records.get(id) ?? null; }
 };
 const runtime = new AutonomousAgentRuntimeV2(
  {agentId:"agent-1",allowedTools:["publish"],maxSteps:2},
  {next:async()=>({type:"tool" as const,request:{id:"action-1",name:"publish",kind:"external_write" as const,input:{draft:"hello"}}})},
  {execute:async()=>({ok:true})},
  {ownerId:"owner-1",resolvePrincipal:async()=>({principalId:"owner-1",ownerId:"owner-1",permissions:["agent:approve:external_write"]}),
   decisions:{consumeOnce:async()=>true}}
 );
 runtime.authorize();
 return {runtime, adapter:new IssuedApprovalRuntime(runtime,"agent-1","owner-1",store),records,issued:()=>issued};
}
Deno.test("approval retries preserve original expiry and do not insert twice",async()=>{
 const x=fixture();
 await x.runtime.step();
 const first=await x.adapter.issue();
 const second=await x.adapter.issue();
 if(first.expiresAt!==second.expiresAt||x.issued()!==1) throw new Error("RETRY_RESET_EXPIRY");
});
Deno.test("approval retry rejects challenge collision",async()=>{
 const x=fixture();
 await x.runtime.step();
 const first=await x.adapter.issue();
 x.records.set(first.requestId,{...first,inputDigest:"b".repeat(64)});
 let rejected=false;
 try {await x.adapter.issue();}catch(e){rejected=String(e).includes("APPROVAL_CHALLENGE_COLLISION");}
 if(!rejected) throw new Error("COLLISION_NOT_REJECTED");
});

Deno.test("expired approval cannot be reused on retry",async()=>{
 const x=fixture();
 await x.runtime.step();
 const first=await x.adapter.issue();
 x.records.set(first.requestId,{...first,expiresAt:new Date(Date.now()-1000).toISOString()});
 let rejected=false;
 try {await x.adapter.issue();}catch(e){rejected=String(e).includes("APPROVAL_EXPIRED");}
 if(!rejected||x.issued()!==1) throw new Error("EXPIRED_APPROVAL_REUSED");
});

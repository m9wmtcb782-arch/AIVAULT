/** All-member research assignment planner.
 * Creates an assignment for every enabled member, never silently discards a member.
 * Does not pretend that assignment means reading, browsing, or inference has occurred.
 * Caller must provide legally accessible ebook text or approved public-web fetcher.
 */
export type Member={agentId:string;enabled:boolean;capabilities:readonly string[]};
export type Source={id:string;kind:"EBOOK"|"PUBLIC_WEB";authorized:boolean;location:string};
export type Assignment={agentId:string;sourceId:string|null;status:"ASSIGNED"|"BLOCKED";reason:string};
export function assignAllMembers(members:readonly Member[],sources:readonly Source[]):Assignment[]{
 const usable=sources.filter(s=>s.authorized&&!!s.id.trim()&&!!s.location.trim());
 const seen=new Set<string>();let next=0;
 return members.map(m=>{
  if(seen.has(m.agentId))return {agentId:m.agentId,sourceId:null,status:"BLOCKED",reason:"DUPLICATE_AGENT_ID"};
  seen.add(m.agentId);
  if(!m.enabled)return {agentId:m.agentId,sourceId:null,status:"BLOCKED",reason:"DISABLED"};
  if(!m.capabilities.includes("research")&&!m.capabilities.includes("reading"))return {agentId:m.agentId,sourceId:null,status:"BLOCKED",reason:"CAPABILITY_MISSING"};
  if(!usable.length)return {agentId:m.agentId,sourceId:null,status:"BLOCKED",reason:"NO_AUTHORIZED_SOURCE"};
  const s=usable[next++%usable.length];
  return {agentId:m.agentId,sourceId:s.id,status:"ASSIGNED",reason:"AWAITING_REAL_EXECUTION"};
 });
}
export function summarizeAssignments(a:readonly Assignment[]){
 return {total:a.length,assigned:a.filter(x=>x.status==="ASSIGNED").length,blocked:a.filter(x=>x.status==="BLOCKED").length,completed:0};
}

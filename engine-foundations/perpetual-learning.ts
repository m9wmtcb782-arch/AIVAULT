/** AIVAULT perpetual learning contract.
 * A study cycle can finish, but the learning mission never becomes "done".
 * Do not claim an agent is running without verifiable execution evidence.
 */
export type CycleStatus="WAITING_EXECUTOR"|"RESEARCHING"|"VERIFYING"|"CYCLE_COMPLETE"|"RETRY_WAIT"|"BLOCKED";
export type LearningState={agentId:string;mission:"PERPETUAL_LEARNING";cycle:number;status:CycleStatus;lastEvidenceAt:string|null;nextEligibleAt:string;lastSourceUrl:string|null;verifiedFindings:number;errorCount:number};
export type Evidence={agentId:string;cycle:number;sourceUrl:string;retrievedAt:string;claim:string;verification:"PASS"|"FAIL"|"PENDING";executionId:string};
const DAY=86400000;
export function initialLearningState(agentId:string,now=new Date()):LearningState{
 if(!agentId.trim())throw Error("AGENT_ID_REQUIRED");
 return {agentId,mission:"PERPETUAL_LEARNING",cycle:1,status:"WAITING_EXECUTOR",lastEvidenceAt:null,nextEligibleAt:now.toISOString(),lastSourceUrl:null,verifiedFindings:0,errorCount:0};
}
export function recordResearch(s:LearningState,e:Evidence):LearningState{
 if(e.agentId!==s.agentId||e.cycle!==s.cycle||!e.executionId.trim()||!/^https:\/\//.test(e.sourceUrl)||!e.claim.trim()||Number.isNaN(Date.parse(e.retrievedAt)))throw Error("INVALID_EXECUTION_EVIDENCE");
 return {...s,status:e.verification==="PENDING"?"VERIFYING":e.verification==="PASS"?"CYCLE_COMPLETE":"RETRY_WAIT",lastEvidenceAt:e.retrievedAt,lastSourceUrl:e.sourceUrl,verifiedFindings:s.verifiedFindings+(e.verification==="PASS"?1:0),errorCount:s.errorCount+(e.verification==="FAIL"?1:0)};
}
export function scheduleNextCycle(s:LearningState,now=new Date(),intervalMs=DAY):LearningState{
 if(s.status!=="CYCLE_COMPLETE"&&s.status!=="RETRY_WAIT")throw Error("CYCLE_NOT_RESOLVED");
 if(!Number.isFinite(intervalMs)||intervalMs<3600000)throw Error("INTERVAL_TOO_SHORT");
 return {...s,cycle:s.cycle+1,status:"WAITING_EXECUTOR",nextEligibleAt:new Date(now.getTime()+intervalMs).toISOString()};
}
export function mayDispatch(s:LearningState,now=new Date()):boolean{return s.status==="WAITING_EXECUTOR"&&now.getTime()>=Date.parse(s.nextEligibleAt)}
export function learningDashboard(states:readonly LearningState[],now=new Date()){
 return {registered:states.length,perpetual:states.filter(s=>s.mission==="PERPETUAL_LEARNING").length,eligible:states.filter(s=>mayDispatch(s,now)).length,waitingForExecutor:states.filter(s=>s.status==="WAITING_EXECUTOR").length,activelyResearching:states.filter(s=>s.status==="RESEARCHING"&&s.lastEvidenceAt!==null).length,verifiedFindings:states.reduce((n,s)=>n+s.verifiedFindings,0)};
}

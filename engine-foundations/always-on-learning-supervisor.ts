/** AIVAULT always-on learning supervisor contract.
 * Learning continues while BOTH frontend heartbeat and backend heartbeat are healthy.
 * No fabricated progress; execution must be acknowledged by a real worker.
 * The scheduler itself must run on an always-on backend, not inside a browser tab.
 */
export type Health={frontendLastSeen:string|null;backendLastSeen:string|null};
export type WorkerState={id:string;nextEligibleAt:string;leaseUntil:string|null;lastExecutionId:string|null;lastEvidenceAt:string|null};
export type DispatchDecision={action:"DISPATCH"|"WAIT"|"PAUSE";reason:string};
const age=(s:string|null,now:number)=>s===null?Infinity:now-Date.parse(s);
export function decideDispatch(health:Health,worker:WorkerState,now=new Date(),heartbeatTimeoutMs=120000):DispatchDecision{
 const t=now.getTime();
 if(!Number.isFinite(heartbeatTimeoutMs)||heartbeatTimeoutMs<1000)throw Error("INVALID_HEARTBEAT_TIMEOUT");
 if(age(health.backendLastSeen,t)>heartbeatTimeoutMs)return {action:"PAUSE",reason:"BACKEND_UNAVAILABLE"};
 if(age(health.frontendLastSeen,t)>heartbeatTimeoutMs)return {action:"PAUSE",reason:"FRONTEND_UNAVAILABLE"};
 if(worker.leaseUntil&&Date.parse(worker.leaseUntil)>t)return {action:"WAIT",reason:"EXECUTION_LEASE_ACTIVE"};
 if(Date.parse(worker.nextEligibleAt)>t)return {action:"WAIT",reason:"NEXT_CYCLE_NOT_DUE"};
 return {action:"DISPATCH",reason:"HEALTHY_AND_ELIGIBLE"};
}
export function acknowledgeExecution(worker:WorkerState,executionId:string,evidenceAt:string,now=new Date()):WorkerState{
 if(!executionId.trim()||!Number.isFinite(Date.parse(evidenceAt)))throw Error("INVALID_EVIDENCE");
 return {...worker,lastExecutionId:executionId,lastEvidenceAt:evidenceAt,leaseUntil:null,nextEligibleAt:now.toISOString()};
}
export function claimLease(worker:WorkerState,now=new Date(),leaseMs=60000):WorkerState{
 if(!Number.isFinite(leaseMs)||leaseMs<1000)throw Error("INVALID_LEASE");
 if(worker.leaseUntil&&Date.parse(worker.leaseUntil)>now.getTime())throw Error("ALREADY_LEASED");
 return {...worker,leaseUntil:new Date(now.getTime()+leaseMs).toISOString()};
}

/** V0.8 Three-engine coordination contract.
 * ANN supplies an optional accepted-model suggestion; rule reasoning verifies evidence;
 * ANCN dispatch is permitted only after real worker admission and independent verification.
 * Pure orchestration: no network calls, fake ANN scores, or implicit task execution.
 */
import {admit, type Worker} from "./worker-admission.ts";
export type ANNResult={status:"ACCEPTED"|"FALLBACK_RULE"|"BLOCKED";score:number|null;modelVersion?:string;reason:string};
export type RuleResult={truth:"PROVEN"|"REFUTED"|"CONFLICT"|"UNKNOWN";evidenceIds:readonly string[]};
export type ANCNDecision={
 status:"READY_FOR_DISPATCH"|"BLOCKED";workerId:string|null;
 annUsed:boolean;annStatus:ANNResult["status"];ruleTruth:RuleResult["truth"];reasons:string[];
};
export function coordinateThreeEngines(input:{
 worker:Worker;now:number;ann:ANNResult;rules:RuleResult;
 executionVerified:boolean;taskAuthorized:boolean;
}):ANCNDecision{
 const reasons:string[]=[];
 const admission=admit(input.worker,input.now);
 if(admission.status!=="READY")reasons.push(admission.reason);
 if(!input.taskAuthorized)reasons.push("TASK_NOT_AUTHORIZED");
 if(input.rules.truth!=="PROVEN"||input.rules.evidenceIds.length===0)reasons.push("RULE_EVIDENCE_NOT_PROVEN");
 // Pre-dispatch must not require a future execution receipt.\n // This legacy flag is intentionally ignored; use runThreeEngines for post-execution verification.
 const annUsed=input.ann.status==="ACCEPTED" && typeof input.ann.score==="number" &&
 Number.isFinite(input.ann.score)&&input.ann.score>=0&&input.ann.score<=1;
 if(input.ann.status==="ACCEPTED"&&!annUsed)reasons.push("ANN_SCORE_INVALID");
 if(input.ann.status==="BLOCKED")reasons.push("ANN_BLOCKED");\n if(annUsed&&input.ann.score!<=0.5)reasons.push("ANN_ADVISES_AVOID");
 // Fallback rule route is allowed, but must never claim ANN participated.
 return {status:reasons.length?"BLOCKED":"READY_FOR_DISPATCH",
 workerId:reasons.length?null:input.worker.id,annUsed,
 annStatus:input.ann.status,ruleTruth:input.rules.truth,reasons};
}

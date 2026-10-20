/** V0.9 ANCN two-phase execution. No API calls until caller injects a real executor.
 * Admission and evidence are checked BEFORE execution; actual receipt is checked AFTER.
 */
import {admit,type Worker} from "./worker-admission.ts";
import type {ANNResult,RuleResult} from "./three-engine-coordinator.ts";
export type Task={id:string;authorized:boolean;worker:Worker;now:number;ann:ANNResult;rules:RuleResult};
export type Receipt={taskId:string;workerId:string;success:boolean;output:string;verified:boolean};
export type Audit={taskId:string;workerId:string;phase:"BLOCKED"|"DISPATCHED"|"VERIFIED"|"FAILED";annUsed:boolean;annScore:number|null;ruleTruth:RuleResult["truth"];reason:string;receipt?:Receipt};
export type Executor=(task:Task)=>Promise<Receipt>;
export async function runThreeEngines(task:Task,execute:Executor):Promise<Audit>{
 const annUsed=task.ann.status==="ACCEPTED"&&typeof task.ann.score==="number"&&Number.isFinite(task.ann.score)&&task.ann.score>=0&&task.ann.score<=1;
 const base={taskId:task.id,workerId:task.worker.id,annUsed,annScore:annUsed?task.ann.score:null,ruleTruth:task.rules.truth};
 const deny=(reason:string):Audit=>({...base,phase:"BLOCKED",reason});
 if(!task.id.trim())return deny("INVALID_TASK_ID");
 if(!task.authorized)return deny("TASK_NOT_AUTHORIZED");
 const a=admit(task.worker,task.now);
 if(a.status!=="READY")return deny(a.reason);
 if(task.rules.truth!=="PROVEN"||task.rules.evidenceIds.length===0)return deny("RULE_EVIDENCE_NOT_PROVEN");
 if(task.ann.status==="BLOCKED")return deny("ANN_BLOCKED");
 if(task.ann.status==="ACCEPTED"&&!annUsed)return deny("ANN_SCORE_INVALID");
 if(annUsed&&task.ann.score!<=0.5)return deny("ANN_ADVISES_AVOID");
 try{
  const receipt=await execute(task);
  if(receipt.taskId!==task.id||receipt.workerId!==task.worker.id)return {...base,phase:"FAILED",reason:"RECEIPT_ID_MISMATCH",receipt};
  if(!receipt.success||!receipt.verified||!receipt.output.trim())return {...base,phase:"FAILED",reason:"EXECUTION_NOT_VERIFIED",receipt};
  return {...base,phase:"VERIFIED",reason:"VERIFIED_RECEIPT",receipt};
 }catch{return {...base,phase:"FAILED",reason:"EXECUTOR_ERROR"};}
}

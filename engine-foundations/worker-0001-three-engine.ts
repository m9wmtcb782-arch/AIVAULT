/** V1.0 Worker-0001 -> rules -> ANCN execution adapter.
 * Explicit extracted evidence only. No invented model execution, network, or paid APIs.
 * The independent verifier MUST be supplied by the caller.
 */
import {researchWorker0001,type ResearchDocument} from "./worker-0001.ts";
import {runThreeEngines,type Audit} from "./three-engine-runtime.ts";
import type {ANNResult} from "./three-engine-coordinator.ts";
import type {Worker} from "./worker-admission.ts";
import type {Rule} from "./chain.ts";
export type IndependentVerifier=(input:{taskId:string;source:ResearchDocument;proposition:string;evidenceIds:readonly string[]})=>Promise<boolean>;
export async function runWorker0001EvidenceTask(input:{
 taskId:string;document:ResearchDocument;proposition:string;rules?:readonly Rule[];
 worker:Worker;now:number;authorized:boolean;ann:ANNResult;
 verify:IndependentVerifier;
}):Promise<Audit>{
 const research=researchWorker0001(input.document,input.rules??[]);
 const fact=research.findings.facts.find(f=>f.proposition===input.proposition);
 const ruleTruth=research.status==="EVIDENCE_READY"&&!research.findings.truncated&&fact?fact.truth:"UNKNOWN";
 const evidenceIds=fact?.evidenceIds??[];
 const task={id:input.taskId,authorized:input.authorized,worker:input.worker,now:input.now,ann:input.ann,
 rules:{truth:ruleTruth,evidenceIds}};
 return runThreeEngines(task,async t=>{
  // This worker only provides evidence intake, NOT LLM-generated answers.
  const verified=await input.verify({taskId:t.id,source:input.document,proposition:input.proposition,evidenceIds});
  return {taskId:t.id,workerId:t.worker.id,success:research.status==="EVIDENCE_READY",
   output:verified?input.proposition:"",verified};
 });
}

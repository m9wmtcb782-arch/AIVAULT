/** Deterministic voice-result reorder buffer.
 * Inference can complete out of order, but audio must be emitted in source order.
 * No network, task submission or model access is performed here.
 */
import {validateVoiceClauseResult} from "./voice-pool-task-planner.mjs";
export class OrderedVoiceResults {
 constructor(tasks,{maxBuffered=16}={}){
  if(!Array.isArray(tasks)||!tasks.length||!Number.isSafeInteger(maxBuffered)||maxBuffered<1)throw new Error("INVALID_VOICE_TASKS");
  if(tasks.some((t,i)=>t.sequence!==i))throw new Error("INVALID_TASK_SEQUENCE");
  this.tasks=tasks;this.maxBuffered=maxBuffered;this.next=0;this.pending=new Map();this.failed=false;
 }
 accept(result){
  if(this.failed)throw new Error("VOICE_SESSION_FAILED");
  if(!result||!Number.isSafeInteger(result.sequence)||result.sequence<this.next||result.sequence>=this.tasks.length)
   throw new Error("STALE_OR_INVALID_VOICE_RESULT");
  if(this.pending.has(result.sequence))throw new Error("DUPLICATE_VOICE_RESULT");
  if(!validateVoiceClauseResult(this.tasks[result.sequence],result))throw new Error("INVALID_VOICE_RESULT");
  if(this.pending.size>=this.maxBuffered&&!this.pending.has(this.next))throw new Error("VOICE_RESULT_BACKPRESSURE");
  this.pending.set(result.sequence,result);
  const ready=[];
  while(this.pending.has(this.next)){
   ready.push(this.pending.get(this.next));this.pending.delete(this.next);this.next++;
  }
  return ready;
 }
 fail(){this.failed=true;this.pending.clear();}
 get complete(){return !this.failed&&this.next===this.tasks.length;}
}

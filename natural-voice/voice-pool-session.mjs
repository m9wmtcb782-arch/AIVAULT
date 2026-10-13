/** Isolated, fail-closed voice pool orchestration.
 * Dispatch is dependency-injected and MUST be a trusted first-party server adapter.
 * This file never contacts the live Coordinator or sends text to browser nodes.
 */
import {assessVoicePool} from "./compute-pool-admission.mjs";
import {planVoiceClauses} from "./voice-pool-task-planner.mjs";
import {OrderedVoiceResults} from "./ordered-voice-results.mjs";

export async function runVoicePoolSession({text,modelId,pool,approved=false,weightsInstalled=false,dispatch,signal,onAudio}={}){
 const admission=assessVoicePool({pool,modelId,approved,weightsInstalled});
 if(!admission.ready)throw new Error(admission.reason);
 if(typeof dispatch!=="function"||typeof onAudio!=="function")throw new Error("TRUSTED_DISPATCH_REQUIRED");
 if(signal?.aborted)throw new Error("VOICE_CANCELLED");
 const tasks=planVoiceClauses({text,modelId});
 const queue=new OrderedVoiceResults(tasks,{maxBuffered:Math.max(16,tasks.length)});
 // Limit concurrent model requests; preserve original playback order.
 let cursor=0,failed=null,playback=Promise.resolve();
 const cancelled=()=>signal?.aborted===true;
 const workers=Array.from({length:Math.min(2,tasks.length)},async()=>{
  while(cursor<tasks.length&&!failed&&!cancelled()){
   const task=tasks[cursor++];
   try{
    const result=await dispatch(task,{signal});
    if(cancelled()||failed)return;
    const ready=queue.accept(result);
    const batch=ready;
    playback=playback.then(async()=>{
     for(const audio of batch){
      if(cancelled()||failed)return;
      await onAudio(audio);
     }
    });
    await playback;
   }catch(error){if(!failed){failed=error;queue.fail();}return;}
  }
 });
 await Promise.all(workers);
 if(cancelled())throw new Error("VOICE_CANCELLED");
 if(failed)throw failed;
 if(!queue.complete)throw new Error("VOICE_INCOMPLETE");
 return {status:"COMPLETED",clauses:tasks.length};
}

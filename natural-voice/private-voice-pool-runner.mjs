/** Private first-party voice pool runner.
 * Intended for a trusted Node server, NOT a browser or public Supabase Edge page.
 * Does not register nodes or submit jobs to the live Compute Coordinator.
 */
import {createPrivateVoiceDispatch} from "./private-voice-worker-dispatch.mjs";
import {runVoicePoolSession} from "./voice-pool-session.mjs";

export async function runPrivateVoicePool({
 text,modelId,pool,approved=false,weightsInstalled=false,
 workerBaseUrl,workerToken,fetchImpl,signal,onAudio
}={}){
 if(typeof onAudio!=="function")throw new Error("AUDIO_CALLBACK_REQUIRED");
 const dispatch=createPrivateVoiceDispatch({
  baseUrl:workerBaseUrl,token:workerToken,fetchImpl
 });
 return runVoicePoolSession({
  text,modelId,pool,approved,weightsInstalled,dispatch,signal,onAudio
 });
}

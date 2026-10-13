/** Pace incoming PCM16 frames against the Web Audio playback clock. */
export async function enqueueWithPacing(player,frame,{signal,maximumWaitMs=30000}={}){
 if(signal?.aborted)return false;
 const start=Date.now();
 while(true){
  if(signal?.aborted)return false;
  const queued=Math.max(0,player.nextTime-player.context.currentTime);
  if(queued<=player.maxQueuedSeconds-0.15) {
   try{return player.enqueue(frame);}
   catch(error){if(error?.message!=="PLAYBACK_BACKPRESSURE")throw error;}
  }
  if(Date.now()-start>maximumWaitMs)throw new Error("PLAYBACK_QUEUE_TIMEOUT");
  await new Promise(resolve=>setTimeout(resolve,35));
 }
}

/** Bind isolated voice pipeline audio frames to the Web Audio player.
 * Each run gets a new player generation; interruptions clear queued sound.
 */
import {VoicePipeline} from "./voice-pipeline.mjs";
import {PcmAudioPlayer} from "./pcm-audio-player.mjs";
export class VoicePlaybackSession {
 constructor({asr,brain,tts,audioContext,onEvent=()=>{}}) {
  this.onEvent=onEvent;
  this.player=new PcmAudioPlayer({audioContext,onEvent});
  this.pipeline=new VoicePipeline({asr,brain,tts,onEvent:event=>{
   if(event.type==="audio.clear") {
    this.player.interrupt();
   } else if(event.type==="audio.frame") {
    this.player.enqueue(event.pcm,{generation:this.player.generation,sequence:event.sequence});
   }
   this.onEvent(event);
  }});
 }
 async start({audio,voiceId="anxing-default",language="zh-TW"}) {
  await this.player.resume();
  return this.pipeline.run({audio,voiceId,language});
 }
 interrupt(){this.pipeline.interrupt();}
}

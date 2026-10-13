/** Browser PCM16 mono playback using Web Audio.
 * Playback position is acknowledged when audio is scheduled, not heard;
 * callers must not use schedule events as reading-highlight proof.
 */
export class PcmAudioPlayer {
 constructor({audioContext,onEvent=()=>{},sampleRate=24000,maxQueuedSeconds=3}={}) {
  if(!audioContext?.createBuffer||!audioContext?.createBufferSource||!audioContext?.destination) throw new Error("AUDIO_CONTEXT_REQUIRED");
  if(!Number.isFinite(maxQueuedSeconds)||maxQueuedSeconds<=0) throw new Error("INVALID_QUEUE_LIMIT");
  this.context=audioContext;this.onEvent=onEvent;this.sampleRate=sampleRate;
  this.maxQueuedSeconds=maxQueuedSeconds;this.nextTime=0;this.sources=new Set();this.generation=0;
 }
 async resume(){if(this.context.state==="suspended")await this.context.resume();}
 enqueue(pcm,{generation=this.generation,sequence=0}={}) {
  if(generation!==this.generation)return false;
  if(!(pcm instanceof Uint8Array)||pcm.length===0||pcm.length%2) throw new Error("INVALID_PCM");
  const frames=pcm.length/2;
  const start=Math.max(this.context.currentTime+0.03,this.nextTime);
  if(start-this.context.currentTime>this.maxQueuedSeconds) throw new Error("PLAYBACK_BACKPRESSURE");
  const buffer=this.context.createBuffer(1,frames,this.sampleRate);
  const samples=buffer.getChannelData(0);
  const view=new DataView(pcm.buffer,pcm.byteOffset,pcm.byteLength);
  for(let i=0;i<frames;i++)samples[i]=view.getInt16(i*2,true)/32768;
  const source=this.context.createBufferSource();
  source.buffer=buffer;source.connect(this.context.destination);
  source.onended=()=>{this.sources.delete(source);this.onEvent({type:"playback.ended",generation,sequence});};
  this.sources.add(source);source.start(start);
  this.nextTime=start+frames/this.sampleRate;
  this.onEvent({type:"playback.scheduled",generation,sequence,start,duration:frames/this.sampleRate});
  return true;
 }
 interrupt() {
  this.generation++;
  for(const source of this.sources){source.onended=null;try{source.stop();}catch{}try{source.disconnect();}catch{}}
  this.sources.clear();this.nextTime=0;
  this.onEvent({type:"playback.cleared",generation:this.generation});
  return this.generation;
 }
}

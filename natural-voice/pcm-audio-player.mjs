/** Browser PCM16 mono playback using Web Audio.
 * Playback position is acknowledged when audio is scheduled, not heard;
 * callers must not use schedule events as reading-highlight proof.
 */
export class PcmAudioPlayer {
 constructor({audioContext,onEvent=()=>{},sampleRate=24000,maxQueuedSeconds=3}={}) {
  if(!audioContext?.createBuffer||!audioContext?.createBufferSource||!audioContext?.destination) throw new Error("AUDIO_CONTEXT_REQUIRED");
  if(!Number.isFinite(maxQueuedSeconds)||maxQueuedSeconds<=0) throw new Error("INVALID_QUEUE_LIMIT");
  this.context=audioContext;this.onEvent=onEvent;this.sampleRate=sampleRate;
  this.maxQueuedSeconds=maxQueuedSeconds;this.nextTime=0;this.sources=new Set();this.generation=0;this.pendingHighlights=[];this.highlightTimer=null;
 }
 async resume(){if(this.context.state==="suspended")await this.context.resume();}
 enqueue(pcm,{generation=this.generation,sequence=0,charStart=null,charEnd=null}={}) {
  if(generation!==this.generation)return false;
  if(!(pcm instanceof Uint8Array)||pcm.length===0||pcm.length%2) throw new Error("INVALID_PCM");
  if((charStart!==null||charEnd!==null)&&(!Number.isSafeInteger(charStart)||charStart<0||!Number.isSafeInteger(charEnd)||charEnd<=charStart))throw new Error("INVALID_HIGHLIGHT_RANGE");
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
  if(charStart!==null){
   const previous=this.pendingHighlights[this.pendingHighlights.length-1];
   if(!previous||previous.charStart!==charStart||previous.charEnd!==charEnd||previous.generation!==generation)
    this.pendingHighlights.push({start,end:this.nextTime,charStart,charEnd,generation,sequence});
   this.startHighlightClock();
  }
  this.onEvent({type:"playback.scheduled",generation,sequence,start,duration:frames/this.sampleRate});
  return true;
 }
 /** Poll the audio clock while a highlighted clause is queued, without scheduling a second audio stream. */
 startHighlightClock(){
  if(this.highlightTimer!==null||typeof setInterval!=="function")return;
  this.highlightTimer=setInterval(()=>this.updatePlaybackPosition(),25);
 }
 stopHighlightClock(){
  if(this.highlightTimer!==null){clearInterval(this.highlightTimer);this.highlightTimer=null;}
 }
 /** Emit a highlight only after the audio clock has reached its actual start time. */
 updatePlaybackPosition(now=this.context.currentTime){
  if(!Number.isFinite(now))throw new Error("INVALID_AUDIO_CLOCK");
  while(this.pendingHighlights.length&&this.pendingHighlights[0].start<=now){
   const item=this.pendingHighlights.shift();
   if(item.generation===this.generation)this.onEvent({type:"playback.highlight",generation:item.generation,sequence:item.sequence,charStart:item.charStart,charEnd:item.charEnd});
  }
  if(!this.pendingHighlights.length)this.stopHighlightClock();
 }
 interrupt() {
  this.generation++;
  for(const source of this.sources){source.onended=null;try{source.stop();}catch{}try{source.disconnect();}catch{}}
  this.sources.clear();this.nextTime=0;this.pendingHighlights=[];this.stopHighlightClock();
  this.onEvent({type:"playback.cleared",generation:this.generation});
  return this.generation;
 }
}

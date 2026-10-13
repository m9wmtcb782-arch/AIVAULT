/** AIVAULT Live Voice v1: transport-independent session state.
 * No vendor API calls. No generated audio. Not a speech model.
 */
export class LiveVoiceSession {
  constructor({onEvent=()=>{}, maxBufferedFrames=128}={}) {
    this.onEvent=onEvent;
    this.maxBufferedFrames=maxBufferedFrames;
    this.epoch=0;
    this.state="idle";
    this.nextSequence=0;
    this.pending=new Map();
  }
  start() {
    this.epoch++;
    this.state="listening";
    this.pending.clear();
    this.nextSequence=0;
    this.onEvent({type:"session.started",epoch:this.epoch});
    return this.epoch;
  }
  beginResponse() {
    if(this.state==="idle") throw new Error("SESSION_NOT_STARTED");
    this.epoch++;
    this.pending.clear();
    this.nextSequence=0;
    this.state="speaking";
    this.onEvent({type:"response.started",epoch:this.epoch});
    return this.epoch;
  }
  receiveAudio({epoch,sequence,pcm,segmentId,startOffset,endOffset}) {
    if(epoch!==this.epoch || this.state!=="speaking") return false;
    if(!Number.isSafeInteger(sequence)||sequence<0 || sequence<this.nextSequence) return false;
    if(!(pcm instanceof Uint8Array)||!pcm.length) throw new Error("INVALID_PCM");
    if(!Number.isSafeInteger(startOffset)||!Number.isSafeInteger(endOffset)||endOffset<startOffset) throw new Error("INVALID_OFFSETS");
    if(sequence-this.nextSequence>=this.maxBufferedFrames) throw new Error("AUDIO_BACKPRESSURE");
    if(this.pending.has(sequence)) return false;
    this.pending.set(sequence,{pcm,segmentId,startOffset,endOffset});
    this.flush();
    return true;
  }
  flush() {
    while(this.pending.has(this.nextSequence)) {
      const frame=this.pending.get(this.nextSequence);
      this.pending.delete(this.nextSequence);
      this.onEvent({type:"audio.frame",epoch:this.epoch,sequence:this.nextSequence,...frame});
      this.nextSequence++;
    }
  }
  interrupt() {
    if(this.state==="idle") return;
    this.epoch++;
    this.pending.clear();
    this.nextSequence=0;
    this.state="listening";
    this.onEvent({type:"audio.clear",epoch:this.epoch});
    this.onEvent({type:"listening",epoch:this.epoch});
  }
  stop() {
    this.epoch++;
    this.pending.clear();
    this.nextSequence=0;
    this.state="idle";
    this.onEvent({type:"audio.clear",epoch:this.epoch});
    this.onEvent({type:"session.stopped",epoch:this.epoch});
  }
}

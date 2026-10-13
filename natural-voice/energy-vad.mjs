/** Voice activity detector (VAD) based on normalized PCM16 energy.
 * Local-only signal gating; replace with neural VAD for production.
 */
export class EnergyVad {
  constructor({threshold=0.018,hangoverMs=350,minSpeechMs=120}={}) {
    this.threshold=threshold;this.hangoverMs=hangoverMs;this.minSpeechMs=minSpeechMs;
    this.active=false;this.voicedMs=0;this.silenceMs=0;
  }
  process(pcm,sampleRate=16000) {
    if(!(pcm instanceof Int16Array)||!pcm.length||sampleRate<=0) throw new Error("INVALID_AUDIO");
    let sum=0;for(const sample of pcm){const x=sample/32768;sum+=x*x;}
    const rms=Math.sqrt(sum/pcm.length);
    const durationMs=pcm.length/sampleRate*1000;
    const voiced=rms>=this.threshold;
    if(voiced){this.voicedMs+=durationMs;this.silenceMs=0;}
    else {this.silenceMs+=durationMs;if(!this.active)this.voicedMs=0;}
    let event=null;
    if(!this.active&&this.voicedMs>=this.minSpeechMs){this.active=true;event="speech.start";}
    if(this.active&&!voiced&&this.silenceMs>=this.hangoverMs){
      this.active=false;this.voicedMs=0;event="speech.end";
    }
    return {rms,active:this.active,event};
  }
  reset(){this.active=false;this.voicedMs=0;this.silenceMs=0;}
}

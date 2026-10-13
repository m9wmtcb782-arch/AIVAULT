/** AIVAULT Live Voice: cancellable, provider-independent inference adapter.
 * An actual GPU ASR/TTS service must implement the injected methods.
 */
export class VoicePipeline {
  constructor({asr,brain,tts,onEvent=()=>{}}) {
    if(typeof asr?.transcribe!=="function"||typeof brain?.respond!=="function"||typeof tts?.synthesize!=="function") throw new Error("WORKERS_REQUIRED");
    this.asr=asr;this.brain=brain;this.tts=tts;this.onEvent=onEvent;
    this.generation=0;this.controller=null;
  }
  interrupt() {
    this.generation++;
    this.controller?.abort();
    this.controller=null;
    this.onEvent({type:"audio.clear",generation:this.generation});
  }
  async run({audio,voiceId="anxing-default",language="zh-TW"}) {
    this.interrupt();
    const generation=this.generation;
    const controller=new AbortController();
    this.controller=controller;
    const signal=controller.signal;
    const alive=()=>!signal.aborted&&generation===this.generation;
    try {
      this.onEvent({type:"asr.started",generation});
      const transcript=await this.asr.transcribe({audio,language,signal});
      if(!alive()) return {status:"cancelled"};
      if(typeof transcript!=="string"||!transcript.trim()) throw new Error("EMPTY_TRANSCRIPT");
      this.onEvent({type:"asr.final",generation,text:transcript});
      const response=await this.brain.respond({text:transcript,signal});
      if(!alive()) return {status:"cancelled"};
      if(typeof response!=="string"||!response.trim()) throw new Error("EMPTY_RESPONSE");
      this.onEvent({type:"brain.final",generation,text:response});
      const stream=await this.tts.synthesize({text:response,voiceId,language,signal});
      if(!stream||typeof stream[Symbol.asyncIterator]!=="function") throw new Error("INVALID_AUDIO_STREAM");
      let sequence=0;
      for await (const frame of stream) {
        if(!alive()) return {status:"cancelled"};
        if(!(frame instanceof Uint8Array)||!frame.length||frame.length%2) throw new Error("INVALID_AUDIO_FRAME");
        this.onEvent({type:"audio.frame",generation,sequence:sequence++,pcm:frame});
      }
      if(!alive()) return {status:"cancelled"};
      this.onEvent({type:"response.complete",generation});
      return {status:"completed",transcript,response,frames:sequence};
    } catch(error) {
      if(!alive()||error?.name==="AbortError") return {status:"cancelled"};
      this.onEvent({type:"pipeline.error",generation,code:error?.message||"UNKNOWN_ERROR"});
      return {status:"error",code:error?.message||"UNKNOWN_ERROR"};
    } finally {
      if(this.controller===controller) this.controller=null;
    }
  }
}

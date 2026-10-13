/** Transport-agnostic ASR stream state. No provider or model dependency. */
export class AsrTranscript {
  constructor({onEvent=()=>{}}={}) {this.onEvent=onEvent;this.sessionId=null;this.epoch=0;this.finalSegments=[];this.partial="";this.lastSequence=-1;}
  start(sessionId) {
    if(typeof sessionId!=="string"||!sessionId||sessionId.length>128) throw new Error("INVALID_SESSION");
    this.sessionId=sessionId;this.epoch++;this.finalSegments=[];this.partial="";this.lastSequence=-1;
    return this.epoch;
  }
  receive({sessionId,epoch,sequence,text,isFinal=false}) {
    if(!this.sessionId||sessionId!==this.sessionId||epoch!==this.epoch) return false;
    if(!Number.isSafeInteger(sequence)||sequence<=this.lastSequence) return false;
    if(typeof text!=="string"||text.length>4096||typeof isFinal!=="boolean") throw new Error("INVALID_TRANSCRIPT");
    this.lastSequence=sequence;
    if(isFinal) {
      if(text.trim()) this.finalSegments.push(text);
      this.partial="";
      this.onEvent({type:"asr.final",sessionId,epoch,sequence,text});
    } else {
      this.partial=text;
      this.onEvent({type:"asr.partial",sessionId,epoch,sequence,text});
    }
    return true;
  }
  snapshot(){return {sessionId:this.sessionId,epoch:this.epoch,finalText:this.finalSegments.join(""),partial:this.partial};}
  reset(){this.sessionId=null;this.epoch++;this.finalSegments=[];this.partial="";this.lastSequence=-1;}
}

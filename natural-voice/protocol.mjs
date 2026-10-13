/** Protocol validator for AIVAULT-owned streaming ASR/TTS workers.
 * No provider calls, credentials or implicit fallback.
 */
const modes=new Set(["reading","conversation","fiction"]);
const format="pcm_s16le";
export function validateSynthesisRequest(input) {
  if(!input||typeof input!=="object") throw new Error("INVALID_REQUEST");
  const {request_id,text,voice_id,mode="conversation",language="zh-TW",rate=1,stream=true}=input;
  if(typeof request_id!=="string"||!request_id||request_id.length>128) throw new Error("INVALID_REQUEST_ID");
  if(typeof text!=="string"||!text.trim()||text.length>2000) throw new Error("INVALID_TEXT");
  if(typeof voice_id!=="string"||!(/^[a-zA-Z0-9_-]{1,64}$/).test(voice_id)) throw new Error("INVALID_VOICE");
  if(!modes.has(mode)) throw new Error("INVALID_MODE");
  if(language!=="zh-TW") throw new Error("UNSUPPORTED_LANGUAGE");
  if(typeof rate!=="number"||!Number.isFinite(rate)||rate<0.7||rate>1.5) throw new Error("INVALID_RATE");
  if(stream!==true) throw new Error("STREAM_REQUIRED");
  return {request_id,text,voice_id,mode,language,rate,stream};
}
export function validateAudioFrame(frame) {
  if(!frame||typeof frame!=="object") throw new Error("INVALID_FRAME");
  const {request_id,epoch,sequence,sample_rate,format:audioFormat,start_offset,end_offset,pcm}=frame;
  if(typeof request_id!=="string"||!request_id) throw new Error("INVALID_REQUEST_ID");
  if(!Number.isSafeInteger(epoch)||epoch<0||!Number.isSafeInteger(sequence)||sequence<0) throw new Error("INVALID_SEQUENCE");
  if(![16000,24000,48000].includes(sample_rate)||audioFormat!==format) throw new Error("INVALID_AUDIO_FORMAT");
  if(!Number.isSafeInteger(start_offset)||!Number.isSafeInteger(end_offset)||start_offset<0||end_offset<start_offset) throw new Error("INVALID_OFFSETS");
  if(!(pcm instanceof Uint8Array)||pcm.byteLength===0||pcm.byteLength%2!==0) throw new Error("INVALID_PCM");
  return frame;
}

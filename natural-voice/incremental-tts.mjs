/** Split speech into bounded clauses for incremental TTS.
 * Preserves all characters and avoids splitting surrogate pairs.
 */
export function* speechChunks(text,{maxChars=100,minChars=12}={}) {
 if(typeof text!=="string"||!Number.isInteger(maxChars)||maxChars<8||maxChars>2000||!Number.isInteger(minChars)||minChars<1||minChars>maxChars) throw new Error("INVALID_CHUNK_CONFIG");
 const chars=Array.from(text);let buffer="";
 for(const ch of chars) {
  buffer+=ch;
  if((/[。！？!?；;，,\n]/u.test(ch)&&Array.from(buffer).length>=minChars)||Array.from(buffer).length>=maxChars) {
   yield buffer;buffer="";
  }
 }
 if(buffer) yield buffer;
}
export async function* synthesizeIncrementally({text,tts,voiceId,language="zh-TW",signal,maxChars=100}) {
 if(typeof tts?.synthesize!=="function") throw new Error("TTS_REQUIRED");
 let chunkIndex=0;
 for(const chunk of speechChunks(text,{maxChars})) {
  if(signal?.aborted)return;
  const stream=await tts.synthesize({text:chunk,voiceId,language,signal});
  if(!stream||typeof stream[Symbol.asyncIterator]!=="function") throw new Error("INVALID_TTS_STREAM");
  let frameIndex=0;
  for await(const pcm of stream) {
   if(signal?.aborted)return;
   if(!(pcm instanceof Uint8Array)||pcm.length===0||pcm.length%2) throw new Error("INVALID_PCM");
   yield {chunkIndex,frameIndex:frameIndex++,text:chunk,pcm};
  }
  chunkIndex++;
 }
}

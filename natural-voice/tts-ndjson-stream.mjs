/** Parse NDJSON TTS over Fetch ReadableStream, including split UTF-8 boundaries. */
export async function* parseTtsNdjson(response,{signal,maxLineBytes=200000,withMetadata=false}={}) {
 if(!response?.ok)throw new Error("TTS_HTTP_ERROR");
 if(!response.body?.getReader)throw new Error("STREAM_UNAVAILABLE");
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let pending="",completed=false,lastSequence=-1;
 try {
  while(true) {
   if(signal?.aborted)return;
   const {done,value}=await reader.read();
   pending+=decoder.decode(value||new Uint8Array(),{stream:!done});
   let pos;
   while((pos=pending.indexOf("\n"))>=0){
    if(pos>maxLineBytes)throw new Error("STREAM_LINE_TOO_LONG");
    const line=pending.slice(0,pos).trim();pending=pending.slice(pos+1);
    if(!line)continue;
    const event=JSON.parse(line);
    if(event.type==="error")throw new Error("TTS_REMOTE_ERROR");
    if(event.type==="complete"){
      if(!Number.isSafeInteger(event.frames)||event.frames!==lastSequence+1)throw new Error("INVALID_TTS_COMPLETE");
      if(pending.trim())throw new Error("TRAILING_TTS_DATA");
      completed=true;break;
    }
    if(event.type!=="audio"||!Number.isSafeInteger(event.sequence)||event.sequence!==lastSequence+1||
      typeof event.pcm_base64!=="string")throw new Error("INVALID_TTS_EVENT");
    if(typeof atob!=="function")throw new Error("BASE64_UNAVAILABLE");
    const raw=atob(event.pcm_base64);
    if(!raw.length||raw.length%2)throw new Error("INVALID_PCM");
    const pcm=Uint8Array.from(raw,c=>c.charCodeAt(0));
    lastSequence=event.sequence;
    if(withMetadata){
      const {char_start:start,char_end:end,sample_rate:rate}=event;
      if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||
         rate!==24000)throw new Error("INVALID_TTS_TEXT_METADATA");
      yield {pcm,sequence:event.sequence,charStart:start,charEnd:end,sampleRate:rate};
    }else yield pcm;
   }
   if(completed){
    if(!done){
     const extra=await reader.read();
     if(!extra.done&&extra.value?.length)throw new Error("TRAILING_TTS_DATA");
    }
    break;
   }
   if(pending.length>maxLineBytes)throw new Error("STREAM_LINE_TOO_LONG");
   if(done)break;
  }
  if(!completed&&!signal?.aborted)throw new Error("TTS_STREAM_TRUNCATED");
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}

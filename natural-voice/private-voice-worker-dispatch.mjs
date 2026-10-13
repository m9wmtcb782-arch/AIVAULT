/** Trusted server-side adapter for a private AIVAULT voice worker.
 * NEVER import this into public mobile pages: bearer token stays server-side.
 * No Compute Coordinator task submission is performed here.
 */
export function createPrivateVoiceDispatch({baseUrl,token,fetchImpl=globalThis.fetch,timeoutMs=30000}={}){
 let url;
 try{url=new URL(baseUrl);}catch{throw new Error("INVALID_VOICE_WORKER_URL");}
 if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/")
  throw new Error("PRIVATE_VOICE_WORKER_HTTPS_REQUIRED");
 if(typeof token!=="string"||token.length<16)throw new Error("PRIVATE_VOICE_TOKEN_REQUIRED");
 if(typeof fetchImpl!=="function")throw new Error("FETCH_UNAVAILABLE");
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000)throw new Error("INVALID_TIMEOUT");
 return async function dispatch(task,{signal}={}){
  if(signal?.aborted)throw new Error("VOICE_CANCELLED");
  const controller=new AbortController();
  const abort=()=>controller.abort();
  signal?.addEventListener("abort",abort,{once:true});
  const timer=setTimeout(abort,timeoutMs);
  try{
   const response=await fetchImpl(new URL("/v1/tts",url),{
    method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
    body:JSON.stringify({text:task.text,voice_id:task.modelId,language:"zh-TW",format:"pcm_s16le",sample_rate:24000}),
    signal:controller.signal,redirect:"error",credentials:"omit"
   });
   if(!response.ok)throw new Error("VOICE_WORKER_HTTP_"+response.status);
   const payload=await response.json();
   if(!payload||!Array.isArray(payload.frames)||!payload.frames.length)throw new Error("EMPTY_VOICE_AUDIO");
   // Bound worker memory before decoding: at most 60 seconds of mono 24kHz PCM16.
   if(payload.frames.length>1200)throw new Error("VOICE_AUDIO_TOO_LARGE");
   const maxBase64=3840000; // 2.88 MB PCM, approx. 60 seconds.
   let totalEncoded=0;
   for(const frame of payload.frames){
    if(typeof frame!=="string")throw new Error("INVALID_VOICE_AUDIO_FRAME");
    totalEncoded+=frame.length;
    if(totalEncoded>maxBase64)throw new Error("VOICE_AUDIO_TOO_LARGE");
   }
   // Node server runtime only. Never deserialize arbitrary worker metadata as task identity.
   const chunks=payload.frames.map(frame=>{
    if(typeof frame!=="string"||frame.length>4000000||!/^([A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(frame))
     throw new Error("INVALID_VOICE_AUDIO_FRAME");
    return Buffer.from(frame,"base64");
   });
   const bytes=Buffer.concat(chunks);
   if(!bytes.length||bytes.length%2)throw new Error("INVALID_VOICE_PCM");
   return {sequence:task.sequence,modelId:task.modelId,charStart:task.charStart,
    charEnd:task.charEnd,sampleRate:24000,pcm:new Uint8Array(bytes)};
  }finally{clearTimeout(timer);signal?.removeEventListener("abort",abort);}
 };
}

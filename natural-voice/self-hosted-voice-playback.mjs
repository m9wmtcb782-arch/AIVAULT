/** PCM16 24kHz mono playback for a self-hosted AIVAULT Worker response.
 * A user-initiated request only. Does not use browser speechSynthesis.
 */
export function decodeVoiceFrames(frames){
 if(!Array.isArray(frames)||!frames.length||frames.length>1200)throw Error("INVALID_FRAMES");
 let total=0;
 const chunks=frames.map(s=>{
  if(typeof s!=="string"||!s||s.length>6400||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw Error("INVALID_FRAME_BASE64");
  const raw=atob(s);const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  if(!bytes.length||bytes.length%2)throw Error("INVALID_PCM_FRAME");
  total+=bytes.length;
  if(total>2880000)throw Error("AUDIO_TOO_LARGE");
  return bytes;
 });
 const pcm=new Float32Array(total/2);
 let n=0;
 for(const chunk of chunks){const view=new DataView(chunk.buffer,chunk.byteOffset,chunk.byteLength);for(let i=0;i<chunk.length;i+=2)pcm[n++]=view.getInt16(i,true)/32768;}
 return pcm;
}
export async function playSelfHostedVoice({url,token,text,voiceId="aivault-mandarin-v1",fetchImpl=fetch,AudioContextImpl=globalThis.AudioContext||globalThis.webkitAudioContext}){
 const endpoint=new URL(url);
 if(endpoint.protocol!=="https:"||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw Error("HTTPS_ENDPOINT_REQUIRED");
 if(!endpoint.pathname.endsWith("/v1/tts"))throw Error("EXPECTED_TTS_ENDPOINT");
 if(!token||!text||text.length>2000)throw Error("TOKEN_OR_TEXT_INVALID");
 if(!AudioContextImpl)throw Error("WEB_AUDIO_UNAVAILABLE");
 const response=await fetchImpl(endpoint.href,{method:"POST",redirect:"error",cache:"no-store",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({text,voice_id:voiceId,language:"zh-TW",format:"pcm_s16le",sample_rate:24000})});
 if(!response.ok)throw Error("TTS_HTTP_"+response.status);
 const payload=await response.json();
 const pcm=decodeVoiceFrames(payload.frames);
 const ctx=new AudioContextImpl();
 try{
  const buffer=ctx.createBuffer(1,pcm.length,24000);
  buffer.copyToChannel(pcm,0);
  const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);
  await ctx.resume();
  await new Promise((resolve,reject)=>{source.onended=resolve;source.start();});
  return {ok:true,samples:pcm.length,sampleRate:24000,source:"SELF_HOSTED_TTS_WORKER",gpuPoolVerified:false};
 }finally{await ctx.close();}
}

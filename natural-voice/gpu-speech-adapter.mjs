/** Browser-independent authenticated GPU worker adapter.
 * Calls only an explicitly configured self-hosted endpoint.
 * Audio is base64 encoded PCM16; no paid provider fallback.
 */
function bytesToBase64(bytes) {
  if(!(bytes instanceof Uint8Array)) throw new Error("INVALID_AUDIO");
  if(typeof btoa==="function") {
    let binary="";for(const byte of bytes) binary+=String.fromCharCode(byte);
    return btoa(binary);
  }
  throw new Error("BASE64_UNAVAILABLE");
}
function base64ToBytes(base64) {
  if(typeof atob!=="function"||typeof base64!=="string"||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw new Error("INVALID_BASE64_AUDIO");
  const binary=atob(base64);const out=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
  return out;
}
export function createGpuSpeechAdapter({baseUrl,token,fetchImpl=fetch}) {
  if(typeof baseUrl!=="string"||!/^https:\/\//.test(baseUrl)) throw new Error("HTTPS_REQUIRED");
  if(typeof token!=="string"||!token) throw new Error("AUTH_REQUIRED");
  const root=baseUrl.replace(/\/+$/,"");
  async function post(path,payload,signal) {
    const response=await fetchImpl(root+path,{
      method:"POST",headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json"},
      body:JSON.stringify(payload),signal
    });
    if(!response.ok) throw new Error(response.status===503?"MODEL_UNAVAILABLE":`WORKER_HTTP_${response.status}`);
    return response.json();
  }
  return {
    asr:{async transcribe({audio,language="zh-TW",signal}) {
      const result=await post("/v1/asr",{audio_pcm16_base64:bytesToBase64(audio),sample_rate:16000,language},signal);
      if(typeof result.text!=="string") throw new Error("INVALID_ASR_RESPONSE");
      return result.text;
    }},
    tts:{async synthesize({text,voiceId,language="zh-TW",signal}) {
      const result=await post("/v1/tts",{text,voice_id:voiceId,language,format:"pcm_s16le",sample_rate:24000},signal);
      if(!Array.isArray(result.frames)) throw new Error("INVALID_TTS_RESPONSE");
      return (async function*(){
        for(const item of result.frames) {
          if(signal?.aborted) return;
          const bytes=base64ToBytes(item);
          if(!bytes.length||bytes.length%2) throw new Error("INVALID_AUDIO_FRAME");
          yield bytes;
        }
      })();
    }}
  };
}

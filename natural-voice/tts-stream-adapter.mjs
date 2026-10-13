import {parseTtsNdjson} from "./tts-ndjson-stream.mjs";

/** Standalone test adapter for the self-hosted incremental TTS endpoint. */
export async function openTtsStream({baseUrl,token,text,voiceId="anxing-default",signal,withMetadata=false,fetchImpl=fetch}) {
  if(!/^https:\/\//.test(baseUrl))throw new Error("HTTPS_REQUIRED");
  if(!token)throw new Error("AUTH_REQUIRED");
  const response=await fetchImpl(baseUrl.replace(/\/+$/,"")+"/v1/tts/stream",{
    method:"POST",
    headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({text,voice_id:voiceId,language:"zh-TW",format:"pcm_s16le",sample_rate:24000}),
    signal
  });
  return parseTtsNdjson(response,{signal,withMetadata});
}

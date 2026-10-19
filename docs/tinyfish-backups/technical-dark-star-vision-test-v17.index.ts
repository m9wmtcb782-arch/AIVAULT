import { GoogleGenAI, Modality } from "npm:@google/genai@2.22.0";
const MODEL="gemini-3.1-flash-live-preview";
const VOICES=new Set(["Zephyr","Puck","Charon","Kore","Fenrir","Leda","Orus","Aoede","Callirrhoe","Autonoe","Enceladus","Iapetus","Umbriel","Algieba","Despina","Erinome","Algenib","Rasalgethi","Laomedeia","Achernar","Alnilam","Schedar","Gacrux","Pulcherrima","Achird","Zubenelgenubi","Vindemiatrix","Sadachbia","Sadaltager","Sulafat"]);
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, OPTIONS"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve((req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if((req.headers.get("upgrade")||"").toLowerCase()!=="websocket")return json({success:true,service:"technical-dark-star-vision-test",model:MODEL,realtimeVision:true,realtimeVoice:true,sessionResumption:true,contextWindowCompression:true,testHandoffSeconds:115,autoRestart:{stopAtSeconds:115,startAtSeconds:116},voices:[...VOICES]});
 const {socket,response}=Deno.upgradeWebSocket(req,{idleTimeout:0});
 let resolveClosed!:()=>void; const socketClosed=new Promise<void>(r=>{resolveClosed=r});
 // Keep the Edge Function worker alive for the entire WebSocket lifetime.
 // @ts-ignore
 EdgeRuntime.waitUntil(socketClosed);
 const url=new URL(req.url);
 const requestedVoice=url.searchParams.get("voice")||"Kore";
 const voice=VOICES.has(requestedVoice)?requestedVoice:"Kore";
 const resumeHandle=url.searchParams.get("resumeHandle");
 let live:any=null,connected=false,swapping=false,closed=false,handle:string|null=resumeHandle||null,handoffTimer:any=null;
 const send=(p:unknown)=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(p));};
 const instruction="你是 Technical Dark Star（暗星）的即時視覺與語音核心。回答使用繁體中文；但「使用者語音輸入字幕」必須依使用者實際說話的語言與地區呈現，不要把其他語言翻譯成中文。中文語音優先使用台灣繁體中文（zh-TW）；若使用者實際說英文、日文、韓文或其他語言，字幕應保留該語言及其常用地區文字格式（例如 en-US、ja-JP、ko-KR）。不要因系統指令而把使用者原話改成其他語言。你正在持續看即時視訊並聽使用者說話。只有使用者真正需要回應時才回答。第一次啟動可以依照目前產品規則說一次開場白；但是只要這是續接、重新連線、Session handoff 或 session resumption，絕對不要重新打招呼、不要自我介紹、不要說歡迎回來、不要說重新連線，也不要宣布 Session 改變。要把自己視為同一個正在持續對話的暗星，直接接續上一個上下文。不要自我介紹成 Gemini，也不要提及內部模型。根據目前影像與使用者問題自然回答；不要假裝看到沒有出現在影像中的東西，不確定就明確說不確定。使用者打斷你時立即停止目前回答並處理新內容。";
 const aiPromise=(async()=>{const key=Deno.env.get("GEMINI_API_KEY")||Deno.env.get("GOOGLE_API_KEY");if(!key)throw new Error("GEMINI_API_KEY/GOOGLE_API_KEY is not configured");return new GoogleGenAI({apiKey:key});})();
 const scheduleHandoff=()=>{clearTimeout(handoffTimer);handoffTimer=setTimeout(()=>handoff(),115000);};
 const connectLive=async(ai:any,resume:string|null)=>{
  const next=await ai.live.connect({model:MODEL,callbacks:{
   onopen:()=>{send({type:resume?"session_resumed":"live_open",model:MODEL,vision:true,voice:true,voiceName:voice,sessionResumed:!!resume});},
   onmessage:(message:any)=>{
    const r=message?.sessionResumptionUpdate;
    if(r?.resumable&&r?.newHandle){handle=r.newHandle;send({type:"session_handle",resumable:true,handle:r.newHandle});}
    const c=message?.serverContent;
    if(message?.setupComplete)send({setupComplete:{}});
    if(c?.interimInputTranscription?.text)send({serverContent:{interimInputTranscription:{text:c.interimInputTranscription.text}}});
    if(c?.inputTranscription?.text)send({serverContent:{inputTranscription:{text:c.inputTranscription.text}}});
    if(c?.outputTranscription?.text)send({serverContent:{outputTranscription:{text:c.outputTranscription.text}}});
    if(c?.modelTurn?.parts)for(const part of c.modelTurn.parts){const x=part?.inlineData;if(x?.data)send({audio:{data:x.data,mimeType:x.mimeType||"audio/pcm;rate=24000"}});}
    if(c?.turnComplete)send({serverContent:{turnComplete:true}});
    if(c?.interrupted)send({serverContent:{interrupted:true}});
    if(message?.goAway){send({type:"go_away",timeLeft:message.goAway.timeLeft});handoff();}
    if(message?.usageMetadata)send({usageMetadata:message.usageMetadata});
    if(message?.error)send({error:message.error});
   },
   onerror:(e:any)=>send({error:{message:e?.message||String(e)}}),
   onclose:()=>{if(next===live){connected=false;send({type:"live_close"});if(!closed)tryHandoff();}}
  },config:{responseModalities:[Modality.AUDIO],outputAudioTranscription:{},inputAudioTranscription:{},speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}},thinkingConfig:{thinkingLevel:"minimal"},contextWindowCompression:{slidingWindow:{}},sessionResumption:{handle:resume||undefined},systemInstruction:{parts:[{text:instruction}]}}});
  return next;
 };
 const tryHandoff=async()=>{
  if(closed||swapping)return;
  if(!handle){scheduleHandoff();return;}
  swapping=true;
  try{const ai=await aiPromise;send({type:"handoff_start",message:"無痕銜接中"});const old=live;const next=await connectLive(ai,handle);live=next;connected=true;send({type:"handoff_complete",message:"無痕銜接完成"});try{old?.close()}catch{}scheduleHandoff();}
  catch(e){send({type:"handoff_failed",message:e instanceof Error?e.message:String(e)});setTimeout(()=>{if(!closed)tryHandoff()},1000);}
  finally{swapping=false;}
 };
 const handoff=()=>{if(!closed&&!swapping)tryHandoff()};
 socket.onopen=async()=>{try{const ai=await aiPromise;live=await connectLive(ai,resumeHandle);connected=true;send({setupComplete:{},voiceName:voice,sessionHandoffSeconds:115,resumedFromClient:!!resumeHandle});scheduleHandoff();}catch(e){send({error:{message:e instanceof Error?e.message:String(e)}});try{socket.close(1011,"Gemini Live connection failed")}catch{}}};
 socket.onmessage=(event)=>{if(!live||!connected)return;try{const m=JSON.parse(String(event.data));if(m.type==="close"){closed=true;clearTimeout(handoffTimer);try{live.close()}catch{}try{socket.close(1000,"closed")}catch{}return;}if(m.type==="text"&&m.text){live.sendRealtimeInput({text:String(m.text)});return;}if(m.type==="video"&&m.data){live.sendRealtimeInput({video:{data:String(m.data),mimeType:m.mimeType||"image/jpeg"}});return;}if(m.type==="audio"&&m.data){live.sendRealtimeInput({audio:{data:String(m.data),mimeType:m.mimeType||"audio/pcm;rate=16000"}});return;}}catch(e){send({error:{message:e instanceof Error?e.message:String(e)}})}};
 socket.onerror=()=>{};
 socket.onclose=()=>{closed=true;clearTimeout(handoffTimer);try{live?.close()}catch{};resolveClosed();};
 return response;
});
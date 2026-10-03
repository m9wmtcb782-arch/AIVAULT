(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_LIVE_HOME_V1__) return;
window.__AIVAULT_DARK_STAR_LIVE_HOME_V1__=true;

const FN='wss://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-live-voice-v2';
const SUPABASE_URL='https://clcddygkaaqqtsbswgdf.supabase.co';
const SUPABASE_PUBLIC_KEY='sb_publishable_1D05YGthBrNGg-5L92TLCw_GiLnInBu';

const state={
  ws:null,stream:null,inputCtx:null,playCtx:null,source:null,processor:null,silent:null,
  wanted:false,auto:false,starting:false,reconnecting:false,connectPromise:null,
  nextPlayTime:0,playSources:[],audioPackets:0,audioBytes:0,userTalkingUntil:0,inText:'',outText:'',userEl:null,assistantEl:null,
  forceAuthRefresh:false
};

function $(id){return document.getElementById(id)}
function status(t,show){
  const el=$('voiceStatus');
  if(el){el.textContent=t;el.classList.toggle('show',show!==false)}
}
function scrollBottom(){
  try{const m=$('messages');if(m)m.scrollTop=m.scrollHeight}catch(e){}
}
function syncChecked(){
  const on=!!state.wanted;
  window.__AIVAULT_LIVE_VOICE_WANTED__=on;
  const btn=$('darkStarLiveButton');
  if(btn){
    btn.setAttribute('aria-pressed',String(on));
    btn.classList.toggle('live-voice-on',on);
    if('checked' in btn)btn.checked=on;
  }
  document.querySelectorAll('input[data-live-voice],#liveVoiceToggle,#instantVoiceToggle').forEach(el=>{el.checked=on});
}
function setMic(on){
  const b=$('micButton');
  if(!b)return;
  b.classList.toggle('recording',!!on);
  b.setAttribute('aria-pressed',String(!!on));
  b.title=on?'結束即時語音':'開始即時語音';
}
function makeBubble(role){
  const welcome=$('welcome');if(welcome)welcome.remove();
  const inner=$('messagesInner');if(!inner)return null;
  const row=document.createElement('div');row.className='message '+role;
  const avatar=document.createElement('div');avatar.className='message-avatar';avatar.textContent=role==='user'?'你':'✦';
  const body=document.createElement('div');body.className='message-body';
  const text=document.createElement('div');text.className='message-text';body.appendChild(text);
  row.append(avatar,body);inner.appendChild(row);scrollBottom();return text;
}
function readAuth(){
  try{
    const raw=localStorage.getItem('sb-clcddygkaaqqtsbswgdf-auth-token');
    if(!raw)return null;return JSON.parse(raw);
  }catch(e){return null}
}
async function accessToken(){
  const j=readAuth();if(!j)return '';
  let token=String(j.access_token||(j.currentSession&&j.currentSession.access_token)||'').trim();
  const refresh=String(j.refresh_token||(j.currentSession&&j.currentSession.refresh_token)||'').trim();
  const exp=Number(j.expires_at||(j.currentSession&&j.currentSession.expires_at)||0);
  const need=!!refresh&&(state.forceAuthRefresh||!token||(exp>0&&exp*1000-Date.now()<60000));
  if(!need)return token;
  try{
    const r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLIC_KEY},
      body:JSON.stringify({refresh_token:refresh})
    });
    if(!r.ok)return token;
    const fresh=await r.json();if(!fresh.access_token)return token;
    const merged={...j,...fresh,access_token:fresh.access_token,refresh_token:fresh.refresh_token||refresh};
    try{localStorage.setItem('sb-clcddygkaaqqtsbswgdf-auth-token',JSON.stringify(merged))}catch(e){}
    state.forceAuthRefresh=false;return String(fresh.access_token).trim();
  }catch(e){return token}
}
async function openMedia(){
  if(state.stream)return;
  const s=await navigator.mediaDevices.getUserMedia({
    audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}
  });
  const track=s.getAudioTracks()[0];
  if(!track||track.readyState==='ended'){s.getTracks().forEach(t=>t.stop());throw new Error('沒有取得麥克風音軌')}
  state.stream=s;
}
async function openAudio(){
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)throw new Error('此瀏覽器不支援音訊');
  if(!state.playCtx)state.playCtx=new AC();
  if(state.playCtx.state!=='running')await state.playCtx.resume();
  if(!state.inputCtx)state.inputCtx=new AC({sampleRate:16000});
  if(state.inputCtx.state!=='running')await state.inputCtx.resume();
}
function bargeIn(){
  state.playSources.forEach(s=>{try{s.stop()}catch(e){}});
  state.playSources=[];state.nextPlayTime=0;state.userTalkingUntil=Date.now()+700;
}
function playPCM(buf){
  if(!state.playCtx)return;
  if(Date.now()<state.userTalkingUntil)return;
  const bytes=new Uint8Array(buf),pcm=new Int16Array(bytes.buffer,bytes.byteOffset,Math.floor(bytes.byteLength/2));
  if(!pcm.length)return;
  state.audioPackets++;state.audioBytes+=bytes.byteLength;
  const stat=$('audioStat');if(stat)stat.textContent=String(state.audioPackets);
  const bs=$('byteStat');if(bs)bs.textContent=state.audioBytes.toLocaleString();
  if(state.playCtx.state!=='running')state.playCtx.resume().catch(()=>{});
  const b=state.playCtx.createBuffer(1,pcm.length,24000),d=b.getChannelData(0);
  for(let i=0;i<pcm.length;i++)d[i]=pcm[i]/32768;
  const src=state.playCtx.createBufferSource();src.buffer=b;src.connect(state.playCtx.destination);
  const now=state.playCtx.currentTime;
  if(state.nextPlayTime<now+.03)state.nextPlayTime=now+.03;
  src.start(state.nextPlayTime);state.nextPlayTime+=b.duration;state.playSources.push(src);
  src.onended=()=>{const i=state.playSources.indexOf(src);if(i>=0)state.playSources.splice(i,1)}
}
function playB64(b64){
  try{
    const bin=atob(b64),u=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    playPCM(u.buffer);
  }catch(e){}
}
function handleMessage(raw){
  if(raw instanceof ArrayBuffer){playPCM(raw);return}
  if(typeof Blob!=='undefined'&&raw instanceof Blob){raw.arrayBuffer().then(playPCM).catch(()=>{});return}
  let d;try{d=JSON.parse(raw)}catch(e){return}
  const sc=d.serverContent||d;
  if(d.type==='interrupted'||sc.interrupted)bargeIn();
  if(d.audio&&d.audio.data)playB64(d.audio.data);
  if(d.data&&d.mimeType&&String(d.mimeType).indexOf('audio')===0)playB64(d.data);
  const parts=(sc.modelTurn&&sc.modelTurn.parts)||(d.modelTurn&&d.modelTurn.parts)||[];
  parts.forEach(p=>{
    const id=p&&p.inlineData;
    if(id&&id.data&&String(id.mimeType||'').indexOf('audio')===0)playB64(id.data);
  });
  const inn=(sc.inputTranscription&&sc.inputTranscription.text)||(d.type==='inputTranscription'?d.text:'');
  const out=(sc.outputTranscription&&sc.outputTranscription.text)||(d.type==='outputTranscription'?d.text:'');
  const input=$('composerInput');
  if(inn){
    state.inText+=String(inn);
    if(!state.userEl)state.userEl=makeBubble('user');
    if(state.userEl)state.userEl.textContent=state.inText;
    if(input){input.value=state.inText;input.dispatchEvent(new Event('input',{bubbles:true}))}
    scrollBottom();
  }
  if(out){
    state.outText+=String(out);
    if(!state.assistantEl)state.assistantEl=makeBubble('assistant');
    if(state.assistantEl)state.assistantEl.textContent=state.outText;
    scrollBottom();
  }
  if(d.type==='live_open'||d.setupComplete)status('正在聆聽……');
  if(d.type==='error'||d.error){
    const m=d.message||(d.error&&d.error.message)||JSON.stringify(d.error||d);
    status('語音連線錯誤：'+m,true);
    if(String(m).includes('INVALID_AUTH'))state.forceAuthRefresh=true;
  }
  if(sc.turnComplete||d.turnComplete||d.type==='turnComplete'){
    state.inText='';state.outText='';state.userEl=null;state.assistantEl=null;
    if(state.wanted)status('正在聆聽……');
  }
}
function startAudio(){
  if(!state.stream||!state.inputCtx||state.processor)return;
  state.source=state.inputCtx.createMediaStreamSource(state.stream);
  state.processor=state.inputCtx.createScriptProcessor(4096,1,1);
  state.silent=state.inputCtx.createGain();state.silent.gain.value=0;
  const sourceRate=Number(state.inputCtx.sampleRate)||16000;
  const targetRate=16000;
  state.processor.onaudioprocess=e=>{
    if(!state.ws||state.ws.readyState!==WebSocket.OPEN)return;
    const input=e.inputBuffer.getChannelData(0);
    let samples=input;
    if(sourceRate!==targetRate){
      const outLength=Math.max(1,Math.round(input.length*targetRate/sourceRate));
      const out=new Float32Array(outLength);
      const ratio=sourceRate/targetRate;
      for(let i=0;i<outLength;i++){
        const pos=i*ratio,idx=Math.floor(pos),frac=pos-idx;
        const x=input[Math.min(idx,input.length-1)]||0;
        const y=input[Math.min(idx+1,input.length-1)]||x;
        out[i]=x+(y-x)*frac;
      }
      samples=out;
    }
    const pcm=new Int16Array(samples.length);
    for(let i=0;i<samples.length;i++){
      const v=Math.max(-1,Math.min(1,samples[i]));
      pcm[i]=v<0?v*32768:v*32767;
    }
    let bin='';const u=new Uint8Array(pcm.buffer);
    for(let i=0;i<u.length;i++)bin+=String.fromCharCode(u[i]);
    try{state.ws.send(JSON.stringify({type:'audio',data:btoa(bin),mimeType:'audio/pcm;rate=16000'}))}catch(e){}
  };
  state.source.connect(state.processor);
  state.processor.connect(state.silent);
  state.silent.connect(state.inputCtx.destination);
}
function scheduleReconnect(){
  if(!state.auto||!state.wanted||state.reconnecting)return;
  state.reconnecting=true;status('即時語音連線中斷，重新連線中……',true);
  setTimeout(()=>{
    state.reconnecting=false;
    if(!state.auto||!state.wanted)return;
    connect().then(()=>{if(!state.processor)startAudio();status('正在聆聽……')}).catch(()=>scheduleReconnect());
  },1000);
}
async function connect(){
  if(state.ws&&state.ws.readyState===WebSocket.OPEN)return;
  if(state.connectPromise)return state.connectPromise;
  state.connectPromise=(async()=>{
    const q=new URLSearchParams();
    q.set('voice',localStorage.getItem('darkStarVoice')||'Kore');
    q.set('agent_id','technical-dark-star');
    const topic=localStorage.getItem('technical-dark-star-topic-id')||'';
    const conv=localStorage.getItem('technical_dark_star_conversation_id')||'';
    const tok=await accessToken();
    if(topic)q.set('topic_id',topic);if(conv)q.set('conversation_id',conv);if(tok)q.set('access_token',tok);
    const socket=new WebSocket(FN+'?'+q.toString());
    socket.binaryType='arraybuffer';state.ws=socket;
    await new Promise((resolve,reject)=>{
      let settled=false;const timer=setTimeout(()=>{try{socket.close()}catch(e){}if(!settled){settled=true;reject(new Error('連線逾時'))}},8000);
      socket.onopen=()=>{clearTimeout(timer);settled=true;resolve()};
      socket.onerror=()=>{clearTimeout(timer);if(!settled){settled=true;reject(new Error('WebSocket error'))}};
      socket.onmessage=e=>handleMessage(e.data);
      socket.onclose=ev=>{
        clearTimeout(timer);if(state.ws===socket)state.ws=null;
        if(state.auto&&state.wanted)scheduleReconnect();
      };
    });
  })();
  try{return await state.connectPromise}finally{state.connectPromise=null}
}
async function start(){
  if(state.starting||state.wanted)return;
  state.starting=true;state.wanted=true;state.auto=true;syncChecked();setMic(true);status('正在啟動即時語音……',true);
  try{
    await openMedia();await openAudio();await connect();startAudio();status('正在聆聽……',true);
  }catch(e){
    state.wanted=false;state.auto=false;syncChecked();setMic(false);
    try{state.stream?.getTracks().forEach(t=>t.stop())}catch(_){}
    state.stream=null;status('即時語音啟動失敗：'+(e.message||e),true);
  }finally{state.starting=false}
}
async function stop(){
  state.wanted=false;state.auto=false;syncChecked();setMic(false);
  try{state.processor?.disconnect()}catch(e){}try{state.source?.disconnect()}catch(e){}try{state.silent?.disconnect()}catch(e){}
  try{state.ws?.close()}catch(e){}
  try{state.stream?.getTracks().forEach(t=>t.stop())}catch(e){}
  try{await state.inputCtx?.close()}catch(e){}try{await state.playCtx?.close()}catch(e){}
  state.processor=null;state.source=null;state.silent=null;state.ws=null;state.stream=null;state.inputCtx=null;state.playCtx=null;state.nextPlayTime=0;state.inText='';state.outText='';state.userEl=null;state.assistantEl=null;
  status('即時語音已停止',false);
}
async function toggle(){
  if(state.wanted||state.starting)return stop();
  return start();
}
function sendText(){
  const input=$('composerInput'),text=String(input?.value||'').trim();if(!text)return false;
  if(!state.ws||state.ws.readyState!==WebSocket.OPEN)return false;
  try{state.ws.send(JSON.stringify({type:'text',text}));return true}catch(e){return false}
}

const send=$('sendButton');
if(send)send.addEventListener('click',e=>{
  if(!state.wanted)return;
  const input=$('composerInput');const text=String(input?.value||'').trim();if(!text)return;
  if(sendText()){e.preventDefault();e.stopImmediatePropagation()}
},true);

const input=$('composerInput');
if(input)input.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey&&state.wanted){
    const text=String(input.value||'').trim();
    if(text&&sendText()){e.preventDefault();e.stopImmediatePropagation()}
  }
},true);

setMic(false);syncChecked();
window.__AIVAULT_DARK_STAR_START__=start;
window.__AIVAULT_DARK_STAR_STOP__=stop;
window.__AIVAULT_DARK_STAR_TOGGLE_AUTO__=toggle;
window.__AIVAULT_DARK_STAR_TOGGLE_LIVE_VOICE__=toggle;
window.__AIVAULT_DARK_STAR_LIVE_HOME_STATE__=()=>({wanted:state.wanted,connected:!!state.ws&&state.ws.readyState===1});
})();
const FN='wss://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-live-voice';
const TURNS_KEY='aivault_ds_live_turns';
const DRAFT_KEY='aivault_ds_live_draft';
const CTX_KEY='technical_dark_star_live_context';
const VOICES=[['Kore','穩重'],['Puck','活潑'],['Charon','資訊型'],['Zephyr','明亮'],['Leda','年輕'],['Aoede','輕快'],['Orus','穩重'],['Fenrir','興奮'],['Gacrux','成熟'],['Achird','友善']];
let ws=null,stream=null,auto=false,facing='user',mode='video',videoTimer=null,inputCtx=null,processor=null,source=null,playCtx=null,nextPlayTime=0,audioPackets=0,audioBytes=0,reconnecting=false,wanted=false;
let pendingText=[], inBuf='', outBuf='', userEl=null, aiEl=null;
const $=id=>document.getElementById(id);
function log(s){const el=$('log');if(!el)return;el.textContent+='['+new Date().toLocaleTimeString('zh-TW')+'] '+s+'\n';el.scrollTop=el.scrollHeight}
function status(s){const el=$('status');if(el)el.textContent=s}
function setAutoUi(){const b=$('autoBtn');if(b)b.textContent=auto?'⏸ 停止自動連接':'⚡ 自動連接'}
function bubble(role,text,replace){
  const chat=$('chat');if(!chat)return;
  if(replace && role==='user' && userEl){userEl.textContent=text;return}
  if(replace && role==='ai' && aiEl){aiEl.textContent=text;return}
  const d=document.createElement('div');d.className='bubble '+(role==='user'?'user':'ai');
  d.innerHTML='<b>'+(role==='user'?'你':'暗星')+'</b>';
  const t=document.createElement('div');t.textContent=text;d.appendChild(t);chat.appendChild(d);chat.scrollTop=chat.scrollHeight;
  if(role==='user')userEl=t; else aiEl=t;
}
function saveTurn(role,text){text=String(text||'').trim();if(!text)return;let list=[];try{list=JSON.parse(localStorage.getItem(TURNS_KEY)||'[]')}catch(e){list=[]}list.push({role:role==='user'?'user':'assistant',text,t:Date.now()});try{localStorage.setItem(TURNS_KEY,JSON.stringify(list.slice(-80)))}catch(e){}}
function flushTurn(){if(inBuf.trim())saveTurn('user',inBuf);if(outBuf.trim())saveTurn('assistant',outBuf);inBuf='';outBuf='';userEl=null;aiEl=null}
function accessToken(){try{const raw=localStorage.getItem('sb-clcddygkaaqqtsbswgdf-auth-token');if(!raw)return '';const j=JSON.parse(raw);return String(j.access_token||(j.currentSession&&j.currentSession.access_token)||'').trim()}catch(e){return ''}}
function sendTextToLive(text){
  text=String(text||'').trim();if(!text)return false;
  if(!ws||ws.readyState!==1){pendingText.push(text);status('文字已排隊');return false}
  try{ws.send(JSON.stringify({type:'text',text}));log('送文字：'+text);bubble('user',text,false);saveTurn('user',text);return true}catch(e){log('送字失敗：'+e.message);return false}
}
function flushPending(){pendingText.splice(0).forEach(t=>sendTextToLive(t))}
function sendTyped(){const input=$('liveInput');const text=(input&&input.value||'').trim();if(!text)return;input.value='';sendTextToLive(text)}
function initVoices(){const sel=$('voiceSelect');if(!sel)return;sel.innerHTML='';VOICES.forEach(([id,label])=>{const o=document.createElement('option');o.value=id;o.textContent=id+' — '+label;sel.appendChild(o)});const q=new URLSearchParams(location.search);sel.value=q.get('voice')||localStorage.getItem('darkStarVoice')||'Kore';updateVoice();sel.onchange=()=>{localStorage.setItem('darkStarVoice',sel.value);updateVoice()}}
function updateVoice(){const el=$('voiceStat');if(el)$('voiceStat').textContent=$('voiceSelect').value}
function setMode(m){if(m===mode)return;if(ws||stream)return;mode=m;document.body.className='mode-'+m;const vb=$('voiceBtn'),vd=$('videoBtn');if(vb)vb.classList.toggle('active',m==='voice');if(vd)vd.classList.toggle('active',m==='video');const ms=$('modeStat');if(ms)ms.textContent=m==='voice'?'語音':'視訊'}
async function openMedia(){if(stream)return;const constraints={audio:{echoCancellation:true,noiseSuppression:true}};if(mode==='video')constraints.video={facingMode:facing,width:{ideal:640},height:{ideal:480}};stream=await navigator.mediaDevices.getUserMedia(constraints);if(mode==='video'&&stream.getVideoTracks().length){const p=$('preview');if(p)p.srcObject=stream;const c=$('cameraBtn');if(c)c.disabled=false}}
async function openAudio(){if(!playCtx)playCtx=new AudioContext();if(playCtx.state!=='running')await playCtx.resume();if(!inputCtx)inputCtx=new AudioContext({sampleRate:16000});if(inputCtx.state!=='running')await inputCtx.resume()}
function scheduleReconnect(){if(!auto||!wanted||reconnecting)return;reconnecting=true;status('🟡 斷線重連中');log('1 秒後重連');setTimeout(()=>{reconnecting=false;if(!auto||!wanted)return;connect().then(()=>{if(!processor)startAudio();status('🟢 已重連')}).catch(()=>scheduleReconnect())},1000)}
function connect(){
  return new Promise((resolve,reject)=>{
    if(ws&&ws.readyState===1)return resolve();
    const q=new URLSearchParams();q.set('voice',($('voiceSelect')&&$('voiceSelect').value)||'Kore');q.set('agent_id','technical-dark-star');
    const topicId=localStorage.getItem('technical-dark-star-topic-id')||'';const conversationId=localStorage.getItem('technical_dark_star_conversation_id')||'';const tok=accessToken();
    if(topicId)q.set('topic_id',topicId);if(conversationId)q.set('conversation_id',conversationId);if(tok)q.set('access_token',tok);
    log('連線 '+FN);ws=new WebSocket(FN+'?'+q.toString());ws.binaryType='arraybuffer';
    const t=setTimeout(()=>{try{ws.close()}catch(e){}reject(new Error('連線逾時'))},8000);
    ws.onopen=()=>{clearTimeout(t);status('🟢 已連線 live-voice');log('OPEN');flushPending();resolve()};
    ws.onerror=()=>{clearTimeout(t);log('WS error');reject(new Error('WebSocket error'))};
    ws.onclose=function(ev){clearTimeout(t);log('CLOSE code='+ev.code+' reason='+(ev.reason||'')+' clean='+ev.wasClean);ws=null;if(auto&&wanted)scheduleReconnect();else status('⚪ 已斷線 '+ev.code)};
    ws.onmessage=e=>handleMessage(e.data);
  });
}
function takeAudio(d){
  if(!d||typeof d!=='object')return;
  if(d.audio&&d.audio.data)playBase64PCM(d.audio.data);
  if(d.data&&d.mimeType&&String(d.mimeType).indexOf('audio')===0)playBase64PCM(d.data);
  const parts=(d.serverContent&&d.serverContent.modelTurn&&d.serverContent.modelTurn.parts)||(d.modelTurn&&d.modelTurn.parts)||[];
  parts.forEach(function(p){const id=p&&p.inlineData;if(id&&id.data&&String(id.mimeType||'').indexOf('audio')===0)playBase64PCM(id.data)});
}
function handleMessage(raw){
  if(raw instanceof ArrayBuffer){playPCM(raw);return}
  if(typeof Blob!=='undefined'&&raw instanceof Blob){raw.arrayBuffer().then(playPCM).catch(function(){});return}
  let d;try{d=JSON.parse(raw)}catch(e){return}
  takeAudio(d);
  if(d.type==='live_open'||d.setupComplete){log('live_open '+(d.model||''));status('🟢 Gemini Live 已啟動 '+(d.model||''))}
  if(d.type==='go_away'){log('go_away');return}
  const sc=d.serverContent||d;
  if(sc.inputTranscription&&sc.inputTranscription.text){inBuf+=sc.inputTranscription.text;bubble('user',inBuf,true)}
  if(sc.outputTranscription&&sc.outputTranscription.text){outBuf+=sc.outputTranscription.text;bubble('ai',outBuf,true)}
  if(d.type==='inputTranscription'&&d.text){inBuf+=d.text;bubble('user',inBuf,true)}
  if(d.type==='outputTranscription'&&d.text){outBuf+=d.text;bubble('ai',outBuf,true)}
  if(sc.turnComplete||d.turnComplete||d.type==='turnComplete')flushTurn();
  if(d.type==='error'||d.error){const m=d.message||(d.error&&d.error.message)||JSON.stringify(d.error||d);log('錯誤：'+m);status('🔴 '+m)}
}
function playBase64PCM(b64){try{const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);playPCM(u.buffer)}catch(e){}}
function playPCM(buf){if(!playCtx)return;const bytes=new Uint8Array(buf),pcm=new Int16Array(bytes.buffer,bytes.byteOffset,Math.floor(bytes.byteLength/2));if(!pcm.length)return;audioPackets++;audioBytes+=bytes.byteLength;if($('audioStat'))$('audioStat').textContent=audioPackets;if($('byteStat'))$('byteStat').textContent=audioBytes.toLocaleString();if(playCtx.state!=='running')playCtx.resume().catch(function(){});const audio=playCtx.createBuffer(1,pcm.length,24000),data=audio.getChannelData(0);for(let i=0;i<pcm.length;i++)data[i]=pcm[i]/32768;const src=playCtx.createBufferSource();src.buffer=audio;src.connect(playCtx.destination);const now=playCtx.currentTime;if(nextPlayTime<now+.03)nextPlayTime=now+.03;src.start(nextPlayTime);nextPlayTime+=audio.duration}
async function start(){try{wanted=true;auto=true;setAutoUi();audioPackets=0;audioBytes=0;if($('audioStat'))$('audioStat').textContent='0';await openAudio();await openMedia();await connect();startAudio();if($('startBtn'))$('startBtn').disabled=true;if($('stopBtn'))$('stopBtn').disabled=false;status('🟢 已開始（鏡頭預覽本機，語音走 live-voice）');log('不送 type:video，避免 live-voice 斷線');const draft=($('liveInput')&&$('liveInput').value||'').trim();if(draft)sendTextToLive(draft)}catch(e){status('🔴 無法啟動：'+(e.message||e));log('啟動失敗：'+(e.message||e))}}
function startVideo(){clearInterval(videoTimer);log('鏡頭只做預覽，不送 JPEG 給 live-voice')}
function startAudio(){if(!stream||!inputCtx||processor)return;source=inputCtx.createMediaStreamSource(stream);processor=inputCtx.createScriptProcessor(2048,1,1);const silent=inputCtx.createGain();silent.gain.value=0;processor.onaudioprocess=e=>{if(!ws||ws.readyState!==1)return;const a=e.inputBuffer.getChannelData(0),pcm=new Int16Array(a.length);for(let i=0;i<a.length;i++)pcm[i]=Math.max(-1,Math.min(1,a[i]))*32767;let bin='';const u=new Uint8Array(pcm.buffer);for(let i=0;i<u.length;i++)bin+=String.fromCharCode(u[i]);try{ws.send(JSON.stringify({type:'audio',data:btoa(bin),mimeType:'audio/pcm;rate=16000'}))}catch(err){}};source.connect(processor);processor.connect(silent);silent.connect(inputCtx.destination)}
async function stop(){wanted=false;auto=false;setAutoUi();flushTurn();clearInterval(videoTimer);if(processor)processor.disconnect();if(source)source.disconnect();if(inputCtx)await inputCtx.close().catch(function(){});if(playCtx)await playCtx.close().catch(function(){});inputCtx=null;playCtx=null;processor=null;source=null;nextPlayTime=0;if(ws){try{ws.close()}catch(_){}ws=null}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}const p=$('preview');if(p)p.srcObject=null;if($('startBtn'))$('startBtn').disabled=false;if($('stopBtn'))$('stopBtn').disabled=true;status('⚪ 已停止')}
async function toggleAuto(){if(auto&&wanted){await stop();return}await start()}
async function switchCamera(){if(mode!=='video'||!stream)return;facing=facing==='user'?'environment':'user';const old=stream;const ns=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing},audio:{echoCancellation:true}});old.getTracks().forEach(t=>t.stop());stream=ns;const p=$('preview');if(p){p.srcObject=ns;p.classList.toggle('mirror',facing==='user')}if(processor){try{processor.disconnect()}catch(_){}processor=null;source=null;startAudio()}}
function bootFromQuery(){const q=new URLSearchParams(location.search);const m=q.get('mode')==='voice'?'voice':'video';mode='';setMode(m)}
if($('liveInput'))$('liveInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendTyped()}});
initVoices();bootFromQuery();

const FN='wss://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-live-memory';
const TURNS_KEY='aivault_ds_live_turns';
const DRAFT_KEY='aivault_ds_live_draft';
const CTX_KEY='technical_dark_star_live_context';
const VOICES=[['Zephyr','明亮'],['Puck','活潑'],['Charon','資訊型'],['Kore','穩重'],['Fenrir','興奮'],['Leda','年輕'],['Orus','穩重'],['Aoede','輕快'],['Callirrhoe','輕鬆'],['Autonoe','明亮'],['Enceladus','氣聲'],['Iapetus','清晰'],['Umbriel','輕鬆'],['Algieba','順滑'],['Despina','順滑'],['Erinome','清晰'],['Algenib','沙啞'],['Rasalgethi','資訊型'],['Laomedeia','活潑'],['Achernar','柔和'],['Alnilam','穩重'],['Schedar','平穩'],['Gacrux','成熟'],['Pulcherrima','前衛'],['Achird','友善'],['Zubenelgenubi','隨性'],['Vindemiatrix','溫柔'],['Sadachbia','活潑'],['Sadaltager','知識型'],['Sulafat','溫暖']];
let ws=null,stream=null,auto=false,facing='user',mode='video',videoTimer=null,inputCtx=null,processor=null,source=null,playCtx=null,nextPlayTime=0,audioPackets=0,audioBytes=0,reconnecting=false,wanted=false;
let pendingText=[], inBuf='', outBuf='', userEl=null, aiEl=null;
const $=id=>document.getElementById(id);
function log(s){$('log').textContent+='['+new Date().toLocaleTimeString('zh-TW')+'] '+s+'\n';$('log').scrollTop=$('log').scrollHeight}
function status(s){$('status').textContent=s}
function setAutoUi(){const b=$('autoBtn');if(b)b.textContent=auto?'⏸ 停止自動連接':'⚡ 自動連接'}
function bubble(role,text,replace){
  const chat=$('chat');
  if(replace && role==='user' && userEl){userEl.textContent=text;return userEl}
  if(replace && role==='ai' && aiEl){aiEl.textContent=text;return aiEl}
  const d=document.createElement('div');d.className='bubble '+(role==='user'?'user':'ai');
  d.innerHTML='<b>'+(role==='user'?'你':'暗星')+'</b>';
  const t=document.createElement('div');t.textContent=text;d.appendChild(t);chat.appendChild(d);chat.scrollTop=chat.scrollHeight;
  if(role==='user')userEl=t; else aiEl=t;return t;
}
function saveTurn(role,text){
  text=String(text||'').trim();if(!text)return;
  let list=[];try{list=JSON.parse(localStorage.getItem(TURNS_KEY)||'[]')}catch(e){list=[]}
  const item={id:Date.now()+'-'+Math.random().toString(16).slice(2),role:role==='user'?'user':'assistant',text,t:Date.now()};
  list.push(item);
  try{localStorage.setItem(TURNS_KEY,JSON.stringify(list.slice(-80)))}catch(e){}
  try{new BroadcastChannel('aivault-dark-star-live').postMessage({type:'turn',...item})}catch(e){}
}
function flushTurn(){if(inBuf.trim())saveTurn('user',inBuf);if(outBuf.trim())saveTurn('assistant',outBuf);inBuf='';outBuf='';userEl=null;aiEl=null}
function sendTextToLive(text){
  text=String(text||'').trim();if(!text)return false;
  if(!ws||ws.readyState!==1){pendingText.push(text);status('文字已排隊，連上後會送給暗星');return false}
  try{
    ws.send(JSON.stringify({type:'text',text,source:'dark-star-live-page'}));
    ws.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text}]}],turnComplete:true}}));
    ws.send(JSON.stringify({realtimeInput:{text}}));
    log('你打字：'+text);bubble('user',text,false);saveTurn('user',text);return true;
  }catch(e){log('送字失敗：'+e.message);return false}
}
function flushPending(){pendingText.splice(0).forEach(t=>sendTextToLive(t))}
function sendTyped(){const input=$('liveInput');const text=(input.value||'').trim();if(!text)return;input.value='';sendTextToLive(text)}
function initVoices(){
  const sel=$('voiceSelect');sel.innerHTML='';
  VOICES.forEach(([id,label])=>{const o=document.createElement('option');o.value=id;o.textContent=id+' — '+label;sel.appendChild(o)});
  const q=new URLSearchParams(location.search);
  sel.value=q.get('voice')||localStorage.getItem('darkStarVoice')||'Kore';updateVoice();
  sel.onchange=()=>{localStorage.setItem('darkStarVoice',sel.value);updateVoice()};
}
function updateVoice(){$('voiceStat').textContent=$('voiceSelect').value}
function setMode(m){
  if(m===mode)return;
  if(ws||stream)return;
  mode=m;document.body.className='mode-'+m;
  $('voiceBtn').classList.toggle('active',m==='voice');
  $('videoBtn').classList.toggle('active',m==='video');
  $('modeStat').textContent=m==='voice'?'語音':'視訊';
}
async function openMedia(){
  if(stream)return;
  const constraints={audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}};
  if(mode==='video')constraints.video={facingMode:facing,width:{ideal:1280},height:{ideal:720}};
  stream=await navigator.mediaDevices.getUserMedia(constraints);
  if(mode==='video'&&stream.getVideoTracks().length){$('preview').srcObject=stream;$('cameraBtn').disabled=false}
  else $('cameraBtn').disabled=true;
}
async function openAudio(){
  if(!playCtx)playCtx=new AudioContext();
  if(playCtx.state!=='running')await playCtx.resume();
  if(!inputCtx)inputCtx=new AudioContext({sampleRate:16000});
  if(inputCtx.state!=='running')await inputCtx.resume();
}
function scheduleReconnect(){
  if(!auto||!wanted||reconnecting)return;
  reconnecting=true;status('🟡 已斷線，正在自動重連…');log('連線中斷，1 秒後自動重連');
  setTimeout(()=>{reconnecting=false;if(!auto||!wanted)return;connect().then(()=>{if(mode==='video')startVideo();if(!processor)startAudio();status('🟢 已重連｜可繼續說或打字')}).catch(()=>scheduleReconnect())},1000);
}
function connect(){
  return new Promise((resolve,reject)=>{
    if(ws&&ws.readyState===1)return resolve();
    const q=new URLSearchParams(location.search);const topicId=localStorage.getItem('technical-dark-star-topic-id')||q.get('topic_id')||'';const conversationId=localStorage.getItem('technical_dark_star_conversation_id')||q.get('conversation_id')||'';ws=new WebSocket(FN+'?voice='+encodeURIComponent($('voiceSelect').value)+'&topic_id='+encodeURIComponent(topicId)+'&conversation_id='+encodeURIComponent(conversationId));
    ws.binaryType='arraybuffer';
    ws.onopen=()=>{status('🟢 已連線｜可以打字或說話');log('WebSocket 已連線');flushPending();resolve()};
    ws.onerror=e=>reject(e);
    ws.onclose=()=>{ws=null;if(auto&&wanted)scheduleReconnect();else status('⚪ 已斷線')};
    ws.onmessage=e=>handleMessage(e.data);
  });
}
function handleMessage(raw){
  if(raw instanceof ArrayBuffer){playPCM(raw);return}
  try{
    const d=JSON.parse(raw);
    if(d.audio&&d.audio.data)playBase64PCM(d.audio.data);
    if(d.type==='go_away'){if(auto&&wanted){try{ws&&ws.close()}catch(_){}}return}
    if(d.serverContent&&d.serverContent.inputTranscription&&d.serverContent.inputTranscription.text){inBuf+=d.serverContent.inputTranscription.text;bubble('user',inBuf,true)}
    else if(d.serverContent&&d.serverContent.outputTranscription&&d.serverContent.outputTranscription.text){outBuf+=d.serverContent.outputTranscription.text;bubble('ai',outBuf,true)}
    else if(d.serverContent&&d.serverContent.turnComplete){flushTurn()}
    else if(d.type==='error'||d.error)log('錯誤：'+(d.message||(d.error&&d.error.message)||''));
  }catch(e){}
}
function playBase64PCM(b64){const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);playPCM(u.buffer)}
function playPCM(buf){
  if(!playCtx)return;
  const bytes=new Uint8Array(buf),pcm=new Int16Array(bytes.buffer,bytes.byteOffset,Math.floor(bytes.byteLength/2));
  if(!pcm.length)return;
  audioPackets++;audioBytes+=bytes.byteLength;$('audioStat').textContent=audioPackets;$('byteStat').textContent=audioBytes.toLocaleString();
  if(playCtx.state!=='running')playCtx.resume().catch(()=>{});
  const audio=playCtx.createBuffer(1,pcm.length,24000),data=audio.getChannelData(0);
  for(let i=0;i<pcm.length;i++)data[i]=pcm[i]/32768;
  const src=playCtx.createBufferSource();src.buffer=audio;src.connect(playCtx.destination);
  const now=playCtx.currentTime;if(nextPlayTime<now+.03)nextPlayTime=now+.03;src.start(nextPlayTime);nextPlayTime+=audio.duration;
}
async function start(){
  try{
    wanted=true;auto=true;setAutoUi();
    audioPackets=0;audioBytes=0;$('audioStat').textContent='0';$('byteStat').textContent='0';
    await openAudio();await openMedia();await connect();
    if(mode==='video')startVideo();startAudio();
    $('startBtn').disabled=true;$('stopBtn').disabled=false;
    status('🟢 暗星正在聽／說'+(mode==='video'?'／看':'')+'｜斷線會自動重連');
    const draft=($('liveInput').value||'').trim();if(draft)sendTextToLive(draft);
  }catch(e){status('🔴 無法啟動');log('啟動失敗：'+(e.message||e))}
}
function startVideo(){
  clearInterval(videoTimer);
  const c=document.createElement('canvas'),x=c.getContext('2d');
  videoTimer=setInterval(()=>{
    if(!ws||ws.readyState!==1||!$('preview').videoWidth)return;
    c.width=640;c.height=Math.round(640*$('preview').videoHeight/$('preview').videoWidth);
    x.drawImage($('preview'),0,0,c.width,c.height);
    ws.send(JSON.stringify({type:'video',data:c.toDataURL('image/jpeg',.72).split(',')[1],mimeType:'image/jpeg'}));
  },1000);
}
function startAudio(){
  if(!stream||!inputCtx||processor)return;
  source=inputCtx.createMediaStreamSource(stream);
  processor=inputCtx.createScriptProcessor(2048,1,1);
  const silent=inputCtx.createGain();silent.gain.value=0;
  processor.onaudioprocess=e=>{
    if(!ws||ws.readyState!==1)return;
    const a=e.inputBuffer.getChannelData(0),pcm=new Int16Array(a.length);
    for(let i=0;i<a.length;i++)pcm[i]=Math.max(-1,Math.min(1,a[i]))*32767;
    let bin='';const u=new Uint8Array(pcm.buffer);for(let i=0;i<u.length;i++)bin+=String.fromCharCode(u[i]);
    ws.send(JSON.stringify({type:'audio',data:btoa(bin),mimeType:'audio/pcm;rate=16000'}));
  };
  source.connect(processor);processor.connect(silent);silent.connect(inputCtx.destination);
}
async function stop(){
  wanted=false;auto=false;setAutoUi();flushTurn();clearInterval(videoTimer);
  if(processor)processor.disconnect();if(source)source.disconnect();
  if(inputCtx)await inputCtx.close().catch(()=>{});if(playCtx)await playCtx.close().catch(()=>{});
  inputCtx=null;playCtx=null;processor=null;source=null;nextPlayTime=0;
  if(ws){try{ws.send(JSON.stringify({type:'close'}))}catch(_){}ws.close();ws=null}
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
  $('preview').srcObject=null;$('startBtn').disabled=false;$('stopBtn').disabled=true;$('cameraBtn').disabled=true;
  status('⚪ 已停止');
}
async function toggleAuto(){if(auto&&wanted){await stop();return}await start()}
async function switchCamera(){
  if(mode!=='video'||!stream||!stream.getVideoTracks().length)return;
  facing=facing==='user'?'environment':'user';
  const old=stream;
  const ns=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:1280},height:{ideal:720}},audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  old.getTracks().forEach(t=>t.stop());stream=ns;$('preview').srcObject=ns;
  $('preview').classList.toggle('mirror',facing==='user');
  if(processor){try{processor.disconnect()}catch(_){}processor=null;source=null;startAudio()}
}
function bootFromQuery(){
  const q=new URLSearchParams(location.search);
  const m=q.get('mode')==='voice'?'voice':'video';
  mode='';setMode(m);
  try{
    const draft=localStorage.getItem(DRAFT_KEY)||'';
    if(draft && !$('liveInput').value) $('liveInput').value=draft;
    const ctx=JSON.parse(localStorage.getItem(CTX_KEY)||'{}');
    if(ctx && ctx.draft && !$('liveInput').value) $('liveInput').value=ctx.draft;
  }catch(e){}
}
$('liveInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendTyped()}});
initVoices();bootFromQuery();
window.addEventListener('beforeunload',()=>{try{flushTurn();wanted=false;ws&&ws.close()}catch(_){}});

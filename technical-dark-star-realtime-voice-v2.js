(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_REALTIME_VOICE_V15__)return;
window.__AIVAULT_DARK_STAR_REALTIME_VOICE_V15__=true;
const RELAY='wss://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-live-voice';
const SESSION='https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-voice-session';
const LIVE_VIDEO='https://m9wmtcb782-arch.github.io/AIVAULT/technical-dark-star-live-video-test.html?mode=video&v=2';
const HOME='aivault-home.html';
const VOICES=[['Kore','Kore｜沉穩、專業、溫柔'],['Puck','Puck｜活漿、俏皮、親切'],['Charon','Charon｜低沉、穩重、權威'],['Leda','Leda｜溫柔、細膻、知性'],['Gacrux','Gacrux｜成熟、厚實、可靠'],['Aoede','Aoede｜明亮、優雅、自然'],['Orus','Orus｜冷靜、理性、沉著'],['Zephyr','Zephyr｜輕快、清新、柔和'],['Fenrir','Fenrir｜低沉、強烈、果斷'],['Achird','Achird｜親切、溫暖、自然']];
const state={active:false,starting:false,ws:null,stream:null,ctx:null,source:null,processor:null,sink:null,nextAudioTime:0,sessionId:null,voice:'Kore'};
const CTX_KEY='technical_dark_star_live_context';
function bindHomeBack(){
  const btn=document.getElementById('homeButton')||document.querySelector('.brand-home');
  if(btn){
    btn.setAttribute('href',HOME);
    if(!btn.dataset.homeBound){
      btn.dataset.homeBound='1';
      btn.textContent='🔙 返回 Home';
      btn.addEventListener('click',function(e){e.preventDefault();location.replace(HOME)});
    }
  }
  if(!sessionStorage.getItem('aivault-ds-home-guard')){
    sessionStorage.setItem('aivault-ds-home-guard','1');
    history.replaceState({aivaultHome:1},'',location.href);
    history.pushState({aivaultDarkStar:1},'',location.href);
  }
  if(!window.__AIVAULT_DS_HOME_POP__){
    window.__AIVAULT_DS_HOME_POP__=true;
    window.addEventListener('popstate',function(){location.replace(HOME)});
  }
}
function collectDarkStarContext(){
  let hist=[];
  try{
    if(typeof messagesHistory!=='undefined' && Array.isArray(messagesHistory)) hist=messagesHistory;
    else hist=JSON.parse(localStorage.getItem('technical_dark_star_messages')||'[]');
  }catch(e){hist=[]}
  const input=document.getElementById('composerInput');
  const draft=input&&typeof input.value==='string'?input.value:'';
  const lines=[];
  hist.slice(-30).forEach(m=>{
    if(!m)return;
    const role=String(m.role||m.sender||'user');
    const text=String(m.text||m.content||'').trim();
    if(!text)return;
    lines.push(((role==='assistant'||role==='model'||role==='ai')?'暗星':'使用者')+'：'+text);
  });
  let s='以下是暗星頁面目前的對話與輸入，請一併理解後再回答。\n';
  if(lines.length) s+='【先前對話】\n'+lines.join('\n')+'\n';
  s+='【輸入框即時文字】\n'+(draft.trim()?draft:'（空白）');
  return {text:s, draft:draft};
}
function publishDarkStarContext(){
  const ctx=collectDarkStarContext();
  try{localStorage.setItem(CTX_KEY, JSON.stringify({t:Date.now(), text:ctx.text, draft:ctx.draft}))}catch(e){}
  return ctx;
}
function sendDarkStarContext(reason){
  const ctx=publishDarkStarContext();
  if(state.ws&&state.ws.readyState===1){
    try{
      state.ws.send(JSON.stringify({type:'text', text:ctx.text, source:'dark-star-page', reason:reason||'sync'}));
      const typed=(ctx.draft||'').trim();
      if(typed&&reason==='session-start'){
        state.ws.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text:typed}]}],turnComplete:true}}));
      }
    }catch(e){}
  }
}
function bindComposerSendToLive(){
  if(window.__AIVAULT_DARK_STAR_COMPOSER_LIVE__)return;
  const input=document.getElementById('composerInput')||document.querySelector('.composer-input');
  const send=document.querySelector('.composer-send');
  if(!input||!send)return;
  window.__AIVAULT_DARK_STAR_COMPOSER_LIVE__=true;
  send.addEventListener('click',e=>{
    if(!state.active||!state.ws||state.ws.readyState!==1)return;
    const text=String(input.value||'').trim();
    if(!text)return;
    e.preventDefault();e.stopImmediatePropagation();
    try{
      state.ws.send(JSON.stringify({type:'text',text,source:'dark-star-page',reason:'composer-send'}));
      state.ws.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text}]}],turnComplete:true}}));
    }catch(err){}
    input.value='';
    try{input.dispatchEvent(new Event('input',{bubbles:true}))}catch{}
  },true);
}
function bindDarkStarTextSync(){
  if(window.__AIVAULT_DARK_STAR_TEXT_SYNC__)return;
  window.__AIVAULT_DARK_STAR_TEXT_SYNC__=true;
  const input=document.getElementById('composerInput');
  let last='', timer=null;
  const kick=()=>{
    const ctx=publishDarkStarContext();
    if(ctx.draft===last)return;
    last=ctx.draft;
    sendDarkStarContext('typing');
  };
  if(input){
    input.addEventListener('input',()=>{
      publishDarkStarContext();
      clearTimeout(timer);
      timer=setTimeout(kick,280);
    });
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)publishDarkStarContext()});
  setInterval(publishDarkStarContext,1200);
  publishDarkStarContext();
}
function css(){if(document.getElementById('dsVoiceStyle'))return;const s=document.createElement('style');s.id='dsVoiceStyle';s.textContent=`.dark-star-live-controls{display:flex;align-items:center;gap:4px}.dark-star-sound-button,.dark-star-live-button{height:30px;border:1px solid #dedede;border-radius:8px;background:#fff;color:#222;font-size:11px;padding:0 7px}.dark-star-live-button.active{background:#171717;color:#fff}.dark-star-voice-select{position:absolute;top:34px;right:0;width:210px;height:32px;display:none;z-index:1001}.dark-star-live-controls.expanded .dark-star-voice-select{display:block}.dark-star-live-status{position:fixed;top:66px;right:14px;display:none}.dark-star-live-status.show{display:block}`;
document.head.appendChild(s)}
function favorites(){
  const bottom=document.querySelector('.drawer-bottom');
  if(!bottom)return false;
  let link=document.getElementById('darkStarFavoriteVideo');
  if(link){
    link.href=LIVE_VIDEO;link.target='_blank';link.rel='noopener noreferrer';
    const label=link.querySelector('span:last-child');
    if(label)label.textContent='即時暗星'; else link.textContent='🎥 即時暗星';
    return true;
  }
  return false;
}
function ui(){
  css();favorites();bindHomeBack();
  if(document.getElementById('darkStarLiveControls'))return;
  const top=document.querySelector('.topbar');if(!top)return;
  const controls=document.createElement('div');controls.id='darkStarLiveControls';controls.className='dark-star-live-controls';
  const sound=document.createElement('button');sound.id='darkStarSoundButton';sound.type='button';sound.className='dark-star-sound-button';sound.textContent='聲音';
  const video=document.createElement('a');video.id='darkStarLiveVideoButton';video.className='dark-star-live-button';video.textContent='即時視訊';video.href=LIVE_VIDEO;video.target='_blank';video.rel='noopener noreferrer';
  const live=document.createElement('button');live.id='darkStarLiveButton';live.type='button';live.className='dark-star-live-button';live.textContent='即時語音';
  const select=document.createElement('select');select.id='darkStarVoiceSelect';select.className='dark-star-voice-select';VOICES.forEach(([value,label],i)=>{const o=document.createElement('option');o.value=value;o.textContent=label;select.appendChild(o)});select.value=state.voice;controls.append(sound,select);
  const home=document.querySelector('.brand-home');
  if(home){home.before(video);video.after(live);live.after(controls)}else top.append(video,controls,live);
  const st=document.createElement('div');st.id='darkStarLiveStatus';st.className='dark-star-live-status';document.body.appendChild(st);
  sound.onclick=()=>{state.expanded=!state.expanded;controls.classList.toggle('expanded',state.expanded)};
  select.onchange=()=>{state.voice=select.value;if(state.active||state.starting)stopVoice().then(startVoice)};
  live.onclick=()=>state.active||state.starting?stopVoice():startVoice();
}
function status(t,show=true){const s=document.getElementById('darkStarLiveStatus');if(s){s.textContent=t;s.classList.toggle('show',show)}}
function button(on){const b=document.getElementById('darkStarLiveButton');if(b){b.classList.toggle('active',on);b.textContent=on?'結束即時語音':'即時語音'}}
function b64(bytes){let o='';for(let i=0;i<bytes.length;i+=32768)o+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(o)}
function decode64(x){const s=atob(x),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u}
function pcm16(samples,rate,target=16000){let src=samples;if(rate!==target){const r=rate/target,n=Math.max(1,Math.round(samples.length/r)),o=new Float32Array(n);for(let i=0;i<n;i++){const p=i*r,j=Math.floor(p),f=p-j,a=samples[j]||0,c=samples[Math.min(j+1,samples.length-1)]||a;o[i]=a+(c-a)*f}src=o}const p=new Int16Array(src.length);for(let i=0;i<src.length;i++){const v=Math.max(-1,Math.min(1,src[i]));p[i]=v<0?v*32768:v*32767}return new Uint8Array(p.buffer)}
function play(data,mime){if(!state.ctx)return;const u=decode64(data);if(u.length<2)return;const p=new Int16Array(u.buffer,u.byteOffset,Math.floor(u.byteLength/2)),f=new Float32Array(p.length);for(let i=0;i<p.length;i++)f[i]=p[i]/32768;const rate=Number((/rate=(\d+)/i.exec(mime||'')||[])[1]||24000);const ab=state.ctx.createBuffer(1,f.length,rate);ab.copyToChannel(f,0);const src=state.ctx.createBufferSource();src.buffer=ab;src.connect(state.ctx.destination);const at=Math.max(state.ctx.currentTime,state.nextAudioTime);src.start(at);state.nextAudioTime=at+ab.duration}
async function sessionStart(){try{const r=await fetch(SESSION,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start',voice_profile:state.voice})});const j=await r.json();state.sessionId=j?.session?.id||j?.session_id||j?.id||null}catch{state.sessionId=null}}
async function sessionEnd(){if(!state.sessionId)return;try{await fetch(SESSION,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'end',session_id:state.sessionId})})}catch{}state.sessionId=null}
async function stopVoice(){state.active=false;state.starting=false;button(false);status('即時語音已結束',false);try{state.ws?.close()}catch{}try{state.processor?.disconnect()}catch{}try{state.source?.disconnect()}catch{}try{state.sink?.disconnect()}catch{}try{state.stream?.getTracks().forEach(t=>t.stop())}catch{}try{await state.ctx?.close()}catch{}state.ws=null;state.processor=null;state.source=null;state.sink=null;state.stream=null;state.ctx=null;state.nextAudioTime=0;await sessionEnd()}
async function startVoice(){if(state.active||state.starting)return;state.starting=true;button(true);status('正在啟動即時語音……');try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('此瀏覽器不支援音訊');if(!navigator.mediaDevices?.getUserMedia)throw Error('此瀏覽器不允許麥克風');state.ctx=new AC();await state.ctx.resume();await sessionStart();state.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});state.ws=new WebSocket(RELAY+'?voice='+encodeURIComponent(state.voice));try{window.__AIVAULT_LIVE_SOCKETS__=window.__AIVAULT_LIVE_SOCKETS__||[];window.__AIVAULT_LIVE_SOCKETS__.push(state.ws)}catch(e){}state.ws.onopen=()=>{state.active=true;state.starting=false;button(true);status('正在耳聽');sendDarkStarContext('session-start');const src=state.ctx.createMediaStreamSource(state.stream),pr=state.ctx.createScriptProcessor(2048,1,1),sink=state.ctx.createGain();sink.gain.value=0;state.source=src;state.processor=pr;state.sink=sink;src.connect(pr);pr.connect(sink);sink.connect(state.ctx.destination);pr.onaudioprocess=e=>{if(!state.active||state.ws?.readyState!==WebSocket.OPEN)return;const bytes=pcm16(e.inputBuffer.getChannelData(0),e.inputBuffer.sampleRate,16000);state.ws.send(JSON.stringify({type:'audio',data:b64(bytes),mimeType:'audio/pcm;rate=16000'}))}};state.ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.error?.message){status('語音錯誤：'+m.error.message);return}const c=m.serverContent||{};if(c.modelTurn?.parts)for(const part of c.modelTurn.parts)if(part?.inlineData?.data)play(part.inlineData.data,part.inlineData.mimeType);if(c.turnComplete)status('正在耳聽')};state.ws.onerror=()=>status('即時語音連線錯誤');state.ws.onclose=()=>{if(state.active)stopVoice()}}catch(e){console.error('[DarkStar voice]',e);await stopVoice();status(e?.message||'即時語音啟動失敗')}}
function loadPageTextBridge(){if(document.getElementById('dsPageTextToLive'))return;const s=document.createElement('script');s.id='dsPageTextToLive';s.src='technical-dark-star-page-text-to-live.js?v=15';document.head.appendChild(s)}
function init(){ui();bindDarkStarTextSync();bindComposerSendToLive();bindHomeBack();loadPageTextBridge();let tries=0;const timer=setInterval(()=>{tries++;bindHomeBack();bindComposerSendToLive();loadPageTextBridge();if(favorites()||tries>=20)clearInterval(timer)},250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

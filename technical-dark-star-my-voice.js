(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_MY_VOICE__)return;
window.__AIVAULT_DARK_STAR_MY_VOICE__=true;
const FN='https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/fish-tts';
const RELAY='wss://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-live-voice';
const KEY='darkStarUseMyVoice';
const RATE_KEY='darkStarMyVoiceRate';
const LANG_LOCK='聽寫規則：使用者只說繁體中文或英文。input transcription 必須是繁體中文或英文原文，禁止翻譬或聽寫成韓文、日文或其他語言。回答只用繁體中文，可另起一行英文字幕。';
const STT_FIX='聽寫錯誤。使用者說的是繁體中文或英文，請用繁中或英文重聽，不要韓文。';
let audio=null,speaking=false,last='',typeTimer=0,sttWarn=0;
let ws=null,stream=null,ctx=null,source=null,processor=null,sink=null,outText='',inText='',userEl=null,aiEl=null,thinkEl=null,thinkT=0,thinkSec=0;
const originalSpeak=window.speakText;
function lsGet(k){try{return (localStorage.getItem(k)||'').trim()}catch(e){return ''}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function voiceId(){return lsGet('FISH_VOICE_ID')}
function on(){return lsGet(KEY)==='1'}
function rate(){let n=parseFloat(lsGet(RATE_KEY));if(!isFinite(n))n=1;return Math.min(1.3,Math.max(0.7,n))}
function toast(msg){const el=document.getElementById('voiceStatus');if(!el){alert(msg);return}el.textContent=msg;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),3200)}
function paint(){const btn=document.getElementById('darkStarMyVoiceButton');if(!btn)return;const v=on();btn.classList.toggle('active',v);btn.setAttribute('aria-pressed',String(v));btn.textContent=v?'我的聲音 ✓':'我的聲音'}
function stopSpeak(){speaking=false;if(!audio)return;try{audio.pause()}catch(e){}try{audio.currentTime=0}catch(e){}}
function unlockAudio(){
  if(!audio)audio=new Audio();
  audio.volume=1;try{audio.muted=false}catch(e){}
  const silent='data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
  audio.src=silent;
  return audio.play().catch(function(){}).then(function(){try{audio.pause()}catch(e){}});
}
function accessToken(){try{const raw=localStorage.getItem('sb-clcddygkaaqqtsbswgdf-auth-token');if(!raw)return '';const j=JSON.parse(raw);return String(j.access_token||(j.currentSession&&j.currentSession.access_token)||'').trim()}catch(e){return ''}}
function topicId(){if(typeof getDarkStarTopicId==='function')return String(getDarkStarTopicId()||'').trim();try{return (localStorage.getItem('technical-dark-star-topic-id')||'').trim()}catch(e){return ''}}
function convId(){if(typeof conversationId==='string')return conversationId.trim();try{return (localStorage.getItem('technical_dark_star_conversation_id')||'').trim()}catch(e){return ''}}
function liveParams(){const p=new URLSearchParams();p.set('voice','Kore');p.set('agent_id','technical-dark-star');const t=topicId();const c=convId();const tok=accessToken();if(t)p.set('topic_id',t);if(c)p.set('conversation_id',c);if(tok)p.set('access_token',tok);return p}
function pcm16(float32){const out=new Int16Array(float32.length);for(let i=0;i<float32.length;i++){const s=Math.max(-1,Math.min(1,float32[i]));out[i]=s<0?s*0x8000:s*0x7fff}const bytes=new Uint8Array(out.buffer);let bin='';for(let i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);return btoa(bin)}
function wrongLang(s){return /[가-힣぀-ヿ]/.test(String(s||''))}
function scrollChat(){const box=document.getElementById('messages');if(box)box.scrollTop=box.scrollHeight}
function ensureBubble(role){
  const welcome=document.getElementById('welcome');if(welcome)welcome.remove();
  const inner=document.getElementById('messagesInner');if(!inner)return null;
  const row=document.createElement('div');
  row.className='message '+(role==='user'?'user':'ai');
  const avatar=document.createElement('div');avatar.className='message-avatar';avatar.textContent=role==='user'?'你':'✦';
  const body=document.createElement('div');body.className='message-body';
  const text=document.createElement('div');text.className='message-text';
  body.appendChild(text);row.appendChild(avatar);row.appendChild(body);inner.appendChild(row);
  return text;
}
function writeUser(text){
  const raw=String(text||'').trim();if(!raw)return;
  if(!userEl||!userEl.isConnected)userEl=ensureBubble('user');
  if(userEl)userEl.textContent=raw;
  const input=document.getElementById('composerInput');
  if(input){input.value=raw;input.dispatchEvent(new Event('input',{bubbles:true}))}
  scrollChat();
}
function writeAI(text){
  const raw=String(text||'').trim();if(!raw)return;
  if(!aiEl||!aiEl.isConnected)aiEl=ensureBubble('ai');
  if(aiEl)aiEl.textContent=raw;
  scrollChat();
}
function startThink(){
  stopThink();thinkSec=0;
  if(!thinkEl||!thinkEl.isConnected)thinkEl=ensureBubble('ai');
  if(thinkEl)thinkEl.textContent='暗星思考中 0 秒';
  thinkT=setInterval(function(){thinkSec+=1;if(thinkEl&&thinkEl.isConnected)thinkEl.textContent='暗星思考中 '+thinkSec+' 秒'},1000);
}
function stopThink(){if(thinkT){clearInterval(thinkT);thinkT=0}}
function mergeText(prev,next){
  const a=String(prev||'');const b=String(next||'');
  if(!b)return a;if(!a)return b;if(b===a)return a;
  if(b.startsWith(a))return b;
  if(a.startsWith(b)&&a.length>b.length)return a;
  if(a.endsWith(b))return a;
  if(b.length+4<a.length)return a;
  return a+b;
}
function lastTyped(){
  const nodes=document.querySelectorAll('.message.ai .message-text, .message.assistant .message-text');
  const el=nodes[nodes.length-1];
  const t=el?String(el.innerText||'').trim():'';
  if(!t||/思考中|正在思考|正在聆聽/.test(t))return '';
  return t;
}
function watchTyped(){
  if(!on())return;
  clearTimeout(typeTimer);
  typeTimer=setTimeout(function(){const t=lastTyped();if(!t||t===last)return;speakMine(t)},1400);
}
function addDrawerSettings(){
  const bottom=document.querySelector('.drawer-bottom');
  if(!bottom||document.getElementById('dsMyVoiceSettings'))return;
  const box=document.createElement('div');
  box.id='dsMyVoiceSettings';
  box.style.cssText='padding:10px 12px 12px;border-bottom:1px solid #eee';
  const has=!!(lsGet('FISH_VOICE_ID')||lsGet('FISH_API_KEY'));
  const r=rate();
  box.innerHTML='<div style="font-size:12px;font-weight:600;margin-bottom:8px">我的聲音</div>'+
    '<div id="dsMyVoiceSummary" style="font-size:11px;color:#888;margin-bottom:8px">'+(has?'已設定（已隱藏）':'尚未設定')+'</div>'+
    '<label style="display:flex;align-items:center;gap:8px;font-size:11px;color:#666;margin:0 0 8px">語速 <input id="dsFishRateIn" type="range" min="0.7" max="1.3" step="0.05" style="flex:1"><span id="dsFishRateVal">'+r.toFixed(2)+'</span></label>'+
    '<button id="dsMyVoiceToggle" type="button" class="drawer-item" style="width:100%">變更我的聲音設定</button>'+
    '<div id="dsMyVoiceFields" hidden>'+
    '<label style="display:block;font-size:11px;color:#666;margin:8px 0 6px">Fish API Key<br><input id="dsFishKeyIn" type="password" autocomplete="off" style="width:100%;margin-top:4px;padding:7px;border:1px solid #ddd;border-radius:8px"></label>'+
    '<label style="display:block;font-size:11px;color:#666;margin-bottom:6px">Voice id<br><input id="dsFishVoiceIn" type="text" autocomplete="off" style="width:100%;margin-top:4px;padding:7px;border:1px solid #ddd;border-radius:8px"></label>'+
    '<button id="dsFishSave" type="button" class="drawer-item" style="width:100%">儲存並收起</button></div>';
  bottom.insertBefore(box,bottom.firstChild);
  const fields=document.getElementById('dsMyVoiceFields');
  const toggle=document.getElementById('dsMyVoiceToggle');
  const summary=document.getElementById('dsMyVoiceSummary');
  const rateIn=document.getElementById('dsFishRateIn');
  const rateVal=document.getElementById('dsFishRateVal');
  if(rateIn){rateIn.value=String(r);rateIn.oninput=function(){const cur=Math.min(1.3,Math.max(0.7,parseFloat(rateIn.value)||1));lsSet(RATE_KEY,String(cur));if(rateVal)rateVal.textContent=cur.toFixed(2);if(audio)audio.playbackRate=cur}};
  function fill(){const k=document.getElementById('dsFishKeyIn');const v=document.getElementById('dsFishVoiceIn');if(k)k.value=lsGet('FISH_API_KEY');if(v)v.value=lsGet('FISH_VOICE_ID')}
  function collapse(){if(fields)fields.hidden=true;const k=document.getElementById('dsFishKeyIn');const v=document.getElementById('dsFishVoiceIn');if(k)k.value='';if(v)v.value='';if(summary)summary.textContent=(lsGet('FISH_VOICE_ID')||lsGet('FISH_API_KEY'))?'已設定（已隱藏）':'尚未設定';if(toggle)toggle.textContent='變更我的聲音設定'}
  if(toggle)toggle.onclick=function(){if(!fields)return;if(fields.hidden){fields.hidden=false;fill();toggle.textContent='收起設定'}else collapse()};
  const save=document.getElementById('dsFishSave');
  if(save)save.onclick=function(){const k=document.getElementById('dsFishKeyIn');const v=document.getElementById('dsFishVoiceIn');lsSet('FISH_API_KEY',(k&&k.value||'').trim());lsSet('FISH_VOICE_ID',(v&&v.value||'').trim());toast('已儲存我的聲音設定');collapse()};
}
function speakChinese(text){
  const raw=String(text||'').trim();
  const lines=raw.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const zh=lines.filter(s=>/[一-鿿]/.test(s));
  if(zh.length)return zh.join('。');
  return raw;
}
async function speakMine(text){
  const raw=speakChinese(text);
  const id=voiceId();
  if(!raw||raw.length<2)return;
  if(!id){toast('請先在抽屆填 Voice id');return}
  if(speaking)return;
  last=raw;speaking=true;
  const chunks=[];for(let i=0;i<raw.length;i+=180)chunks.push(raw.slice(i,i+180));
  if(!audio)audio=new Audio();audio.volume=1;try{audio.muted=false}catch(e){}
  for(let i=0;i<chunks.length;i++){
    if(!on())break;
    const res=await fetch(FN,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:chunks[i],reference_id:id,format:'mp3'})});
    if(!res.ok){toast('我的聲音合成失敗：'+res.status);break}
    const blob=await res.blob();if(!blob||blob.size<200){toast('我的聲音沒有音訊');break}
    const url=URL.createObjectURL(blob);
    await new Promise(resolve=>{audio.onended=resolve;audio.onerror=function(){toast('播放失敗');resolve()};audio.src=url;audio.playbackRate=rate();audio.play().catch(function(err){toast('播放被系統攔下：'+(err&&err.message||'autoplay'));resolve()})});
  }
  speaking=false;
}
function readBlock(msg,kind){if(!msg||typeof msg!=='object')return '';const c=msg.serverContent||msg.content||msg;const key=kind==='in'?'inputTranscription':'outputTranscription';const block=c[key]||msg[key];if(block&&typeof block==='object'&&block.text)return String(block.text).trim();if(typeof block==='string')return block.trim();if(msg.type===key&&msg.text)return String(msg.text).trim();if(kind==='out'){const parts=c.modelTurn&&c.modelTurn.parts;if(Array.isArray(parts)){const t=parts.map(p=>p&&p.text?p.text:'').join('').trim();if(t)return t}}return ''}
function isDone(msg){if(!msg||typeof msg!=='object')return false;const c=msg.serverContent||msg.content||msg;return !!(c.turnComplete||msg.turnComplete||msg.type==='turnComplete')}
function blockOfficial(e){
  if(!on())return;
  const t=e.target;if(!t||!t.closest)return;
  if(t.closest('#micButton')||t.closest('#sendButton')||t.closest('.composer-mic')||t.closest('.composer-send')||t.closest('.message-action')){e.preventDefault();e.stopImmediatePropagation()}
}
function stopLive(){
  stopThink();
  try{if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:'audioStreamEnd'}))}catch(e){}
  try{if(ws)ws.close()}catch(e){}
  ws=null;outText='';inText='';userEl=null;aiEl=null;thinkEl=null;sttWarn=0;
  try{if(processor)processor.disconnect()}catch(e){}
  try{if(source)source.disconnect()}catch(e){}
  try{if(sink)sink.disconnect()}catch(e){}
  try{if(ctx)ctx.close()}catch(e){}
  processor=source=sink=ctx=null;
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
}
function attachMic(s){
  stream=s;
  ctx=new (window.AudioContext||window.webkitAudioContext)({sampleRate:16000});
  source=ctx.createMediaStreamSource(stream);
  processor=ctx.createScriptProcessor(4096,1,1);
  sink=ctx.createGain();sink.gain.value=0;
  processor.onaudioprocess=function(ev){if(!ws||ws.readyState!==1)return;try{ws.send(JSON.stringify({type:'audio',data:pcm16(ev.inputBuffer.getChannelData(0)),mimeType:'audio/pcm;rate=16000'}))}catch(e){}};
  source.connect(processor);processor.connect(sink);sink.connect(ctx.destination);
  if(ctx.state==='suspended')ctx.resume();
  ws=new WebSocket(RELAY+'?'+liveParams().toString());
  ws.onopen=function(){toast('麥克風已開啟，可直接說話');try{ws.send(JSON.stringify({type:'text',text:LANG_LOCK}))}catch(e){}};
  ws.onmessage=function(ev){
    let msg=ev.data;try{msg=JSON.parse(ev.data)}catch(e){return}
    const spoken=readBlock(msg,'in');
    if(spoken){
      if(wrongLang(spoken)){
        writeUser('（你說的是中文或英文，聽寫請勿用韓文）');
        if(ws&&ws.readyState===1&&sttWarn<3){sttWarn+=1;try{ws.send(JSON.stringify({type:'text',text:STT_FIX}))}catch(e){}}
      }else{
        inText=mergeText(inText,spoken);
        writeUser(inText);
      }
      if(!thinkT)startThink();
    }
    const t=readBlock(msg,'out');if(t)outText=mergeText(outText,t);
    if(isDone(msg)){stopThink();const say=outText.trim();if(say.length>=2){aiEl=thinkEl&&thinkEl.isConnected?thinkEl:null;writeAI(say);speakMine(say)}inText='';outText='';userEl=null;aiEl=null;thinkEl=null}
  };
  ws.onerror=()=>toast('我的聲音連線錯誤');
  ws.onclose=()=>{if(on())toast('我的聲音連線已結束')};
}
window.speakText=function(text){if(on()){if(text)speakMine(text);return}if(typeof originalSpeak==='function')return originalSpeak(text)};
function addButton(){
  if(document.getElementById('darkStarMyVoiceButton'))return;
  const top=document.querySelector('.topbar');if(!top)return;
  const btn=document.createElement('button');
  btn.id='darkStarMyVoiceButton';btn.type='button';
  btn.title='開：同一下要麥克風權限';
  btn.style.cssText='margin-left:6px;border:1px solid #ddd;background:#fff;border-radius:9px;padding:7px 10px;font-size:12px;white-space:nowrap';
  btn.addEventListener('click',function(){
    if(on()){lsSet(KEY,'0');paint();stopSpeak();stopLive();return}
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast('這個瀏覽器不能開麥');return}
    const ask=navigator.mediaDevices.getUserMedia({audio:true,video:false});
    ask.then(function(s){
      lsSet(KEY,'1');paint();
      unlockAudio();
      if(!voiceId())toast('麥克風已允許。請到抽屆填 Voice id');
      attachMic(s);
    }).catch(function(e){
      lsSet(KEY,'0');paint();
      toast('請允許麥克風：'+(e&&e.message||'permission'));
    });
  });
  const home=document.getElementById('homeButton')||document.querySelector('.brand-home');
  if(home)home.before(btn);else top.appendChild(btn);
  lsSet(KEY,'0');paint();
}
function init(){
  addButton();
  addDrawerSettings();
  document.addEventListener('click',blockOfficial,true);
  document.addEventListener('pointerdown',blockOfficial,true);
  const inner=document.getElementById('messagesInner');
  if(inner)new MutationObserver(watchTyped).observe(inner,{childList:true,subtree:true,characterData:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

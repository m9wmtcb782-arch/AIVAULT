(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_MY_VOICE__)return;
window.__AIVAULT_DARK_STAR_MY_VOICE__=true;
const FN='https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/fish-tts';
const RELAY='wss://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-live-voice';
const KEY='darkStarUseMyVoice';
const RATE_KEY='darkStarMyVoiceRate';
let audio=null,speaking=false,timer=0,last='';
let ws=null,stream=null,ctx=null,source=null,processor=null,sink=null,outText='',speakTimer=0;
const originalSpeak=window.speakText;
function lsGet(k){try{return (localStorage.getItem(k)||'').trim()}catch(e){return ''}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function voiceId(){return lsGet('FISH_VOICE_ID')}
function on(){return lsGet(KEY)==='1'}
function rate(){let n=parseFloat(lsGet(RATE_KEY));if(!isFinite(n))n=1;return Math.min(1.3,Math.max(0.7,n))}
function toast(msg){const el=document.getElementById('voiceStatus');if(!el){alert(msg);return}el.textContent=msg;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),2200)}
function paint(){const btn=document.getElementById('darkStarMyVoiceButton');if(!btn)return;const v=on();btn.classList.toggle('active',v);btn.setAttribute('aria-pressed',String(v));btn.textContent=v?'我的聲音 ✓':'我的聲音'}
function stopSpeak(){speaking=false;clearTimeout(speakTimer);if(!audio)return;try{audio.pause()}catch(e){}try{audio.currentTime=0}catch(e){}}
function accessToken(){try{const raw=localStorage.getItem('sb-clcddygkaaqqtsbswgdf-auth-token');if(!raw)return '';const j=JSON.parse(raw);return String(j.access_token||(j.currentSession&&j.currentSession.access_token)||'').trim()}catch(e){return ''}}
function topicId(){if(typeof getDarkStarTopicId==='function')return String(getDarkStarTopicId()||'').trim();try{return (localStorage.getItem('technical-dark-star-topic-id')||'').trim()}catch(e){return ''}}
function convId(){if(typeof conversationId==='string')return conversationId.trim();try{return (localStorage.getItem('technical_dark_star_conversation_id')||'').trim()}catch(e){return ''}}
function liveParams(){const p=new URLSearchParams();p.set('voice','Kore');p.set('agent_id','technical-dark-star');const t=topicId();const c=convId();const tok=accessToken();if(t)p.set('topic_id',t);if(c)p.set('conversation_id',c);if(tok)p.set('access_token',tok);return p}
function pcm16(float32){const out=new Int16Array(float32.length);for(let i=0;i<float32.length;i++){const s=Math.max(-1,Math.min(1,float32[i]));out[i]=s<0?s*0x8000:s*0x7fff}const bytes=new Uint8Array(out.buffer);let bin='';for(let i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);return btoa(bin)}
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
    '<button id="dsFishSave" type="button" class="drawer-item" style="width:100%">儲存並收起</button>'+
    '</div>';
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
async function speakMine(text){const raw=String(text||'').trim();const id=voiceId();if(!raw||raw===last)return;if(!id){toast('請先在左上抽屆變更設定');return}last=raw;stopSpeak();speaking=true;const chunks=[];for(let i=0;i<raw.length;i+=180)chunks.push(raw.slice(i,i+180));if(!audio)audio=new Audio();audio.playbackRate=rate();for(let i=0;i<chunks.length;i++){if(!speaking)return;const res=await fetch(FN,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:chunks[i],reference_id:id,format:'mp3'})});if(!res.ok){toast('我的聲音合成失敗：'+res.status);speaking=false;return}const blob=await res.blob();if(!blob||blob.size<200){toast('我的聲音沒有音訊');speaking=false;return}const url=URL.createObjectURL(blob);await new Promise(resolve=>{audio.onended=resolve;audio.onerror=resolve;audio.src=url;audio.playbackRate=rate();audio.play().catch(resolve)})}speaking=false}
function lastAI(){const nodes=document.querySelectorAll('.message.ai .message-text, .message.assistant .message-text');const el=nodes[nodes.length-1];return el?String(el.innerText||'').trim():''}
function queueAuto(){if(!on())return;clearTimeout(timer);timer=setTimeout(()=>{const text=lastAI();if(!text||text===last)return;if(/正在思考|正在聆聽/.test(text))return;speakMine(text)},700)}
function readOut(msg){if(!msg||typeof msg!=='object')return '';const c=msg.serverContent||msg.content||msg;const block=c.outputTranscription||msg.outputTranscription;if(block&&typeof block==='object'&&block.text)return String(block.text).trim();if(typeof block==='string')return block.trim();if(msg.type==='outputTranscription'&&msg.text)return String(msg.text).trim();const parts=c.modelTurn&&c.modelTurn.parts;if(Array.isArray(parts)){const t=parts.map(p=>p&&p.text?p.text:'').join('').trim();if(t)return t}return ''}
function isDone(msg){if(!msg||typeof msg!=='object')return false;const c=msg.serverContent||msg.content||msg;return !!(c.turnComplete||msg.turnComplete||msg.type==='turnComplete')}
function stopOfficialMic(){const mic=document.getElementById('micButton');if(mic&&mic.classList.contains('recording')){try{mic.click()}catch(e){}}}
function sendComposerNow(){const input=document.getElementById('composerInput');if(!input||!ws||ws.readyState!==1)return;const text=String(input.value||'').trim();if(!text)return;try{ws.send(JSON.stringify({type:'text',text}));input.value='';input.dispatchEvent(new Event('input',{bubbles:true}))}catch(e){}}
function stopLive(){
  try{if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:'audioStreamEnd'}))}catch(e){}
  try{if(ws)ws.close()}catch(e){}
  ws=null;outText='';
  try{if(processor)processor.disconnect()}catch(e){}
  try{if(source)source.disconnect()}catch(e){}
  try{if(sink)sink.disconnect()}catch(e){}
  try{if(ctx)ctx.close()}catch(e){}
  processor=source=sink=ctx=null;
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
}
async function startLive(){
  stopOfficialMic();
  stopLive();
  if(!voiceId()){toast('請先在左上抽屆變更設定');return}
  stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
  ctx=new (window.AudioContext||window.webkitAudioContext)({sampleRate:16000});
  if(ctx.state==='suspended')await ctx.resume();
  source=ctx.createMediaStreamSource(stream);
  processor=ctx.createScriptProcessor(4096,1,1);
  sink=ctx.createGain();sink.gain.value=0;
  processor.onaudioprocess=function(ev){
    if(!ws||ws.readyState!==1)return;
    const data=pcm16(ev.inputBuffer.getChannelData(0));
    try{ws.send(JSON.stringify({type:'audio',data,mimeType:'audio/pcm;rate=16000'}))}catch(e){}
  };
  source.connect(processor);processor.connect(sink);sink.connect(ctx.destination);
  ws=new WebSocket(RELAY+'?'+liveParams().toString());
  ws.onopen=()=>toast('我的聲音已開麥，直接說即可');
  ws.onmessage=function(ev){
    let msg=ev.data;
    try{msg=JSON.parse(ev.data)}catch(e){return}
    const t=readOut(msg);
    if(t)outText=t;
    if(outText&&(isDone(msg)||t)){
      clearTimeout(speakTimer);
      const wait=isDone(msg)?80:650;
      const say=outText;
      speakTimer=setTimeout(()=>speakMine(say),wait);
    }
  };
  ws.onerror=()=>toast('我的聲音連線錯誤');
  ws.onclose=()=>{if(on())toast('我的聲音連線已結束')};
}
window.speakText=function(text){if(on())return speakMine(text);if(typeof originalSpeak==='function')return originalSpeak(text);try{if('speechSynthesis' in window){window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(text||''));u.lang='zh-TW';window.speechSynthesis.speak(u)}}catch(e){}};
function addButton(){if(document.getElementById('darkStarMyVoiceButton'))return;const top=document.querySelector('.topbar');if(!top)return;const btn=document.createElement('button');btn.id='darkStarMyVoiceButton';btn.type='button';btn.title='開：直接開麥，回答自動用我的聲音。關：改回按喇叭播手機聲音';btn.style.cssText='margin-left:6px;border:1px solid #ddd;background:#fff;border-radius:9px;padding:7px 10px;font-size:12px;white-space:nowrap';btn.onclick=async()=>{const next=!on();lsSet(KEY,next?'1':'0');paint();if(!next){stopSpeak();stopLive();return}if(!voiceId()){toast('請先在左上抽屆變更設定');return}try{await startLive()}catch(e){toast(e&&e.message||'麥克風權限失敗');lsSet(KEY,'0');paint()}};const home=document.getElementById('homeButton')||document.querySelector('.brand-home');if(home)home.before(btn);else top.appendChild(btn);paint()}
function bindComposer(){
  const input=document.getElementById('composerInput');
  const send=document.getElementById('sendButton');
  if(input&&!input.dataset.dsMyVoice){
    input.dataset.dsMyVoice='1';
    input.addEventListener('keydown',function(e){if(!on())return;if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendComposerNow()}});
  }
  if(send&&!send.dataset.dsMyVoice){
    send.dataset.dsMyVoice='1';
    send.addEventListener('click',function(e){if(!on())return;e.preventDefault();e.stopImmediatePropagation();sendComposerNow()},true);
  }
}
function init(){addButton();addDrawerSettings();bindComposer();const inner=document.getElementById('messagesInner');if(inner)new MutationObserver(queueAuto).observe(inner,{childList:true,subtree:true,characterData:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

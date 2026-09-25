(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_MY_VOICE__)return;
window.__AIVAULT_DARK_STAR_MY_VOICE__=true;
const FN='https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/fish-tts';
const KEY='darkStarUseMyVoice';
const RATE_KEY='darkStarMyVoiceRate';
let audio=null,speaking=false,last='',typeTimer=0,rec=null,stream=null;
const originalSpeak=window.speakText;
function lsGet(k){try{return (localStorage.getItem(k)||'').trim()}catch(e){return ''}}
function lsSet(k,v){try{localStorage.setItem(k,String(v))}catch(e){}}
function voiceId(){return lsGet('FISH_VOICE_ID')}
function on(){return lsGet(KEY)==='1'}
function rate(){let n=parseFloat(lsGet(RATE_KEY));if(!isFinite(n))n=1;return Math.min(1.3,Math.max(0.7,n))}
function toast(msg){const el=document.getElementById('voiceStatus');if(!el){alert(msg);return}el.textContent=msg;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),2800)}
function paint(){const btn=document.getElementById('darkStarMyVoiceButton');if(!btn)return;btn.classList.toggle('active',on());btn.textContent=on()?'我的聲音 ✓':'我的聲音'}
function stopSpeak(){speaking=false;if(!audio)return;try{audio.pause()}catch(e){}}
function unlockAudio(){if(!audio)audio=new Audio();audio.volume=1;audio.src='data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';return audio.play().catch(function(){}).then(function(){try{audio.pause()}catch(e){}})}
function wrongLang(s){return /[ऀ-ॿ가-힣぀-ヿЀ-ӿ؀-ۿ฀-๿]/.test(String(s||''))}
function setInput(text){const input=document.getElementById('composerInput');if(!input)return;input.value=String(text||'');input.dispatchEvent(new Event('input',{bubbles:true}))}
function sendOfficial(){
  const input=document.getElementById('composerInput');
  const send=document.getElementById('sendButton')||document.querySelector('.composer-send');
  if(!input||!String(input.value||'').trim())return;
  if(send)send.click();
}
function lastAI(){const nodes=document.querySelectorAll('.message.ai .message-text, .message.assistant .message-text');const el=nodes[nodes.length-1];const t=el?String(el.innerText||'').trim():'';if(!t||/思考中|正在思考/.test(t))return '';return t}
function speakChinese(text){const raw=String(text||'').trim();const lines=raw.split(/\n+/).map(s=>s.trim()).filter(Boolean);const zh=lines.filter(s=>/[一-鿿]/.test(s)&&!wrongLang(s));return zh.length?zh.join('。'):raw}
async function speakMine(text){
  const raw=speakChinese(text);const id=voiceId();
  if(!raw||raw.length<2||!id||speaking||wrongLang(raw)||raw===last)return;
  last=raw;speaking=true;
  if(!audio)audio=new Audio();audio.volume=1;
  const chunks=[];for(let i=0;i<raw.length;i+=180)chunks.push(raw.slice(i,i+180));
  for(let i=0;i<chunks.length;i++){
    if(!on())break;
    const res=await fetch(FN,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:chunks[i],reference_id:id,format:'mp3'})});
    if(!res.ok){toast('我的聲音合成失敗：'+res.status);break}
    const blob=await res.blob();if(!blob||blob.size<200)break;
    const url=URL.createObjectURL(blob);
    await new Promise(resolve=>{audio.onended=resolve;audio.onerror=resolve;audio.src=url;audio.playbackRate=rate();audio.play().catch(resolve)});
  }
  speaking=false;
}
function watchTyped(){
  if(!on())return;
  clearTimeout(typeTimer);
  typeTimer=setTimeout(function(){const t=lastAI();if(!t||t===last||wrongLang(t))return;speakMine(t)},1600);
}
function stopRec(){
  try{if(rec)rec.stop()}catch(e){}
  rec=null;
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
}
function startRec(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast('這台手機沒有語音轉文字，請直接打字，暗星寫完仍會自動播');return}
  rec=new SR();
  rec.lang='zh-TW';
  rec.continuous=true;
  rec.interimResults=true;
  rec.onresult=function(ev){
    let final='';
    for(let i=ev.resultIndex;i<ev.results.length;i++){
      const piece=ev.results[i][0]&&ev.results[i][0].transcript||'';
      if(wrongLang(piece))continue;
      if(ev.results[i].isFinal)final+=piece;
      else setInput(piece);
    }
    if(final.trim()){setInput(final.trim());sendOfficial()}
  };
  rec.onerror=function(ev){if(ev.error!=='no-speech')toast('聽寫：'+ev.error)};
  rec.onend=function(){if(on())try{rec.start()}catch(e){}};
  try{rec.start();toast('我的聲音已開：說話→暗星寫完→再播')}catch(e){toast(e&&e.message||'無法開聽寫')}
}
function addDrawerSettings(){
  const bottom=document.querySelector('.drawer-bottom');
  if(!bottom||document.getElementById('dsMyVoiceSettings'))return;
  const box=document.createElement('div');box.id='dsMyVoiceSettings';box.style.cssText='padding:10px 12px 12px;border-bottom:1px solid #eee';
  box.innerHTML='<div style="font-size:12px;font-weight:600;margin-bottom:8px">我的聲音</div><button id="dsMyVoiceToggle" type="button" class="drawer-item" style="width:100%">變更設定</button><div id="dsMyVoiceFields" hidden><label style="display:block;font-size:11px;color:#666;margin:8px 0 6px">Fish API Key<br><input id="dsFishKeyIn" type="password" style="width:100%;margin-top:4px;padding:7px;border:1px solid #ddd;border-radius:8px"></label><label style="display:block;font-size:11px;color:#666">Voice id<br><input id="dsFishVoiceIn" type="text" style="width:100%;margin-top:4px;padding:7px;border:1px solid #ddd;border-radius:8px"></label><button id="dsFishSave" type="button" class="drawer-item" style="width:100%">儲存</button></div>';
  bottom.insertBefore(box,bottom.firstChild);
  const fields=document.getElementById('dsMyVoiceFields');
  const toggle=document.getElementById('dsMyVoiceToggle');
  if(toggle)toggle.onclick=function(){if(!fields)return;fields.hidden=!fields.hidden;if(!fields.hidden){const k=document.getElementById('dsFishKeyIn');const v=document.getElementById('dsFishVoiceIn');if(k)k.value=lsGet('FISH_API_KEY');if(v)v.value=lsGet('FISH_VOICE_ID')}};
  const save=document.getElementById('dsFishSave');
  if(save)save.onclick=function(){const k=document.getElementById('dsFishKeyIn');const v=document.getElementById('dsFishVoiceIn');lsSet('FISH_API_KEY',(k&&k.value||'').trim());lsSet('FISH_VOICE_ID',(v&&v.value||'').trim());toast('已儲存');if(fields)fields.hidden=true};
}
window.speakText=function(text){if(on()){if(text)speakMine(text);return}if(typeof originalSpeak==='function')return originalSpeak(text)};
function addButton(){
  if(document.getElementById('darkStarMyVoiceButton'))return;
  const top=document.querySelector('.topbar');if(!top)return;
  const btn=document.createElement('button');btn.id='darkStarMyVoiceButton';btn.type='button';
  btn.style.cssText='margin-left:6px;border:1px solid #ddd;background:#fff;border-radius:9px;padding:7px 10px;font-size:12px;white-space:nowrap';
  btn.addEventListener('click',function(){
    if(on()){lsSet(KEY,'0');paint();stopSpeak();stopRec();return}
    navigator.mediaDevices.getUserMedia({audio:true,video:false}).then(function(s){
      stream=s;lsSet(KEY,'1');paint();unlockAudio();startRec();
    }).catch(function(){toast('請允許麥克風')});
  });
  const home=document.getElementById('homeButton')||document.querySelector('.brand-home');
  if(home)home.before(btn);else top.appendChild(btn);
  lsSet(KEY,'0');paint();
}
function init(){
  addButton();addDrawerSettings();
  const inner=document.getElementById('messagesInner');
  if(inner)new MutationObserver(watchTyped).observe(inner,{childList:true,subtree:true,characterData:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

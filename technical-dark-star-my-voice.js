(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_MY_VOICE__)return;
window.__AIVAULT_DARK_STAR_MY_VOICE__=true;
const FN='https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/fish-tts';
const KEY='darkStarUseMyVoice';
const RATE_KEY='darkStarMyVoiceRate';
let audio=null,speaking=false,last='',typeTimer=0,rec=null,stream=null,hold='',holdT=0;
const originalSpeak=window.speakText;
function lsGet(k){try{return (localStorage.getItem(k)||'').trim()}catch(e){return ''}}
function lsSet(k,v){try{localStorage.setItem(k,String(v))}catch(e){}}
function voiceId(){return lsGet('FISH_VOICE_ID')}
function on(){return lsGet(KEY)==='1'}
function rate(){let n=parseFloat(lsGet(RATE_KEY));if(!isFinite(n))n=1;return Math.min(1.3,Math.max(0.7,n))}
function toast(msg){const el=document.getElementById('voiceStatus');if(!el){return}el.textContent=msg;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),2400)}
function paint(){const btn=document.getElementById('darkStarMyVoiceButton');if(!btn)return;btn.classList.toggle('active',on());btn.textContent=on()?'我的聲音 ✓':'我的聲音'}
function stopSpeak(){speaking=false;if(!audio)return;try{audio.pause()}catch(e){}}
function unlockAudio(){if(!audio)audio=new Audio();audio.volume=1;audio.src='data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';return audio.play().catch(function(){}).then(function(){try{audio.pause()}catch(e){}})}
function wrongLang(s){return /[ऀ-ॿ가-힣　-ヿЀ-ӿ؀-ۿ฀-๿]/.test(String(s||''))}
function setInput(text){const input=document.getElementById('composerInput');if(!input)return;input.value=String(text||'');input.dispatchEvent(new Event('input',{bubbles:true}))}
function sendOfficial(text){
  const raw=String(text||'').trim();
  if(!raw||wrongLang(raw))return;
  setInput(raw);
  const send=document.getElementById('sendButton')||document.querySelector('.composer-send');
  if(send)send.click();
  hold='';
  setInput('');
  try{if(rec)rec.stop()}catch(e){}
}
function lastAI(){const nodes=document.querySelectorAll('.message.ai .message-text, .message.assistant .message-text');const el=nodes[nodes.length-1];const t=el?String(el.innerText||'').trim():'';if(!t||/思考中|正在思考/.test(t))return '';return t}
function speakChinese(text){const raw=String(text||'').trim();const lines=raw.split(/\n+/).map(s=>s.trim()).filter(Boolean);const zh=lines.filter(s=>/[一-鿿]/.test(s)&&!wrongLang(s));return zh.length?zh.join('。'):raw}
async function speakMine(text){
  const raw=speakChinese(text);const id=voiceId();
  if(!raw||raw.length<2||!id||speaking||wrongLang(raw)||raw===last)return;
  last=raw;speaking=true;
  if(!audio)audio=new Audio();audio.volume=1;
  const res=await fetch(FN,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:raw.slice(0,800),reference_id:id,format:'mp3'})});
  if(!res.ok){speaking=false;return}
  const blob=await res.blob();if(!blob||blob.size<200){speaking=false;return}
  const url=URL.createObjectURL(blob);
  await new Promise(resolve=>{audio.onended=resolve;audio.onerror=resolve;audio.src=url;audio.playbackRate=rate();audio.play().catch(resolve)});
  speaking=false;
}
function watchTyped(){if(!on())return;clearTimeout(typeTimer);typeTimer=setTimeout(function(){const t=lastAI();if(!t||t===last||wrongLang(t))return;speakMine(t)},500)}
function stopRec(){clearTimeout(holdT);try{if(rec)rec.stop()}catch(e){}rec=null;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}}
function startRec(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast('請打字，寫完會自動播');return}
  hold='';
  setInput('');
  rec=new SR();rec.lang='zh-TW';rec.continuous=true;rec.interimResults=true;
  rec.onresult=function(ev){
    let finals='';
    let interim='';
    for(let i=ev.resultIndex;i<ev.results.length;i++){
      const piece=ev.results[i][0]&&ev.results[i][0].transcript||'';
      if(!piece||wrongLang(piece))continue;
      if(ev.results[i].isFinal)finals+=piece;
      else interim+=piece;
    }
    const text=(finals||interim).trim();
    if(!text)return;
    hold=text;setInput(text);
    clearTimeout(holdT);
    holdT=setTimeout(function(){if(hold)sendOfficial(hold)},550);
  };
  rec.onend=function(){if(hold)sendOfficial(hold);if(on())try{rec.start()}catch(e){}};
  try{rec.start();toast('說完停一下就會送出')}catch(e){toast('無法開聽寫')}
}
function addDrawerSettings(){
  const bottom=document.querySelector('.drawer-bottom');
  if(!bottom||document.getElementById('dsMyVoiceSettings'))return;
  const box=document.createElement('div');
  box.id='dsMyVoiceSettings';
  box.style.cssText='padding:10px 12px 12px;border-bottom:1px solid #eee';
  const saved=!!(lsGet('FISH_API_KEY')||lsGet('FISH_VOICE_ID'));
  box.innerHTML='<div style="font-size:12px;font-weight:600;margin-bottom:8px">我的聲音</div><button id="dsMyVoiceToggle" type="button" class="drawer-item" style="width:100%">'+(saved?'密碼已儲存，點此展開更改':'設定 API Key 與 Voice ID')+'</button><div id="dsMyVoiceFields" hidden><p style="font-size:11px;color:#888;margin:8px 0">不顯示明文。留空儲存不會覆蓋舊值。</p><label style="display:block;font-size:11px;color:#666;margin:8px 0 6px">我的聲音 API Key<br><input id="dsFishKeyIn" type="password" autocomplete="new-password" placeholder="••••••••" style="width:100%;margin-top:4px;padding:7px;border:1px solid #ddd;border-radius:8px"></label><label style="display:block;font-size:11px;color:#666">我的聲音 Voice ID<br><input id="dsFishVoiceIn" type="password" autocomplete="new-password" placeholder="••••••••" style="width:100%;margin-top:4px;padding:7px;border:1px solid #ddd;border-radius:8px"></label><div style="display:flex;gap:8px"><button id="dsFishPeek" type="button" class="drawer-item" style="flex:1">顯示/隱藏</button><button id="dsFishSave" type="button" class="drawer-item" style="flex:1">儲存並收起</button></div></div>';
  bottom.insertBefore(box,bottom.firstChild);
  const fields=document.getElementById('dsMyVoiceFields');
  const toggle=document.getElementById('dsMyVoiceToggle');
  function collapse(){
    if(fields)fields.hidden=true;
    const k=document.getElementById('dsFishKeyIn');
    const v=document.getElementById('dsFishVoiceIn');
    if(k){k.value='';k.type='password'}
    if(v){v.value='';v.type='password'}
    if(toggle)toggle.textContent=(lsGet('FISH_API_KEY')||lsGet('FISH_VOICE_ID'))?'密碼已儲存，點此展開更改':'設定 API Key 與 Voice ID';
  }
  if(toggle)toggle.onclick=function(){
    if(!fields)return;
    if(fields.hidden){fields.hidden=false;toggle.textContent='收起密碼欄位'}
    else collapse();
  };
  const peek=document.getElementById('dsFishPeek');
  if(peek)peek.onclick=function(){
    const k=document.getElementById('dsFishKeyIn');
    const v=document.getElementById('dsFishVoiceIn');
    if(!k||!v)return;
    const next=k.type==='password'?'text':'password';
    k.type=next;v.type=next;
  };
  const save=document.getElementById('dsFishSave');
  if(save)save.onclick=function(){
    const k=document.getElementById('dsFishKeyIn');
    const v=document.getElementById('dsFishVoiceIn');
    const nextKey=(k&&k.value||'').trim();
    const nextVoice=(v&&v.value||'').trim();
    if(nextKey)lsSet('FISH_API_KEY',nextKey);
    if(nextVoice)lsSet('FISH_VOICE_ID',nextVoice);
    toast('已儲存');
    collapse();
  };
}
window.speakText=function(text){if(on()){if(text)speakMine(text);return}if(typeof originalSpeak==='function')return originalSpeak(text)};
function addButton(){if(document.getElementById('darkStarMyVoiceButton'))return;const top=document.querySelector('.topbar');if(!top)return;const btn=document.createElement('button');btn.id='darkStarMyVoiceButton';btn.type='button';btn.style.cssText='margin-left:6px;border:1px solid #ddd;background:#fff;border-radius:9px;padding:7px 10px;font-size:12px;white-space:nowrap;position:relative;z-index:20;flex:0 0 auto';btn.addEventListener('click',function(){if(on()){lsSet(KEY,'0');paint();stopSpeak();stopRec();return}navigator.mediaDevices.getUserMedia({audio:true,video:false}).then(function(s){stream=s;lsSet(KEY,'1');paint();unlockAudio();startRec()}).catch(function(){toast('請允許麥克風')})});const home=document.getElementById('homeButton')||document.querySelector('.brand-home');if(home)home.before(btn);else top.appendChild(btn);paint()}
function ensureUI(){addButton();addDrawerSettings()}\nfunction init(){\n  ensureUI();\n  const inner=document.getElementById('messagesInner');\n  if(inner&&!inner.__darkStarMyVoiceMessagesGuard){inner.__darkStarMyVoiceMessagesGuard=true;new MutationObserver(watchTyped).observe(inner,{childList:true,subtree:true,characterData:true})}\n  if(!document.__darkStarMyVoiceBodyGuard){\n    document.__darkStarMyVoiceBodyGuard=true;\n    new MutationObserver(function(){ensureUI()}).observe(document.body,{childList:true,subtree:true});\n  }\n  let tries=0;\n  const timer=setInterval(function(){ensureUI();if(++tries>=40)clearInterval(timer)},500);\n}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

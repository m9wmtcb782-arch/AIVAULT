(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_REALTIME_VOICE_V16__)return;
window.__AIVAULT_DARK_STAR_REALTIME_VOICE_V16__=true;
const RELAY='wss://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-live-voice';
const SESSION='https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-voice-session';
const LIVE_VIDEO='technical-dark-star-live-video-test.html?mode=video&v=3';
const LIVE_VOICE='technical-dark-star-live-video-test.html?mode=voice&v=3';
const HOME='aivault-home.html';
const VOICES=[['Kore','Kore｜沉穩、專業、溫柔'],['Puck','Puck｜活漿、俗皮、親切'],['Charon','Charon｜低沉、穩重、權威'],['Leda','Leda｜溫柔、細腺、知性'],['Gacrux','Gacrux｜成熟、厚實、可靠'],['Aoede','Aoede｜明亮、優雅、自然'],['Orus','Orus｜冷靜、理性、沉著'],['Zephyr','Zephyr｜輕快、清新、柔和'],['Fenrir','Fenrir｜低沉、強烈、果斷'],['Achird','Achird｜親切、溫暖、自然']];
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
}
function bindDarkStarTextSync(){
  if(window.__AIVAULT_DARK_STAR_TEXT_SYNC__)return;
  window.__AIVAULT_DARK_STAR_TEXT_SYNC__=true;
  publishDarkStarContext();
}
function css(){if(document.getElementById('dsVoiceStyle'))return;const s=document.createElement('style');s.id='dsVoiceStyle';s.textContent=`.dark-star-live-controls{display:flex;align-items:center;gap:4px}.dark-star-sound-button,.dark-star-live-button{height:30px;border:1px solid #dedede;border-radius:8px;background:#fff;color:#222;font-size:11px;padding:0 7px}.dark-star-live-button.active{background:#171717;color:#fff}.dark-star-voice-select{position:absolute;top:34px;right:0;width:210px;height:32px;display:none;z-index:1001}.dark-star-live-controls.expanded .dark-star-voice-select{display:block}.dark-star-live-status{position:fixed;top:66px;right:14px;display:none}.dark-star-live-status.show{display:block}`;
document.head.appendChild(s)}
function favorites(){
  const bottom=document.querySelector('.drawer-bottom');
  if(!bottom)return false;
  let link=document.getElementById('darkStarFavoriteVideo');
  if(link){
    link.href=LIVE_VIDEO;link.removeAttribute('target');
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
  let video=document.getElementById('darkStarLiveVideoButton');
  if(video){
    video.href=LIVE_VIDEO;
    video.removeAttribute('target');
    video.textContent='即時視訊';
  }else{
    video=document.createElement('a');
    video.id='darkStarLiveVideoButton';
    video.className='dark-star-live-button';
    video.textContent='即時視訊';
    video.href=LIVE_VIDEO;
  }
  document.querySelectorAll('#darkStarLiveVideoButton').forEach((el,i)=>{if(i>0)el.remove()});
  const live=document.createElement('button');live.id='darkStarLiveButton';live.type='button';live.className='dark-star-live-button';live.textContent='即時語音';
  const select=document.createElement('select');select.id='darkStarVoiceSelect';select.className='dark-star-voice-select';VOICES.forEach(([value,label])=>{const o=document.createElement('option');o.value=value;o.textContent=label;select.appendChild(o)});select.value=state.voice;controls.append(sound,select);
  const home=document.querySelector('.brand-home');
  if(!document.getElementById('darkStarLiveVideoButton')){
    if(home){home.before(video)}else top.append(video);
  }
  if(video.nextElementSibling!==live) video.after(live);
  live.after(controls);
  const st=document.createElement('div');st.id='darkStarLiveStatus';st.className='dark-star-live-status';document.body.appendChild(st);
  sound.onclick=()=>{state.expanded=!state.expanded;controls.classList.toggle('expanded',state.expanded)};
  select.onchange=()=>{state.voice=select.value;localStorage.setItem('darkStarVoice',state.voice)};
  live.onclick=()=>{location.href=LIVE_VOICE};
}
function loadLiveJump(){if(document.getElementById('dsLiveJump'))return;const s=document.createElement('script');s.id='dsLiveJump';s.src='technical-dark-star-live-jump.js?v=3';document.head.appendChild(s)}
function init(){ui();bindDarkStarTextSync();bindComposerSendToLive();bindHomeBack();loadLiveJump();let tries=0;const timer=setInterval(()=>{tries++;bindHomeBack();loadLiveJump();if(favorites()||tries>=20)clearInterval(timer)},250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_MY_VOICE__)return;
window.__AIVAULT_DARK_STAR_MY_VOICE__=true;
const FN='https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/fish-tts';
const KEY='darkStarUseMyVoice';
let audio=null,speaking=false,timer=0,last='';
const originalSpeak=window.speakText;
function lsGet(k){try{return (localStorage.getItem(k)||'').trim()}catch(e){return ''}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function voiceId(){return lsGet('FISH_VOICE_ID')}
function on(){return lsGet(KEY)==='1'}
function toast(msg){const el=document.getElementById('voiceStatus');if(!el){alert(msg);return}el.textContent=msg;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),2200)}
function paint(){const btn=document.getElementById('darkStarMyVoiceButton');if(!btn)return;const v=on();btn.classList.toggle('active',v);btn.setAttribute('aria-pressed',String(v));btn.textContent=v?'我的聲音 ✓':'我的聲音'}
function stop(){speaking=false;if(!audio)return;try{audio.pause()}catch(e){}try{audio.currentTime=0}catch(e){}}
function addDrawerSettings(){
  const bottom=document.querySelector('.drawer-bottom');
  if(!bottom||document.getElementById('dsMyVoiceSettings'))return;
  const box=document.createElement('div');
  box.id='dsMyVoiceSettings';
  box.style.cssText='padding:10px 12px 12px;border-bottom:1px solid #eee';
  box.innerHTML='<div style="font-size:12px;font-weight:600;margin-bottom:8px">我的聲音設定</div>'+
    '<label style="display:block;font-size:11px;color:#666;margin-bottom:6px">Fish API Key<br><input id="dsFishKeyIn" type="password" autocomplete="off" style="width:100%;margin-top:4px;padding:7px;border:1px solid #ddd;border-radius:8px"></label>'+
    '<label style="display:block;font-size:11px;color:#666;margin-bottom:6px">Voice id<br><input id="dsFishVoiceIn" type="text" autocomplete="off" style="width:100%;margin-top:4px;padding:7px;border:1px solid #ddd;border-radius:8px"></label>'+
    '<button id="dsFishSave" type="button" class="drawer-item" style="width:100%">儲存我的聲音設定</button>';
  bottom.insertBefore(box,bottom.firstChild);
  const k=document.getElementById('dsFishKeyIn');
  const v=document.getElementById('dsFishVoiceIn');
  if(k)k.value=lsGet('FISH_API_KEY');
  if(v)v.value=lsGet('FISH_VOICE_ID');
  const save=document.getElementById('dsFishSave');
  if(save)save.onclick=function(){
    lsSet('FISH_API_KEY',(k&&k.value||'').trim());
    lsSet('FISH_VOICE_ID',(v&&v.value||'').trim());
    toast('已儲存我的聲音設定');
  };
}
async function speakMine(text){const raw=String(text||'').trim();const id=voiceId();if(!raw)return;if(!id){toast('請先在左上抽屆存 Voice id');return}stop();speaking=true;const chunks=[];for(let i=0;i<raw.length;i+=180)chunks.push(raw.slice(i,i+180));if(!audio)audio=new Audio();for(let i=0;i<chunks.length;i++){if(!speaking)return;const res=await fetch(FN,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:chunks[i],reference_id:id,format:'mp3'})});if(!res.ok){toast('我的聲音合成失敗：'+res.status);speaking=false;return}const blob=await res.blob();if(!blob||blob.size<200){toast('我的聲音沒有音訊');speaking=false;return}const url=URL.createObjectURL(blob);await new Promise(resolve=>{audio.onended=resolve;audio.onerror=resolve;audio.src=url;audio.play().catch(resolve)})}speaking=false}
function lastAI(){const nodes=document.querySelectorAll('.message.ai .message-text');const el=nodes[nodes.length-1];return el?String(el.innerText||'').trim():''}
function queueAuto(){if(!on())return;clearTimeout(timer);timer=setTimeout(()=>{const text=lastAI();if(!text||text===last)return;if(/正在思考|正在聆聽/.test(text))return;last=text;speakMine(text)},900)}
window.speakText=function(text){if(on())return speakMine(text);if(typeof originalSpeak==='function')return originalSpeak(text);try{if('speechSynthesis' in window){window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(text||''));u.lang='zh-TW';window.speechSynthesis.speak(u)}}catch(e){}};
function addButton(){if(document.getElementById('darkStarMyVoiceButton'))return;const top=document.querySelector('.topbar');if(!top)return;const btn=document.createElement('button');btn.id='darkStarMyVoiceButton';btn.type='button';btn.title='開：暗星回答自動用我的聲音。關：改回按喇叭播手機聲音';btn.style.cssText='margin-left:6px;border:1px solid #ddd;background:#fff;border-radius:9px;padding:7px 10px;font-size:12px;white-space:nowrap';btn.onclick=()=>{const next=!on();lsSet(KEY,next?'1':'0');paint();if(next&&!voiceId())toast('請先在左上抽屆存 Voice id');if(!next)stop()};const home=document.getElementById('homeButton')||document.querySelector('.brand-home');if(home)home.before(btn);else top.appendChild(btn);paint()}
function init(){addButton();addDrawerSettings();const inner=document.getElementById('messagesInner');if(inner)new MutationObserver(queueAuto).observe(inner,{childList:true,subtree:true,characterData:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

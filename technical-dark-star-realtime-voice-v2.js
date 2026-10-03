(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_REALTIME_VOICE_V16__)return;
window.__AIVAULT_DARK_STAR_REALTIME_VOICE_V16__=true;
const LIVE_VIDEO='technical-dark-star-live-video-test.html?mode=video&v=3';
const HOME='aivault-home.html';const VOICES=['Zephyr','Puck','Charon','Kore','Fenrir','Leda','Orus','Aoede','Callirrhoe','Autonoe','Enceladus','Iapetus','Umbriel','Algieba','Despina','Erinome','Algenib','Rasalgethi','Laomedeia','Achernar','Alnilam','Schedar','Gacrux','Pulcherrima','Achird','Zubenelgenubi','Vindemiatrix','Sadachbia','Sadaltager','Sulafat'];
function bindHomeBack(){const btn=document.getElementById('homeButton')||document.querySelector('.brand-home');if(btn){btn.setAttribute('href',HOME);if(!btn.dataset.homeBound){btn.dataset.homeBound='1';btn.textContent='🔙 返回 Home';btn.addEventListener('click',function(e){e.preventDefault();location.replace(HOME)})}}}
function hideDupVoice(){document.querySelectorAll('a,button').forEach(function(el){if(el.id==='darkStarLiveButton')return;if(String(el.textContent||'').replace(/\s+/g,'')==='即時語音')el.style.display='none'})}
function css(){if(document.getElementById('dsVoiceStyle'))return;const s=document.createElement('style');s.id='dsVoiceStyle';s.textContent='.dark-star-live-controls{display:flex;align-items:center;gap:4px}.dark-star-sound-button,.dark-star-live-button{height:30px;border:1px solid #dedede;border-radius:8px;background:#fff;font-size:11px;padding:0 7px}.dark-star-voice-select{position:absolute;top:34px;right:0;width:210px;height:32px;display:none;z-index:1001}.dark-star-live-controls.expanded .dark-star-voice-select{display:block}';document.head.appendChild(s)}
function ui(){css();bindHomeBack();hideDupVoice();if(document.getElementById('darkStarLiveControls'))return;const top=document.querySelector('.topbar');if(!top)return;const controls=document.createElement('div');controls.id='darkStarLiveControls';controls.className='dark-star-live-controls';const sound=document.createElement('button');sound.id='darkStarSoundButton';sound.type='button';sound.className='dark-star-sound-button';sound.textContent='聲音';let video=document.getElementById('darkStarLiveVideoButton');if(video){video.href=LIVE_VIDEO;video.removeAttribute('target');video.textContent='視訊'}else{video=document.createElement('a');video.id='darkStarLiveVideoButton';video.className='dark-star-live-button';video.textContent='視訊';video.href=LIVE_VIDEO}const select=document.createElement('select');select.id='darkStarVoiceSelect';select.className='dark-star-voice-select';VOICES.forEach(function(v){const o=document.createElement('option');o.value=v;o.textContent=v;select.appendChild(o)});select.value=localStorage.getItem('darkStarVoice')||'Kore';select.onchange=function(){try{localStorage.setItem('darkStarVoice',select.value)}catch(e){}};controls.style.position='relative';controls.append(sound,select);const home=document.querySelector('.brand-home');if(!document.getElementById('darkStarLiveVideoButton')){if(home)home.before(video);else top.append(video)}video.after(controls);sound.onclick=function(){controls.classList.toggle('expanded')};setInterval(function(){const v=document.getElementById('darkStarLiveVideoButton');if(v)v.textContent='視訊'},800)}
function loadMyVoice(){if(document.getElementById('dsMyVoiceScript'))return;const s=document.createElement('script');s.id='dsMyVoiceScript';s.src='technical-dark-star-my-voice.js?v=23';document.head.appendChild(s)}
function init(){ui();loadMyVoice();setInterval(hideDupVoice,800)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
(function(){
  if(window.__AIVAULT_DARK_DIRECT_WS__)return;
  window.__AIVAULT_DARK_DIRECT_WS__=true;
  var Native=window.WebSocket;
  function restore(){ if(window.WebSocket!==Native) window.WebSocket=Native; }
  restore();
  setInterval(restore,200);
})();
(function(){if(window.__AIVAULT_DAWN_OWN_AUDIO_LOADER__)return;window.__AIVAULT_DAWN_OWN_AUDIO_LOADER__=true;var s=document.createElement('script');s.src='artifacts/dawn-own-audio.js?v=6';document.body.appendChild(s);})();

(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_REALTIME_VOICE_V16__)return;
window.__AIVAULT_DARK_STAR_REALTIME_VOICE_V16__=true;
const LIVE_VIDEO='technical-dark-star-live-video-test.html?mode=video&v=3';
const HOME='aivault-home.html';
function rainbowLogo(){
  if(document.getElementById('dsRainbowLogoStyle'))return;
  const s=document.createElement('style');
  s.id='dsRainbowLogoStyle';
  s.textContent=
    '@keyframes aivaultLogoColorShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}'+
    '.brand-mark,.welcome-mark,.message.assistant .message-avatar,.message.ai .message-avatar,.message:not(.user) .message-avatar{'+
    'background:linear-gradient(135deg,#ff3b30,#ff9500,#ffcc00,#34c759,#0a84ff,#5856d6,#af52de,#ff2d55)!important;'+
    'background-size:300% 300%!important;color:#fff!important;text-shadow:0 1px 2px rgba(0,0,0,.28);'+
    'animation:aivaultLogoColorShift 6s ease-in-out infinite;font-weight:800}'+
    '.brand-mark{width:32px;height:32px;border-radius:9px;font-size:16px}'+
    '.welcome-mark{border-radius:16px}'+
    '.message.user .message-avatar{background:#e9e9e9!important;background-image:none!important;color:#444!important;animation:none!important;text-shadow:none;font-weight:600}';
  document.documentElement.appendChild(s);
}
function bindHomeBack(){const btn=document.getElementById('homeButton')||document.querySelector('.brand-home');if(btn){btn.setAttribute('href',HOME);if(!btn.dataset.homeBound){btn.dataset.homeBound='1';btn.textContent='🔙 返回 Home';btn.addEventListener('click',function(e){e.preventDefault();location.replace(HOME)})}}}
function hideDupVoice(){document.querySelectorAll('#darkStarLiveButton').forEach(function(el){el.style.display='none'});document.querySelectorAll('a,button').forEach(function(el){if(String(el.textContent||'').replace(/\s+/g,'')==='即時語音')el.style.display='none'})}
function css(){if(document.getElementById('dsVoiceStyle'))return;const s=document.createElement('style');s.id='dsVoiceStyle';s.textContent='#darkStarLiveButton{display:none!important}.dark-star-live-controls{display:flex;align-items:center;gap:4px}.dark-star-sound-button,.dark-star-live-button{height:30px;border:1px solid #dedede;border-radius:8px;background:#fff;font-size:11px;padding:0 7px}.dark-star-voice-select{position:absolute;top:34px;right:0;width:210px;height:32px;display:none;z-index:1001}.dark-star-live-controls.expanded .dark-star-voice-select{display:block}';document.head.appendChild(s)}
function ui(){css();rainbowLogo();bindHomeBack();hideDupVoice();if(document.getElementById('darkStarLiveControls'))return;const top=document.querySelector('.topbar');if(!top)return;const controls=document.createElement('div');controls.id='darkStarLiveControls';controls.className='dark-star-live-controls';const sound=document.createElement('button');sound.id='darkStarSoundButton';sound.type='button';sound.className='dark-star-sound-button';sound.textContent='聲音';let video=document.getElementById('darkStarLiveVideoButton');if(video){video.href=LIVE_VIDEO;video.removeAttribute('target');video.textContent='視訊'}else{video=document.createElement('a');video.id='darkStarLiveVideoButton';video.className='dark-star-live-button';video.textContent='視訊';video.href=LIVE_VIDEO}const select=document.createElement('select');select.id='darkStarVoiceSelect';select.className='dark-star-voice-select';['Kore','Puck','Charon','Leda'].forEach(function(v){const o=document.createElement('option');o.value=v;o.textContent=v;select.appendChild(o)});controls.append(sound,select);const home=document.querySelector('.brand-home');if(!document.getElementById('darkStarLiveVideoButton')){if(home)home.before(video);else top.append(video)}video.after(controls);sound.onclick=function(){controls.classList.toggle('expanded')};setInterval(function(){const v=document.getElementById('darkStarLiveVideoButton');if(v)v.textContent='視訊'},800)}
function loadMyVoice(){if(document.getElementById('dsMyVoiceScript'))return;const s=document.createElement('script');s.id='dsMyVoiceScript';s.src='technical-dark-star-my-voice.js?v=23';document.head.appendChild(s)}
function bindComposerBridge(){
  const input=document.getElementById('composerInput');
  const send=document.getElementById('sendButton');
  if(!input||!send)return;

  const sync=()=>{
    send.disabled=!String(input.value||'').trim();
  };

  input.addEventListener('input',sync,{passive:true});

  if(!send.dataset.darkStarComposerBridge){
    send.dataset.darkStarComposerBridge='1';
    send.addEventListener('click',function(){
      if(typeof window.sendMessage==='function'){
        window.sendMessage();
      }
    });
  }

  sync();
}

function init(){ui();bindComposerBridge();loadMyVoice();setInterval(function(){hideDupVoice();bindComposerBridge()},800)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

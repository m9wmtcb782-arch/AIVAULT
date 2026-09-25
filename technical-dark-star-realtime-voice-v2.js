(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_REALTIME_VOICE_V16__)return;
window.__AIVAULT_DARK_STAR_REALTIME_VOICE_V16__=true;
const LIVE_VIDEO='technical-dark-star-live-video-test.html?mode=video&v=3';
const LIVE_VOICE='technical-dark-star-live-video-test.html?mode=voice&v=3';
const HOME='aivault-home.html';
const VOICES=[['Kore','Kore'],['Puck','Puck'],['Charon','Charon'],['Leda','Leda'],['Gacrux','Gacrux'],['Aoede','Aoede'],['Orus','Orus'],['Zephyr','Zephyr'],['Fenrir','Fenrir'],['Achird','Achird']];
const state={expanded:false,voice:'Kore'};
function bindHomeBack(){const btn=document.getElementById('homeButton')||document.querySelector('.brand-home');if(btn){btn.setAttribute('href',HOME);if(!btn.dataset.homeBound){btn.dataset.homeBound='1';btn.textContent='🔙 返回 Home';btn.addEventListener('click',function(e){e.preventDefault();location.replace(HOME)})}}}
function css(){if(document.getElementById('dsVoiceStyle'))return;const s=document.createElement('style');s.id='dsVoiceStyle';s.textContent='.dark-star-live-controls{display:flex;align-items:center;gap:4px}.dark-star-sound-button,.dark-star-live-button{height:30px;border:1px solid #dedede;border-radius:8px;background:#fff;color:#222;font-size:11px;padding:0 7px}.dark-star-voice-select{position:absolute;top:34px;right:0;width:210px;height:32px;display:none;z-index:1001}.dark-star-live-controls.expanded .dark-star-voice-select{display:block}';document.head.appendChild(s)}
function ui(){
  css();bindHomeBack();
  if(document.getElementById('darkStarLiveControls'))return;
  const top=document.querySelector('.topbar');if(!top)return;
  const controls=document.createElement('div');controls.id='darkStarLiveControls';controls.className='dark-star-live-controls';
  const sound=document.createElement('button');sound.id='darkStarSoundButton';sound.type='button';sound.className='dark-star-sound-button';sound.textContent='聲音';
  let video=document.getElementById('darkStarLiveVideoButton');
  if(video){video.href=LIVE_VIDEO;video.removeAttribute('target');video.textContent='即時視訊'}
  else{video=document.createElement('a');video.id='darkStarLiveVideoButton';video.className='dark-star-live-button';video.textContent='即時視訊';video.href=LIVE_VIDEO}
  const live=document.createElement('button');live.id='darkStarLiveButton';live.type='button';live.className='dark-star-live-button';live.textContent='即時語音';
  const select=document.createElement('select');select.id='darkStarVoiceSelect';select.className='dark-star-voice-select';VOICES.forEach(function(pair){const o=document.createElement('option');o.value=pair[0];o.textContent=pair[1];select.appendChild(o)});
  controls.append(sound,select);
  const home=document.querySelector('.brand-home');
  if(!document.getElementById('darkStarLiveVideoButton')){if(home)home.before(video);else top.append(video)}
  if(video.nextElementSibling!==live)video.after(live);
  live.after(controls);
  sound.onclick=function(){state.expanded=!state.expanded;controls.classList.toggle('expanded',state.expanded)};
  live.onclick=function(){location.href=LIVE_VOICE};
}
function loadMyVoice(){if(document.getElementById('dsMyVoiceScript'))return;const s=document.createElement('script');s.id='dsMyVoiceScript';s.src='technical-dark-star-my-voice.js?v=18';document.head.appendChild(s)}
function init(){ui();loadMyVoice()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

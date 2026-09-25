(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_REALTIME_VOICE_V16__)return;
window.__AIVAULT_DARK_STAR_REALTIME_VOICE_V16__=true;
const LIVE_VIDEO='technical-dark-star-live-video-test.html?mode=video&v=3';
const LIVE_VOICE='technical-dark-star-live-video-test.html?mode=voice&v=3';
const HOME='aivault-home.html';
function bindHomeBack(){const btn=document.getElementById('homeButton')||document.querySelector('.brand-home');if(btn){btn.setAttribute('href',HOME);if(!btn.dataset.homeBound){btn.dataset.homeBound='1';btn.textContent='🔙 返回 Home';btn.addEventListener('click',function(e){e.preventDefault();location.replace(HOME)})}}}
function loadMyVoice(){if(document.getElementById('dsMyVoiceScript'))return;const s=document.createElement('script');s.id='dsMyVoiceScript';s.src='technical-dark-star-my-voice.js?v=18';document.head.appendChild(s)}
function init(){bindHomeBack();loadMyVoice()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

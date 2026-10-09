(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_RESTORE_LIVE_CONTROLS__)return;
window.__AIVAULT_DARK_STAR_RESTORE_LIVE_CONTROLS__=true;
function paint(on){
  const b=document.getElementById('darkStarLiveButton');
  if(!b)return;
  b.textContent=on?'暗星即時 ✓':'暗星即時';
  b.classList.toggle('active',!!on);
  b.setAttribute('aria-pressed',String(!!on));
}
function stopSpeech(){
  window.__AIVAULT_SPEECH_AUTO_RESTART__=false;
  if(typeof window.__AIVAULT_STOP_DARK_STAR_SPEECH__==='function')window.__AIVAULT_STOP_DARK_STAR_SPEECH__();
  const mic=document.getElementById('micButton');
  if(mic&&mic.classList.contains('recording')){try{mic.click()}catch(e){}}
}
function bind(){
  const live=document.getElementById('darkStarLiveButton');
  if(!live||live.dataset.checkBound)return false;
  live.dataset.checkBound='1';
  if(live.textContent.indexOf('即時語音')>=0)live.textContent='暗星即時';
  live.addEventListener('click',function(e){
    e.preventDefault();e.stopPropagation();
    const on=live.textContent.indexOf('✓')<0;
    paint(on);
    window.__AIVAULT_LIVE_VOICE_WANTED__=on;
    if(on)stopSpeech();
    const dual=window.AivaultDualAgentLive;
    if(dual&&typeof dual.arm==='function')dual.arm('dark',on);
    else if(typeof window.__AIVAULT_DARK_STAR_TOGGLE_LIVE_VOICE__==='function')window.__AIVAULT_DARK_STAR_TOGGLE_LIVE_VOICE__();
  },true);
  return true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
setInterval(bind,300);
setInterval(function(){
  const b=document.getElementById('darkStarLiveButton');
  if(b&&String(b.textContent).indexOf('即時語音')>=0)b.textContent=b.textContent.replace('即時語音','暗星即時');
},200);
})();

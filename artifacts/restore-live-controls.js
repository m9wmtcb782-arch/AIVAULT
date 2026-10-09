(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_RESTORE_LIVE_CONTROLS__)return;
window.__AIVAULT_DARK_STAR_RESTORE_LIVE_CONTROLS__=true;
function stopSpeech(){
  window.__AIVAULT_SPEECH_AUTO_RESTART__=false;
  if(typeof window.__AIVAULT_STOP_DARK_STAR_SPEECH__==='function')window.__AIVAULT_STOP_DARK_STAR_SPEECH__();
  const mic=document.getElementById('micButton');
  if(mic&&mic.classList.contains('recording')){try{mic.click()}catch(e){}}
}
function ensureDawn(){
  const live=document.getElementById('darkStarLiveButton');
  const bottom=live&&live.parentElement;
  if(!live||!bottom)return;
  let dawn=document.getElementById('dawnLightLiveButton');
  if(!dawn){
    dawn=document.createElement('button');
    dawn.id='dawnLightLiveButton';
    dawn.type='button';
    dawn.className='drawer-item';
    dawn.textContent='曙光即時';
  }
  if(dawn.parentElement!==bottom)bottom.insertBefore(dawn,live.nextSibling);
  if(dawn.dataset.checkBound)return;
  dawn.dataset.checkBound='1';
  dawn.addEventListener('click',function(e){
    e.preventDefault();e.stopPropagation();
    const on=dawn.textContent.indexOf('✓')<0;
    dawn.textContent=on?'曙光即時 ✓':'曙光即時';
    dawn.classList.toggle('active',on);
    dawn.setAttribute('aria-pressed',String(on));
    if(on)stopSpeech();
    const dual=window.AivaultDualAgentLive;
    if(dual&&typeof dual.arm==='function')dual.arm('dawn',on);
  },true);
}
function bind(){
  const live=document.getElementById('darkStarLiveButton');
  if(!live)return false;
  if(live.textContent.indexOf('即時語音')>=0)live.textContent=live.textContent.replace('即時語音','暗星即時');
  if(!live.dataset.checkBound){
    live.dataset.checkBound='1';
    live.addEventListener('click',function(e){
      e.preventDefault();e.stopPropagation();
      const on=live.textContent.indexOf('✓')<0;
      live.textContent=on?'暗星即時 ✓':'暗星即時';
      live.classList.toggle('active',on);
      live.setAttribute('aria-pressed',String(on));
      window.__AIVAULT_LIVE_VOICE_WANTED__=on;
      if(on)stopSpeech();
      const dual=window.AivaultDualAgentLive;
      if(dual&&typeof dual.arm==='function')dual.arm('dark',on);
      else if(typeof window.__AIVAULT_DARK_STAR_TOGGLE_LIVE_VOICE__==='function')window.__AIVAULT_DARK_STAR_TOGGLE_LIVE_VOICE__();
    },true);
  }
  ensureDawn();
  return true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
setInterval(bind,300);
})();

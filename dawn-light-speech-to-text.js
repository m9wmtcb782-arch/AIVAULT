(()=>{
'use strict';
if(window.__DAWN_LIGHT_STT__)return;
window.__DAWN_LIGHT_STT__=true;
const SVG='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path></svg>';
let rec=null, on=false, last='', timer=0, sent='';
function show(text){const input=document.getElementById('composerInput');if(!input)return;input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));}
async function sendLive(text){
  text=String(text||'').trim();
  if(!text||text===sent)return;
  show(text);
  const live=window.DawnLightLiveVoice;
  if(live){
    if(window.AivaultDualAgentLive&&window.AivaultDualAgentLive.arm)window.AivaultDualAgentLive.arm('dawn',true);
    if(typeof live.start==='function')await live.start();
    for(let i=0;i<20;i++){
      if(typeof live.sendText==='function'&&live.sendText(text,'user','dawn-light')){sent=text;show('');return;}
      await new Promise(r=>setTimeout(r,300));
    }
  }
}
function icon(){const hostBtn=document.getElementById('dawnLightLiveButton');if(!hostBtn)return null;let btn=document.getElementById('dawnLightMicIcon');if(!btn){btn=document.createElement('button');btn.id='dawnLightMicIcon';btn.type='button';btn.className='composer-mic';btn.innerHTML=SVG;btn.style.cssText='width:38px;height:38px;border:1px solid #dedede;border-radius:50%;background:#fff;color:#222;display:inline-flex;align-items:center;justify-content:center;margin-left:8px';hostBtn.insertAdjacentElement('afterend',btn);}return btn;}
function stop(){on=false;clearTimeout(timer);if(rec){try{rec.stop()}catch(e){}}const btn=document.getElementById('dawnLightMicIcon');if(btn)btn.classList.remove('recording');sendLive(last);}
function start(btn){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return;rec=new SR();rec.lang='zh-TW';rec.continuous=true;rec.interimResults=true;rec.onresult=e=>{let t='';let final=false;for(let i=0;i<e.results.length;i++){t+=e.results[i][0].transcript;if(e.results[i].isFinal)final=true;}last=t.trim();show(last);clearTimeout(timer);if(final)timer=setTimeout(()=>sendLive(last),700);};rec.onend=()=>{if(on)try{rec.start()}catch(e){}};on=true;btn.classList.add('recording');rec.start();}
function bind(){const btn=icon();if(!btn||btn.dataset.own)return;btn.dataset.own='1';btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(on)stop();else start(btn);});}
setInterval(bind,400);
})();

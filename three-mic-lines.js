(()=>{
'use strict';
if(window.__AIVAULT_THREE_MIC_ICONS__)return;
window.__AIVAULT_THREE_MIC_ICONS__=true;
const SVG='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path></svg>';
const owners={};
function iconFor(id,label){
  let btn=document.getElementById(id+'MicIcon');
  const host=document.getElementById(id);
  if(!btn){
    btn=document.createElement('button');
    btn.id=id+'MicIcon';
    btn.type='button';
    btn.className='composer-mic';
    btn.setAttribute('aria-label',label+'麥克風');
    btn.innerHTML=SVG;
    btn.style.cssText='width:38px;height:38px;border:1px solid #dedede;border-radius:50%;background:#fff;color:#222;display:inline-flex;align-items:center;justify-content:center;margin-left:8px';
    if(host)host.insertAdjacentElement('afterend',btn);
  }
  const line=document.getElementById(id+'Line');
  if(line)line.remove();
  return btn;
}
async function toggle(id,btn){
  const own=owners[id]||(owners[id]={on:false,stream:null});
  if(own.on){
    own.on=false;
    if(own.stream)own.stream.getTracks().forEach(t=>t.stop());
    own.stream=null;
    btn.classList.remove('recording');
    btn.setAttribute('aria-pressed','false');
    return;
  }
  own.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
  own.on=true;
  btn.classList.add('recording');
  btn.setAttribute('aria-pressed','true');
}
function bind(id,label){
  const host=document.getElementById(id);
  if(!host)return;
  const btn=iconFor(id,label);
  if(btn.dataset.bound)return;
  btn.dataset.bound='1';
  btn.addEventListener('click',function(e){
    e.preventDefault();e.stopPropagation();
    toggle(id,btn).catch(err=>console.warn('[mic-icon]',id,err));
  });
}
function scan(){
  bind('darkStarMyVoiceButton','我的聲音');
  bind('darkStarLiveButton','暗星即時');
  bind('dawnLightLiveButton','曙光即時');
}
scan();
setInterval(scan,400);
})();

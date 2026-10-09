(()=>{
'use strict';
if(window.__DARK_STAR_LIVE_STT__)return;
window.__DARK_STAR_LIVE_STT__=true;
const SVG='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path></svg>';
let rec=null, on=false;
function write(text){
  const host=document.getElementById('messagesInner')||document.getElementById('messages');
  if(!host)return;
  let row=document.getElementById('darkStarLiveText');
  if(!row){row=document.createElement('div');row.id='darkStarLiveText';row.className='message user';const body=document.createElement('div');body.className='message-text';row.appendChild(body);host.appendChild(row);}
  row.querySelector('.message-text').textContent='暗星即時：'+text;
  host.scrollTop=host.scrollHeight;
}
function icon(){
  const hostBtn=document.getElementById('darkStarLiveButton');
  if(!hostBtn)return null;
  let btn=document.getElementById('darkStarLiveMicIcon');
  if(!btn){btn=document.createElement('button');btn.id='darkStarLiveMicIcon';btn.type='button';btn.className='composer-mic';btn.innerHTML=SVG;btn.style.cssText='width:38px;height:38px;border:1px solid #dedede;border-radius:50%;background:#fff;color:#222;display:inline-flex;align-items:center;justify-content:center;margin-left:8px';hostBtn.insertAdjacentElement('afterend',btn);}
  return btn;
}
function stop(){on=false;if(rec){try{rec.stop()}catch(e){}}const btn=document.getElementById('darkStarLiveMicIcon');if(btn)btn.classList.remove('recording');}
function start(btn){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){write('此瀏覽器沒有語音轉文字');return;}
  rec=new SR();
  rec.lang=localStorage.getItem('darkStarLiveLanguage')||'zh-TW';
  rec.continuous=true;rec.interimResults=true;
  rec.onresult=e=>{let t='';for(let i=0;i<e.results.length;i++)t+=e.results[i][0].transcript;write(t);};
  rec.onend=()=>{if(on)try{rec.start()}catch(e){}};
  on=true;btn.classList.add('recording');
  rec.start();
}
function bind(){
  const btn=icon();if(!btn||btn.dataset.own)return;
  btn.dataset.own='1';
  btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(on)stop();else start(btn);});
}
setInterval(bind,400);
})();

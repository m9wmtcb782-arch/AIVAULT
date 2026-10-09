(()=>{
'use strict';
if(window.__DAWN_LIGHT_STT__)return;
window.__DAWN_LIGHT_STT__=true;
const SVG='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path></svg>';
const GATEWAY='https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/ai-gateway';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE';
let rec=null, on=false, last='';
function host(){return document.getElementById('messagesInner')||document.querySelector('.messages-inner')||document.getElementById('messages');}
function write(id, who, text){
  const box=host(); if(!box) return;
  let row=document.getElementById(id);
  if(!row){row=document.createElement('div');row.id=id;row.className='message '+(who==='曙光'?'assistant':'user');const body=document.createElement('div');body.className='message-text';row.appendChild(body);box.appendChild(row);}
  row.querySelector('.message-text').textContent=who+'：'+text;
  box.scrollTop=box.scrollHeight;
}
async function ask(text){
  write('dawnLightReply','曙光','Gemini 3.1 回覆中……');
  const res=await fetch(GATEWAY,{method:'POST',headers:{'Content-Type':'application/json',apikey:ANON,Authorization:'Bearer '+ANON},body:JSON.stringify({agent_id:'dawn-light',model:'gemini-3.1-flash',messages:[{role:'user',content:text}]})});
  const data=await res.json().catch(()=>({}));
  const reply=data.content||data.text||data.message||data.error||('沒有回覆 '+res.status);
  write('dawnLightReply','曙光',String(reply));
}
function icon(){
  const hostBtn=document.getElementById('dawnLightLiveButton'); if(!hostBtn) return null;
  let btn=document.getElementById('dawnLightMicIcon');
  if(!btn){btn=document.createElement('button');btn.id='dawnLightMicIcon';btn.type='button';btn.className='composer-mic';btn.innerHTML=SVG;btn.style.cssText='width:38px;height:38px;border:1px solid #dedede;border-radius:50%;background:#fff;color:#222;display:inline-flex;align-items:center;justify-content:center;margin-left:8px';hostBtn.insertAdjacentElement('afterend',btn);}
  return btn;
}
function stop(){on=false;if(rec){try{rec.stop()}catch(e){}}const btn=document.getElementById('dawnLightMicIcon');if(btn)btn.classList.remove('recording');if(last)ask(last).catch(err=>write('dawnLightReply','曙光',String(err.message||err)));}
function start(btn){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){write('dawnLightText','你','此瀏覽器沒有語音轉文字');return;}
  rec=new SR();rec.lang='zh-TW';rec.continuous=true;rec.interimResults=true;
  rec.onresult=e=>{let t='';for(let i=0;i<e.results.length;i++)t+=e.results[i][0].transcript;last=t;write('dawnLightText','你',t);};
  rec.onend=()=>{if(on)try{rec.start()}catch(e){}};
  on=true;btn.classList.add('recording');rec.start();
}
function bind(){const btn=icon();if(!btn||btn.dataset.own)return;btn.dataset.own='1';btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(on)stop();else start(btn);});}
setInterval(bind,400);
})();

/* This page typed text -> live voice Dark Star. Blocks Gateway send while live is connected. */
(()=>{
'use strict';
if(window.__AIVAULT_DS_PAGE_TEXT_TO_LIVE_V2__)return;
window.__AIVAULT_DS_PAGE_TEXT_TO_LIVE_V2__=true;
function isLiveUrl(u){
  u=String(u||'');
  return /live-voice|voice-sdk-relay|voice-session|generativelanguage.googleapis.com/i.test(u);
}
function liveOpen(){
  const list=window.__AIVAULT_LIVE_SOCKETS__||[];
  for(let i=list.length-1;i>=0;i--){
    const ws=list[i];
    if(ws&&ws.readyState===1)return ws;
  }
  return null;
}
function sendLive(text,complete){
  text=String(text||'').trim();
  const ws=liveOpen();
  if(!text||!ws)return false;
  try{
    ws.send(JSON.stringify({type:'text',text,source:'dark-star-page'}));
    ws.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text}]}],turnComplete:complete!==false}}));
    ws.send(JSON.stringify({realtimeInput:{text}}));
    return true;
  }catch(e){
    console.warn('[DarkStar] live text send failed',e);
    return false;
  }
}
const Native=window.WebSocket;
if(Native&&!Native.__AIVAULT_WRAP_V2__){
  function Wrapped(url,protocols){
    const ws=protocols!==undefined?new Native(url,protocols):new Native(url);
    try{
      if(isLiveUrl(url)){
        window.__AIVAULT_LIVE_SOCKETS__=window.__AIVAULT_LIVE_SOCKETS__||[];
        window.__AIVAULT_LIVE_SOCKETS__.push(ws);
        ws.addEventListener('open',()=>{
          const input=document.getElementById('composerInput');
          const draft=input&&input.value&&input.value.trim();
          if(draft)sendLive('【這一頁輸入框】'+draft,true);
        });
      }
    }catch(e){}
    return ws;
  }
  Wrapped.prototype=Native.prototype;
  try{Object.keys(Native).forEach(k=>{Wrapped[k]=Native[k]})}catch(e){}
  Wrapped.__AIVAULT_WRAP_V2__=true;
  window.WebSocket=Wrapped;
}
function intercept(e){
  const input=document.getElementById('composerInput')||document.querySelector('.composer-input');
  const text=input?String(input.value||'').trim():'';
  if(!liveOpen()||!text)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  sendLive(text,true);
  if(input){
    input.value='';
    try{input.dispatchEvent(new Event('input',{bubbles:true}))}catch(err){}
  }
}
function bind(){
  const input=document.getElementById('composerInput')||document.querySelector('.composer-input');
  const send=document.getElementById('sendButton')||document.querySelector('.composer-send');
  if(!input||input.dataset.dsPageTextV2==='1')return;
  input.dataset.dsPageTextV2='1';
  let timer=null;
  input.addEventListener('input',()=>{
    if(!liveOpen())return;
    const text=input.value.trim();
    if(!text)return;
    clearTimeout(timer);
    timer=setTimeout(()=>sendLive('【這一頁輸入框】'+text,false),350);
  });
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey)intercept(e);
  },true);
  if(send)send.addEventListener('click',intercept,true);
}
function boot(){bind();let n=0;const t=setInterval(()=>{bind();if(++n>40)clearInterval(t)},250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

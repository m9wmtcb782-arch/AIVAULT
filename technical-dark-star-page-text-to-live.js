/* Forwards composer typed text into the live voice socket on this page only. */
(()=>{
'use strict';
if(window.__AIVAULT_DS_PAGE_TEXT_TO_LIVE__)return;
window.__AIVAULT_DS_PAGE_TEXT_TO_LIVE__=true;
function sendAll(ws,text,complete){
  text=String(text||'').trim();
  if(!text||!ws||ws.readyState!==1)return;
  try{
    ws.send(JSON.stringify({type:'text',text}));
    ws.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text}]}],turnComplete:!!complete}}));
    ws.send(JSON.stringify({realtimeInput:{text}}));
  }catch(e){}
}
function findWs(){
  const nodes=[window];
  try{if(window.parent&&window.parent!==window)nodes.push(window.parent)}catch(e){}
  for(const w of nodes){
    const list=w.__AIVAULT_LIVE_SOCKETS__;
    if(Array.isArray(list)){
      for(let i=list.length-1;i>=0;i--) if(list[i]&&list[i].readyState===1) return list[i];
    }
  }
  return null;
}
const Native=window.WebSocket;
if(Native&&!Native.__AIVAULT_WRAP__){
  function Wrapped(url,protocols){
    const ws=protocols!==undefined?new Native(url,protocols):new Native(url);
    try{
      window.__AIVAULT_LIVE_SOCKETS__=window.__AIVAULT_LIVE_SOCKETS__||[];
      window.__AIVAULT_LIVE_SOCKETS__.push(ws);
    }catch(e){}
    return ws;
  }
  Wrapped.prototype=Native.prototype;
  Object.keys(Native).forEach(k=>{try{Wrapped[k]=Native[k]}catch(e){}});
  Wrapped.__AIVAULT_WRAP__=true;
  window.WebSocket=Wrapped;
}
function bind(){
  const input=document.getElementById('composerInput')||document.querySelector('.composer-input');
  const send=document.getElementById('sendButton')||document.querySelector('.composer-send');
  if(!input||input.dataset.dsPageText==='1')return;
  input.dataset.dsPageText='1';
  let timer=null;
  input.addEventListener('input',()=>{
    const text=input.value.trim();
    if(!text)return;
    clearTimeout(timer);
    timer=setTimeout(()=>sendAll(findWs(),'【這一頁輸入框】'+text,false),400);
  });
  if(send){
    send.addEventListener('click',()=>{
      const text=input.value.trim();
      if(text)sendAll(findWs(),text,true);
    },true);
  }
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey){
      const text=input.value.trim();
      if(text)sendAll(findWs(),text,true);
    }
  },true);
}
function boot(){bind();let n=0;const t=setInterval(()=>{bind();if(++n>40)clearInterval(t)},250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

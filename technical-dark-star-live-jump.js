(()=>{
'use strict';
if(window.__AIVAULT_DS_LIVE_JUMP__)return;
window.__AIVAULT_DS_LIVE_JUMP__=true;
const LIVE='technical-dark-star-live-video-test.html';
const TURNS_KEY='aivault_ds_live_turns';
const SEEN_KEY='aivault_ds_live_seen';
const DRAFT_KEY='aivault_ds_live_draft';
function goLive(mode){
  const voiceEl=document.getElementById('darkStarVoiceSelect');
  const input=document.getElementById('composerInput');
  const voice=(voiceEl&&voiceEl.value)||localStorage.getItem('darkStarVoice')||localStorage.getItem('ds_live_voice')||'Kore';
  const draft=input&&typeof input.value==='string'?input.value:'';const topicId=localStorage.getItem('technical-dark-star-topic-id')||'';const conversationId=localStorage.getItem('technical_dark_star_conversation_id')||'';
  try{localStorage.setItem(DRAFT_KEY,draft);localStorage.setItem('darkStarVoice',voice)}catch(e){}
  location.href=LIVE+'?mode='+(mode==='video'?'video':'voice')+'&voice='+encodeURIComponent(voice)+'&topic_id='+encodeURIComponent(topicId)+'&conversation_id='+encodeURIComponent(conversationId)+'&v=4';
}
function hijack(el,mode){
  if(!el||el.dataset.dsJump==='1')return;
  el.dataset.dsJump='1';
  el.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();goLive(mode)},true);
}
function bindJumps(){
  hijack(document.getElementById('darkStarLiveButton'),'voice');
  hijack(document.getElementById('dsFixLive'),'voice');
  // The bottom composer microphone is normal zh-TW SpeechRecognition input.
  // Do not hijack it to the live page; live voice uses the top 「即時語音」 control.
  const video=document.getElementById('darkStarLiveVideoButton');
  if(video){
    video.href=LIVE+'?mode=video&v=3';
    video.removeAttribute('target');
    hijack(video,'video');
  }
  const fav=document.getElementById('darkStarFavoriteVideo');
  if(fav){
    fav.href=LIVE+'?mode=video&v=3';
    fav.removeAttribute('target');
  }
}
function addBubble(role,text){
  const inner=document.getElementById('messagesInner');
  if(!inner||!text)return;
  const welcome=document.getElementById('welcome');
  if(welcome)welcome.remove();
  const row=document.createElement('div');
  row.className='message '+(role==='user'?'user':'assistant');
  const avatar=document.createElement('div');
  avatar.className='message-avatar';
  avatar.textContent=role==='user'?'你':'暗';
  const body=document.createElement('div');
  body.className='message-body';
  const t=document.createElement('div');
  t.className='message-text';
  t.textContent=text;
  body.appendChild(t);row.appendChild(avatar);row.appendChild(body);inner.appendChild(row);
  const messages=document.getElementById('messages');
  if(messages)messages.scrollTop=messages.scrollHeight;
  try{
    if(typeof messagesHistory!=='undefined'&&Array.isArray(messagesHistory)){
      messagesHistory.push({role:role==='user'?'user':'assistant',text:text});
      localStorage.setItem('technical_dark_star_messages',JSON.stringify(messagesHistory.slice(-80)));
    }
  }catch(e){}
}
function ingest(){
  let turns=[],seen=[];
  try{turns=JSON.parse(localStorage.getItem(TURNS_KEY)||'[]')}catch(e){turns=[]}
  try{seen=JSON.parse(localStorage.getItem(SEEN_KEY)||'[]')}catch(e){seen=[]}
  const set=new Set(seen);
  turns.forEach(item=>{
    if(!item||!item.id||set.has(item.id))return;
    const text=String(item.text||'').trim();
    if(!text)return;
    set.add(item.id);
    addBubble(item.role==='user'?'user':'assistant',text);
  });
  try{localStorage.setItem(SEEN_KEY,JSON.stringify([...set].slice(-200)))}catch(e){}
}
function listen(){
  ingest();
  window.addEventListener('storage',e=>{if(e.key===TURNS_KEY)ingest()});
  try{
    const bc=new BroadcastChannel('aivault-dark-star-live');
    bc.onmessage=ev=>{
      const m=ev.data||{};
      if(m.type==='turn'&&m.id) ingest();
    };
  }catch(e){}
}
function boot(){
  bindJumps();listen();
  let n=0;const t=setInterval(()=>{bindJumps();if(++n>40)clearInterval(t)},250);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

(()=>{
'use strict';
if(window.__AIVAULT_THREE_MIC_LINES__)return;
window.__AIVAULT_THREE_MIC_LINES__=true;
const owners={};
function lineFor(id){
  let canvas=document.getElementById(id+'Line');
  if(!canvas){
    canvas=document.createElement('canvas');
    canvas.id=id+'Line';
    canvas.width=180;canvas.height=18;
    canvas.style.cssText='display:block;width:140px;height:14px;margin:4px 0 8px;background:#f4f4f4;border-radius:7px';
    const btn=document.getElementById(id);
    if(btn&&btn.parentElement)btn.insertAdjacentElement('afterend',canvas);
  }
  return canvas;
}
function draw(id,level){
  const canvas=lineFor(id);if(!canvas)return;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#e8e8e8';ctx.fillRect(0,7,canvas.width,4);
  ctx.fillStyle=level>0.02?'#111':'#bbb';
  ctx.fillRect(0,7,Math.max(4,Math.min(canvas.width,level*canvas.width*8)),4);
}
async function toggle(id){
  const own=owners[id]||(owners[id]={on:false,stream:null,ctx:null,raf:0});
  const btn=document.getElementById(id);
  if(own.on){
    own.on=false;
    if(own.raf)cancelAnimationFrame(own.raf);
    if(own.stream)own.stream.getTracks().forEach(t=>t.stop());
    own.stream=null;
    if(own.ctx)own.ctx.close();
    own.ctx=null;
    draw(id,0);
    if(btn)btn.classList.remove('active');
    return;
  }
  const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
  const AC=window.AudioContext||window.webkitAudioContext;
  const ctx=new AC();
  if(ctx.state==='suspended')await ctx.resume();
  const src=ctx.createMediaStreamSource(stream);
  const analyser=ctx.createAnalyser();
  analyser.fftSize=512;
  const sink=ctx.createGain();sink.gain.value=0;
  src.connect(analyser);analyser.connect(sink);sink.connect(ctx.destination);
  own.on=true;own.stream=stream;own.ctx=ctx;
  if(btn)btn.classList.add('active');
  const data=new Uint8Array(analyser.fftSize);
  const tick=()=>{
    if(!own.on)return;
    analyser.getByteTimeDomainData(data);
    let sum=0;for(let i=0;i<data.length;i++){const v=(data[i]-128)/128;sum+=v*v;}
    draw(id,Math.sqrt(sum/data.length));
    own.raf=requestAnimationFrame(tick);
  };
  tick();
}
function bind(id){
  const btn=document.getElementById(id);
  if(!btn||btn.dataset.micLineBound)return;
  btn.dataset.micLineBound='1';
  lineFor(id);
  btn.addEventListener('click',function(e){
    e.preventDefault();e.stopPropagation();
    toggle(id).catch(err=>console.warn('[mic-line]',id,err));
  },true);
}
function scan(){
  bind('darkStarMyVoiceButton');
  bind('darkStarLiveButton');
  bind('dawnLightLiveButton');
}
scan();
setInterval(scan,400);
})();

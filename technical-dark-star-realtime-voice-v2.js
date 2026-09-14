(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_REALTIME_VOICE_V3__) return;
window.__AIVAULT_DARK_STAR_REALTIME_VOICE_V3__=true;

const RELAY='wss://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-live-voice';
const SESSION='https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-voice-session';
const VOICES=[
 ['Kore','Kore'],['Puck','Puck'],['Charon','Charon'],['Leda','Leda'],['Gacrux','Gacrux'],
 ['Aoede','Aoede'],['Orus','Orus'],['Zephyr','Zephyr'],['Fenrir','Fenrir'],['Achird','Achird'],
 ['Sadachbia','Sadachbia'],['Algieba','Algieba'],['Algenib','Algenib'],['Achernar','Achernar'],['Zubenelgenubi','Zubenelgenubi'],
 ['Sadaltager','Sadaltager'],['Enceladus','Enceladus'],['Laomedeia','Laomedeia'],['Schedar','Schedar'],['Umbriel','Umbriel'],
 ['Autonoe','Autonoe'],['Erinome','Erinome'],['Callirrhoe','Callirrhoe'],['Iapetus','Iapetus'],['Despina','Despina'],
 ['Rasalgethi','Rasalgethi'],['Alnilam','Alnilam'],['Pulcherrima','Pulcherrima'],['Vindemiatrix','Vindemiatrix'],['Sulafat','Sulafat']
];
const state={active:false,starting:false,ws:null,stream:null,ctx:null,source:null,processor:null,sink:null,nextAudioTime:0,sessionId:null,sequence:0,voice:'Kore'};

function css(){
 const s=document.createElement('style');
 s.textContent=`
 .dark-star-live-controls{margin-left:auto;display:flex;align-items:center;gap:7px;min-width:0}
 .dark-star-voice-select{height:34px;max-width:128px;border:1px solid #e2e2e2;border-radius:9px;background:#fff;color:#333;padding:0 8px;font-size:12px;outline:none}
 .dark-star-live-button{height:34px;border:1px solid #dedede;border-radius:9px;background:#fff;color:#222;padding:0 11px;font-size:12px;display:flex;align-items:center;gap:6px;white-space:nowrap}
 .dark-star-live-button:hover{background:#f5f5f5}
 .dark-star-live-button.active{background:#171717;color:#fff;border-color:#171717}
 .dark-star-live-status{position:fixed;top:66px;right:14px;z-index:1000;background:#fff;border:1px solid #e5e5e5;border-radius:10px;padding:7px 10px;font-size:12px;color:#555;box-shadow:0 4px 18px rgba(0,0,0,.10);display:none}
 .dark-star-live-status.show{display:block}
 .composer-mic{display:none!important}
 .brand-home{font-size:0!important;width:36px;height:36px;padding:0!important;display:flex;align-items:center;justify-content:center}
 .brand-home::before{content:'‹';font-size:28px;line-height:1;font-weight:300;color:#333}
 @media(max-width:520px){.dark-star-voice-select{max-width:104px}.dark-star-live-button{padding:0 9px}.dark-star-live-button span.label{display:none}.dark-star-live-controls{gap:5px}.brand-home{width:34px;height:34px}}
 `;
 document.head.appendChild(s);
}
function ui(){
 if(document.getElementById('darkStarLiveControls'))return;
 css();
 const top=document.querySelector('.topbar');
 if(!top)return;
 const controls=document.createElement('div');controls.id='darkStarLiveControls';controls.className='dark-star-live-controls';
 const select=document.createElement('select');select.id='darkStarVoiceSelect';select.className='dark-star-voice-select';select.title='選擇即時語音';
 VOICES.forEach(([value,label],i)=>{const o=document.createElement('option');o.value=value;o.textContent=`${i+1}. ${label}`;select.appendChild(o)});
 select.value=state.voice;
 const button=document.createElement('button');button.id='darkStarLiveButton';button.type='button';button.className='dark-star-live-button';button.innerHTML='<span class="icon">🎙</span><span class="label">即時語音</span>';
 const status=document.createElement('div');status.id='darkStarLiveStatus';status.className='dark-star-live-status';
 controls.appendChild(select);controls.appendChild(button);top.appendChild(controls);document.body.appendChild(status);
 const home=document.querySelector('.brand-home');
 if(home){home.textContent='';home.title='回上一頁';home.setAttribute('aria-label','回上一頁');home.href='javascript:history.back()';}
 select.addEventListener('change',()=>{state.voice=select.value;if(state.active||state.starting){stopVoice().then(()=>startVoice())}});
 button.addEventListener('click',()=>state.active||state.starting?stopVoice():startVoice());
}
function status(t,show=true){const s=document.getElementById('darkStarLiveStatus');if(s){s.textContent=t;s.classList.toggle('show',show)}}
function button(on){const b=document.getElementById('darkStarLiveButton');if(!b)return;b.classList.toggle('active',on);b.querySelector('.icon').textContent=on?'■':'🎙';b.title=on?'結束即時語音':'開始即時語音'}
function b64(bytes){let out='';for(let i=0;i<bytes.length;i+=32768)out+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(out)}
function decode64(x){const s=atob(x),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u}
function pcm16(samples,rate,target=16000){let src=samples;if(rate!==target){const ratio=rate/target,n=Math.max(1,Math.round(samples.length/ratio)),o=new Float32Array(n);for(let i=0;i<n;i++){const p=i*ratio,j=Math.floor(p),f=p-j,a=samples[j]||0,c=samples[Math.min(j+1,samples.length-1)]||a;o[i]=a+(c-a)*f}src=o}const p=new Int16Array(src.length);for(let i=0;i<src.length;i++){const v=Math.max(-1,Math.min(1,src[i]));p[i]=v<0?v*32768:v*32767}return new Uint8Array(p.buffer)}
function play(data,mime){if(!state.ctx)return;const u=decode64(data);if(u.length<2)return;const p=new Int16Array(u.buffer,u.byteOffset,Math.floor(u.byteLength/2)),f=new Float32Array(p.length);for(let i=0;i<p.length;i++)f[i]=p[i]/32768;const rate=(/rate=(\d+)/i.exec(mime||'')||[])[1]||24000;const ab=state.ctx.createBuffer(1,f.length,Number(rate));ab.copyToChannel(f,0);const src=state.ctx.createBufferSource();src.buffer=ab;src.connect(state.ctx.destination);const at=Math.max(state.ctx.currentTime,state.nextAudioTime);src.start(at);state.nextAudioTime=at+ab.duration}
async function sessionStart(){try{const r=await fetch(SESSION,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start',voice_profile:state.voice})});const j=await r.json();state.sessionId=j?.session?.id||j?.session_id||j?.id||null}catch{state.sessionId=null}}
async function sessionEnd(){if(!state.sessionId)return;try{await fetch(SESSION,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'end',session_id:state.sessionId})})}catch{}state.sessionId=null}
async function stopVoice(){state.active=false;state.starting=false;button(false);status('即時語音已結束',false);const ws=state.ws;state.ws=null;try{ws?.send(JSON.stringify({type:'close'}))}catch{}try{ws?.close()}catch{}try{state.processor?.disconnect()}catch{}try{state.source?.disconnect()}catch{}try{state.sink?.disconnect()}catch{}try{state.stream?.getTracks().forEach(t=>t.stop())}catch{}try{await state.ctx?.close()}catch{}state.processor=null;state.source=null;state.sink=null;state.stream=null;state.ctx=null;state.nextAudioTime=0;await sessionEnd()}
async function startVoice(){if(state.active||state.starting)return;state.starting=true;button(true);status(`正在啟動「${state.voice}」即時語音……`);try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('此瀏覽器不支援音訊');if(!navigator.mediaDevices?.getUserMedia)throw Error('此瀏覽器不允許麥克風');state.ctx=new AC();await state.ctx.resume();await sessionStart();state.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});state.ws=new WebSocket(RELAY+'?voice='+encodeURIComponent(state.voice));state.ws.onopen=()=>{state.active=true;state.starting=false;button(true);status(`正在聆聽 · ${state.voice}`);const src=state.ctx.createMediaStreamSource(state.stream),pr=state.ctx.createScriptProcessor(2048,1,1),sink=state.ctx.createGain();sink.gain.value=0;state.source=src;state.processor=pr;state.sink=sink;src.connect(pr);pr.connect(sink);sink.connect(state.ctx.destination);pr.onaudioprocess=e=>{if(!state.active||state.ws?.readyState!==WebSocket.OPEN)return;const bytes=pcm16(e.inputBuffer.getChannelData(0),e.inputBuffer.sampleRate,16000);state.ws.send(JSON.stringify({type:'audio',data:b64(bytes),mimeType:'audio/pcm;rate=16000'}))}};state.ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.error?.message){console.error('[DarkStar voice]',m.error.message);status('語音錯誤：'+m.error.message);return}const c=m.serverContent||{};if(c.modelTurn?.parts)for(const part of c.modelTurn.parts)if(part?.inlineData?.data)play(part.inlineData.data,part.inlineData.mimeType);if(c.turnComplete)status(`正在聆聽 · ${state.voice}`)};state.ws.onerror=()=>status('即時語音連線錯誤');state.ws.onclose=()=>{if(state.active)stopVoice()}}catch(e){console.error('[DarkStar voice]',e);await stopVoice();status(e?.message||'即時語音啟動失敗')}}

function init(){ui()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

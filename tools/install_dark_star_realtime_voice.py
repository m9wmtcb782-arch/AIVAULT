from pathlib import Path

HTML = Path('technical-dark-star.html')
MARKER = 'AIVAULT_DARK_STAR_REALTIME_VOICE_V1'

BLOCK = r'''<!-- AIVAULT_DARK_STAR_REALTIME_VOICE_V1 -->
<script>
(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_REALTIME_VOICE_V1__) return;
window.__AIVAULT_DARK_STAR_REALTIME_VOICE_V1__=true;
const RELAY='wss://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-live-voice';
const SESSION='https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-voice-session';
const VOICE='Kore';
const mic=document.getElementById('micButton');
const input=document.getElementById('composerInput');
const send=document.getElementById('sendButton');
const messages=document.getElementById('messages');
const inner=document.getElementById('messagesInner');
const status=document.getElementById('voiceStatus');
if(!mic||!input||!send||!inner) return;
const state={active:false,starting:false,ws:null,stream:null,ctx:null,source:null,processor:null,sink:null,nextAudioTime:0,sessionId:null,sequence:0,inputText:'',outputText:'',userTextEl:null,assistantTextEl:null};
const cleanMic=mic.cloneNode(true);
mic.replaceWith(cleanMic);
const voiceButton=document.getElementById('micButton');
function setStatus(text,show=true){if(!status)return;status.textContent=text;status.classList.toggle('show',show)}
function setMic(on){voiceButton.classList.toggle('recording',on);voiceButton.setAttribute('aria-pressed',String(on));voiceButton.title=on?'結束即時語音':'開始即時語音'}
function scrollBottom(){try{messages.scrollTop=messages.scrollHeight}catch{}}
function makeBubble(role){const welcome=document.getElementById('welcome');if(welcome)welcome.remove();const row=document.createElement('div');row.className='message '+role;const avatar=document.createElement('div');avatar.className='message-avatar';avatar.textContent=role==='user'?'你':'暗';const body=document.createElement('div');body.className='message-body';const text=document.createElement('div');text.className='message-text';body.appendChild(text);row.appendChild(avatar);row.appendChild(body);inner.appendChild(row);scrollBottom();return text}
function b64(bytes){let s='';const u=new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode(...u.subarray(i,i+32768));return btoa(s)}
function u8(base64){const bin=atob(base64),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
function floatToPCM16(inputSamples,inputRate,targetRate=16000){let samples=inputSamples;if(inputRate!==targetRate){const ratio=inputRate/targetRate,outLength=Math.max(1,Math.round(inputSamples.length/ratio)),out=new Float32Array(outLength);for(let i=0;i<outLength;i++){const pos=i*ratio,left=Math.floor(pos),frac=pos-left,a=inputSamples[left]||0,b=inputSamples[Math.min(left+1,inputSamples.length-1)]||a;out[i]=a+(b-a)*frac}samples=out}const pcm=new Int16Array(samples.length);for(let i=0;i<samples.length;i++){const v=Math.max(-1,Math.min(1,samples[i]));pcm[i]=v<0?v*32768:v*32767}return pcm}
async function saveTurn(role,text){text=String(text||'').trim();if(!state.sessionId||!text)return;try{await fetch(SESSION,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'turn',session_id:state.sessionId,sequence_no:++state.sequence,role,content:text})})}catch(e){console.warn('[DarkStar voice] save turn failed',e)}}
async function startSession(){try{const r=await fetch(SESSION,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start',voice_profile:VOICE})}),j=await r.json();state.sessionId=j?.session?.id||j?.session_id||j?.id||null}catch(e){console.warn('[DarkStar voice] session persistence unavailable',e);state.sessionId=null}}
function playPCM(base64){if(!state.ctx)return;const bytes=u8(base64);if(bytes.byteLength<2)return;const pcm=new Int16Array(bytes.buffer,bytes.byteOffset,Math.floor(bytes.byteLength/2)),f=new Float32Array(pcm.length);for(let i=0;i<pcm.length;i++)f[i]=pcm[i]/32768;const buffer=state.ctx.createBuffer(1,f.length,24000);buffer.copyToChannel(f,0);const source=state.ctx.createBufferSource();source.buffer=buffer;source.connect(state.ctx.destination);const start=Math.max(state.ctx.currentTime,state.nextAudioTime);source.start(start);state.nextAudioTime=start+buffer.duration}
async function stopVoice(endSession=true){const wasActive=state.active||state.starting;state.active=false;state.starting=false;setMic(false);try{state.processor?.disconnect()}catch{}try{state.source?.disconnect()}catch{}try{state.sink?.disconnect()}catch{}try{state.stream?.getTracks().forEach(t=>t.stop())}catch{}try{state.ws?.close()}catch{}try{await state.ctx?.close()}catch{}state.processor=null;state.source=null;state.sink=null;state.stream=null;state.ws=null;state.ctx=null;state.nextAudioTime=0;if(endSession&&state.sessionId){try{await fetch(SESSION,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'end',session_id:state.sessionId})})}catch{}}state.sessionId=null;if(wasActive)setStatus('即時語音已結束',false)}
async function startVoice(){if(state.active||state.starting)return;state.starting=true;setStatus('正在啟動即時語音……');try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('此瀏覽器不支援音訊');if(!navigator.mediaDevices?.getUserMedia)throw new Error('此瀏覽器不允許麥克風存取');state.ctx=new AC();await state.ctx.resume();await startSession();state.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});state.ws=new WebSocket(RELAY+'?voice='+encodeURIComponent(VOICE));state.ws.onopen=()=>{state.active=true;state.starting=false;state.inputText='';state.outputText='';state.userTextEl=null;state.assistantTextEl=null;setMic(true);setStatus('正在聆聽……');const src=state.ctx.createMediaStreamSource(state.stream),processor=state.ctx.createScriptProcessor(2048,1,1),sink=state.ctx.createGain();sink.gain.value=0;state.source=src;state.processor=processor;state.sink=sink;src.connect(processor);processor.connect(sink);sink.connect(state.ctx.destination);processor.onaudioprocess=event=>{if(!state.active||!state.ws||state.ws.readyState!==WebSocket.OPEN)return;const pcm=floatToPCM16(event.inputBuffer.getChannelData(0),event.inputBuffer.sampleRate,16000);if(!pcm.length)return;try{state.ws.send(JSON.stringify({type:'audio',data:b64(pcm),mimeType:'audio/pcm;rate=16000'}))}catch{}}};state.ws.onmessage=async event=>{let msg;try{msg=JSON.parse(event.data)}catch{return}if(msg?.error?.message){console.error('[DarkStar voice]',msg.error.message);setStatus('語音連線錯誤：'+msg.error.message);return}const content=msg.serverContent||{};if(content.inputTranscription?.text){state.inputText+=String(content.inputTranscription.text);if(!state.userTextEl)state.userTextEl=makeBubble('user');state.userTextEl.textContent=state.inputText;scrollBottom()}if(content.outputTranscription?.text){state.outputText+=String(content.outputTranscription.text);if(!state.assistantTextEl)state.assistantTextEl=makeBubble('assistant');state.assistantTextEl.textContent=state.outputText;scrollBottom()}if(content.modelTurn?.parts)for(const part of content.modelTurn.parts)if(part?.inlineData?.data)playPCM(part.inlineData.data);if(content.interrupted)state.nextAudioTime=0;if(content.turnComplete){const u=state.inputText,a=state.outputText;if(u)await saveTurn('user',u);if(a)await saveTurn('assistant',a);state.inputText='';state.outputText='';state.userTextEl=null;state.assistantTextEl=null;if(state.active)setStatus('正在聆聽……')}};state.ws.onerror=()=>setStatus('即時語音連線發生錯誤');state.ws.onclose=()=>{if(state.active)stopVoice(false)}}catch(error){state.starting=false;console.error('[DarkStar voice] start failed',error);setStatus(error?.message||'即時語音啟動失敗');await stopVoice(false)}}
voiceButton.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();if(state.active||state.starting)stopVoice();else startVoice()},true);
send.addEventListener('click',event=>{if(!state.active)return;event.preventDefault();event.stopImmediatePropagation();const text=input.value.trim();if(!text)return;if(state.ws?.readyState===WebSocket.OPEN){state.ws.send(JSON.stringify({type:'text',text}));if(!state.userTextEl)state.userTextEl=makeBubble('user');state.userTextEl.textContent=text;state.inputText=text;input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));scrollBottom()}},true);
input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&state.active){event.preventDefault();send.click()}},true);
setMic(false);
})();
</script>
<!-- /AIVAULT_DARK_STAR_REALTIME_VOICE_V1 -->
'''

s = HTML.read_text(encoding='utf-8')
if MARKER not in s:
    if '</body>' not in s:
        raise SystemExit('Protected stop: </body> not found')
    s = s.replace('</body>', BLOCK + '\n</body>', 1)
    HTML.write_text(s, encoding='utf-8')
    print('installed')
else:
    print('already installed')

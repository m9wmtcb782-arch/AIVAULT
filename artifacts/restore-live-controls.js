(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_RESTORE_LIVE_CONTROLS__)return;
window.__AIVAULT_DARK_STAR_RESTORE_LIVE_CONTROLS__=true;
const LIVE_VIDEO='technical-dark-star-live-video-test.html?mode=video&autostart=1&v=5';
const LIVE_VOICE='technical-dark-star-live-video-test.html?mode=voice&v=3';
const VIDEO_CHANNEL_NAME='aivault-dark-star-video';
const VOICES=[['Zephyr','Zephyr｜明亮'],['Puck','Puck｜歡快'],['Charon','Charon｜資訊豐富'],['Kore','Kore｜堅定'],['Fenrir','Fenrir｜興奮'],['Leda','Leda｜年輕'],['Orus','Orus｜堅定'],['Aoede','Aoede｜輕快'],['Callirrhoe','Callirrhoe｜隨和'],['Autonoe','Autonoe｜明亮'],['Enceladus','Enceladus｜氣聲'],['Iapetus','Iapetus｜清晰'],['Umbriel','Umbriel｜隨和'],['Algieba','Algieba｜柔順'],['Despina','Despina｜柔順'],['Erinome','Erinome｜清晰'],['Algenib','Algenib｜粗獲'],['Rasalgethi','Rasalgethi｜資訊豐富'],['Laomedeia','Laomedeia｜歡快'],['Achernar','Achernar｜柔和'],['Alnilam','Alnilam｜堅定'],['Schedar','Schedar｜均衡'],['Gacrux','Gacrux｜成熟'],['Pulcherrima','Pulcherrima｜前進感'],['Achird','Achird｜友善'],['Zubenelgenubi','Zubenelgenubi｜隨性'],['Vindemiatrix','Vindemiatrix｜溫和'],['Sadachbia','Sadachbia｜活潑'],['Sadaltager','Sadaltager｜知識豐富'],['Sulafat','Sulafat｜溫暖']];
function css(){if(document.getElementById('dsRestoreLiveControlsStyle'))return;const s=document.createElement('style');s.id='dsRestoreLiveControlsStyle';s.textContent='.dark-star-live-controls{display:flex!important;align-items:center;gap:8px;margin-left:auto}.dark-star-live-button,.dark-star-sound-button{height:38px;border:1px solid #dedede;border-radius:10px;background:#fff;color:#222;font-size:15px;font-weight:600;padding:0 12px;white-space:nowrap}.dark-star-voice-select{position:absolute;top:34px;right:0;width:210px;height:32px;z-index:1001}.dark-star-live-controls{position:relative}';document.head.appendChild(s)}
function restore(){
 const top=document.querySelector('.topbar, .top');if(!top)return false;css();
 let controls=document.getElementById('darkStarLiveControls');
 if(controls)controls.remove();
 const drawer=document.getElementById('drawer');
 const bottom=drawer&&drawer.querySelector('.drawer-bottom');
 let video=document.getElementById('darkStarLiveVideoButton');
 if(!video){video=document.createElement('button');video.id='darkStarLiveVideoButton';video.type='button';video.className='drawer-item';video.textContent='即時視訊';}
 let live=document.getElementById('darkStarLiveButton');
 if(!live){live=document.createElement('button');live.id='darkStarLiveButton';live.type='button';live.classList.add('drawer-item');if(!live.dataset.liveVoiceBound&&!live.classList.contains('active')&&live.textContent.indexOf('✓')<0)live.textContent='暗星即時';}
 let settings=document.getElementById('darkStarSettingsButton');
 if(!settings){settings=document.createElement('button');settings.id='darkStarSettingsButton';settings.type='button';settings.className='drawer-item';settings.textContent='⚙️ 設定';}
 let sound=document.getElementById('darkStarSoundButton');
 if(!sound){sound=document.createElement('button');sound.id='darkStarSoundButton';sound.type='button';sound.className='drawer-item';sound.textContent='🔊 聲音';}
 let select=document.getElementById('darkStarVoiceSelect');
 if(!select){select=document.createElement('select');select.id='darkStarVoiceSelect';select.className='drawer-voice-select';VOICES.forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;select.appendChild(o)});}
 select.value=localStorage.getItem('darkStarVoice')||'Kore';
 if(bottom){live.classList.add('drawer-item');if(!live.dataset.liveVoiceBound&&!live.classList.contains('active')&&live.textContent.indexOf('✓')<0)live.textContent='暗星即時';live.style.removeProperty('display');live.removeAttribute('aria-hidden');if(live.parentElement!==bottom)bottom.insertBefore(live,bottom.firstChild);settings.className='drawer-item';settings.textContent='⚙️ 設定';settings.style.removeProperty('display');settings.removeAttribute('aria-hidden');if(settings.parentElement!==bottom)bottom.insertBefore(settings,live.nextSibling);if(video.parentElement!==bottom)bottom.insertBefore(video,bottom.firstChild);}
 async function toggleDualAgent(which){for(let i=0;i<40;i++){const dual=window.AivaultDualAgentLive;if(dual&&typeof dual.toggleArm==='function'){await dual.toggleArm(which);const state=typeof dual.armed==='function'?dual.armed():null;const id=which==='dark'?'darkStarLiveButton':'dawnLightLiveButton';const b=document.getElementById(id);if(b&&state){const on=which==='dark'?!!state.dark:!!state.dawn;b.textContent=which==='dark'?(on?'暗星即時 ✓':'暗星即時'):(on?'曙光即時 ✓':'曙光即時');b.classList.toggle('active',on)}return;}await new Promise(r=>setTimeout(r,50));}}
 if(!live.dataset.liveVoiceBound){live.dataset.liveVoiceBound='1';live.addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();const dual=window.AivaultDualAgentLive;const next=dual&&typeof dual.armed==='function'?!dual.armed().dark:true;live.textContent=next?'暗星即時 ✓':'暗星即時';live.classList.toggle('active',next);live.setAttribute('aria-pressed',String(next));await toggleDualAgent('dark');});}
 let dawnLive=document.getElementById('dawnLightLiveButton');
 if(!dawnLive){dawnLive=document.createElement('button');dawnLive.id='dawnLightLiveButton';dawnLive.type='button';dawnLive.className='drawer-item';dawnLive.textContent='曙光即時';}
 if(bottom&&dawnLive.parentElement!==bottom)bottom.insertBefore(dawnLive,live.nextSibling);
 if(!dawnLive.dataset.liveVoiceBound){dawnLive.dataset.liveVoiceBound='1';dawnLive.addEventListener('click',async function(event){event.preventDefault();event.stopPropagation();await toggleDualAgent('dawn');});}
 var videoWindow=null,videoOpen=false,videoChannel=null;
 try{videoChannel=new BroadcastChannel(VIDEO_CHANNEL_NAME);videoChannel.onmessage=e=>{if(e&&e.data&&e.data.type==='started'){videoOpen=true;paintVideo()}if(e&&e.data&&e.data.type==='stopped'){videoOpen=false;paintVideo()}}}catch(e){}
 var paintVideo=function(){const b=document.getElementById('darkStarLiveVideoButton');if(!b)return;b.textContent=videoOpen?'關閉視訊':'即時視訊';b.setAttribute('aria-pressed',String(videoOpen));b.classList.toggle('active',videoOpen)};
 var closeVideo=function(){try{videoChannel&&videoChannel.postMessage({type:'stop'})}catch(e){}try{if(videoWindow&&!videoWindow.closed)videoWindow.close()}catch(e){}videoOpen=false;paintVideo()};
 var bindVideoToggle=function(){const b=document.getElementById('darkStarLiveVideoButton');if(!b||b.dataset.videoToggleBound)return;b.dataset.videoToggleBound='1';b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(videoOpen){closeVideo();return}videoOpen=true;paintVideo();videoWindow=window.open(LIVE_VIDEO,'aivault-dark-star-video');if(!videoWindow)location.href=LIVE_VIDEO});paintVideo()};
 bindVideoToggle();
 ['darkStarLiveButton','darkStarSettingsButton'].forEach(id=>{const e=document.getElementById(id);if(e){e.style.removeProperty('display');e.removeAttribute('aria-hidden')}});
 return true
}
function ensureSettingsPanel(){
 const drawer=document.getElementById('drawer');
 const bottom=drawer&&drawer.querySelector('.drawer-bottom');
 const settings=document.getElementById('darkStarSettingsButton');
 const live=document.getElementById('darkStarLiveButton');
 if(!bottom||!settings)return false;
 if(live){live.classList.add('drawer-item');if(!live.classList.contains('active')&&live.textContent.indexOf('✓')<0)live.textContent='暗星即時';live.style.removeProperty('display');if(live.parentElement!==bottom)bottom.insertBefore(live,bottom.firstChild);}
 settings.className='drawer-item';settings.textContent='⚙️ 設定';settings.style.removeProperty('display');settings.removeAttribute('aria-hidden');
 let panel=document.getElementById('darkStarSettingsPanel');
 if(!panel){panel=document.createElement('div');panel.id='darkStarSettingsPanel';panel.style.display='none';panel.style.padding='4px 0 0';panel.style.borderTop='1px solid #eee';panel.style.marginTop='4px';bottom.insertBefore(panel,settings.nextSibling);}
 const sound=document.getElementById('darkStarSoundButton');
 const select=document.getElementById('darkStarVoiceSelect')||document.createElement('select');
 if(!select.id){select.id='darkStarVoiceSelect';select.className='drawer-voice-select';VOICES.forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;select.appendChild(o)});select.value=localStorage.getItem('darkStarVoice')||'Kore';}
 const big=document.getElementById('readabilityToggle');
 const video=document.getElementById('darkStarLiveVideoButton');
 const speedKey='darkStarMyVoiceRate';
 let speed=document.getElementById('darkStarSpeechSpeed');
 let speedValue=document.getElementById('darkStarSpeechSpeedValue');
 if(!speed){speed=document.createElement('input');speed.id='darkStarSpeechSpeed';speed.type='range';speed.min='0.7';speed.max='1.3';speed.step='0.05';speed.value=localStorage.getItem(speedKey)||'1';speed.style.cssText='display:block;width:100%;height:36px;margin:4px 0 0';}
 if(!speedValue){speedValue=document.createElement('span');speedValue.id='darkStarSpeechSpeedValue';speedValue.style.cssText='font-size:12px;color:#666;min-width:48px;text-align:right';}
 speedValue.textContent=parseFloat(speed.value).toFixed(2)+'×';
 if(video){video.className='drawer-item';video.style.removeProperty('display');video.removeAttribute('aria-hidden');if(video.parentElement!==bottom)bottom.insertBefore(video,settings);}
 if(sound){sound.className='drawer-item';sound.textContent='🔊 聲音';sound.style.removeProperty('display');if(sound.parentElement!==panel)panel.appendChild(sound);sound.onclick=function(e){e.preventDefault();e.stopPropagation();if(select)select.style.display=select.style.display==='none'?'block':'none';};}
 if(select){select.className='drawer-voice-select';select.style.position='static';select.style.width='100%';select.style.height='42px';select.style.marginTop='4px';if(select.parentElement!==panel)panel.appendChild(select);if(!select.dataset.settingsInitialized){select.style.display='none';select.dataset.settingsInitialized='1';}select.onchange=()=>localStorage.setItem('darkStarVoice',select.value);let dawnLabel=document.getElementById('dawnLightVoiceLabel');if(!dawnLabel){dawnLabel=document.createElement('div');dawnLabel.id='dawnLightVoiceLabel';dawnLabel.textContent='曙光聲音';dawnLabel.style.cssText='font-size:12px;color:#555;margin:8px 0 2px';select.insertAdjacentElement('afterend',dawnLabel);}let darkLabel=document.getElementById('darkStarVoiceLabel');if(!darkLabel){darkLabel=document.createElement('div');darkLabel.id='darkStarVoiceLabel';darkLabel.textContent='暗星聲音';darkLabel.style.cssText='font-size:12px;color:#555;margin:6px 0 2px';select.parentNode.insertBefore(darkLabel,select);}let dawnSelect=document.getElementById('dawnLightVoiceSelect');if(!dawnSelect){dawnSelect=document.createElement('select');dawnSelect.id='dawnLightVoiceSelect';dawnSelect.className='drawer-voice-select';VOICES.forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;dawnSelect.appendChild(o)});dawnLabel.insertAdjacentElement('afterend',dawnSelect);}dawnSelect.value=localStorage.getItem('dawnLightVoice')||'Aoede';dawnSelect.style.cssText='position:static;width:100%;height:42px;margin-top:4px';dawnSelect.onchange=()=>localStorage.setItem('dawnLightVoice',dawnSelect.value);}
 const speedRow=document.getElementById('darkStarSpeechSpeedRow')||document.createElement('div');
 speedRow.id='darkStarSpeechSpeedRow';speedRow.style.cssText='padding:8px 4px 4px';
 speedRow.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#555"><span>語速快慢</span><span id="darkStarSpeechSpeedValue"></span></div>';
 speedRow.appendChild(speed);
 if(speedValue.parentElement!==speedRow){speedRow.querySelector('#darkStarSpeechSpeedValue').replaceWith(speedValue);}
 if(speedRow.parentElement!==panel)panel.appendChild(speedRow);
 speed.oninput=function(){const v=Math.min(1.3,Math.max(0.7,parseFloat(speed.value)||1));speed.value=String(v);speedValue.textContent=v.toFixed(2)+'×';localStorage.setItem(speedKey,String(v));};
 speed.oninput();
 if(big){big.className='drawer-item';big.style.removeProperty('display');big.style.marginTop='4px';if(big.parentElement!==panel)panel.appendChild(big);}
 settings.onclick=function(e){e.preventDefault();e.stopPropagation();const open=panel.style.display!=='none';panel.style.display=open?'none':'block';if(!open&&select)select.style.display='block';var dawnVoice=document.getElementById('dawnLightVoiceSelect');if(!open&&dawnVoice)dawnVoice.style.display='block';if(open&&select)select.style.display='none';};
 return true
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restore);else restore();let n=0;const t=setInterval(()=>{if(restore()){ensureSettingsPanel();}if(++n>40)clearInterval(t)},250);
})();
(()=>{if(window.__AIVAULT_METER_PULL__)return;window.__AIVAULT_METER_PULL__=true;if(!window.AudioNode||!AudioNode.prototype.connect)return;const orig=AudioNode.prototype.connect;AudioNode.prototype.connect=function(dest){const out=orig.apply(this,arguments);if(dest&&dest.fftSize&&dest.context&&!dest.__aivaultPulled){dest.__aivaultPulled=true;try{const g=dest.context.createGain();g.gain.value=0;orig.call(dest,g);orig.call(g,dest.context.destination);}catch(e){}}return out;};})();

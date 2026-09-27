(()=>{
'use strict';
if(window.__AIVAULT_DARK_STAR_RESTORE_LIVE_CONTROLS__)return;
window.__AIVAULT_DARK_STAR_RESTORE_LIVE_CONTROLS__=true;
const LIVE_VIDEO='technical-dark-star-live-video-test.html?mode=video&autostart=1&v=4';
const LIVE_VOICE='technical-dark-star-live-video-test.html?mode=voice&v=3';
const VIDEO_CHANNEL_NAME='aivault-dark-star-video';
const VOICES=[['Zephyr','Zephyr｜明亮'],['Puck','Puck｜歡快'],['Charon','Charon｜資訊豐富'],['Kore','Kore｜堅定'],['Fenrir','Fenrir｜興奮'],['Leda','Leda｜年輕'],['Orus','Orus｜堅定'],['Aoede','Aoede｜輕快'],['Callirrhoe','Callirrhoe｜隨和'],['Autonoe','Autonoe｜明亮'],['Enceladus','Enceladus｜氣聲'],['Iapetus','Iapetus｜清晰'],['Umbriel','Umbriel｜隨和'],['Algieba','Algieba｜柔順'],['Despina','Despina｜柔順'],['Erinome','Erinome｜清晰'],['Algenib','Algenib｜粗獷'],['Rasalgethi','Rasalgethi｜資訊豐富'],['Laomedeia','Laomedeia｜歡快'],['Achernar','Achernar｜柔和'],['Alnilam','Alnilam｜堅定'],['Schedar','Schedar｜均衡'],['Gacrux','Gacrux｜成熟'],['Pulcherrima','Pulcherrima｜前進感'],['Achird','Achird｜友善'],['Zubenelgenubi','Zubenelgenubi｜隨性'],['Vindemiatrix','Vindemiatrix｜溫和'],['Sadachbia','Sadachbia｜活潑'],['Sadaltager','Sadaltager｜知識豐富'],['Sulafat','Sulafat｜溫暖']];
function css(){if(document.getElementById('dsRestoreLiveControlsStyle'))return;const s=document.createElement('style');s.id='dsRestoreLiveControlsStyle';s.textContent='.dark-star-live-controls{display:flex!important;align-items:center;gap:8px;margin-left:auto}.dark-star-live-button,.dark-star-sound-button{height:38px;border:1px solid #dedede;border-radius:10px;background:#fff;color:#222;font-size:15px;font-weight:600;padding:0 12px;white-space:nowrap}.dark-star-voice-select{position:absolute;top:34px;right:0;width:210px;height:32px;z-index:1001}.dark-star-live-controls{position:relative}';document.head.appendChild(s)}
function restore(){const top=document.querySelector('.topbar');if(!top)return false;css();let controls=document.getElementById('darkStarLiveControls');if(!controls){controls=document.createElement('div');controls.id='darkStarLiveControls';controls.className='dark-star-live-controls';const video=document.createElement('a');video.id='darkStarLiveVideoButton';video.className='dark-star-live-button';video.href=LIVE_VIDEO;video.textContent='即時視訊';const live=document.createElement('button');live.id='darkStarLiveButton';live.type='button';live.className='dark-star-live-button';live.textContent='⚙️ 設定';const sound=document.createElement('button');sound.id='darkStarSoundButton';sound.type='button';sound.className='dark-star-sound-button';sound.textContent='聲音';const select=document.createElement('select');select.id='darkStarVoiceSelect';select.className='dark-star-voice-select';VOICES.forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;select.appendChild(o)});select.value=localStorage.getItem('darkStarVoice')||'Kore';select.onchange=()=>localStorage.setItem('darkStarVoice',select.value);controls.append(video);const drawer=document.getElementById('drawer');const drawerBottom=drawer&&drawer.querySelector('.drawer-bottom');if(drawerBottom){sound.className='drawer-item';sound.textContent='🔊 聲音';select.className='drawer-voice-select';select.style.position='static';select.style.width='100%';select.style.height='42px';select.style.marginTop='4px';select.style.display='none';sound.setAttribute('aria-expanded','false');sound.addEventListener('click',()=>{const open=select.style.display!=='none';select.style.display=open?'none':'block';sound.setAttribute('aria-expanded',String(!open));if(!open)select.focus()});live.className='drawer-item';live.textContent='⚙️ 設定';live.setAttribute('aria-expanded','false');live.addEventListener('click',()=>{const open=sound.style.display!=='none';sound.style.display=open?'none':'block';select.style.display='none';live.setAttribute('aria-expanded',String(!open))});sound.style.display='none';drawerBottom.insertBefore(live,drawerBottom.firstChild);drawerBottom.insertBefore(sound,live.nextSibling);drawerBottom.insertBefore(select,sound.nextSibling)}const home=top.querySelector('.brand-home');if(home)home.before(controls);else top.appendChild(controls);
var videoWindow=null;
var videoOpen=false;
var videoChannel=null;
try{videoChannel=new BroadcastChannel(VIDEO_CHANNEL_NAME);videoChannel.onmessage=e=>{if(e&&e.data&&e.data.type==='started'){videoOpen=true;paintVideo()}if(e&&e.data&&e.data.type==='stopped'){videoOpen=false;paintVideo()}}}catch(e){}
var paintVideo=function(){const b=document.getElementById('darkStarLiveVideoButton');if(!b)return;b.textContent=videoOpen?'關閉視訊':'即時視訊';b.setAttribute('aria-pressed',String(videoOpen));b.classList.toggle('active',videoOpen)}
var closeVideo=function(){try{videoChannel&&videoChannel.postMessage({type:'stop'})}catch(e){}try{if(videoWindow&&!videoWindow.closed)videoWindow.close()}catch(e){}videoOpen=false;paintVideo()}
var bindVideoToggle=function(){const b=document.getElementById('darkStarLiveVideoButton');if(!b||b.dataset.videoToggleBound)return;b.dataset.videoToggleBound='1';b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(videoOpen){closeVideo();return}videoOpen=true;paintVideo();videoWindow=window.open(LIVE_VIDEO,'aivault-dark-star-video');if(!videoWindow){location.href=LIVE_VIDEO}});paintVideo()}
bindVideoToggle();
}else{controls.style.removeProperty('display');controls.style.display='flex';const existingSound=document.getElementById('darkStarSoundButton');const existingSelect=document.getElementById('darkStarVoiceSelect');if(existingSelect&&existingSelect.options.length!==VOICES.length){existingSelect.innerHTML='';VOICES.forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;existingSelect.appendChild(o)})}const drawer=document.getElementById('drawer');const drawerBottom=drawer&&drawer.querySelector('.drawer-bottom');const existingLive=document.getElementById('darkStarLiveButton');if(drawerBottom&&existingLive&&existingLive.parentElement!==drawerBottom){existingLive.className='drawer-item';existingLive.textContent='⚙️ 設定';drawerBottom.insertBefore(existingLive,drawerBottom.firstChild)}/* 聲音控制由 ensureSettingsPanel() 唯一掛載到「設定」內；此處不再搬回抽屜根層。 */if(drawerBottom&&existingLive&&!existingLive.dataset.settingsNestedBound){existingLive.dataset.settingsNestedBound='1';existingLive.setAttribute('aria-expanded','false');existingLive.addEventListener('click',()=>{const open=existingSound&&existingSound.style.display!=='none';if(existingSound)existingSound.style.display=open?'none':'block';if(existingSelect)existingSelect.style.display='none';existingLive.setAttribute('aria-expanded',String(!open))})}/* 聲音選單由 ensureSettingsPanel() 唯一掛載到「設定」內；此處不再搬回抽屜根層。 */if(!document.getElementById('darkStarLiveButton')){const live=document.createElement('button');live.id='darkStarLiveButton';live.type='button';live.className='dark-star-live-button';live.textContent='⚙️ 設定';controls.appendChild(live)}['darkStarLiveVideoButton','darkStarLiveControls','darkStarFavoriteVideo'].forEach(id=>{const e=document.getElementById(id);if(e){e.style.removeProperty('display');e.removeAttribute('aria-hidden')}});const v=document.getElementById('darkStarLiveVideoButton');if(v){v.href=LIVE_VIDEO;bindVideoToggle();}const s=document.getElementById('darkStarVoiceSelect');if(s){s.value=localStorage.getItem('darkStarVoice')||s.value||'Kore';s.onchange=()=>localStorage.setItem('darkStarVoice',s.value)}const liveBtn=document.getElementById('darkStarLiveButton');if(liveBtn){liveBtn.className='drawer-item';liveBtn.textContent='⚙️ 設定';liveBtn.style.removeProperty('display');liveBtn.removeAttribute('aria-hidden')}}return true}
/* AIVAULT_SETTINGS_PANEL_V2 */
function ensureSettingsPanel(){
  const drawer=document.getElementById('drawer');
  const bottom=drawer&&drawer.querySelector('.drawer-bottom');
  const settings=document.getElementById('darkStarLiveButton');
  if(!bottom||!settings)return false;

  settings.className='drawer-item';
  settings.textContent='⚙️ 設定';
  settings.style.removeProperty('display');
  settings.removeAttribute('aria-hidden');

  let panel=document.getElementById('darkStarSettingsPanel');
  if(!panel){
    panel=document.createElement('div');
    panel.id='darkStarSettingsPanel';
    panel.style.display='none';
    panel.style.padding='4px 0 0';
    panel.style.borderTop='1px solid #eee';
    panel.style.marginTop='4px';
    bottom.insertBefore(panel,settings.nextSibling);
  }

  const sound=document.getElementById('darkStarSoundButton');
  const select=document.getElementById('darkStarVoiceSelect');
  const big=document.getElementById('readabilityToggle');

  if(sound){
    sound.className='drawer-item';
    sound.textContent='🔊 聲音';
    sound.style.removeProperty('display');
    sound.removeAttribute('aria-hidden');
    if(sound.parentElement!==panel)panel.appendChild(sound);
    sound.onclick=function(event){
      event.preventDefault();
      event.stopPropagation();
      if(select){
        const open=select.style.display!=='none';
        select.style.display=open?'none':'block';
        sound.setAttribute('aria-expanded',String(!open));
        if(!open)select.focus();
      }
    };
    sound.setAttribute('aria-expanded','false');
  }

  if(select){
    select.className='drawer-voice-select';
    select.style.position='static';
    select.style.width='100%';
    select.style.height='42px';
    select.style.marginTop='4px';
    if(select.parentElement!==panel)panel.appendChild(select);
    select.style.display='none';
    select.onchange=()=>localStorage.setItem('darkStarVoice',select.value);
  }

  if(big){
    big.className='drawer-item';
    big.style.removeProperty('display');
    big.removeAttribute('aria-hidden');
    big.style.marginTop='4px';
    if(big.parentElement!==panel)panel.appendChild(big);
  }

  settings.onclick=function(event){
    event.preventDefault();
    event.stopPropagation();
    const open=panel.style.display!=='none';
    panel.style.display=open?'none':'block';
    settings.setAttribute('aria-expanded',String(!open));
    if(open&&select)select.style.display='none';
  };
  settings.setAttribute('aria-expanded',panel.style.display!=='none'?'true':'false');

  return true;
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restore);else restore();let n=0;const t=setInterval(()=>{if(restore()){ensureSettingsPanel();}if(++n>40)clearInterval(t)},250);
})();

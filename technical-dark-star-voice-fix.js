/* AIVAULT Technical Dark Star - realtime voice + hidden translation */
(()=>{
  'use strict';
  if(window.__AIVAULT_DARK_STAR_VOICE_FIX__) return;
  window.__AIVAULT_DARK_STAR_VOICE_FIX__=true;

  const RELAY='wss://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-voice-sdk-relay';
  const SESSION='https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-voice-session';
  const TRANSLATION_VERSION='4';

  if(localStorage.getItem('aivault_translation_settings_version')!==TRANSLATION_VERSION){
    localStorage.removeItem('aivault_voice_translate');
    localStorage.removeItem('aivault_translate_targets');
    localStorage.setItem('aivault_translation_settings_version',TRANSLATION_VERSION);
  }

  const voices=[
    ['Kore','沉穩女聲'],['Puck','活潑男聲'],['Charon','知性男聲'],['Leda','年輕女聲'],['Gacrux','成熟女聲'],
    ['Aoede','自然女聲'],['Orus','沉穩男聲'],['Zephyr','明亮女聲'],['Fenrir','有力男聲'],['Achird','親切男聲'],
    ['Sadachbia','活潑女聲'],['Algieba','柔和男聲'],['Algenib','沙啞男聲'],['Achernar','柔軟女聲'],['Zubenelgenubi','自然男聲'],
    ['Sadaltager','知識型男聲'],['Enceladus','氣聲男聲'],['Laomedeia','明快女聲'],['Schedar','平穩男聲'],['Umbriel','輕鬆男聲'],
    ['Autonoe','明亮女聲'],['Erinome','清晰女聲'],['Callirrhoe','輕鬆女聲'],['Iapetus','清晰男聲'],['Despina','柔和女聲'],
    ['Rasalgethi','資訊型男聲'],['Alnilam','堅定男聲'],['Pulcherrima','前進感女聲'],['Vindemiatrix','溫柔女聲'],['Sulafat','溫暖女聲']
  ];

  const languages=[
    ['english','English'],['japanese','日語'],['korean','韓語'],['french','法語'],['german','德語'],['spanish','西班牙語'],
    ['italian','義大利語'],['portuguese','葡萄牙語'],['russian','俄語'],['vietnamese','越南語'],['thai','泰語'],['hindi','印地語'],
    ['arabic','阿拉伯語'],['urdu','烏爾都語'],
    ['mandarin','普通話'],['taiwanese','台語'],['cantonese','廣東話'],['hakka','客家話'],['chaozhou','潮州話'],['hainanese','海南話'],
    ['shanghainese','上海話'],['sichuan','四川話'],['chongqing','重慶話'],['zhejiang','浙江話'],['hangzhou','杭州話'],['ningbo','寧波話'],['wenzhou','溫州話'],
    ['suzhou','蘇州話'],['nanjing','南京話'],['henan','河南話'],['shandong','山東話'],['tianjin','天津話'],['northeastern_mandarin','東北話'],
    ['shaanxi','陝西話'],['shanxi','山西話'],['hubei','湖北話'],['hunan','湖南話'],['jiangxi','江西話'],['anhui','安徽話'],['fujian','福建話'],
    ['uyghur','維吾爾語'],['tibetan','藏語'],['mongolian','蒙古語'],['kazakh','哈薩克語'],['kyrgyz','吉爾吉斯語'],['zhuang','壯語'],['yi','彝語'],
    ['miao','苗語'],['dong','侗語'],['yao','瑤語'],['bouyei','布依語'],['dai','傣語'],['bai','白語'],['naxi','納西語'],['hani','哈尼語'],
    ['korean_china','中國朝鮮語'],['manchu','滿語'],['xibe','錫伯語'],['tu','土族語'],['salar','撒拉語'],['bonan','保安語'],['dongxiang','東鄉語'],
    ['tatar','塔塔爾語'],['tajik','塔吉克語'],['russian_china','中國俄語'],
    ['austrian_german','奧地利德語'],['burmese','緬甸語']
  ];

  const defaultTargets=['english'];
  let savedTargets=[];
  try{savedTargets=JSON.parse(localStorage.getItem('aivault_translate_targets')||'[]')}catch{}
  if(!Array.isArray(savedTargets)||!savedTargets.length)savedTargets=defaultTargets.slice();

  const state={
    active:false,ready:false,ws:null,stream:null,ctx:null,source:null,processor:null,
    sessionId:null,sessionKey:null,seq:0,
    voice:localStorage.getItem('aivault_voice_profile')||'Kore',
    inputText:'',outputText:'',userBubble:null,assistantBubble:null,sources:new Set(),nextAudioTime:0,
    translate:localStorage.getItem('aivault_voice_translate')==='1',
    translateTargets:savedTargets
  };

  const $=s=>document.querySelector(s);
  const $$=s=>Array.from(document.querySelectorAll(s));
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const scroll=()=>{const m=$('#messages');if(m)m.scrollTop=m.scrollHeight};
  const b64=buf=>{const u=new Uint8Array(buf.buffer,buf.byteOffset,buf.byteLength);let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode(...u.subarray(i,i+32768));return btoa(s)};
  const u8=s=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u};

  function addStyle(){
    if($('#aivaultVoiceFixStyle'))return;
    const st=document.createElement('style');st.id='aivaultVoiceFixStyle';st.textContent=`
      .ds-fix-tools{display:flex;align-items:center;gap:6px;margin-left:10px;position:relative;z-index:80}
      .ds-fix-btn{height:36px;border:1px solid #e3e3e3;background:#fff;color:#222;border-radius:10px;padding:0 10px;font-size:12px;white-space:nowrap}
      .ds-fix-btn:hover{background:#f4f4f4}.ds-fix-btn.live{background:#171717;color:#fff;border-color:#171717}
      .ds-fix-menu{position:absolute;left:0;top:41px;width:285px;max-height:60vh;overflow:auto;padding:7px;background:#fff;border:1px solid #e5e5e5;border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,.14);display:none}
      .ds-fix-menu.show{display:block}.ds-fix-voice{width:100%;border:0;background:#fff;border-radius:9px;padding:9px 10px;display:flex;justify-content:space-between;gap:8px;text-align:left;font-size:12px;color:#333}.ds-fix-voice:hover{background:#f3f3f3}.ds-fix-voice.active{background:#f0f0f0;font-weight:600}.ds-fix-voice small{color:#888;font-size:10px}
      .ds-fix-row{display:flex;gap:13px;margin-bottom:30px;align-items:flex-start}.ds-fix-row.user{justify-content:flex-end}.ds-fix-row .message-avatar{flex:none}.ds-fix-row .message-body{min-width:0;max-width:690px}.ds-fix-row.user .message-body{max-width:min(600px,82%)}.ds-fix-row .message-text{font-size:16px;line-height:1.75;white-space:pre-wrap;word-break:break-word}.ds-fix-row.user .message-text{background:#f4f4f4;border-radius:18px;padding:10px 15px}
      .ds-fix-translate{margin:0 0 9px;padding:0;border:1px solid #e7e7e7;border-radius:11px;background:#fff;overflow:hidden}
      .ds-fix-translate summary{list-style:none;cursor:pointer;padding:11px 12px;font-size:13px;color:#333;display:flex;align-items:center;justify-content:space-between}
      .ds-fix-translate summary::-webkit-details-marker{display:none}.ds-fix-translate summary:after{content:'›';font-size:18px;color:#999;transform:rotate(90deg);transition:.15s}.ds-fix-translate:not([open]) summary:after{transform:rotate(0deg)}
      .ds-fix-translate-body{padding:0 11px 11px;border-top:1px solid #eee}.ds-fix-translate-label{display:block;margin:9px 0 5px;font-size:11px;color:#888}
      .ds-fix-translate-list{max-height:300px;overflow:auto;border:1px solid #ddd;border-radius:9px;padding:4px;background:#fff}
      .ds-fix-translate-option{display:flex;align-items:center;gap:8px;padding:8px;border-radius:7px;font-size:12px;color:#333;cursor:pointer}.ds-fix-translate-option:hover{background:#f4f4f4}.ds-fix-translate-option input{width:16px;height:16px;accent-color:#171717}
      .ds-fix-translate-actions{display:flex;gap:7px;margin-top:9px}.ds-fix-translate-toggle{flex:1;height:36px;border:1px solid #ddd;border-radius:8px;background:#fff;color:#333;font-size:12px}.ds-fix-translate-toggle.on{background:#171717;color:#fff;border-color:#171717}
      .ds-fix-translate-note{margin-top:7px;color:#999;font-size:10px;line-height:1.5}.ds-fix-translate-count{font-size:10px;color:#999;margin-top:6px}
      @media(max-width:700px){.ds-fix-tools{margin-left:4px}.ds-fix-btn{padding:0 7px}.ds-fix-menu{width:250px}}
    `;document.head.appendChild(st);
  }

  function addTranslationToDrawer(){
    if($('#dsFixTranslation'))return;
    const drawer=$('#drawer'),bottom=drawer?.querySelector('.drawer-bottom');
    if(!drawer||!bottom)return;
    const details=document.createElement('details');details.className='ds-fix-translate';details.id='dsFixTranslation';
    details.innerHTML=`<summary>🌐 翻譯</summary><div class="ds-fix-translate-body"><label class="ds-fix-translate-label">翻譯成（可複選）</label><div class="ds-fix-translate-list" id="dsTranslateList"></div><div class="ds-fix-translate-count" id="dsTranslateCount"></div><div class="ds-fix-translate-actions"><button type="button" class="ds-fix-translate-toggle" id="dsTranslateToggle">啟用翻譯</button></div><div class="ds-fix-translate-note">正常即時語音固定辨識繁體中文；只有你明確啟用翻譯後，才會把中文翻譯成你勾選的語言。可同時勾選多種語言。</div></div>`;
    bottom.insertBefore(details,bottom.firstElementChild||null);
    const list=$('#dsTranslateList'),count=$('#dsTranslateCount'),toggle=$('#dsTranslateToggle');
    languages.forEach(([id,label])=>{
      const labelEl=document.createElement('label');labelEl.className='ds-fix-translate-option';
      const input=document.createElement('input');input.type='checkbox';input.value=id;input.checked=state.translateTargets.includes(id);
      input.onchange=()=>{state.translateTargets=$$('#dsTranslateList input:checked').map(x=>x.value);if(!state.translateTargets.length){input.checked=true;state.translateTargets=[id]}localStorage.setItem('aivault_translate_targets',JSON.stringify(state.translateTargets));count.textContent=`已選 ${state.translateTargets.length} 種語言`;if(state.active&&state.translate)restartVoice()};
      labelEl.append(input,document.createTextNode(label));list.appendChild(labelEl);
    });
    count.textContent=`已選 ${state.translateTargets.length} 種語言`;
    toggle.classList.toggle('on',state.translate);toggle.textContent=state.translate?'已啟用翻譯':'啟用翻譯';
    toggle.onclick=async e=>{e.preventDefault();e.stopPropagation();state.translate=!state.translate;localStorage.setItem('aivault_voice_translate',state.translate?'1':'0');toggle.classList.toggle('on',state.translate);toggle.textContent=state.translate?'已啟用翻譯':'啟用翻譯';if(state.active)await restartVoice()};
  }

  function addUI(){
    const top=$('.topbar'),brand=$('.brand');if(!top||$('#dsFixTools'))return;
    const wrap=document.createElement('div');wrap.id='dsFixTools';wrap.className='ds-fix-tools';
    const voice=document.createElement('button');voice.type='button';voice.className='ds-fix-btn';voice.id='dsFixVoice';
    const live=document.createElement('button');live.type='button';live.className='ds-fix-btn';live.id='dsFixLive';
    const menu=document.createElement('div');menu.className='ds-fix-menu';menu.id='dsFixMenu';
    voices.forEach(([name,label])=>{const b=document.createElement('button');b.type='button';b.className='ds-fix-voice';b.dataset.voice=name;b.innerHTML=`<span>🔊 ${esc(name)}</span><small>${esc(label)}</small>`;b.onclick=async e=>{e.stopPropagation();await chooseVoice(name)};menu.appendChild(b)});
    wrap.append(voice,menu,live);brand?brand.after(wrap):top.appendChild(wrap);
    const update=()=>{voice.textContent='🔊 '+state.voice;live.textContent=state.active?'⏹ 結束語音':'🎙 即時語音';live.classList.toggle('live',state.active);$$('.ds-fix-voice').forEach(b=>b.classList.toggle('active',b.dataset.voice===state.voice))};
    voice.onclick=e=>{e.stopPropagation();menu.classList.toggle('show')};live.onclick=e=>{e.stopPropagation();state.active?stopVoice():startVoice()};document.addEventListener('click',()=>menu.classList.remove('show'));update();
  }

  function bubble(role){const inner=$('#messagesInner');if(!inner)return null;const row=document.createElement('div');row.className='ds-fix-row '+role;row.innerHTML=`<div class="message-avatar">${role==='user'?'你':'✦'}</div><div class="message-body"><div class="message-text"></div></div>`;inner.appendChild(row);scroll();return row.querySelector('.message-text')}
  function updateBubble(role,text){const key=role==='user'?'userBubble':'assistantBubble';if(!state[key])state[key]=bubble(role);if(state[key])state[key].textContent=text;scroll()}
  async function saveTurn(role,text){if(!state.sessionId||!text)return;try{await fetch(SESSION,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'turn',session_id:state.sessionId,sequence_no:++state.seq,role,content:text})})}catch(e){console.warn('[DarkStar voice] save turn',e)}}
  function stopAudio(){for(const s of state.sources){try{s.stop()}catch{}}state.sources.clear();if(state.ctx)state.nextAudioTime=state.ctx.currentTime}
  function playPCM(base64){if(!state.ctx)return;const u=u8(base64),pcm=new Int16Array(u.buffer,u.byteOffset,Math.floor(u.byteLength/2)),f=new Float32Array(pcm.length);for(let i=0;i<pcm.length;i++)f[i]=pcm[i]/32768;const ac=state.ctx,ab=ac.createBuffer(1,f.length,24000),src=ac.createBufferSource();ab.copyToChannel(f,0);src.buffer=ab;src.connect(ac.destination);const start=Math.max(ac.currentTime,state.nextAudioTime);src.start(start);state.nextAudioTime=start+ab.duration;state.sources.add(src);src.onended=()=>state.sources.delete(src)}

  async function startVoice(){
    if(state.active)return;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('此瀏覽器不支援音訊播放');
      state.ctx=new AC();await state.ctx.resume();
      const sr=await fetch(SESSION,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start',voice_profile:state.voice})});
      const sj=await sr.json();if(!sr.ok||!sj.session)throw Error(sj.error||'語音工作階段建立失敗');
      state.sessionId=sj.session.id;state.sessionKey=sj.session.session_key;state.seq=0;
      state.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      const params=new URLSearchParams();params.set('voice',state.voice);params.set('session_key',state.sessionKey||'');params.set('language','mandarin');
      if(state.translate){params.set('translate','1');params.set('languages',state.translateTargets.join(','));}
      state.ws=new WebSocket(RELAY+'?'+params.toString());
      state.ws.onopen=()=>{state.active=true;state.ready=true;addUI();const ac=state.ctx;const src=ac.createMediaStreamSource(state.stream);const p=ac.createScriptProcessor(4096,1,1);state.source=src;state.processor=p;src.connect(p);p.connect(ac.destination);p.onaudioprocess=e=>{if(!state.active||!state.ws||state.ws.readyState!==WebSocket.OPEN)return;state.ws.send(JSON.stringify({type:'audio',data:b64(e.inputBuffer.getChannelData(0)),mimeType:'audio/pcm;rate=16000'}))};addUI()};
      state.ws.onmessage=async e=>{try{const m=JSON.parse(e.data);const c=m.serverContent||{};if(m.setupComplete){state.ready=true;return}if(c.inputTranscription?.text){state.inputText+=c.inputTranscription.text;updateBubble('user',state.inputText)}if(c.outputTranscription?.text){state.outputText+=c.outputTranscription.text;updateBubble('assistant',state.outputText)}if(c.modelTurn?.parts)for(const part of c.modelTurn.parts){if(part.inlineData?.data)playPCM(part.inlineData.data)}if(c.interrupted)stopAudio();if(c.turnComplete){await saveTurn('user',state.inputText);await saveTurn('assistant',state.outputText);state.inputText='';state.outputText='';state.userBubble=null;state.assistantBubble=null}}catch(err){console.warn('[DarkStar voice] message',err)}};
      state.ws.onerror=()=>{};state.ws.onclose=()=>stopVoice();
    }catch(e){console.error('[DarkStar voice] start',e);stopVoice();alert(e?.message||'即時語音啟動失敗')}
  }

  async function restartVoice(){if(!state.active)return;const wasActive=state.active;stopVoice();if(wasActive)await startVoice()}
  async function chooseVoice(name){state.voice=name;localStorage.setItem('aivault_voice_profile',name);if(state.active)await restartVoice();addUI()}

  function stopVoice(){state.active=false;state.ready=false;try{state.ws?.close()}catch{}state.ws=null;try{state.processor?.disconnect()}catch{}try{state.source?.disconnect()}catch{}try{state.stream?.getTracks().forEach(t=>t.stop())}catch{}state.processor=null;state.source=null;state.stream=null;stopAudio();try{state.ctx?.close()}catch{}state.ctx=null;state.sessionId=null;state.sessionKey=null;state.inputText='';state.outputText='';state.userBubble=null;state.assistantBubble=null;addUI()}

  function connectTypedInput(){
    const input=$('.composer-input'),send=$('.composer-send');
    if(!input||!send||send.dataset.dsVoiceBound==='1')return;
    send.dataset.dsVoiceBound='1';
    send.addEventListener('click',e=>{
      if(!state.active||!state.ready||!state.ws||state.ws.readyState!==WebSocket.OPEN)return;
      const text=String(input.value||'').trim();
      if(!text)return;
      e.preventDefault();e.stopImmediatePropagation();
      input.value='';
      state.inputText='';state.outputText='';state.userBubble=null;state.assistantBubble=null;
      updateBubble('user',text);
      state.ws.send(JSON.stringify({type:'text',text}));
    },true);
    input.addEventListener('keydown',e=>{
      if(e.key!=='Enter'||e.shiftKey||!state.active||!state.ready||!state.ws||state.ws.readyState!==WebSocket.OPEN)return;
      const text=String(input.value||'').trim();
      if(!text)return;
      e.preventDefault();e.stopImmediatePropagation();
      send.click();
    },true);
  }

  function boot(){addStyle();addUI();addTranslationToDrawer();connectTypedInput();let n=0;const t=setInterval(()=>{addUI();addTranslationToDrawer();connectTypedInput();if(++n>30)clearInterval(t)},500)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
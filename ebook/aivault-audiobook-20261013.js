(function () {
  'use strict';
  const $=id=>document.getElementById(id), bridge=window.AIVAULTReaderBridge;
  if(!bridge)return;
  let segments=[], index=0, page=0, book='', status='idle', generation=0, audio=null, audioURL='', request=null, utterance=null, timer=null;
  let voiceChoice=localStorage.getItem('aivault_listen_voice')||'', rate=Number(localStorage.getItem('aivault_listen_rate'))||1;
  if(!localStorage.getItem('aivault_listen_gemini_v1')){voiceChoice='gemini:Aoede';localStorage.setItem('aivault_listen_voice',voiceChoice);localStorage.setItem('aivault_listen_gemini_v1','1');}
  let cloudPlayer=null;
  const audioCache=new Map();
  function unlockCloudAudio(){if(!cloudPlayer)cloudPlayer=new Audio();if(!audio||!audio.src){cloudPlayer.src="data:audio/wav;base64,UklGRmQBAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";cloudPlayer.play().catch(()=>{});}}
  let geminiQueue=Promise.resolve(), nextGeminiAt=0, intervalMs=0, loadingNote='';
  function clearAudioCache(){audioCache.forEach((entry,key)=>{if(!entry.done){entry.controller.abort();audioCache.delete(key);}});}
  function cloudVoice(){return voiceChoice==='natural'||voiceChoice.startsWith('gemini:');}
  function delay(ms,signal){return new Promise((resolve,reject)=>{if(signal.aborted){reject(new DOMException('Aborted','AbortError'));return;}const aborted=()=>{clearTimeout(id);reject(new DOMException('Aborted','AbortError'));};const id=setTimeout(()=>{signal.removeEventListener('abort',aborted);resolve();},Math.max(0,ms));signal.addEventListener('abort',aborted,{once:true});});}
  let cacheDB=null;
  function openAudioDB(){if(!window.indexedDB)return Promise.resolve(null);if(cacheDB)return cacheDB;cacheDB=new Promise(resolve=>{const req=window.indexedDB.open('aivault-narration-cache',1);req.onupgradeneeded=()=>req.result.createObjectStore('clips',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=req.onblocked=()=>resolve(null);});return cacheDB;}
  async function savedAudio(key){try{const db=await openAudioDB();if(!db)return null;return await new Promise(resolve=>{const req=db.transaction('clips').objectStore('clips').get(key);req.onsuccess=()=>resolve(req.result?.blob||null);req.onerror=()=>resolve(null);});}catch(e){return null;}}
  async function saveAudio(key,blob){try{const db=await openAudioDB();if(!db)return;const tx=db.transaction('clips','readwrite'), store=tx.objectStore('clips');store.put({id:key,blob,at:Date.now()});const all=store.getAll();all.onsuccess=()=>{const rows=all.result.sort((a,b)=>b.at-a.at);let total=0;rows.forEach((r,i)=>{total+=r.blob.size;if(i>=32||total>33554432)store.delete(r.id);});};}catch(e){}}
  async function geminiResponse(text,choice,controller){
    const E=window.AIVAULTEbook;
    for(let attempt=0;attempt<3;attempt++){
      const wait=nextGeminiAt-Date.now();if(wait>0){if(request===controller&&status==='loading'){loadingNote='Gemini 暫時限流，約 '+Math.ceil(wait/1000)+' 秒後自動續播';render();}await delay(wait,controller.signal);}
      if(controller.signal.aborted)throw new DOMException('Aborted','AbortError');
      nextGeminiAt=Date.now()+intervalMs;
      const response=await fetch((E.SUPABASE_URL||'https://clcddygkaaqqtsbswgdf.supabase.co')+'/functions/v1/aivault-tts',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',apikey:E.ANON_KEY||'',Authorization:'Bearer '+(E.ANON_KEY||'')},body:JSON.stringify({action:'tts',provider:'gemini',text,voice_id:choice.slice(7),language:'zh-TW',save:false})});
      const data=await response.json(),result=data.result;
      if(response.status===429||/429|GEMINI_TTS_QUOTA/.test(String(data.message||data.error||''))){
        if(data.quota_kind==='daily')throw new Error('Gemini 今日語音額度已用完，需等額度重置；更換音色無法增加額度');
        if(data.quota_kind==='disabled')throw new Error('目前 Gemini 專案沒有這個語音模型的可用配額');
        const seconds=Math.max(1,Number(data.retry_after_seconds)||60);intervalMs=Math.max(intervalMs,data.requests_per_minute?Math.ceil(60000/Number(data.requests_per_minute))+1000:21000);nextGeminiAt=Date.now()+seconds*1000;
        if(attempt===2)throw new Error('Gemini 仍在限制請求，已保留閱讀位置；稍後再按播放');
        continue;
      }
      if(!response.ok||!data.success||result?.provider!=='gemini'||!result.audio_base64||result.fallback){const message=String(data.message||data.error||'HTTP '+response.status);if(/NOT_CONFIGURED/.test(message))throw new Error('Gemini 語音金鑰尚未設定');throw new Error('Gemini 語音尚未可用：'+message);}
      loadingNote='';const bytes=Uint8Array.from(atob(result.audio_base64),c=>c.charCodeAt(0));return new Blob([bytes],{type:result.mime||'audio/wav'});
    }
  }
  function getCloudAudio(text){
    const choice=voiceChoice,key='tts-v1|'+choice+'|'+text,cached=audioCache.get(key);
    if(cached&&(!cached.controller.signal.aborted||cached.done))return cached;
    const controller=new AbortController(), E=window.AIVAULTEbook,gemini=choice.startsWith('gemini:'),entry={controller,promise:null,done:false};
    const task=async()=>{
      const saved=await savedAudio(key);if(saved)return saved;
      if(gemini)return geminiResponse(text,choice,controller);
      const response=await fetch((E.SUPABASE_URL||'https://clcddygkaaqqtsbswgdf.supabase.co')+'/functions/v1/fish-tts',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',apikey:E.ANON_KEY||'',Authorization:'Bearer '+(E.ANON_KEY||'')},body:JSON.stringify({text,reference_id:naturalVoice(),format:'mp3'})});
      if(!response.ok)throw new Error('語音服務 HTTP '+response.status);if(/json/i.test(response.headers.get('content-type')||''))throw new Error('語音服務未回傳音訊');return response.blob();
    };
    entry.promise=(gemini?geminiQueue.then(task):task()).then(blob=>{if(!blob||blob.size<200)throw new Error('語音內容為空');entry.done=true;saveAudio(key,blob);return blob;}).catch(e=>{if(audioCache.get(key)===entry)audioCache.delete(key);throw e;});
    if(gemini)geminiQueue=entry.promise.catch(()=>{});
    audioCache.set(key,entry);if(audioCache.size>8){const first=audioCache.keys().next().value;if(first!==key)audioCache.delete(first);}return entry;
  }
  function naturalVoice(){return (localStorage.getItem('FISH_VOICE_ID')||'').trim();}
  function preparePaper(paper){
    const walker=document.createTreeWalker(paper,NodeFilter.SHOW_TEXT);const nodes=[];
    while(walker.nextNode())if(walker.currentNode.textContent.trim()&&!walker.currentNode.parentElement.closest('script,style,button,iframe,video,a'))nodes.push(walker.currentNode);
    let pieces=[], text='', number=0;
    function flush(){if(text.trim()){pieces.push(text.trim());number++;}text='';}
    nodes.forEach(node=>{
      const heading=node.parentElement.closest('h1,h2,h3,h4');if(heading||(node.previousSibling&&node.previousSibling.nodeName==='BR'&&node.previousSibling.previousSibling&&node.previousSibling.previousSibling.nodeName==='BR'))flush();
      const fragment=document.createDocumentFragment();
      const chunks=node.textContent.match(/[^。！？；!?;]+[。！？；!?;]?|[。！？；!?;]/g)||[node.textContent];
      chunks.forEach(chunk=>{
        for(let offset=0;offset<chunk.length;){
          const capacity=Math.max(1,180-text.length), part=chunk.slice(offset,offset+capacity);offset+=part.length;
          const span=document.createElement('span');span.dataset.narration=String(number);span.textContent=part;fragment.appendChild(span);text+=part;
          if(text.length>=180||/[。！？；!?;]$/.test(part))flush();
        }
      });
      node.replaceWith(fragment);if(heading)flush();
    });flush();paper._narrationSegments=pieces;
  }
  function loadSegments(){
    const info=bridge.info();segments=bridge.paper()._narrationSegments||[];page=info.page;book=info.id;
    index=Math.max(0,Math.min(index,Math.max(0,segments.length-1)));
  }
  function remember(){try{localStorage.setItem('aivault_listen_position_'+book,JSON.stringify({page,index}));}catch(e){}}
  function savedPosition(){try{return JSON.parse(localStorage.getItem('aivault_listen_position_'+bridge.info().id)||'null');}catch(e){return null;}}
  function render(){
    const info=bridge.info();$('listenTitle').textContent=info.title;$('listenCoverTitle').textContent=info.title;$('listenChapter').textContent=info.chapter;
    $('listenLocation').textContent='第 '+info.page+' / '+info.total+' 頁';
    $('listenCoverImg').hidden=!info.cover;$('listenCoverArt').hidden=!!info.cover;
    if(info.cover&&$('listenCoverImg').getAttribute('src')!==info.cover)$('listenCoverImg').src=info.cover;
    $('listenExcerpt').textContent=segments[index]||'此頁沒有可朗讀文字。';
    $('listenProgress').max=String(Math.max(0,segments.length-1));$('listenProgress').value=String(index);$('listenProgress').disabled=!segments.length;
    $('listenSegmentLabel').textContent=segments.length?'第 '+(index+1)+' / '+segments.length+' 段':'無文字';
    const running=status==='playing'||status==='loading';$('listenPlay').textContent=running?'Ⅱ':'▶';$('listenPlay').setAttribute('aria-label',running?'暫停聽書':'播放聽書');
    $('listenPrev').disabled=page<=1&&index===0;$('listenNext').disabled=page>=info.total&&index>=segments.length-1;
    $('listenEngineBadge').textContent=voiceChoice.startsWith('gemini:')?'Gemini 自然朗讀':voiceChoice==='natural'?'自然朗讀':'裝置語音';
    if(status!=='error')$('listenStatus').textContent=({idle:'準備播放',loading:loadingNote||'載入語音…',playing:'正在朗讀',paused:'已暫停',ended:'已讀完'})[status]||'準備播放';
    $('listenPlay').dataset.state=status;
  }
  function syncReader(){
    if(bridge.info().view==='listen')render();
    if(book!==bridge.info().id||page!==bridge.info().page)return;
    if(status==='playing'||status==='paused')bridge.follow(index);
  }
  function updatePosition(){remember();render();syncReader();}
  function cancelPlayback(){
    generation++;if(request){request.abort();request=null;}
    if(audio){audio.onended=audio.onplaying=audio.onerror=null;audio.pause();audio.removeAttribute('src');audio.load();audio=null;}
    if(audioURL){URL.revokeObjectURL(audioURL);audioURL='';}
    utterance=null;try{window.speechSynthesis.cancel();}catch(e){}
  }
  function stop(){cancelPlayback();clearAudioCache();status='idle';clearTimeout(timer);timer=null;$('listenTimer').value='0';document.querySelectorAll('.narration-active').forEach(el=>el.classList.remove('narration-active'));render();}
  function error(message){cancelPlayback();status='error';$('listenStatus').textContent=message;render();}
  function voices(){return window.speechSynthesis?window.speechSynthesis.getVoices():[];}
  function refreshVoices(){
    const list=voices(), select=$('listenVoice');select.innerHTML='';
    const add=(value,label)=>{const option=document.createElement('option');option.value=value;option.textContent=label;select.appendChild(option);};
    [['Aoede','輕柔自然'],['Kore','沉穩清晰'],['Charon','知性敘述'],['Puck','輕快親切'],['Zephyr','明亮有活力']].forEach(v=>add('gemini:'+v[0],'Gemini · '+v[1]+'（'+v[0]+'）'));
    add('','裝置預設中文');
    list.filter(v=>/^zh|^cmn|^yue/i.test(v.lang)).forEach(v=>add(v.voiceURI,v.name+' · '+v.lang));
    if(naturalVoice())add('natural','自然朗讀 · 已設定聲音');
    if(!Array.from(select.options).some(o=>o.value===voiceChoice))voiceChoice='';
    select.value=voiceChoice;$('listenNaturalVoice').value=naturalVoice();render();
  }
  async function advance(token){
    if(token!==generation||status!=='playing')return;
    if(index+1<segments.length){index++;playSegment();return;}
    if(page>=bridge.info().total){status='ended';updatePosition();return;}
    status='loading';render();
    const next=page+1;const ok=await bridge.loadPage(next);
    if(token!==generation)return;
    if(!ok){error('下一頁載入失敗，請再按播放重試。');return;}
    index=0;loadSegments();playSegment();
  }
  function spokenText(text){return text.replace(/\s+/g,' ').trim();}
  function playSegment(){
    cancelPlayback();const token=generation;
    loadSegments();remember();
    if(!segments.length){status='playing';render();advance(token);return;}
    const text=spokenText(segments[index]);loadingNote='';status='loading';render();
    const started=()=>{if(token!==generation)return;status='playing';updatePosition();};
    const ended=()=>{if(token!==generation||status==='paused')return;status='playing';advance(token);};
    if(cloudVoice()){
      if(voiceChoice==='natural'&&!naturalVoice()){error('請先設定自然朗讀聲音。');return;}
      if(!cloudPlayer)cloudPlayer=new Audio();audio=cloudPlayer;audio.preload='auto';audio.playbackRate=rate;
      const entry=getCloudAudio(text);request=entry.controller;
      entry.promise.then(async blob=>{
        if(token!==generation)return;
        audioURL=URL.createObjectURL(blob);audio.src=audioURL;
        audio.onplaying=()=>{started();if(token===generation&&!voiceChoice.startsWith('gemini:')&&index+1<segments.length)getCloudAudio(spokenText(segments[index+1])).promise.catch(()=>{});};
        audio.onended=ended;audio.onerror=()=>{if(token===generation)error('音訊播放失敗，請再按播放。');};
        await audio.play();
      }).catch(e=>{if(token===generation&&e.name!=='AbortError')error(e.message);});
    }else{
      if(!window.speechSynthesis){error('此裝置不支援朗讀，請設定自然朗讀聲音。');return;}
      const list=voices(), selected=list.find(v=>v.voiceURI===voiceChoice)||list.find(v=>/^zh-TW$/i.test(v.lang))||list.find(v=>/^zh|^cmn/i.test(v.lang));
      utterance=new SpeechSynthesisUtterance(text);utterance.lang=selected?selected.lang:'zh-TW';utterance.rate=rate;if(selected)utterance.voice=selected;
      utterance.onstart=started;utterance.onboundary=e=>{if(token===generation&&status==='playing')bridge.follow(index,e.charIndex||0);};utterance.onend=ended;utterance.onerror=e=>{if(token===generation)error('朗讀中斷：'+e.error+'，請按播放重試。');};
      try{speechSynthesis.speak(utterance);}catch(e){error('朗讀無法啟動，請再試一次。');}
    }
  }
  function pause(){
    if(status==='loading'){cancelPlayback();status='paused';render();return;}
    if(status!=='playing')return;
    status='paused';if(audio)audio.pause();else try{speechSynthesis.pause();}catch(e){}render();remember();
  }
  function resume(){
    if(audio&&audio.src){status='loading';render();audio.play().catch(()=>error('播放需要再次點擊，請再按播放。'));return;}
    if(utterance&&window.speechSynthesis.paused){status='playing';render();speechSynthesis.resume();syncReader();return;}
    playSegment();
  }
  function toggle(){if(cloudVoice()&&status!=='playing'&&status!=='loading')unlockCloudAudio();if(status==='playing'||status==='loading')pause();else if(status==='paused')resume();else playSegment();}
  async function seek(delta){
    const running=status==='playing'||status==='loading';cancelPlayback();const token=generation;status='paused';
    let target=index+delta;
    if(target<0&&page>1){const ok=await bridge.loadPage(page-1);if(token!==generation)return;if(!ok){error('上一頁載入失敗');return;}loadSegments();target=segments.length-1;}
    else if(target>=segments.length&&page<bridge.info().total){const ok=await bridge.loadPage(page+1);if(token!==generation)return;if(!ok){error('下一頁載入失敗');return;}loadSegments();target=0;}
    index=Math.max(0,Math.min(Math.max(0,segments.length-1),target));updatePosition();if(running)playSegment();
  }
  function open(){
    if(page!==bridge.info().page||book!==bridge.info().id||status==='idle'){const reading=bridge.info().view==='read';cancelPlayback();index=0;status='idle';loadSegments();const saved=savedPosition();if(reading)index=bridge.visibleSegment();else if(saved&&saved.page===page)index=Math.min(saved.index||0,Math.max(0,segments.length-1));}
    bridge.listen();refreshVoices();render();
  }
  function read(){bridge.read();syncReader();}
  $('listenBack').onclick=read;$('listenRead').onclick=read;$('listenPlay').onclick=toggle;$('listenStop').onclick=stop;
  $('listenPrev').onclick=()=>seek(-1);$('listenNext').onclick=()=>seek(1);
  $('listenProgress').onchange=function(){const running=status==='playing'||status==='loading';cancelPlayback();status='paused';index=Number(this.value);updatePosition();if(running)playSegment();};
  $('listenRate').value=String(rate);$('listenRate').onchange=function(){rate=Number(this.value);localStorage.setItem('aivault_listen_rate',String(rate));if(audio)audio.playbackRate=rate;else if(status==='playing')playSegment();else if(status==='paused')cancelPlayback();};
  $('listenVoice').onchange=function(){const running=status==='playing'||status==='loading';cancelPlayback();clearAudioCache();status='paused';voiceChoice=this.value;localStorage.setItem('aivault_listen_voice',voiceChoice);render();if(running)playSegment();};
  $('listenSaveVoice').onclick=function(){localStorage.setItem('FISH_VOICE_ID',$('listenNaturalVoice').value.trim());refreshVoices();};
  $('listenTimer').onchange=function(){clearTimeout(timer);timer=null;const minutes=Number(this.value);if(minutes)timer=setTimeout(()=>{pause();$('listenTimer').value='0';},minutes*60000);};
  $('listenCoverImg').onerror=function(){this.hidden=true;$('listenCoverArt').hidden=false;};
  if(window.speechSynthesis)window.speechSynthesis.addEventListener('voiceschanged',refreshVoices);
  window.addEventListener('pagehide',()=>{remember();cancelPlayback();clearAudioCache();});
  window.AIVAULTAudiobook={open,read,stop,preparePaper,syncReader};
  if(bridge.paper().textContent.trim()&&!bridge.paper()._narrationSegments)preparePaper(bridge.paper());
  refreshVoices();
})();

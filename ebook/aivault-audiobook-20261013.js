(function () {
  'use strict';
  const $=id=>document.getElementById(id), bridge=window.AIVAULTReaderBridge;
  if(!bridge)return;
  let segments=[], index=0, page=0, book='', status='idle', generation=0, audio=null, audioURL='', request=null, utterance=null, timer=null;
  let voiceChoice=localStorage.getItem('aivault_listen_voice')||'', rate=Number(localStorage.getItem('aivault_listen_rate'))||1;
  function naturalVoice(){return (localStorage.getItem('FISH_VOICE_ID')||'').trim();}
  function preparePaper(paper){
    const walker=document.createTreeWalker(paper,NodeFilter.SHOW_TEXT);const nodes=[];
    while(walker.nextNode())if(walker.currentNode.textContent.trim()&&!walker.currentNode.parentElement.closest('script,style,button,iframe,video,a'))nodes.push(walker.currentNode);
    let pieces=[], text='', number=0;
    function flush(){if(text.trim()){pieces.push(text.trim());number++;}text='';}
    nodes.forEach(node=>{
      const heading=node.parentElement.closest('h1,h2,h3,h4');if(heading)flush();
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
    $('listenEngineBadge').textContent=voiceChoice==='natural'?'自然朗讀':'裝置語音';
    if(status!=='error')$('listenStatus').textContent=({idle:'準備播放',loading:'載入語音…',playing:'正在朗讀',paused:'已暫停',ended:'已讀完'})[status]||'準備播放';
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
  function stop(){cancelPlayback();status='idle';clearTimeout(timer);timer=null;$('listenTimer').value='0';document.querySelectorAll('.narration-active').forEach(el=>el.classList.remove('narration-active'));render();}
  function error(message){cancelPlayback();status='error';$('listenStatus').textContent=message;render();}
  function voices(){return window.speechSynthesis?window.speechSynthesis.getVoices():[];}
  function refreshVoices(){
    const list=voices(), select=$('listenVoice');select.innerHTML='';
    const add=(value,label)=>{const option=document.createElement('option');option.value=value;option.textContent=label;select.appendChild(option);};
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
    const text=spokenText(segments[index]);status='loading';render();
    const started=()=>{if(token!==generation)return;status='playing';updatePosition();};
    const ended=()=>{if(token!==generation||status==='paused')return;status='playing';advance(token);};
    if(voiceChoice==='natural'){
      if(!naturalVoice()){error('請先設定自然朗讀聲音。');return;}
      const E=window.AIVAULTEbook;request=new AbortController();
      audio=new Audio();audio.preload='auto';audio.playbackRate=rate;
      fetch(E.SUPABASE_URL?E.SUPABASE_URL+'/functions/v1/fish-tts':'https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/fish-tts',{
        method:'POST',signal:request.signal,headers:{'Content-Type':'application/json',apikey:E.ANON_KEY||'',Authorization:'Bearer '+(E.ANON_KEY||'')},
        body:JSON.stringify({text,reference_id:naturalVoice(),format:'mp3'})
      }).then(async response=>{
        if(!response.ok)throw new Error('語音服務 HTTP '+response.status);
        if(/json/i.test(response.headers.get('content-type')||''))throw new Error('語音服務未回傳音訊');
        const blob=await response.blob();if(blob.size<200)throw new Error('語音內容為空');
        if(token!==generation)return;
        audioURL=URL.createObjectURL(blob);audio.src=audioURL;audio.onplaying=started;audio.onended=ended;
        audio.onerror=()=>{if(token===generation)error('音訊播放失敗，請再按播放。');};
        await audio.play();
      }).catch(e=>{if(token===generation&&e.name!=='AbortError')error(e.message+'；請按播放重試或改選裝置語音。');});
    }else{
      if(!window.speechSynthesis){error('此裝置不支援朗讀，請設定自然朗讀聲音。');return;}
      const list=voices(), selected=list.find(v=>v.voiceURI===voiceChoice)||list.find(v=>/^zh-TW$/i.test(v.lang))||list.find(v=>/^zh|^cmn/i.test(v.lang));
      utterance=new SpeechSynthesisUtterance(text);utterance.lang=selected?selected.lang:'zh-TW';utterance.rate=rate;if(selected)utterance.voice=selected;
      utterance.onstart=started;utterance.onend=ended;utterance.onerror=e=>{if(token===generation)error('朗讀中斷：'+e.error+'，請按播放重試。');};
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
  function toggle(){if(status==='playing'||status==='loading')pause();else if(status==='paused')resume();else playSegment();}
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
  $('listenVoice').onchange=function(){const running=status==='playing'||status==='loading';cancelPlayback();status='paused';voiceChoice=this.value;localStorage.setItem('aivault_listen_voice',voiceChoice);render();if(running)playSegment();};
  $('listenSaveVoice').onclick=function(){localStorage.setItem('FISH_VOICE_ID',$('listenNaturalVoice').value.trim());refreshVoices();};
  $('listenTimer').onchange=function(){clearTimeout(timer);timer=null;const minutes=Number(this.value);if(minutes)timer=setTimeout(()=>{pause();$('listenTimer').value='0';},minutes*60000);};
  $('listenCoverImg').onerror=function(){this.hidden=true;$('listenCoverArt').hidden=false;};
  if(window.speechSynthesis)window.speechSynthesis.addEventListener('voiceschanged',refreshVoices);
  window.addEventListener('pagehide',()=>{remember();cancelPlayback();});
  window.AIVAULTAudiobook={open,read,stop,preparePaper,syncReader};
  if(bridge.paper().textContent.trim()&&!bridge.paper()._narrationSegments)preparePaper(bridge.paper());
  refreshVoices();
})();

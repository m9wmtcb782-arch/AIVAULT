async function extractPptText(file){slideTexts=[];$('pptTextStatus').textContent='PPT 文字索引：正在建立…';try{const JSZip=(await import('https://esm.sh/jszip@3.10.1')).default;const zip=await JSZip.loadAsync(await file.arrayBuffer());const names=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/i.test(n));names.sort((a,b)=>Number(a.match(/slide(\d+)/i)[1])-Number(b.match(/slide(\d+)/i)[1]));for(const name of names){const xml=await zip.files[name].async('text');const doc=new DOMParser().parseFromString(xml,'application/xml');const arr=[...doc.getElementsByTagName('a:t')].map(x=>x.textContent||'').filter(Boolean);slideTexts.push(arr.join(' '))}$('pptTextStatus').textContent='PPT 文字索引：已完成，共 '+slideTexts.length+' 頁';return true}catch(e){console.warn('PPT text extraction',e);$('pptTextStatus').textContent='PPT 文字索引：瀏覽器無法擷取文字，但投影片仍可播放';return false}}
async function loadPpt(f){stopReading();$('view').textContent='正在解析 PPT…';$('thumbs').textContent='正在建立縮圖…';try{const textPromise=extractPptText(f);const m=await import('https://esm.sh/@aiden0z/pptx-renderer@1.2.4');viewer=await m.PptxViewer.open(await f.arrayBuffer(),$('view'),{renderMode:'slide',fitMode:'contain'});count=Number(viewer.slideCount)||0;if(!count)throw Error('沒有投影片');await textPromise;$('thumbs').innerHTML='';for(let k=0;k<count;k++){const t=document.createElement('div');t.className='thumb';t.innerHTML='<div>第 '+(k+1)+' 頁</div>';const box=document.createElement('div');box.className='tp';t.appendChild(box);t.onclick=()=>go(k);$('thumbs').appendChild(t);try{const h=viewer.renderThumbnailToContainer(k,box,{width:105});if(h&&h.ready)await h.ready}catch(e){console.warn('thumbnail',k,e)}}index=0;await go(0);say('PPT 已載入，共 '+count+' 頁。')}catch(e){console.error(e);$('view').textContent='PPT 預覽失敗：'+(e.message||e);say('PPT 預覽失敗。')}}
$('file').onchange=e=>e.target.files[0]&&loadPpt(e.target.files[0]);$('next').onclick=()=>{go(index+1);say('下一頁。')};$('prev').onclick=()=>{go(index-1);say('上一頁。')};$('goto').onclick=()=>{const n=prompt('請輸入頁碼',index+1);if(n){go(Number(n)-1)}};function pageReadingText(){const t=slideTexts[index]||'';return t.trim()||'這一頁目前沒有擷取到可讀文字。'}$('readPage').onclick=()=>{const t=pageReadingText();if(t.startsWith('這一頁目前'))return say(t);speakText(t)};

const EBOOK_SUPABASE_URL='https://clcddygkaaqqtsbswgdf.supabase.co';
const EBOOK_PUBLISHABLE_KEY='sb_publishable_1D05YGthBrNGg-5L92TLCw_GiLnInBu';
const EBOOK_INGEST=EBOOK_SUPABASE_URL+'/functions/v1/dark-star-ebook-ingest';
const CLASSROOM_API=EBOOK_SUPABASE_URL+'/functions/v1/dark-star-ebook-ingest';
const CLASSROOM_REALTIME=EBOOK_SUPABASE_URL+'/realtime/v1/api/broadcast';
let classroomActive=false;
let classroomState={code:'',channel_token:'',owner_token:'',expires_at:''};
let classroomSupabase=null;
let classroomChannel=null;
let classroomRealtimeReady=false;
let lastClassroomPayload=null;
let classroomAudioRetryTimer=null;
let classroomMicStream=null;
const classroomPeers=new Map();
const CLASSROOM_ICE_SERVERS=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}];
async function classroomStartAudio(){
  if(classroomMicStream)return classroomMicStream;
  try{
    classroomMicStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    return classroomMicStream;
  }catch(e){
    classroomMicStream=null;
    throw Error('無法取得老師麥克風：請允許瀏覽器使用麥克風。');
  }
}
function classroomStopAudio(){
  if(classroomMicStream){classroomMicStream.getTracks().forEach(t=>t.stop());classroomMicStream=null;}
  classroomPeers.forEach(pc=>{try{pc.close()}catch{}});classroomPeers.clear();
}
async function classroomSendSignal(event,payload){
  if(!classroomChannel)return;
  if(!classroomRealtimeReady){
    await new Promise(resolve=>setTimeout(resolve,300));
    if(!classroomChannel||!classroomRealtimeReady)return;
  }
  try{await classroomChannel.send({type:'broadcast',event,payload});}catch(e){console.warn('classroom audio signal',e);}
}
async function classroomHandleAudioJoin(payload){
  if(!classroomActive||!classroomRealtimeReady||!payload?.peer_id)return;
  const peerId=String(payload.peer_id);
  const existing=classroomPeers.get(peerId);
  if(existing){
    if(['connected','completed'].includes(existing.connectionState))return;
    try{existing.close()}catch{} classroomPeers.delete(peerId);
  }
  try{
    const stream=await classroomStartAudio();
    const pc=new RTCPeerConnection({iceServers:CLASSROOM_ICE_SERVERS});
    classroomPeers.set(peerId,pc);
    stream.getTracks().forEach(track=>pc.addTrack(track,stream));
    pc.onicecandidate=e=>{if(e.candidate)classroomSendSignal('audio_ice',{to:peerId,from:'teacher',candidate:e.candidate});};
    pc.onconnectionstatechange=()=>{if(['failed','closed','disconnected'].includes(pc.connectionState)&&pc.connectionState==='closed')classroomPeers.delete(peerId);};
    const offer=await pc.createOffer({offerToReceiveAudio:false});
    await pc.setLocalDescription(offer);
    await classroomSendSignal('audio_offer',{to:peerId,from:'teacher',description:pc.localDescription});
  }catch(e){console.warn('teacher audio peer',e);}
}
async function classroomHandleAudioAnswer(payload){
  if(!payload?.peer_id||payload.from!=='student')return;
  const pc=classroomPeers.get(String(payload.peer_id));if(!pc||!payload.description)return;
  try{await pc.setRemoteDescription(payload.description);}catch(e){console.warn('teacher audio answer',e);}
}
async function classroomHandleAudioIce(payload){
  if(!payload?.peer_id||payload.from!=='student'||!payload.candidate)return;
  const pc=classroomPeers.get(String(payload.peer_id));if(!pc)return;
  try{await pc.addIceCandidate(payload.candidate);}catch(e){console.warn('teacher audio ice',e);}
}
function classroomApi(payload){
  return fetch(CLASSROOM_API,{method:'POST',headers:{'Content-Type':'application/json',apikey:EBOOK_PUBLISHABLE_KEY},body:JSON.stringify(payload)})
    .then(async r=>{const raw=await r.text();let d={};try{d=raw?JSON.parse(raw):{}}catch{}if(!r.ok)throw Error(d.error||d.message||('課堂服務 HTTP '+r.status));return d});
}
function classroomBadge(){
  let inline=document.getElementById('aivaultClassroomCodeInline');
  const startBtn=$('start');
  if(!inline && startBtn && startBtn.parentElement){
    inline=document.createElement('span');
    inline.id='aivaultClassroomCodeInline';
    inline.style.cssText='display:inline-flex;align-items:center;justify-content:center;margin:0 8px 0 0;padding:5px 9px;border-radius:8px;font-size:16px;font-weight:800;letter-spacing:2px;text-align:center;color:#7567ff;background:rgba(255,255,255,.92);line-height:1.2;white-space:nowrap;pointer-events:none;vertical-align:middle;z-index:31;';
    startBtn.parentElement.insertBefore(inline,startBtn);
  }
  if(inline){
    inline.textContent=classroomState.code?'教室 '+classroomState.code:'課堂代碼建立中…';
    if(classMode){
      inline.style.position='absolute';
      inline.style.right='12px';
      inline.style.top='8px';
      inline.style.margin='0';
      inline.style.display=classroomState.code?'inline-flex':'none';
    }else{
      inline.style.position='static';
      inline.style.right='auto';
      inline.style.top='auto';
      inline.style.margin='0 8px 0 0';
      inline.style.display=classroomState.code?'inline-flex':'none';
    }
  }
  const oldBadge=document.getElementById('aivaultClassroomBadge');
  if(oldBadge)oldBadge.remove();
}
async function ensureClassroom(){
  const saved=(()=>{try{return JSON.parse(sessionStorage.getItem('aivault_classroom')||'null')}catch{return null}})();
  if(saved&&saved.code&&saved.channel_token&&saved.owner_token&&(!saved.expires_at||Date.parse(saved.expires_at)>Date.now()+60000)){classroomState=saved;classroomBadge();return classroomState;}
  const d=await classroomApi({action:'classroom_create'});
  const c=d.classroom;if(!c?.code||!c?.channel_token||!c?.owner_token)throw Error('未取得課堂入口');
  classroomState={code:String(c.code),channel_token:String(c.channel_token),owner_token:String(c.owner_token),expires_at:c.expires_at||''};
  sessionStorage.setItem('aivault_classroom',JSON.stringify(classroomState));
  classroomBadge();
  return classroomState;
}
async function classroomUpdateState(payload){
  if(!classroomActive||!classroomState.owner_token)return;
  lastClassroomPayload={type:payload.type||'page',page:Number(payload.page)||1,total:Number(payload.total)||0,content:String(payload.content||''),videos:Array.isArray(payload.videos)?payload.videos:[]};
  try{await classroomApi({action:'classroom_update',channel_token:classroomState.channel_token,owner_token:classroomState.owner_token,state:lastClassroomPayload});}catch(e){console.warn('classroom state update',e);}
}
async function classroomBroadcast(payload){
  const clean={type:payload.type||'page',page:Number(payload.page)||1,total:Number(payload.total)||0,content:String(payload.content||''),videos:Array.isArray(payload.videos)?payload.videos:[]};
  lastClassroomPayload=clean;
  if(!classroomActive||!classroomState.channel_token)return;
  classroomUpdateState(clean);
  try{
    const r=await fetch(CLASSROOM_REALTIME,{
      method:'POST',
      headers:{'Content-Type':'application/json',apikey:EBOOK_PUBLISHABLE_KEY},
      body:JSON.stringify({messages:[{topic:'student-classroom:'+classroomState.channel_token,event:'classroom_state',payload:clean}]})
    });
    if(!r.ok)throw Error('HTTP '+r.status);
  }catch(e){console.warn('student classroom sync',e);}
}
async function classroomPrepareRealtime(){
  if(!classroomState.channel_token)return;
  classroomRealtimeReady=false;
  if(!window.supabase?.createClient){
    try{const m=await import('https://esm.sh/@supabase/supabase-js@2.117.2');window.supabase=m;}
    catch(e){console.warn('classroom realtime client load',e);throw Error('課堂即時連線元件載入失敗。');}
  }
  if(!classroomSupabase)classroomSupabase=window.supabase.createClient(EBOOK_SUPABASE_URL,EBOOK_PUBLISHABLE_KEY);
  if(classroomChannel)await classroomSupabase.removeChannel(classroomChannel);
  classroomChannel=classroomSupabase.channel('student-classroom:'+classroomState.channel_token,{config:{broadcast:{self:false}}})
    .on('broadcast',{event:'classroom_request'},()=>{if(lastClassroomPayload)classroomBroadcast(lastClassroomPayload)})
    .on('broadcast',{event:'audio_join'},({payload})=>classroomHandleAudioJoin(payload))
    .on('broadcast',{event:'audio_answer'},({payload})=>classroomHandleAudioAnswer(payload))
    .on('broadcast',{event:'audio_ice'},({payload})=>classroomHandleAudioIce(payload))
    .subscribe(status=>{classroomRealtimeReady=status==='SUBSCRIBED';});
}

const ebookState={books:[],bookId:'',book:null,page:1,total:0,loaded:false,toc:[],units:[],unitIndex:-1,unitPages:[],pendingVideo:null};
async function ebookApi(payload){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const r=await fetch(EBOOK_INGEST,{method:'POST',headers:{'Content-Type':'application/json',apikey:EBOOK_PUBLISHABLE_KEY},body:JSON.stringify(payload),signal:controller.signal});
    const raw=await r.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{}
    if(!r.ok)throw Error((data.error||data.message||('電子書服務 HTTP '+r.status)));
    return data;
  }catch(e){
    if(e?.name==='AbortError')throw Error('電子書服務逾時（15 秒）。請稍後重試；目前沒有載入整本電子書。');
    throw e;
  }finally{clearTimeout(timer)}
}
function ebookPick(data,keys){for(const k of keys)if(data&&data[k]!=null)return data[k];return null}
async function ebookRefresh(){
  const sel=$('ebookSelect'), status=$('ebookStatus');
  status.textContent='正在讀取 AIVAULT 電子書書名…';
  try{
    const d=await ebookApi({action:'list',limit:80});
    const payload=ebookPick(d,['data'])||d;
    const rows=ebookPick(payload,['books','ebooks','items'])||[];
    ebookState.books=Array.isArray(rows)?rows:[];
    sel.innerHTML='<option value="">請選擇上課教材</option>';
    ebookState.books.forEach(b=>{
      const id=ebookPick(b,['ebook_id','id','book_id']); if(!id)return;
      const o=document.createElement('option');o.value=id;o.textContent=ebookPick(b,['title','name'])||('電子書 '+id);sel.appendChild(o);
    });
    status.textContent=ebookState.books.length?'已載入 '+ebookState.books.length+' 本電子書書名；選定後才轉換成教材。':'目前沒有可用電子書';
  }catch(e){status.textContent='電子書目錄讀取失敗：'+(e.message||e)}
}
async function ebookLoad(){
  const id=$('ebookSelect').value;if(!id){say('請先選擇電子書教材。');return}
  $('ebookStatus').textContent='正在選定電子書教材…';
  try{
    // 選定教材時不下載整本書；教材指向原電子書，內容仍完整保存在後端。
    // 前端只取得目錄／單元索引，實際頁面在翻頁或選單元時逐頁載入。
    const b=ebookState.books.find(x=>String(ebookPick(x,['ebook_id','id','book_id']))===String(id))||{};
    ebookState.book=b;ebookState.bookId=id;ebookState.page=1;ebookState.total=Number(ebookPick(b,['total_pages','page_count'])||0);$('info').textContent='電子書教材：正在載入…';
    const td=await ebookApi({action:'toc',ebook_id:id});
    const tp=ebookPick(td,['data'])||td;
    ebookState.toc=Array.isArray(ebookPick(tp,['toc','items']))?ebookPick(tp,['toc','items']):[];
    const ud=await ebookApi({action:'lesson_units',ebook_id:id});
    const up=ebookPick(ud,['data'])||ud;
    ebookState.units=Array.isArray(ebookPick(up,['units','items']))?ebookPick(up,['units','items']):[];
    ebookState.unitIndex=-1;ebookState.unitPages=[];ebookState.loaded=true;
    $('ebookLesson').style.display='block';
    await ensureClassroom();
    $('ebookLesson').style.width='100%';
    $('ebookLesson').style.maxWidth='none';
    $('ebookLessonTitle').textContent='📚 '+(ebookPick(b,['title','name'])||'電子書教材');
    $('ebookLessonPage').textContent='已選定教材｜原書共 '+(ebookState.total||'?')+' 頁';
    $('ebookLessonUnit').textContent='目前教學單元：尚未選取';
    $('ebookLessonText').textContent='教材已選定。原書內容保持不變；目前只載入書名與目錄。選擇章節或翻頁後，才逐頁載入原書內容。';
    $('ebookLessonVideo').innerHTML='';
    ebookRenderOutline();
    // 載入後立即把原書第一個教學單元的內文提取到教學助理主區域。
    // 不建立縮小視窗、不嵌入原電子書畫面；只做原文內容的教學呈現。
    if(ebookState.units.length) await ebookLoadUnit(0);
    else await ebookGo(0);
    $('ebookStatus').textContent='教材已載入：'+(ebookPick(b,['title','name'])||'電子書')+'；原書內文已放入教學助理，原文未改寫。';$('info').textContent='電子書教材｜第 '+(ebookState.page||1)+(ebookState.total?' / '+ebookState.total:'');
    say('已將選定電子書作為完整教材來源。原文不改寫，使用時逐頁載入。');
  }catch(e){$('ebookStatus').textContent='教材選定失敗：'+(e.message||e);say('電子書教材選定失敗。')}
}
function videoIdFromUrl(u){
  try{const x=new URL(String(u||'')); if(x.hostname.includes('youtu.be')) return {provider:'youtube',id:x.pathname.split('/').filter(Boolean)[0]||''}; if(x.hostname.includes('youtube.com')) return {provider:'youtube',id:x.searchParams.get('v')||x.pathname.split('/').filter(Boolean).pop()||''}; if(x.hostname.includes('vimeo.com')) return {provider:'vimeo',id:x.pathname.split('/').filter(Boolean).pop()||''}; return null;}catch{return null}
}
function renderInlineVideo(v){
  const provider=String(v.provider||'').toLowerCase(), url=String(v.url||''), id=String(v.video_id||'');
  const title=String(v.title||'影片');
  if(provider==='youtube' && id) return '<div style="margin-top:8px"><b>🎬 '+E.esc(title)+'</b><div style="margin-top:6px;position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden"><iframe src="https://www.youtube.com/embed/'+encodeURIComponent(id)+'" title="'+E.esc(title)+'" style="width:100%;height:100%;border:0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div></div>';
  if(provider==='vimeo' && id) return '<div style="margin-top:8px"><b>🎬 '+E.esc(title)+'</b><div style="margin-top:6px;position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden"><iframe src="https://player.vimeo.com/video/'+encodeURIComponent(id)+'" title="'+E.esc(title)+'" style="width:100%;height:100%;border:0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div></div>';
  if(provider==='direct' && url) return '<div style="margin-top:8px"><b>🎬 '+E.esc(title)+'</b><video controls playsinline preload="metadata" style="width:100%;max-height:520px;background:#000;border-radius:10px" src="'+E.esc(url)+'"></video></div>';
  return '';
}
function ebookCurrentHeading(){const toc=Array.isArray(ebookState.toc)?ebookState.toc:[];let current=null;for(const x of toc){if(Number(x.page_number||1)<=Number(ebookState.page))current=x;else break;}return current;}function ebookCurrentHierarchy(){const toc=Array.isArray(ebookState.toc)?ebookState.toc:[];const h={part:null,chapter:null,section:null,article:null};for(const x of toc){if(Number(x.page_number||1)>Number(ebookState.page))break;if(h[x.level]!==undefined)h[x.level]=x.title||null;}return h;}function ebookUnitIndex(){const toc=Array.isArray(ebookState.toc)?ebookState.toc:[];if(!toc.length)return -1;let idx=-1;for(let i=0;i<toc.length;i++){if(Number(toc[i].page_number||1)<=Number(ebookState.page))idx=i;else break;}return idx;}
async function ebookLoadUnit(idx){const units=Array.isArray(ebookState.units)?ebookState.units:[];if(idx<0||idx>=units.length)return;try{const d=await ebookApi({action:'lesson_unit',ebook_id:ebookState.bookId,ordinal:Number(units[idx].ordinal)});const p=ebookPick(d,['data'])||d;const u=ebookPick(p,['unit'])||units[idx];const pages=Array.isArray(ebookPick(p,['pages','items']))?ebookPick(p,['pages','items']):[];ebookState.unitIndex=idx;ebookState.unitPages=pages;ebookState.page=Number(u.page_number)||1;$('ebookLessonUnit').textContent='目前教學單元：'+[ebookState.book?.title,u.title].filter(Boolean).join(' → ');$('ebookUnitInfo').textContent='單元 '+(idx+1)+' / '+units.length+'｜第 '+(u.page_number||1)+(u.end_page?'–'+u.end_page:'')+' 頁';$('ebookLessonTitle').textContent='📚 '+(ebookState.book?.title||'電子書教材')+'｜'+(u.title||'');$('ebookLessonText').textContent=pages.map(x=>String(x.content||'').trim()).filter(Boolean).join('\n\n');$('ebookLessonText').dataset.unitTitle=u.title||'';$('ebookLessonText').dataset.unitStartPage=String(u.page_number||1);$('ebookLessonText').dataset.unitEndPage=String(u.end_page||u.page_number||1);$('ebookLessonPage').textContent='教學單元｜第 '+(u.page_number||1)+(u.end_page?'–'+u.end_page:'')+' 頁';$('ebookLessonVideo').innerHTML=pages.flatMap(x=>Array.isArray(x?.metadata?.videos)?x.metadata.videos:[]).map(renderInlineVideo).join('');const unitText=pages.map(x=>String(x.content||'').trim()).filter(Boolean).join('\n\n');const unitVideos=pages.flatMap(x=>Array.isArray(x?.metadata?.videos)?x.metadata.videos:[]);classroomBroadcast({type:'unit',page:ebookState.page,total:ebookState.total||0,title:ebookState.book?.title||'電子書教材',unit_title:u.title||'',content:unitText,videos:unitVideos});}catch(e){$('ebookStatus').textContent='教學單元載入失敗：'+(e.message||e)}}
async function ebookGoUnit(delta){const units=Array.isArray(ebookState.units)?ebookState.units:[];if(!units.length)return;const base=ebookState.unitIndex>=0?ebookState.unitIndex:ebookUnitIndex();const idx=Math.max(0,Math.min(units.length-1,base+delta));await ebookLoadUnit(idx);}
function ebookRenderOutline(){const el=$('ebookLessonOutline');if(!el)return;const toc=Array.isArray(ebookState.toc)?ebookState.toc:[];el.replaceChildren();if(!toc.length){el.textContent='本電子書目前沒有可辨識的章節目錄。';return;}toc.forEach(x=>{const b=document.createElement('button');b.type='button';b.className='b';b.textContent=(x.level==='part'?'📕 ':x.level==='chapter'?'📘 ':x.level==='section'?'📗 ':x.level==='article'?'📄 ':'• ')+(x.title||'');b.style.display='block';b.style.width='100%';b.style.textAlign='left';b.style.margin='2px 0';b.style.paddingLeft=(x.level==='part'?6:x.level==='chapter'?18:x.level==='section'?30:x.level==='article'?42:54)+'px';b.onclick=()=>{ebookState.page=Number(x.page_number)||1;ebookGo(0)};el.appendChild(b);});}async function ebookRender(pageObj){
  const p=pageObj||{};const n=Number(ebookPick(p,['page_number','page','number'])||ebookState.page||1);
  ebookState.page=n;
  const text=String(ebookPick(p,['content','page_content','text','body','html'])||'').replace(/<[^>]+>/g,'').trim();
  const current=ebookCurrentHeading();const hierarchy=ebookCurrentHierarchy();$('ebookLessonTitle').textContent='📚 '+(ebookPick(ebookState.book,['title','name'])||'電子書教材')+(current?'｜'+(current.title||''):'');$('ebookLessonText').dataset.part=hierarchy.part||'';$('ebookLessonText').dataset.chapter=hierarchy.chapter||'';$('ebookLessonText').dataset.section=hierarchy.section||'';$('ebookLessonText').dataset.article=hierarchy.article||'';const unit=[hierarchy.part,hierarchy.chapter,hierarchy.section,hierarchy.article].filter(Boolean);$('ebookLessonUnit').textContent='目前教學單元：'+(unit.length?unit.join(' → '):'本頁原文');const ui=ebookUnitIndex();$('ebookUnitInfo').textContent=ui>=0?'單元 '+(ui+1)+' / '+ebookState.toc.length:'單元 0 / 0';ebookRenderOutline();
  $('ebookLessonPage').textContent='第 '+n+(ebookState.total?' / '+ebookState.total:'')+' 頁';$('info').textContent='電子書教材｜第 '+n+(ebookState.total?' / '+ebookState.total:'');
  $('ebookLessonText').textContent=text||'本頁沒有可讀文字。';
  const videos=Array.isArray(p?.metadata?.videos)?p.metadata.videos:[];
  $('ebookLessonVideo').innerHTML=videos.map(renderInlineVideo).join('');
  classroomBroadcast({type:'page',page:n,total:ebookState.total||0,title:ebookPick(ebookState.book,['title','name'])||'電子書教材',content:text,videos});
}
async function ebookGo(delta){
  if(!ebookState.loaded)return;
  const n=Math.max(1,Math.min(ebookState.total||999999,ebookState.page+delta));
  try{
    const d=await ebookApi({action:'book',ebook_id:ebookState.bookId,page_number:n});
    const payload=ebookPick(d,['data'])||d;
    const p=ebookPick(payload,['page'])||((ebookPick(payload,['pages','items'])||[])[0])||payload;
    ebookState.total=Number(ebookPick(payload,['total_pages','page_count'])||ebookState.total||0);
    await ebookRender(p);
  }catch(e){$('ebookStatus').textContent='翻頁失敗：'+(e.message||e)}
}
$('ebookUnitPrev').onclick=()=>ebookGoUnit(-1);$('ebookUnitNext').onclick=()=>ebookGoUnit(1);$('ebookUnitRead').onclick=()=>{const t=$('ebookLessonText').innerText.trim();if(t)speakText(t)};$('ebookLoad').onclick=ebookLoad;
$('ebookRefresh').onclick=ebookRefresh;
$('ebookPrev').onclick=()=>ebookGo(-1);
$('ebookNext').onclick=()=>ebookGo(1);
$('ebookRead').onclick=()=>{const t=$('ebookLessonText').innerText.trim();if(t)speakText(t)};
$('ebookStop').onclick=stopReading;
$('ebookExport').onclick=exportTeachingToEbook;

/* AIVAULT CONTENT RULE: This path is conversion-only. It may write only user-provided PPT/teacher text or already-loaded ebook content. Dark Star must never generate or append original book content here. */
async function exportTeachingToEbook(){
  const title=($('ebookExportTitle')?.value||'').trim() || ('AIVAULT 教學教材 '+new Date().toLocaleDateString('zh-TW'));
  let parts=[];
  if(Array.isArray(slideTexts)&&slideTexts.length){
    parts=slideTexts.map((t,i)=>('第 '+(i+1)+' 頁\n'+(t||'')).trim()).filter(Boolean);
  }else if(ebookState.loaded){
    parts=[($('ebookLessonTitle').textContent||'電子書教材'),($('ebookLessonText').innerText||'')].join('\n');
  }
  const teacherNotes=($('ebookExportText')?.value||'').trim();
  // Teacher notes are explicit user input. Never populate this field from Dark Star output.
  if(teacherNotes) parts.push('【使用者提供的老師課堂補充】\n'+teacherNotes);
  const content=parts.join('\n\n');
  const exportVideo=parseVideoSource($('yu')?.value||'');
  if(exportVideo) ebookState.pendingVideo=exportVideo;
  if(!content.trim()){say('目前沒有可轉換的教學內容。請先載入 PPT 或電子書教材。');return}
  $('ebookStatus').textContent='正在把教學教材建立成電子書…';
  try{
    const created=await ebookApi({action:'create',title,subtitle:'由 AIVAULT 教學助理轉換',author:'AIVAULT 教學助理',edition:'',description:'由教學助理教材轉換建立',reader_language:'zh-Hant',language:'zh-TW',input_format:'text',content_type:'teaching_material',chunk_size:100000});
    const cp=ebookPick(created,['data'])||created;
    const jobId=ebookPick(cp,['job_id']); if(!jobId)throw Error('電子書建立未取得 job_id');
    const chunks=[]; for(let i=0;i<content.length;i+=100000)chunks.push(content.slice(i,i+100000));
    for(let i=0;i<chunks.length;i++)await ebookApi({action:'append',job_id:jobId,sequence_no:i,content:chunks[i]});
    const done=await ebookApi({action:'finalize',job_id:jobId,page_chars:900});
    const dp=ebookPick(done,['data'])||done;
    const newId=ebookPick(dp,['ebook_id']);
    if(newId&&ebookState.pendingVideo){
      await ebookApi({action:'media',ebook_id:newId,page_number:1,videos:[ebookState.pendingVideo]});
      ebookState.pendingVideo=null;
    }
    $('ebookStatus').textContent='已轉換成電子書：'+title+(newId?'（已存入 AIVAULT 書架）':'');
    say('使用者提供的教學教材已轉換成電子書並存入 AIVAULT。');
    await ebookRefresh();
(async()=>{try{const m=await import('https://esm.sh/@supabase/supabase-js@2.117.2');window.supabase=window.supabase||m;classroomBadge();}catch(e){console.warn('classroom realtime client load',e);}})();
    if(newId)$('ebookSelect').value=newId;
  }catch(e){$('ebookStatus').textContent='轉換電子書失敗：'+(e.message||e);say('教學教材轉換失敗。')}
}
ebookRefresh();
async function enter(){if(!count&&!ebookState.loaded)return say('請先上傳 PPT 或匯入電子書教材。');try{await ensureClassroom();await classroomPrepareRealtime();}catch(e){say('課堂入口建立失敗：'+(e.message||e));return}classroomActive=true;classMode=true;classroomBadge();
try{await classroomStartAudio();}catch(e){classroomActive=false;classMode=false;try{await classroomChannel?.unsubscribe?.()}catch{}say(e.message||'老師麥克風啟動失敗。');return;}$('panel').classList.add('class');classVoiceControls();$('ppt').classList.toggle('focusPpt',!!count&&!ebookState.loaded);$('ebookLesson').style.display=ebookState.loaded?'block':$('ebookLesson').style.display;$('start').style.display='none';$('exit').style.display='inline-block';document.body.style.overflow='hidden';if(ebookState.loaded&&!count){$('ppt').style.display='block';$('ppt').classList.add('ebookFocusShell');}else{$('ppt').style.display='block';$('ppt').classList.remove('ebookFocusShell');}classroomBadge();try{await $('panel').requestFullscreen()}catch{}say('開始上課。',ebookState.loaded&&!count);if(lastClassroomPayload)classroomBroadcast(lastClassroomPayload)}async function exit(){classroomActive=false;classroomStopAudio();if(classroomState.channel_token&&classroomState.owner_token)classroomApi({action:'classroom_close',channel_token:classroomState.channel_token,owner_token:classroomState.owner_token}).catch(()=>{});if(classroomChannel&&classroomSupabase){classroomSupabase.removeChannel(classroomChannel);classroomChannel=null}classroomState={code:'',channel_token:'',owner_token:'',expires_at:''};try{sessionStorage.removeItem('aivault_classroom')}catch{}classMode=false;classroomBadge();$('info').textContent=ebookState.loaded?'電子書教材｜第 '+(ebookState.page||1)+(ebookState.total?' / '+ebookState.total:''):count?'第 '+(index+1)+' / '+count+' 頁':'尚未載入';$('panel').classList.remove('class');document.getElementById('classVoiceControls')?.remove();$('ppt').classList.remove('focusPpt','ebookFocusShell');$('start').style.display='inline-block';$('exit').style.display='none';document.body.style.overflow='';hideResearch();stopReading();try{if(document.fullscreenElement)await document.exitFullscreen()}catch{}say('已回到主畫面。')}$('start').onclick=enter;$('exit').onclick=exit;
function hideResearch(){researchOpen=false;researchBig=false;$('research').classList.remove('on','big')}
function showResearch(q){q=(q||'').trim();if(!q)return;researchOpen=true;$('q').value=q;$('research').classList.add('on');$('rbody').textContent=q;say('已開啟研究。')}
$('search').onclick=()=>showResearch($('q').value);$('rClose').onclick=hideResearch;$('rPpt').onclick=()=>{hideResearch();say('已回到 PPT。')};$('rBig').onclick=()=>{$('research').classList.toggle('big')};$('rRead').onclick=()=>{const t=$('rbody').innerText.trim();if(t)speakText(t)};
function parseVideoSource(u){
  const s=String(u||'').trim();
  try{const x=new URL(s); const host=x.hostname.toLowerCase();
    if(host.includes('youtu.be')||host.includes('youtube.com')){const id=x.searchParams.get('v')||x.pathname.split('/').filter(Boolean).pop()||''; if(id)return {provider:'youtube',video_id:id,url:s,title:($('videoTitle')?.value||'').trim()};}
    if(host.includes('vimeo.com')){const id=x.pathname.split('/').filter(Boolean).pop()||''; if(id)return {provider:'vimeo',video_id:id,url:s,title:($('videoTitle')?.value||'').trim()};}
    if(/\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(s))return {provider:'direct',video_id:'',url:s,title:($('videoTitle')?.value||'').trim()};
  }catch{}
  return null;
}
function videoHtml(v){
  if(v.provider==='youtube')return '<iframe style="width:100%;aspect-ratio:16/9;border:0" src="https://www.youtube.com/embed/'+encodeURIComponent(v.video_id)+'" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
  if(v.provider==='vimeo')return '<iframe style="width:100%;aspect-ratio:16/9;border:0" src="https://player.vimeo.com/video/'+encodeURIComponent(v.video_id)+'" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
  if(v.provider==='direct')return '<video controls playsinline preload="metadata" style="width:100%;max-height:520px;background:#000" src="'+E.esc(v.url)+'"></video>';
  return '';
}
$('openV').onclick=()=>{const v=parseVideoSource($('yu').value);if(!v)return say('請輸入可嵌入播放的 YouTube、Vimeo 或直接影片網址。');$('video').innerHTML=videoHtml(v);$('videoStatus').textContent='影片正在 AIVAULT 教學助理內播放。'};
$('saveV').onclick=async()=>{const v=parseVideoSource($('yu').value);if(!v)return say('請先輸入影片網址。');if(!ebookState.loaded){ebookState.pendingVideo=v;$('videoStatus').textContent='影片已加入目前教學教材；轉成電子書時會一起寫入電子書。';return;}try{await ebookApi({action:'media',ebook_id:ebookState.bookId,page_number:ebookState.page,videos:[v]});$('videoStatus').textContent='已儲存到電子書第 '+ebookState.page+' 頁；影片仍可直接在 AIVAULT 內播放。';await ebookGo(0);}catch(e){$('videoStatus').textContent='影片儲存失敗：'+(e.message||e);}};
$('closeV').onclick=()=>{$('video').innerHTML='';$('videoStatus').textContent='影片已關閉。'};
async function detectMicrophone(){const el=$('mic');try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>t.stop());el.className='mic ok';el.textContent='✅ 已偵測到麥克風';return true}catch(e){el.className='mic warn';el.textContent='⚠️ 麥克風尚未允許';return false}}
function classVoiceControls(){
  const bar=document.querySelector('#panel.class .stage .bar');
  if(!bar)return;
  let box=document.getElementById('classVoiceControls');
  if(!box){
    box=document.createElement('div');
    box.id='classVoiceControls';
    box.style.cssText='display:flex;align-items:center;gap:6px;margin-left:8px;z-index:30;';
    const status=document.createElement('span');
    status.id='classVoiceStatus';
    status.textContent='🎤 聲控';
    status.style.cssText='font-size:14px;white-space:nowrap;color:#fff;';
    const on=document.createElement('button');
    on.type='button';on.className='b';on.id='classVoiceOn';on.textContent='🎤 開始聽';
    const off=document.createElement('button');
    off.type='button';off.className='b';off.id='classVoiceOff';off.textContent='⏹ 停止聲控';
    box.append(status,on,off);
    const left=bar.firstElementChild;
    if(left)left.appendChild(box);else bar.appendChild(box);
    on.onclick=()=>{ voice=true; listening=false; $('vs').textContent='🎤 正在啟動聲控…'; startRec(); classVoiceControls(); };
    off.onclick=()=>{ voice=false; listening=false; $('vs').textContent='聲控已取消'; try{rec?.abort()}catch{} classVoiceControls(); };
  }
  const s=$('classVoiceStatus'), v=$('vs'), t=$('tr');
  if(s)s.textContent=(v?.textContent||'🎤 聲控').replace(/^正在準備聲控…$/,'🎤 聲控');
  if(s&&t&&t.textContent&&t.textContent!=='等待老師說話…')s.textContent='🎤 '+t.textContent;
}
function normalizeVoiceText(text){return String(text||'').replace(/[，。！？、,.!?\s]/g,'').trim();}
async function runVoiceCommand(text){
  const t=normalizeVoiceText(text);if(!t)return false;
  const click=id=>{const el=$(id);if(!el||el.disabled)return false;el.click();return true;};
  const bookSel=$('ebookSelect');
  const pickBook=()=>{
    if(!bookSel||!bookSel.options.length)return false;
    const raw=String(text||'').trim().replace(/^(請|幫我|幫忙|我要|選擇|選|使用|打開|開啟)/,'').trim();
    const q=normalizeVoiceText(raw);
    let opt=[...bookSel.options].find(o=>normalizeVoiceText(o.textContent||'')===q||normalizeVoiceText(o.textContent||'').includes(q)||q.includes(normalizeVoiceText(o.textContent||'')));
    if(!opt)return false;
    bookSel.value=opt.value;bookSel.dispatchEvent(new Event('change',{bubbles:true}));
    $('tr').textContent='已選擇教材：'+opt.textContent;classVoiceControls();return true;
  };
  if(/^(下一頁|下一張|下頁|下張|往下一頁|往下翻|往後一頁)$/.test(t)||t.includes('下一頁')||t.includes('下一張')||t.includes('往下翻')){return await handleVoicePageCommand('下一頁');}
  if(/^(上一頁|上一張|上頁|上張|往上一頁|往上翻|往前一頁)$/.test(t)||t.includes('上一頁')||t.includes('上一張')||t.includes('往上翻')){return await handleVoicePageCommand('上一頁');}
  if(t.includes('選擇教材')||t.startsWith('選擇')||t.startsWith('使用教材')||t.startsWith('打開教材')){if(pickBook())return true;}
  if(t.includes('匯入教材')||t.includes('載入教材')||t.includes('導入教材')||t.includes('倒入教材')||t.includes('開始載入'))return click('ebookLoad');
  if(t==='開始上課'||t.includes('開始上課'))return click('start');
  if(t.includes('回主畫面')||t.includes('退出上課')||t.includes('結束上課'))return click('exit');
  if(t.includes('停止聲控')||t.includes('取消聲控')){click('voiceStop');return true;}
  if(t.includes('開始聽')||t.includes('啟動聲控')||t.includes('開始聲控')){click('voiceStart');return true;}
  if(t.includes('朗讀本頁')||t.includes('讀這一頁')||t.includes('開始朗讀'))return click(ebookState.loaded?'ebookRead':'readPage');
  if(t.includes('停止朗讀'))return click(ebookState.loaded?'ebookStop':'readStop');
  if(t.includes('暫停朗讀'))return click('readPause');
  if(t.includes('繼續朗讀'))return click('readResume');
  if(t.includes('上一個單元')||t.includes('上一單元'))return click('ebookUnitPrev');
  if(t.includes('下一個單元')||t.includes('下一單元'))return click('ebookUnitNext');
  if(t.includes('PPT上一頁'))return click('prev');
  if(t.includes('PPT下一頁'))return click('next');
  if(t.includes('選擇')&&bookSel)return pickBook();
  if(t.includes('開啟影片')||t.includes('播放影片'))return click('openV');
  if(t.includes('儲存影片'))return click('saveV');
  if(t.includes('關閉影片'))return click('closeV');
  if(t.includes('重新整理教材')||t.includes('重新讀取教材'))return click('ebookRefresh');
  if(t.includes('匯出電子書'))return click('ebookExport');
  return false;
}
async function handleVoicePageCommand(text){
  const t=String(text||'').replace(/[，。！？、,.!?\s]/g,'').trim();
  if(!t)return false;
  const next=/^(下一頁|下頁|下一張|下張|往下一頁|往下翻|往後一頁|下一頁了)$/.test(t)||t.includes('下一頁')||t.includes('下一張')||t.includes('往下翻');
  const prev=/^(上一頁|上頁|上一張|上張|往上一頁|往上翻|往前一頁|前一頁)$/.test(t)||t.includes('上一頁')||t.includes('上一張')||t.includes('往上翻');
  if(!next&&!prev)return false;
  try{
    if(ebookState.loaded){
      const before=ebookState.page;
      await ebookGo(next?1:-1);
      const after=ebookState.page;
      $('tr').textContent=(after===before)?(next?'已是最後一頁':'已是第一頁'):(next?'已切換下一頁':'已切換上一頁');
    }else if(count){
      const before=index;
      await go(index+(next?1:-1));
      const after=index;
      $('tr').textContent=(after===before)?(next?'已是最後一頁':'已是第一頁'):(next?'已切換下一頁':'已切換上一頁');
    }else{
      $('tr').textContent='目前沒有可翻頁的教材';
      return true;
    }
    classVoiceControls();
    return true;
  }catch(e){console.warn('voice page command',e);$('tr').textContent='翻頁失敗：'+(e.message||e);classVoiceControls();return true;}
}
function startRec(){if(!rec||listening)return;try{rec.start()}catch(e){listening=false;console.warn('speech recognition start',e);$('vs').textContent='請再按一次「開始聽」'}}
function setup(){
  const S=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!S){voice=false;$('vs').textContent='此瀏覽器不支援語音辨識';return}
  rec=new S();rec.lang='zh-TW';rec.continuous=false;rec.interimResults=true;
  rec.onstart=()=>{listening=true;$('vs').textContent='🎤 聲控啟用，請說話'};
  rec.onerror=e=>{listening=false;console.warn('speech recognition',e);if(voice)$('vs').textContent=e?.error==='not-allowed'?'⚠️ 麥克風／語音辨識權限被拒絕':'⚠️ 聲控暫停，請按「開始聽」'};
  rec.onresult=e=>{let t='';for(let k=e.resultIndex;k<e.results.length;k++)if(e.results[k].isFinal)t+=e.results[k][0].transcript;if(t){$('tr').textContent=t;classVoiceControls();runVoiceCommand(t).catch(e=>console.warn('voice command',e))}};
  rec.onend=()=>{listening=false;if(voice){$('vs').textContent='🎤 聲控已停止，重新啟動中…';setTimeout(()=>{if(rec&&voice&&!listening)startRec()},250)}};
  $('voiceStart').onclick=()=>{voice=true;$('vs').textContent='🎤 正在啟動聲控…';startRec()};
  $('voiceStop').onclick=()=>{voice=false;listening=false;$('vs').textContent='聲控已取消';try{rec.abort()}catch{}};
  $('vs').textContent='🎤 請按「開始聽」啟用聲控';
}
setSpeechEnabled(true);detectMicrophone();setup();

/* Generate the classroom code as soon as a teacher has loaded teaching material. */
const classroomOriginalLoadPpt=loadPpt;
loadPpt=async function(f){await classroomOriginalLoadPpt(f);if(count){try{await ensureClassroom();}catch(e){console.warn('classroom code prepare',e);}}};

/* PPT classroom sync: wrap the existing PPT navigation without changing teaching-assistant.js. */
const classroomOriginalGo=go;
go=async function(k){await classroomOriginalGo(k);if(classroomActive&&count){const text=String(slideTexts[index]||'').trim();classroomBroadcast({type:'ppt',page:index+1,total:count,content:text,videos:[]});}};

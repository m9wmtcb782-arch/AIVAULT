function htmlEscape(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
async function extractPptText(file){slideTexts=[];$('pptTextStatus').textContent='PPT 文字索引：正在建立…';try{const JSZip=(await import('https://esm.sh/jszip@3.10.1')).default;const zip=await JSZip.loadAsync(await file.arrayBuffer());const names=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/i.test(n));names.sort((a,b)=>Number(a.match(/slide(\d+)/i)[1])-Number(b.match(/slide(\d+)/i)[1]));for(const name of names){const xml=await zip.files[name].async('text');const doc=new DOMParser().parseFromString(xml,'application/xml');const arr=[...doc.getElementsByTagName('a:t')].map(x=>x.textContent||'').filter(Boolean);slideTexts.push(arr.join(' '))}$('pptTextStatus').textContent='PPT 文字索引：已完成，共 '+slideTexts.length+' 頁';return true}catch(e){console.warn('PPT text extraction',e);$('pptTextStatus').textContent='PPT 文字索引：瀏覽器無法擷取文字，但投影片仍可播放';return false}}
async function loadPpt(f){stopReading();$('view').textContent='正在解析 PPT…';$('thumbs').textContent='正在建立縮圖…';try{const textPromise=extractPptText(f);const m=await import('https://esm.sh/@aiden0z/pptx-renderer@1.2.4');viewer=await m.PptxViewer.open(await f.arrayBuffer(),$('view'),{renderMode:'slide',fitMode:'contain'});count=Number(viewer.slideCount)||0;if(!count)throw Error('沒有投影片');await textPromise;$('thumbs').innerHTML='';for(let k=0;k<count;k++){const t=document.createElement('div');t.className='thumb';t.innerHTML='<div>第 '+(k+1)+' 頁</div>';const box=document.createElement('div');box.className='tp';t.appendChild(box);t.onclick=()=>go(k);$('thumbs').appendChild(t);try{const h=viewer.renderThumbnailToContainer(k,box,{width:105});if(h&&h.ready)await h.ready}catch(e){console.warn('thumbnail',k,e)}}index=0;await go(0);say('PPT 已載入，共 '+count+' 頁。')}catch(e){console.error(e);$('view').textContent='PPT 預覽失敗：'+(e.message||e);say('PPT 預覽失敗。')}}
function renderPptProjectOutline(){
  const el=$('pptProjectOutline'); if(!el)return;
  if(!pptProject.length){el.style.display='none';el.innerHTML='';return;}
  el.style.display='block';
  el.innerHTML='<b>📑 專題大綱</b>'+pptProject.map((s,i)=>'<button type="button" class="b" data-ppt-project-index="'+i+'" style="display:block;width:100%;margin:3px 0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'+(i===pptProjectIndex?'font-weight:800;border-color:#7567ff;':'')+'">'+(i+1)+'. '+htmlEscape(s.title||'專題頁')+'</button>').join('');
  el.querySelectorAll('[data-ppt-project-index]').forEach(b=>b.onclick=()=>{pptProjectIndex=Number(b.dataset.pptProjectIndex)||0;pptProjectRender();});
}
function pptProjectRender(){
  if(!pptProject.length)return;
  const s=pptProject[pptProjectIndex]||{};
  const isTeacherConclusion=s.kind==='teacher-conclusion';
  $('view').innerHTML='<div style="padding:clamp(24px,5vw,70px);height:100%;overflow:auto;background:#fff"><div style="font-size:14px;color:#667085;margin-bottom:12px">PPT 專題報告｜第 '+(pptProjectIndex+1)+' / '+pptProject.length+' 頁</div><h2 style="font-size:clamp(24px,4vw,38px);margin:0 0 18px">'+htmlEscape(s.title||'專題頁')+'</h2>'+(isTeacherConclusion?'<textarea id="teacherConclusionEditor" style="width:100%;min-height:280px;box-sizing:border-box;padding:16px;border:1px solid #cbd5e1;border-radius:12px;font-size:clamp(18px,2.5vw,28px);line-height:1.8;resize:vertical">'+htmlEscape(s.content||'')+'</textarea><button type="button" id="saveTeacherConclusion" class="b primary" style="margin-top:10px">儲存老師結論並同步學生</button>':'<div style="font-size:clamp(18px,2.5vw,28px);line-height:1.9;white-space:pre-wrap">'+htmlEscape(s.content||'')+'</div>')+'</div>';
  $('pptTextStatus').textContent='PPT 專題報告：已載入，共 '+pptProject.length+' 頁';
  renderPptProjectOutline();
  $('info').textContent='PPT 專題報告｜第 '+(pptProjectIndex+1)+' / '+pptProject.length+' 頁';
  if(isTeacherConclusion){
    const editor=$('teacherConclusionEditor'),save=$('saveTeacherConclusion');
    if(editor&&save)save.onclick=()=>{
      s.content=String(editor.value||'').trim()||'請由老師整理本研究的課堂結論。\n\n（這一頁不由暗星代替老師下結論。）';
      pptProjectRender();
      $('pptProjectStatus').textContent='老師結論已儲存，並同步到學生課堂。';
    };
  }
  if(classroomActive)classroomBroadcast({type:'ppt-project',page:pptProjectIndex+1,total:pptProject.length,content:String(s.content||''),project_title:String(pptProjectMeta.title||'PPT 專題報告'),project_page_title:String(s.title||''),project_kind:String(s.kind||'content'),videos:[]});
}

let localPptEbook={file:null,title:'',pages:[],units:[]};
function localPptEbookTextClean(s){return String(s||'').replace(/\\u00a0/g,' ').replace(/\\r/g,'').replace(/[ \\t]+\\n/g,'\\n').replace(/\\n{3,}/g,'\\n\\n').trim();}
function localPptEbookMakeUnits(pages){
  const arr=Array.isArray(pages)?pages.filter(x=>String(x||'').trim()):[];
  const units=[]; let current={title:'電子書內容',pages:[]};
  const heading=/^(第\\s*[0-9０-９一二兩三四五六七八九十百千〇零]+\\s*章|第[一二兩三四五六七八九十百千]+編|[一二兩三四五六七八九十百千]+、|Chapter\\s+\\d+)/i;
  for(const p of arr){
    const lines=String(p).split(/\\n+/).map(x=>x.trim()).filter(Boolean);
    const h=lines.find(x=>heading.test(x))||'';
    if(h&&current.pages.length){units.push(current);current={title:h.replace(/^第\\s*/,'第'),pages:[]};}
    else if(h&&!current.pages.length)current.title=h;
    current.pages.push(String(p));
  }
  if(current.pages.length)units.push(current);
  return units.length?units:arr.map((p,i)=>({title:'內容 '+(i+1),pages:[p]}));
}
async function parseLocalPptEbook(file){
  const name=String(file?.name||'').trim()||'手機電子書';
  const ext=(name.split('.').pop()||'').toLowerCase();
  $('pptLocalEbookStatus').textContent='正在讀取手機電子書：'+name+'…';
  let pages=[];
  if(ext==='txt'){
    pages=[localPptEbookTextClean(await file.text())];
  }else if(ext==='html'||ext==='htm'){
    const doc=new DOMParser().parseFromString(await file.text(),'text/html');
    const title=String(doc.querySelector('title')?.textContent||'').trim();
    if(title)localPptEbook.title=title;
    pages=[localPptEbookTextClean(doc.body?.innerText||doc.documentElement?.textContent||'')];
  }else if(ext==='json'){
    const raw=JSON.parse(await file.text());
    const title=String(raw?.title||raw?.name||'').trim();
    if(title)localPptEbook.title=title;
    const collect=v=>{
      if(typeof v==='string'){const t=localPptEbookTextClean(v);if(t)pages.push(t);return;}
      if(Array.isArray(v)){v.forEach(collect);return;}
      if(v&&typeof v==='object'){
        for(const k of ['content','text','body','page_content','pages','units','chapters','items','lessons'])if(v[k]!==undefined)collect(v[k]);
      }
    };
    collect(raw);
  }else if(ext==='epub'){
    const JSZip=(await import('https://esm.sh/jszip@3.10.1')).default;
    const zip=await JSZip.loadAsync(await file.arrayBuffer());
    const container=zip.file('META-INF/container.xml');
    if(!container)throw Error('EPUB 缺少 META-INF/container.xml');
    const cdoc=new DOMParser().parseFromString(await container.async('text'),'application/xml');
    const root=cdoc.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');
    if(!root||!zip.file(root))throw Error('EPUB 找不到 OPF');
    const opf=zip.file(root), opfDoc=new DOMParser().parseFromString(await opf.async('text'),'application/xml');
    const base=root.split('/').slice(0,-1).join('/');
    const manifest=new Map();
    [...opfDoc.getElementsByTagName('item')].forEach(x=>manifest.set(x.getAttribute('id'),{href:x.getAttribute('href')||'',media:x.getAttribute('media-type')||''}));
    [...opfDoc.getElementsByTagName('spine')[0]?.getElementsByTagName('itemref')||[]].forEach(async()=>{});
    const refs=[...opfDoc.getElementsByTagName('itemref')];
    for(const ref of refs){
      const item=manifest.get(ref.getAttribute('idref')); if(!item)continue;
      const path=(base?base+'/':'')+decodeURIComponent(item.href.split('#')[0]);
      const entry=zip.file(path); if(!entry)continue;
      const doc=new DOMParser().parseFromString(await entry.async('text'),'text/html');
      const text=localPptEbookTextClean(doc.body?.innerText||doc.documentElement?.textContent||'');
      if(text)pages.push(text);
    }
  }else if(ext==='pdf'){
    const pdfjs=await import('https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.mjs');
    try{pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'}catch{}
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
    for(let n=1;n<=pdf.numPages;n++){
      const page=await pdf.getPage(n), tc=await page.getTextContent();
      const text=localPptEbookTextClean(tc.items.map(x=>x.str||'').join(' '));
      if(text)pages.push(text);
    }
  }else{
    throw Error('目前手機電子書支援 EPUB、PDF、HTML、TXT、JSON。');
  }
  pages=pages.map(localPptEbookTextClean).filter(Boolean);
  if(!pages.length)throw Error('沒有讀取到電子書文字內容。');
  localPptEbook.file=file;
  localPptEbook.title=localPptEbook.title||name.replace(/\\.[^.]+$/,'');
  localPptEbook.pages=pages;
  localPptEbook.units=localPptEbookMakeUnits(pages);
  $('pptLocalEbookStatus').textContent='✅ 已讀取手機電子書：'+localPptEbook.title+'｜'+pages.length+' 個內容頁／'+localPptEbook.units.length+' 個專題單元';
  return localPptEbook;
}
async function buildPptProjectFromLocalEbook(){
  if(!localPptEbook.pages.length){$('pptProjectStatus').textContent='請先從手機選擇電子書。';return false;}
  const bookTitle=localPptEbook.title||'手機電子書專題';
  $('pptProjectStatus').textContent='正在把手機電子書整理成 PPT 專題報告…';
  const slides=[
    {kind:'cover',title:bookTitle,content:'PPT 專題報告\\n由手機本機電子書建立\\n\\n原始電子書檔案不會被修改，也不會上傳到 AIVAULT 電子書書架。'},
    {kind:'overview',title:'專題大綱',content:'一、研究／學習問題\\n二、各章核心內容\\n三、重要概念與原文依據\\n四、問題分析與延伸研究\\n五、專題結論'}
  ];
  for(const u of localPptEbook.units){
    const combined=u.pages.join('\\n\\n');
    const chunks=combined.match(/[\\s\\S]{1,2200}/g)||[];
    slides.push({kind:'section',title:'章節／單元：'+u.title,content:'本單元核心內容\\n\\n'+combined.slice(0,2200)});
    chunks.slice(0,4).forEach((part,j)=>slides.push({kind:'content',title:u.title+'｜核心內容'+(chunks.length>1?'（'+(j+1)+'）':''),content:part}));
    slides.push({kind:'analysis',title:u.title+'｜問題分析',content:'可供老師引導討論：\\n\\n1. 本單元的核心問題是什麼？\\n2. 原文提出哪些規範、概念或論證？\\n3. 與前後章節如何連結？\\n4. 哪些地方需要進一步查證或比較？'});
  }
  slides.push({kind:'research',title:'延伸研究問題',content:'可由老師指示暗星進行網路研究：\\n\\n• 最新法規、判決、學說或政策資料\\n• 與教材內容不同的觀點\\n• 原文需要驗證的爭點\\n• 國內外制度比較'});
  slides.push({kind:'conclusion',title:'專題結論',content:'本專題由手機本機電子書建立。\\n\\n老師可以依序說明：\\n① 問題是什麼\\n② 教材如何回答\\n③ 哪些地方需要分析\\n④ 哪些地方需要暗星查證\\n⑤ 最後形成自己的結論\\n\\n原始手機電子書保持不變。'});
  pptProjectMeta={title:bookTitle+'｜專題報告',sourceBook:bookTitle};
  pptProject=slides.slice(0,160);pptProjectIndex=0;
  $('ppt').style.display='block';$('ppt').classList.remove('ebookFocusShell');
  await pptProjectRender();savePptProjectLocal();
  $('pptProjectStatus').textContent='✅ 已由手機電子書建立 PPT 專題報告，共 '+pptProject.length+' 頁。';
  say('已由手機電子書建立 PPT 專題報告。');
  return true;
}
async function buildPptProjectFromEbook(){
  if(!ebookState.loaded){say('請先選擇並載入電子書教材。');$('pptProjectStatus').textContent='請先載入電子書教材。';return false;}
  const units=Array.isArray(ebookState.units)?ebookState.units:[];
  if(!units.length){say('這本電子書沒有可轉換的教學單元。');return false;}
  const bookTitle=String(ebookPick(ebookState.book,['title','name'])||'電子書專題');
  $('pptProjectStatus').textContent='正在建立專題報告結構…';
  const slides=[];
  pptProjectMeta={title:bookTitle+'｜專題報告',sourceBook:bookTitle};
  slides.push({kind:'cover',title:bookTitle,content:'PPT 專題報告\n由 AIVAULT 教學助理依電子書教材建立\n\n原電子書保持不變'});
  slides.push({kind:'overview',title:'專題大綱',content:'一、研究／學習問題\n二、各章核心內容\n三、重要概念與原文依據\n四、問題分析與延伸研究\n五、專題結論'});
  const unitSummaries=[];
  for(const u of units){
    try{
      const d=await ebookApi({action:'lesson_unit',ebook_id:ebookState.bookId,ordinal:Number(u.ordinal)});
      const p=ebookPick(d,['data'])||d;
      const pages=Array.isArray(ebookPick(p,['pages','items']))?ebookPick(p,['pages','items']):[];
      if(!pages.length)continue;
      const title=String(ebookPick(u,['title','name','unit_title'])||'教學單元');
      const cleanPages=pages.map(x=>String(ebookPick(x,['content','page_content','text','body'])||'').replace(/<[^>]+>/g,'').replace(/\s+$/g,'').trim()).filter(Boolean);
      const combined=cleanPages.join('\n\n');
      const first=combined.slice(0,2200);
      unitSummaries.push(title);
      slides.push({kind:'section',title:'章節／單元：'+title,content:'本單元學習重點\n\n'+first});
      if(cleanPages.length){
        const chunks=combined.match(/[\\s\\S]{1,2200}/g)||[];
        chunks.slice(0,4).forEach((part,j)=>{
          slides.push({kind:'content',title:title+'｜核心內容'+(chunks.length>1?'（'+(j+1)+'）':''),content:part});
        });
      }
      const concepts=combined.replace(/[\r\n]+/g,' ').slice(0,900);
      slides.push({kind:'analysis',title:title+'｜問題分析',content:'可供老師引導討論：\n\n1. 本單元要解決的核心問題是什麼？\n2. 原文提出了哪些規範、概念或論證？\n3. 這些內容與前後章節如何連結？\n4. 哪些地方需要進一步查證或比較？\n\n教材依據摘要：\n'+concepts});
    }catch(e){console.warn('ebook to ppt project unit',u,e)}
  }
  if(!unitSummaries.length){$('pptProjectStatus').textContent='電子書沒有取得可轉換內容。';return false;}
  slides.push({kind:'research',title:'延伸研究問題',content:'可由老師指示暗星進行網路研究：\n\n• 最新法規、判決、學說或政策資料\n• 與教材內容不同的觀點\n• 原文需要驗證的爭點\n• 國內外制度比較\n\n暗星只在老師明確要求「暗星，你來解釋」時發聲。'});
  slides.push({kind:'conclusion',title:'專題結論',content:'本專題將電子書原始教材轉為課堂報告結構。\n\n老師可以依序說明：\n① 問題是什麼\n② 教材如何回答\n③ 哪些地方需要分析\n④ 哪些地方需要暗星查證\n⑤ 最後形成自己的結論\n\n注意：這是教學報告版本，不會修改原電子書。'});
  pptProject=slides.slice(0,160);
  pptProjectIndex=0;
  $('pptProjectStatus').textContent='已建立完整 PPT 專題報告，共 '+pptProject.length+' 頁（含封面、大綱、章節、分析、研究問題、結論）。';
  $('ppt').style.display='block';
  $('ppt').classList.remove('ebookFocusShell');
  await pptProjectRender();
  say('已建立完整 PPT 專題報告，共 '+pptProject.length+' 頁。');
  return true;
}
function savePptProjectLocal(){
  if(!pptProject.length){$('pptProjectStatus').textContent='目前沒有可儲存的 PPT 專題報告。';return false;}
  try{
    localStorage.setItem('aivault_ppt_project',JSON.stringify({meta:pptProjectMeta,slides:pptProject,index:pptProjectIndex,saved_at:new Date().toISOString()}));
    $('pptProjectStatus').textContent='PPT 專題報告已儲存到本機瀏覽器。';
    return true;
  }catch(e){$('pptProjectStatus').textContent='儲存失敗：'+(e.message||e);return false;}
}
function loadPptProjectLocal(){
  try{
    const raw=localStorage.getItem('aivault_ppt_project');
    if(!raw)return false;
    const d=JSON.parse(raw);
    if(!Array.isArray(d.slides)||!d.slides.length)return false;
    pptProjectMeta=d.meta&&typeof d.meta==='object'?d.meta:{title:'PPT 專題報告',sourceBook:''};
    pptProject=d.slides;
    pptProjectIndex=Math.max(0,Math.min(Number(d.index)||0,pptProject.length-1));
    pptProjectRender();
    $('pptProjectStatus').textContent='已載入本機儲存的 PPT 專題報告，共 '+pptProject.length+' 頁。';
    return true;
  }catch(e){console.warn('load ppt project',e);return false;}
}
function clearPptProjectLocal(){
  try{localStorage.removeItem('aivault_ppt_project')}catch{}
  pptProject=[];pptProjectIndex=0;pptProjectMeta={title:'',sourceBook:''};
  renderPptProjectOutline();
  $('pptProjectStatus').textContent='PPT 專題報告已清除。';
}
$('pptProjectFromEbook').onclick=()=>buildPptProjectFromEbook();
$('pptProjectFromLocalEbook').onclick=()=>buildPptProjectFromLocalEbook();
$('pptLocalEbook').onchange=async e=>{
  const f=e.target.files[0]; if(!f)return;
  try{await parseLocalPptEbook(f)}catch(err){console.error(err);localPptEbook={file:null,title:'',pages:[],units:[]};$('pptLocalEbookStatus').textContent='❌ 電子書讀取失敗：'+(err.message||err);$('pptProjectStatus').textContent='手機電子書讀取失敗。';}
};
$('save').onclick=()=>{if(pptProject.length)savePptProjectLocal();};
$('clear').onclick=()=>{if(confirm('確定清除目前 PPT 專題報告？'))clearPptProjectLocal();};
loadPptProjectLocal();
$('materialMode').onchange=e=>{
  const project=e.target.value==='ppt-project';
  $('pptFileBox').style.display=project?'none':'block';
  $('pptLocalEbookBox').style.display=project?'block':'none';
  $('pptProjectStatus').textContent=project?'PPT 專題報告只從手機本機電子書匯入；不使用 AIVAULT 電子書書架。':'尚未建立 PPT 專題報告';
};
$('file').onchange=e=>e.target.files[0]&&loadPpt(e.target.files[0]);
$('next').onclick=()=>{if(pptProject.length){pptProjectIndex=Math.min(pptProject.length-1,pptProjectIndex+1);pptProjectRender();say('下一頁。');}else{go(index+1);say('下一頁。')}};
$('prev').onclick=()=>{if(pptProject.length){pptProjectIndex=Math.max(0,pptProjectIndex-1);pptProjectRender();say('上一頁。');}else{go(index-1);say('上一頁。')}};
$('goto').onclick=()=>{const n=prompt('請輸入頁碼',index+1);if(n){go(Number(n)-1)}};function pageReadingText(){if(pptProject.length)return String(pptProject[pptProjectIndex]?.content||'');const t=slideTexts[index]||'';return t.trim()||'這一頁目前沒有擷取到可讀文字。'}$('readPage').onclick=()=>{const t=pageReadingText();if(!t)return;speakText(t)};

const EBOOK_SUPABASE_URL='https://clcddygkaaqqtsbswgdf.supabase.co';
const EBOOK_PUBLISHABLE_KEY='sb_publishable_1D05YGthBrNGg-5L92TLCw_GiLnInBu';
const EBOOK_INGEST=EBOOK_SUPABASE_URL+'/functions/v1/dark-star-ebook-ingest';
const DARK_STAR_TEACHING_RESEARCH=EBOOK_SUPABASE_URL+'/functions/v1/dark-star-web-research';
const DARK_STAR_TEACHING_GATEWAY=EBOOK_SUPABASE_URL+'/functions/v1/ai-gateway';
const darkStarTeachingState={
  color:'#2563eb',
  domains:[],
  lastQuery:'',
  lastResearch:[],
  lastAnswer:'',
  visible:false
};

const CLASSROOM_API=EBOOK_SUPABASE_URL+'/functions/v1/dark-star-ebook-ingest';
const CLASSROOM_REALTIME=EBOOK_SUPABASE_URL+'/realtime/v1/api/broadcast';
let classroomActive=false;
let classroomState={code:'',channel_token:'',owner_token:'',expires_at:''};
let classroomSupabase=null;
let classroomChannel=null;
let classroomRealtimeReady=false;
let lastClassroomPayload=null;
let classroomAudioRetryTimer=null;
let darkStarVoiceState={id:'',text:'',action:'idle'};
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
// 聲控與課堂直播共用老師麥克風時，不停止 classroomMicStream。
// SpeechRecognition 的生命週期只能控制辨識，不得關閉 WebRTC 課堂音訊。
function classroomKeepAudioAlive(){
  if(!classroomActive || !classroomMicStream)return;
  classroomMicStream.getAudioTracks().forEach(track=>{
    if(track.readyState==='ended'){
      classroomMicStream=null;
      classroomStartAudio().catch(e=>console.warn('classroom audio restore',e));
    }
  });
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

function classroomPayloadResearch(){
  return darkStarTeachingState.visible&&darkStarTeachingState.lastAnswer
    ? {
        answer:String(darkStarTeachingState.lastAnswer||''),
        color:String(darkStarTeachingState.color||'#2563eb'),
        query:String(darkStarTeachingState.lastQuery||''),
        sources:Array.isArray(darkStarTeachingState.lastResearch)
          ? darkStarTeachingState.lastResearch.map(s=>({
              title:String(s.title||''),
              url:String(s.url||''),
              snippet:String(s.snippet||'')
            }))
          : []
      }
    : null;
}
function classroomBuildPayload(payload){
  return {
    type:payload.type||'page',
    page:Number(payload.page)||1,
    total:Number(payload.total)||0,
    content:String(payload.content||''),
    project_title:String(payload.project_title||''),
    project_page_title:String(payload.project_page_title||''),
    project_kind:String(payload.project_kind||''),
    videos:Array.isArray(payload.videos)?payload.videos:[],
    darkstar_voice:payload.darkstar_voice||null,
    research:payload.research===undefined?classroomPayloadResearch():payload.research
  };
}
function addDarkStarResearchToProject(){
  if(!pptProject.length||!darkStarTeachingState.lastAnswer)return false;
  const q=String(darkStarTeachingState.lastQuery||'目前問題').trim();
  const answer=String(darkStarTeachingState.lastAnswer||'').trim();
  const sources=Array.isArray(darkStarTeachingState.lastResearch)?darkStarTeachingState.lastResearch:[];
  const current=pptProject[pptProjectIndex]||{};
  const duplicate=pptProject.some(x=>x&&x.kind==='research-question'&&String(x.research_query||'')===q);
  if(duplicate){
    $('pptProjectStatus').textContent='這個研究問題已經加入專題報告，未重複新增。';
    return false;
  }
  const insertAt=Math.min(pptProjectIndex+1,pptProject.length);
  const sourceText=sources.length
    ?sources.map((x,n)=>{
      const title=String(x.title||x.url||'來源');
      const url=x.url?String(x.url):'';
      const snippet=String(x.snippet||x.description||x.content||'').replace(/\s+/g,' ').trim().slice(0,1400);
      return (n+1)+'. '+title+(url?'\n'+url:'')+(snippet?'\n資料摘要：'+snippet:'');
    }).join('\n\n')
    :'本次研究沒有取得可列出的來源。';
  const slides=[
    {kind:'research-question',research_query:q,title:'研究問題｜'+q.slice(0,55),content:'研究問題\n\n'+q+(current.title?'\n\n研究所依據的專題頁：'+String(current.title):'')},
    {kind:'research-sources',research_query:q,title:'研究資料與來源',content:sourceText},
    {kind:'research-analysis',research_query:q,title:'暗星分析｜'+q.slice(0,45),content:'暗星分析\n\n'+answer},
    {kind:'teacher-conclusion',research_query:q,title:'老師結論',content:'請由老師整理本研究的課堂結論。\n\n（這一頁不由暗星代替老師下結論。）'}
  ];
  pptProject.splice(insertAt,0,...slides);
  pptProjectIndex=insertAt;
  pptProjectRender();
  savePptProjectLocal();
  $('pptProjectStatus').textContent='已加入研究四段式：研究問題／研究資料／暗星分析／老師結論，共 4 頁，並已保存。';
  return true;
}
function renderDarkStarTeachingPanel(){
  let host=document.getElementById('darkStarTeachingResearch');
  const target=ebookState.loaded?$('ebookLesson'):$('ppt');
  if(!target)return;
  if(!host){
    host=document.createElement('section');
    host.id='darkStarTeachingResearch';
    host.style.cssText='margin:12px 0;padding:14px 16px;border:1px solid #ddd;border-radius:12px;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,.08);position:relative;z-index:25;';
    target.appendChild(host);
  }
  if(!darkStarTeachingState.visible||!darkStarTeachingState.lastAnswer){
    host.style.display='none';
    host.innerHTML='';
    return;
  }
  host.style.display='block';
  const color=darkStarTeachingState.color||'#2563eb';
  const safeText=String(darkStarTeachingState.lastAnswer||'');
  host.innerHTML='<div style="font-weight:800;margin-bottom:7px">✦ 暗星教學研究</div>'+
    '<div style="white-space:pre-wrap;line-height:1.8;color:'+color+'">'+htmlEscape(safeText)+'</div>'+
    (darkStarTeachingState.lastResearch.length
      ? '<div style="margin-top:10px;padding-top:9px;border-top:1px solid #eee;font-size:13px;color:#666"><b>資料來源</b><br>'+
        darkStarTeachingState.lastResearch.map(s=>'<div style="margin-top:4px">'+htmlEscape(s.title||s.url||'來源')+(s.url?' — <a href="'+htmlEscape(s.url)+'" target="_blank" rel="noopener" style="color:#155eef">'+htmlEscape(s.url)+'</a>':'')+'</div>').join('')+
        '</div>'
      : '')+
    (pptProject.length?'<button type="button" id="addResearchToProject" class="b primary" style="margin-top:10px;width:100%">📊 將研究結果加入專題報告</button>':'');
  const addBtn=document.getElementById('addResearchToProject');
  if(addBtn)addBtn.onclick=()=>addDarkStarResearchToProject();
}
async function darkStarTeachingResearchApi(payload){
  const r=await fetch(DARK_STAR_TEACHING_RESEARCH,{
    method:'POST',
    headers:{'Content-Type':'application/json',apikey:EBOOK_PUBLISHABLE_KEY},
    body:JSON.stringify(payload)
  });
  const raw=await r.text();let d={};try{d=raw?JSON.parse(raw):{}}catch{}
  if(!r.ok)throw Error(d.error||d.message||('暗星網路研究 HTTP '+r.status));
  return d;
}
function darkStarResearchDomains(text){
  const t=String(text||'');
  const map=[
    ['司法院','judicial.gov.tw'],
    ['全國法規資料庫','law.moj.gov.tw'],
    ['法務部','moj.gov.tw'],
    ['行政院','ey.gov.tw'],
    ['立法院','ly.gov.tw'],
    ['教育部','moe.gov.tw'],
    ['衛福部','mohw.gov.tw'],
    ['衛生福利部','mohw.gov.tw'],
    ['內政部','moi.gov.tw'],
    ['最高人民法院','court.gov.cn'],
    ['中國政府網','gov.cn']
  ];
  const out=[];
  for(const [name,domain] of map)if(t.includes(name)&&!out.includes(domain))out.push(domain);
  const found=t.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s，。！？]*)?/ig)||[];
  for(const x of found){
    const d=x.replace(/^https?:\/\//i,'').replace(/^www\./i,'').split('/')[0];
    if(d&&!out.includes(d))out.push(d);
  }
  return out.slice(0,8);
}
function darkStarResearchIntent(text){
  const t=String(text||'');
  return /搜尋|搜索|上網|查資料|找資料|收集資料|研究一下|網路資料|網上資料|大數據|查證|交叉確認|確認一下/.test(t);
}
function darkStarResearchQuery(text){
  return String(text||'')
    .replace(/^[，。\s]*(暗星|暗星，|暗星:|暗星：)/,'')
    .replace(/^(請|幫我|幫忙|老師要|我要)?\s*(搜尋|搜索|上網搜尋|上網找|查資料|找資料|收集資料|研究一下|網路搜尋|網上搜尋)/,'')
    .replace(/只找[^，。；;]+/,'')
    .replace(/用(紅色|藍色|綠色|黃色|紫色|橙色|黑色|灰色)字/,'')
    .replace(/(如果錯誤|再查證|重新查證|交叉確認|確認答案|確認一下).*/,'')
    .trim() || String(text||'').trim();
}
function darkStarSetColor(text){
  const map={紅色:'#dc2626',藍色:'#2563eb',綠色:'#16a34a',黃色:'#ca8a04',紫色:'#9333ea',橙色:'#ea580c',黑色:'#111827',灰色:'#6b7280',白色:'#ffffff'};
  const m=String(text||'').match(/(紅色|藍色|綠色|黃色|紫色|橙色|黑色|灰色|白色)字?/);
  if(!m)return false;
  darkStarTeachingState.color=map[m[1]];
  return true;
}
function darkStarTeachingContext(){
  if(pptProject.length){
    const s=pptProject[pptProjectIndex]||{};
    return {
      mode:'ppt-project',
      project_title:String(pptProjectMeta.title||'PPT 專題報告'),
      source_book:String(pptProjectMeta.sourceBook||''),
      project_page:pptProjectIndex+1,
      project_total:pptProject.length,
      project_page_title:String(s.title||''),
      project_kind:String(s.kind||'content'),
      current_content:String(s.content||'').slice(0,30000),
      original_content:ebookState.loaded?String($('ebookLessonText')?.textContent||'').slice(0,30000):''
    };
  }
  return {
    mode:ebookState.loaded?'ebook':'ppt',
    book:ebookState.book?.title||ebookState.book?.name||'',
    chapter:ebookState.unitPages?.length?ebookState.unitPages[0]?.title||'':ebookState.book?.title||'',
    page:ebookState.page||index+1,
    total:ebookState.total||count||0,
    unit:ebookState.unitIndex>=0?ebookState.units?.[ebookState.unitIndex]?.title||'':'',
    original_content:ebookState.loaded
      ? String($('ebookLessonText')?.textContent||'').slice(0,30000)
      : String(slideTexts[index]||'').slice(0,30000)
  };
}
async function darkStarTeachingGateway(command,research){
  const topic='teaching-classroom-'+String(classroomState.code||'teacher');
  const researchText=(research?.sources||[]).map((s,i)=>
    '來源 '+(i+1)+': '+String(s.title||'')+'\nURL: '+String(s.url||'')+'\n內容: '+String(s.content||s.snippet||'').slice(0,9000)
  ).join('\n\n');
  const prompt=
    '你是 AIVAULT 的 Technical Dark Star（暗星），現在以老師的教學 Agent 身分工作。'+
    '你必須服從老師目前這一則命令。你只能產生課堂補充、研究、解釋或教學操作建議，絕對不能改寫或覆蓋原始教材。'+
    '如果有網路研究資料，必須以資料來源為依據；來源互相矛盾時明確指出，不可假裝確定。'+
    '你的回答會直接顯示在開始上課的頁面，所以請直接給老師要呈現的內容，不要說自己是模型。\n\n'+
    '目前課堂狀態：'+JSON.stringify(darkStarTeachingContext())+
    '\n\n老師命令：'+String(command||'')+
    (researchText?'\n\n暗星剛剛取得的網路資料：\n'+researchText:'');
  const r=await fetch(DARK_STAR_TEACHING_GATEWAY,{
    method:'POST',
    headers:{'Content-Type':'application/json',apikey:EBOOK_PUBLISHABLE_KEY},
    body:JSON.stringify({
      engine:'technical-dark-star',
      agent_id:'technical-dark-star',
      source:'teaching-assistant',
      topic_id:topic,
      owner_question:String(command||''),
      message:prompt,
      stream:false
    })
  });
  const raw=await r.text();let d={};try{d=raw?JSON.parse(raw):{}}catch{}
  if(!r.ok)throw Error(d.error||d.message||('暗星教學 Gateway HTTP '+r.status));
  const answer=String(d.content||d.text||d.message||d.answer||'').trim();
  if(!answer)throw Error('暗星沒有回傳可呈現的教學內容。');
  return answer;
}
async function runNavigationCommandDirect(text){
  const t=String(text||'').trim();
  if(pptProject.length){
    const sectionRules=[
      [/研究問題|研究問題頁/, 'research-question'],
      [/研究資料|資料來源|研究來源/, 'research-sources'],
      [/暗星分析|研究分析/, 'research-analysis'],
      [/老師結論|教師結論/, 'teacher-conclusion']
    ];
    for(const [re,kind] of sectionRules){
      if(re.test(t)){
        const idx=pptProject.findIndex(x=>x&&x.kind===kind);
        if(idx>=0){pptProjectIndex=idx;pptProjectRender();return true;}
      }
    }
    if(/(?:專題|報告).*(?:封面|首頁)|回專題封面/.test(t)){pptProjectIndex=0;pptProjectRender();return true;}
    if(/(?:專題|報告).*(?:下一頁|下一張)|下一頁|下一張|往下翻/.test(t)){if(pptProjectIndex+1<pptProject.length){pptProjectIndex++;pptProjectRender();}return true;}
    if(/(?:專題|報告).*(?:上一頁|上一張)|上一頁|上一張|往上翻/.test(t)){if(pptProjectIndex>0){pptProjectIndex--;pptProjectRender();}return true;}
  }
  if(!ebookState.loaded)return false;
  if(/第[一二三四五六七八九十百千0-9]+章/.test(t)){if(await voiceGotoChapter(t))return true;}
  if(/^(往下|往下走|向下|下面三行|往下三行)$/.test(t))return voiceScrollLines(3);
  if(/^(往上|向上|往上走)$/.test(t))return voiceScrollLines(-3);
  if(/下一個單元|下一單元/.test(t)){if(ebookState.unitIndex+1<ebookState.units.length){await ebookLoadUnit(ebookState.unitIndex+1);return true;}return false;}
  if(/上一個單元|上一單元/.test(t)){if(ebookState.unitIndex>0){await ebookLoadUnit(ebookState.unitIndex-1);return true;}return false;}
  if(/下一頁|下一張|往下翻/.test(t)){await ebookGo(1);return true;}
  if(/上一頁|上一張|往上翻/.test(t)){await ebookGo(-1);return true;}
  return false;
}
function stopDarkStarTeachingVoice(broadcast=true){
  try{speechSynthesis.cancel()}catch{}
  currentUtterance=null;
  darkStarVoiceState={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),text:'',action:'stop'};
  $('readStatus').textContent='⏹ 暗星已停止說話';
  $('tr').textContent='暗星已停止說話。';
  if(broadcast&&classroomActive&&lastClassroomPayload){
    classroomBroadcast({...lastClassroomPayload,darkstar_voice:{id:darkStarVoiceState.id,text:'',action:'stop'}});
  }
  voice=true;listening=false;setTimeout(()=>{if(voice&&!listening)startRec()},250);
  return true;
}
function pauseDarkStarTeachingVoice(){
  if(!speechSynthesis.speaking)return false;
  try{speechSynthesis.pause()}catch{}
  darkStarVoiceState.action='pause';
  if(classroomActive&&lastClassroomPayload)classroomBroadcast({...lastClassroomPayload,darkstar_voice:{id:darkStarVoiceState.id,text:darkStarVoiceState.text,action:'pause'}});
  $('readStatus').textContent='⏸ 暗星已暫停';
  return true;
}
async function darkStarTeacherCommand(text){
  if(!classroomActive||!classroomState.owner_token)return false;
  darkStarSetColor(text);
  const research=darkStarResearchIntent(text);
  const verify=/查證|重新查證|交叉確認|確認答案|確認一下|如果錯誤|再找/.test(String(text||''));
  const rawText=String(text||'').trim();
  // 語音辨識常把「暗星」誤轉成「安心／暗心」；因此教室改用「小助」作為主要喚醒詞，
  // 同時保留「暗星」及常見誤辨識。只有聽到「小助／暗星」+明確要求解釋，暗星才開口。
  const wakeText=String(rawText||'')
    .replace(/[，。！？、,.!?：:；;\s]/g,'')
    .replace(/^(?:安心|暗心|暗新|暗欣|暗星|小助|小朱|小主)/,'暗星');
  const wakeMatch=/^暗星/.test(wakeText);
  const explainIntent=wakeMatch && /(?:請)?(?:你)?(?:來)?(?:解釋|說明|講解)(?:一下)?/.test(wakeText);
  const explicitDarkStar=wakeMatch;
  const colorOnly=/(用|改成|換成|接下來).*?(紅色|藍色|綠色|黃色|紫色|橙色|黑色|灰色|白色).*?字?/.test(String(text||''));
  const navigationIntent=/下一頁|下一張|上一頁|上一張|往下|向下|往上|向上|第[一二三四五六七八九十百千0-9]+章|跳到|翻到|下一個單元|上一個單元/.test(rawText);
  // 翻頁也由暗星輔助：暗星負責理解目前老師意圖，真正的頁面操作仍交給既有的確定性導航函式。
  if(!research && !explicitDarkStar && !colorOnly && !navigationIntent)return false;
  $('tr').textContent=research?'暗星正在上網收集資料…':(navigationIntent?'暗星正在判斷老師的翻頁指令…':'暗星正在執行老師命令…');
  classVoiceControls();
  try{
    let webData=null;
    if(navigationIntent && !research){
      // 教材導航是確定性操作，不再交給 AI 判斷有沒有按鈕。
      // 第幾章會直接執行教材上方對應的章節按鈕。
      const handled=await runNavigationCommandDirect(text);
      if(handled){
        $('tr').textContent='暗星已完成老師指定的教材導航。';
        classVoiceControls();
        return true;
      }
      $('tr').textContent='暗星找不到老師指定的教材章節或翻頁位置。';
      classVoiceControls();
      return true;
    }
    if(research){
      const q=darkStarResearchQuery(text);
      const domains=darkStarResearchDomains(text);
      webData=await darkStarTeachingResearchApi({
        channel_token:classroomState.channel_token,
        owner_token:classroomState.owner_token,
        query:q,
        domains:domains.length?domains:darkStarTeachingState.domains,
        max_sources:verify?8:6,
        verify
      });
      darkStarTeachingState.lastQuery=q;
      darkStarTeachingState.domains=domains.length?domains:darkStarTeachingState.domains;
      darkStarTeachingState.lastResearch=Array.isArray(webData.sources)?webData.sources:[];
    }
    const answer=await darkStarTeachingGateway(text,webData);
    darkStarTeachingState.lastAnswer=answer;
    darkStarTeachingState.visible=true;
    renderDarkStarTeachingPanel();
    // 只有「暗星你來解釋／暗星請你來解釋」才讓暗星真正開口。
    // 搜尋、翻頁、改顏色等工作命令仍可執行，但不會搶答老師對學生提出的問題。
    if(explainIntent){
      $('tr').textContent='暗星正在直接說話…';
      voice=false; listening=false;
      try{rec?.abort()}catch{}
      try{speechSynthesis.cancel()}catch{}
      const voiceId=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random());
      darkStarVoiceState={id:voiceId,text:String(answer||''),action:'speak'};
      const u=new SpeechSynthesisUtterance(darkStarVoiceState.text);
      const v=(typeof chosenVoice==='function')?chosenVoice():null;
      if(v){u.voice=v;u.lang=v.lang||'zh-TW'}else{u.lang='zh-TW'}
      u.rate=+$('rate').value||1;u.pitch=1;u.volume=1;currentUtterance=u;
      u.onstart=()=>{$('readStatus').textContent='🔊 暗星正在說話…';};
      u.onend=()=>{$('readStatus').textContent='✅ 暗星說完了';currentUtterance=null;darkStarVoiceState.action='idle';voice=true;setTimeout(()=>{if(voice&&!listening)startRec()},250);};
      u.onerror=()=>{$('readStatus').textContent='⚠️ 暗星語音播放失敗';currentUtterance=null;darkStarVoiceState.action='idle';voice=true;setTimeout(()=>{if(voice&&!listening)startRec()},250);};
      speechSynthesis.speak(u);
    }
    if(research){
      $('tr').textContent='暗星已完成網路研究並呈現在課堂頁面';
    }else{
      $('tr').textContent='暗星已依老師命令完成課堂處理';
    }
    classVoiceControls();
    if(classroomActive){
      const base=lastClassroomPayload||{
        type:ebookState.loaded?'page':'ppt',
        page:ebookState.loaded?ebookState.page:index+1,
        total:ebookState.loaded?ebookState.total:count,
        content:ebookState.loaded?String($('ebookLessonText')?.textContent||''):String(slideTexts[index]||''),
        videos:[]
      };
      classroomBroadcast({...base,research:classroomPayloadResearch(),darkstar_voice:darkStarVoiceState.action==='speak'?{id:darkStarVoiceState.id,text:darkStarVoiceState.text,action:'speak'}:null});
    }
    return true;
  }catch(e){
    console.warn('dark star teaching command',e);
    $('tr').textContent='暗星執行失敗：'+(e.message||e);
    classVoiceControls();
    return true;
  }
}

async function classroomUpdateState(payload){
  if(!classroomActive||!classroomState.owner_token)return;
  lastClassroomPayload=classroomBuildPayload(payload);
  try{await classroomApi({action:'classroom_update',channel_token:classroomState.channel_token,owner_token:classroomState.owner_token,state:lastClassroomPayload});}catch(e){console.warn('classroom state update',e);}
}
async function classroomBroadcast(payload){
  const clean=classroomBuildPayload(payload);
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
function syncPptEbookSelector(){
  const sel=$('pptEbookSelect'); if(!sel)return;
  const current=String(sel.value||'');
  sel.innerHTML='<option value="">請選擇 AIVAULT 電子書</option>';
  ebookState.books.forEach(b=>{
    const id=ebookPick(b,['ebook_id','id','book_id']); if(!id)return;
    const o=document.createElement('option');
    o.value=id;
    o.textContent=String(ebookPick(b,['title','name'])||'電子書 '+id);
    sel.appendChild(o);
  });
  if(current&&ebookState.books.some(b=>String(ebookPick(b,['ebook_id','id','book_id']))===current))sel.value=current;
}
async function ebookRefresh(){
  const sel=$('ebookSelect'), status=$('ebookStatus');
  status.textContent='正在讀取 AIVAULT 電子書書名…';
  try{
    const d=await ebookApi({action:'list',limit:80});
    const payload=ebookPick(d,['data'])||d;
    const rows=ebookPick(payload,['books','ebooks','items'])||[];
    ebookState.books=Array.isArray(rows)?rows:[];
    sel.innerHTML='<option value="">請選擇上課教材</option>';
    syncPptEbookSelector();
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
  if(provider==='youtube' && id) return '<div style="margin-top:8px"><b>🎬 '+htmlEscape(title)+'</b><div style="margin-top:6px;position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden"><iframe src="https://www.youtube.com/embed/'+encodeURIComponent(id)+'" title="'+htmlEscape(title)+'" style="width:100%;height:100%;border:0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div></div>';
  if(provider==='vimeo' && id) return '<div style="margin-top:8px"><b>🎬 '+htmlEscape(title)+'</b><div style="margin-top:6px;position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden"><iframe src="https://player.vimeo.com/video/'+encodeURIComponent(id)+'" title="'+htmlEscape(title)+'" style="width:100%;height:100%;border:0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div></div>';
  if(provider==='direct' && url) return '<div style="margin-top:8px"><b>🎬 '+htmlEscape(title)+'</b><video controls playsinline preload="metadata" style="width:100%;max-height:520px;background:#000;border-radius:10px" src="'+htmlEscape(url)+'"></video></div>';
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
async function enter(){if(!count&&!ebookState.loaded&&!pptProject.length)return say('請先上傳 PPT、建立 PPT 專題報告或匯入電子書教材。');try{await ensureClassroom();await classroomPrepareRealtime();}catch(e){say('課堂入口建立失敗：'+(e.message||e));return}classroomActive=true;classMode=true;classroomBadge();renderDarkStarClassroomAvatar();
try{await classroomStartAudio();}catch(e){classroomActive=false;classMode=false;try{await classroomChannel?.unsubscribe?.()}catch{}say(e.message||'老師麥克風啟動失敗。');return;}$('panel').classList.add('class');classVoiceControls();darkStarTeachingVoiceControls();$('ppt').classList.toggle('focusPpt',!!(count||pptProject.length)&&!ebookState.loaded);$('ebookLesson').style.display=ebookState.loaded?'block':$('ebookLesson').style.display;$('start').style.display='none';$('exit').style.display='inline-block';document.body.style.overflow='hidden';if(ebookState.loaded&&!count){$('ppt').style.display='block';$('ppt').classList.add('ebookFocusShell');}else{$('ppt').style.display='block';$('ppt').classList.remove('ebookFocusShell');}classroomBadge();try{await $('panel').requestFullscreen()}catch{}renderDarkStarClassroomAvatar();say('開始上課。',ebookState.loaded&&!count&&!pptProject.length);if(pptProject.length){pptProjectRender();}else if(lastClassroomPayload)classroomBroadcast(lastClassroomPayload)}async function exit(){classroomActive=false;classroomStopAudio();if(classroomState.channel_token&&classroomState.owner_token)classroomApi({action:'classroom_close',channel_token:classroomState.channel_token,owner_token:classroomState.owner_token}).catch(()=>{});if(classroomChannel&&classroomSupabase){classroomSupabase.removeChannel(classroomChannel);classroomChannel=null}classroomState={code:'',channel_token:'',owner_token:'',expires_at:''};try{sessionStorage.removeItem('aivault_classroom')}catch{}classMode=false;hideDarkStarClassroomAvatar();classroomBadge();$('info').textContent=ebookState.loaded?'電子書教材｜第 '+(ebookState.page||1)+(ebookState.total?' / '+ebookState.total:''):count?'第 '+(index+1)+' / '+count+' 頁':'尚未載入';$('panel').classList.remove('class');document.getElementById('classVoiceControls')?.remove();hideDarkStarTeachingVoiceControls();$('ppt').classList.remove('focusPpt','ebookFocusShell');$('start').style.display='inline-block';$('exit').style.display='none';document.body.style.overflow='';hideResearch();stopReading();try{if(document.fullscreenElement)await document.exitFullscreen()}catch{}say('已回到主畫面。')}$('start').onclick=enter;$('exit').onclick=exit;
function darkStarTeachingVoiceControls(){
  if(!classroomActive)return;
  let host=document.getElementById('darkStarVoiceControls');
  if(!host){
    host=document.createElement('div');host.id='darkStarVoiceControls';
    host.style.cssText='position:fixed;left:10px;bottom:10px;z-index:9700;display:flex;gap:6px;';
    host.innerHTML='<button type="button" id="darkStarPauseBtn" class="b">⏸ 暫停暗星</button><button type="button" id="darkStarStopBtn" class="b">⏹ 停止暗星</button>';
    document.body.appendChild(host);
    $('darkStarPauseBtn').onclick=()=>pauseDarkStarTeachingVoice();
    $('darkStarStopBtn').onclick=()=>stopDarkStarTeachingVoice(true);
  }
}
function hideDarkStarTeachingVoiceControls(){document.getElementById('darkStarVoiceControls')?.remove();}
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
  if(v.provider==='direct')return '<video controls playsinline preload="metadata" style="width:100%;max-height:520px;background:#000" src="'+htmlEscape(v.url)+'"></video>';
  return '';
}
$('openV').onclick=()=>{const v=parseVideoSource($('yu').value);if(!v)return say('請輸入可嵌入播放的 YouTube、Vimeo 或直接影片網址。');$('video').innerHTML=videoHtml(v);$('videoStatus').textContent='影片正在 AIVAULT 教學助理內播放。'};
$('saveV').onclick=async()=>{const v=parseVideoSource($('yu').value);if(!v)return say('請先輸入影片網址。');if(!ebookState.loaded){ebookState.pendingVideo=v;$('videoStatus').textContent='影片已加入目前教學教材；轉成電子書時會一起寫入電子書。';return;}try{await ebookApi({action:'media',ebook_id:ebookState.bookId,page_number:ebookState.page,videos:[v]});$('videoStatus').textContent='已儲存到電子書第 '+ebookState.page+' 頁；影片仍可直接在 AIVAULT 內播放。';await ebookGo(0);}catch(e){$('videoStatus').textContent='影片儲存失敗：'+(e.message||e);}};
$('closeV').onclick=()=>{$('video').innerHTML='';$('videoStatus').textContent='影片已關閉。'};
async function detectMicrophone(){const el=$('mic');try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>t.stop());el.className='mic ok';el.textContent='✅ 已偵測到麥克風';return true}catch(e){el.className='mic warn';el.textContent='⚠️ 麥克風尚未允許';return false}}
function renderDarkStarClassroomAvatar(){
  if(!classroomActive)return;
  const panel=$('panel');
  if(!panel)return;
  let host=$('darkStarClassroomAvatar');
  if(!host){
    host=document.createElement('div');
    host.id='darkStarClassroomAvatar';
    // 教室中的暗星只做小型狀態指示，不能遮住老師的教材。
    host.style.cssText='position:fixed;right:10px;bottom:10px;width:118px;min-height:92px;padding:7px 7px 6px;border-radius:14px;background:rgba(8,12,24,.86);border:1px solid rgba(130,150,255,.5);box-shadow:0 6px 18px rgba(0,0,0,.3);z-index:9600;color:#fff;pointer-events:none;text-align:center;backdrop-filter:blur(6px);';
    host.innerHTML='<div id="darkStarAvatarFace" style="width:42px;height:42px;margin:0 auto 4px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;background:radial-gradient(circle at 50% 42%,#dbe5ff 0 8%,#6f82ff 9% 22%,#17224b 48%,#050816 72%);box-shadow:0 0 12px rgba(105,125,255,.55);">✦</div>'+
      '<div style="font-size:14px;font-weight:900;letter-spacing:.5px;">暗星</div>'+
      '<div id="darkStarAvatarStatus" style="margin-top:3px;font-size:10px;line-height:1.25;color:#b9c5ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🎤 正在聽</div>';
    panel.appendChild(host);
  }
  const status=$('darkStarAvatarStatus');
  const tr=$('tr')?.textContent||'';
  if(status){
    if(currentUtterance)status.textContent='🔊 暗星正在說話';
    else if(tr&&tr!=='等待老師說話…')status.textContent='🎤 '+tr.slice(0,32);
    else status.textContent='🎤 正在聽老師';
  }
  const face=$('darkStarAvatarFace');
  if(face)face.style.transform=currentUtterance?'scale(1.06)':'scale(1)';
}
function hideDarkStarClassroomAvatar(){
  $('darkStarClassroomAvatar')?.remove();
}

function classVoiceControls(){
  const bar=document.querySelector('#panel.class .stage .bar');
  if(!bar)return;
  renderDarkStarClassroomAvatar();
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
function chineseNumberToInt(s){
  s=String(s||'').trim();
  if(/^\d+$/.test(s))return Number(s);
  const d={'零':0,'〇':0,'一':1,'二':2,'兩':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
  if(!s)return NaN;
  let total=0,section=0,num=0;
  for(const ch of s){
    if(d[ch]!==undefined){num=d[ch];continue;}
    if(ch==='十'||ch==='百'||ch==='千'){
      const unit=ch==='十'?10:ch==='百'?100:1000;
      section+=(num||1)*unit;num=0;
    }else return NaN;
  }
  return section+num;
}
function extractChapterNumber(t){
  const m=String(t||'').match(/第\s*([0-9０-９一二兩三四五六七八九十百千〇零]+)\s*章/);
  if(!m)return NaN;
  const raw=m[1].replace(/[０-９]/g,x=>String('０１２３４５６７８９'.indexOf(x)));
  return chineseNumberToInt(raw);
}
async function voiceGotoChapter(text){
  if(!ebookState.loaded)return false;
  const n=extractChapterNumber(text);
  if(!Number.isFinite(n))return false;
  const outline=$('ebookLessonOutline');
  const buttons=outline?[...outline.querySelectorAll('button')]:[];
  // 優先直接找畫面上真正存在的章節按鈕，不要求 TOC level 必須正確。
  const target=buttons.find(btn=>extractChapterNumber(btn.textContent)===n);
  if(target){
    try{
      target.scrollIntoView({block:'nearest'});
      target.click();
      $('tr').textContent='暗星已點選上方第 '+n+' 章。';
      classVoiceControls();
      return true;
    }catch(e){
      console.warn('voice chapter button',e);
    }
  }
  // 按鈕尚未建立或教材目錄沒有對應按鈕時，再使用 TOC 頁碼作為後備。
  const toc=Array.isArray(ebookState.toc)?ebookState.toc:[];
  const hit=toc.find(x=>extractChapterNumber(x.title)===n);
  if(!hit)return false;
  try{
    const page=Number(hit.page_number);
    if(!Number.isFinite(page)||page<1)return false;
    await ebookGo(page-(Number(ebookState.page)||1));
    $('tr').textContent='暗星已跳到第 '+n+' 章。';
    classVoiceControls();
    return true;
  }catch(e){
    console.warn('voice chapter fallback',e);
    $('tr').textContent='第 '+n+' 章切換失敗：'+(e.message||e);
    classVoiceControls();
    return true;
  }
}
function voiceScrollLines(lines=3){
  if(!ebookState.loaded)return false;
  const el=$('ebookLessonText');
  if(!el)return false;
  const cs=getComputedStyle(el);
  let lh=parseFloat(cs.lineHeight);
  if(!Number.isFinite(lh)||lh<=0)lh=parseFloat(cs.fontSize)||16;
  const before=el.scrollTop;
  const max=Math.max(0,el.scrollHeight-el.clientHeight); el.scrollTop=Math.max(0,Math.min(max,before+lh*lines));
  $('tr').textContent=el.scrollTop>before?'已往下三行':'已到目前內容底部';
  classVoiceControls();
  return true;
}
function voiceNormalizeSearch(s){return normalizeVoiceText(s).replace(/^請?搜尋/,'').replace(/^請?搜索/,'').replace(/^找一下/,'').replace(/^找/,'').trim();}
function voiceSimilarity(query,text){
  const q=normalizeVoiceText(query),t=normalizeVoiceText(text);
  if(!q||!t)return 0;
  if(t.includes(q))return 100000+q.length;
  const chars=[...new Set([...q])];
  let hit=0;for(const ch of chars)if(t.includes(ch))hit++;
  let big=0;for(let i=0;i<q.length-1;i++)if(t.includes(q.slice(i,i+2)))big++;
  return hit*3+big*8+Math.min(q.length,t.length)/100000;
}
async function voiceSearchAndJump(text){
  if(!ebookState.loaded)return false;
  const q=voiceNormalizeSearch(text);
  if(q.length<2)return false;
  let best={score:-1,page:0,content:''};
  const pages=Array.isArray(ebookState.unitPages)?ebookState.unitPages:[];
  for(const p of pages){const score=voiceSimilarity(q,p?.content||'');if(score>best.score)best={score,page:Number(p?.page_number)||0,content:String(p?.content||'')};}
  const units=Array.isArray(ebookState.units)?ebookState.units:[];
  const missing=units.filter((_,i)=>i!==ebookState.unitIndex);
  const results=await Promise.all(missing.map(async u=>{try{const d=await ebookApi({action:'lesson_unit',ebook_id:ebookState.bookId,ordinal:Number(u.ordinal)});const p=ebookPick(d,['data'])||d;return Array.isArray(ebookPick(p,['pages','items']))?ebookPick(p,['pages','items']):[];}catch{return []}}));
  for(const arr of results)for(const p of arr){const score=voiceSimilarity(q,p?.content||'');if(score>best.score)best={score,page:Number(p?.page_number)||0,content:String(p?.content||'')};}
  if(best.page&&best.score>0){
    await ebookGo(best.page-(Number(ebookState.page)||1));
    const preview=best.content.replace(/\\s+/g,' ').trim().slice(0,80);
    $('tr').textContent='已找到相似內容並跳到第 '+best.page+' 頁：'+preview;
    classVoiceControls();
    return true;
  }
  $('tr').textContent='找不到相似內容：'+q;classVoiceControls();return true;
}
function normalizeVoiceText(text){return String(text||'').replace(/[，。！？、,.!?\s]/g,'').trim();}
async function runVoiceCommand(text){
  const commandText=String(text||'').trim();
  if(/(?:暗星|小助|小朱|小主)[，,、\s]*(停止說話|停止|閉嘴|停下來)/.test(commandText))return stopDarkStarTeachingVoice(true);
  if(/(?:暗星|小助|小朱|小主)[，,、\s]*(暫停說話|暫停)/.test(commandText))return pauseDarkStarTeachingVoice();

  // 教材「第幾章」是確定性導航：先直接處理，絕不交給 AI 判斷按鈕。
  // 這也允許語音辨識成「第四章開始」「小助第四章開始」「暗星第四章」等形式。
  const directChapterText=String(text||'').trim();
  if(ebookState.loaded && /第\s*[0-9０-９一二兩三四五六七八九十百千〇零]+\s*章/.test(directChapterText)){
    if(await voiceGotoChapter(directChapterText))return true;
  }
  // 先把語音辨識常見的「安心／暗心」及「小助」喚醒詞視為暗星稱呼。
  // 這只做喚醒詞判定，不會把老師對學生的普通問題交給暗星回答。
  const voiceRaw=String(text||'').trim();
  const voiceWake=/^(?:暗星|安心|暗心|暗新|暗欣|小助|小朱|小主)[，,、\s]/.test(voiceRaw);
  if(voiceWake){
    const canonical=voiceRaw.replace(/^(暗星|安心|暗心|暗新|暗欣|小助|小朱|小主)/,'暗星');
    if(await darkStarTeacherCommand(canonical))return true;
  }else if(await darkStarTeacherCommand(text))return true;
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
function startRec(){
  if(!rec||listening)return;
  classroomKeepAudioAlive();
  try{rec.start()}catch(e){listening=false;console.warn('speech recognition start',e);$('vs').textContent='請再按一次「開始聽」'}
}
function setup(){
  const S=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!S){voice=false;$('vs').textContent='此瀏覽器不支援語音辨識';return}
  rec=new S();rec.lang='zh-TW';rec.continuous=false;rec.interimResults=true;
  rec.onstart=()=>{listening=true;$('vs').textContent='🎤 聲控啟用，請說話'};
  rec.onerror=e=>{listening=false;console.warn('speech recognition',e);if(voice)$('vs').textContent=e?.error==='not-allowed'?'⚠️ 麥克風／語音辨識權限被拒絕':'⚠️ 聲控暫停，請按「開始聽」'};
  rec.onresult=e=>{let t='';for(let k=e.resultIndex;k<e.results.length;k++)if(e.results[k].isFinal)t+=e.results[k][0].transcript;if(t){$('tr').textContent=t;classVoiceControls();runVoiceCommand(t).catch(e=>console.warn('voice command',e));}classroomKeepAudioAlive();};
  rec.onend=()=>{listening=false;classroomKeepAudioAlive();if(voice){$('vs').textContent='🎤 聲控已停止，重新啟動中…';setTimeout(()=>{if(rec&&voice&&!listening)startRec()},250)}};
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

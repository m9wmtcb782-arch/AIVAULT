async function extractPptText(file){slideTexts=[];$('pptTextStatus').textContent='PPT 文字索引：正在建立…';try{const JSZip=(await import('https://esm.sh/jszip@3.10.1')).default;const zip=await JSZip.loadAsync(await file.arrayBuffer());const names=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/i.test(n));names.sort((a,b)=>Number(a.match(/slide(\d+)/i)[1])-Number(b.match(/slide(\d+)/i)[1]));for(const name of names){const xml=await zip.files[name].async('text');const doc=new DOMParser().parseFromString(xml,'application/xml');const arr=[...doc.getElementsByTagName('a:t')].map(x=>x.textContent||'').filter(Boolean);slideTexts.push(arr.join(' '))}$('pptTextStatus').textContent='PPT 文字索引：已完成，共 '+slideTexts.length+' 頁';return true}catch(e){console.warn('PPT text extraction',e);$('pptTextStatus').textContent='PPT 文字索引：瀏覽器無法擷取文字，但投影片仍可播放';return false}}
async function loadPpt(f){stopReading();$('view').textContent='正在解析 PPT…';$('thumbs').textContent='正在建立縮圖…';try{const textPromise=extractPptText(f);const m=await import('https://esm.sh/@aiden0z/pptx-renderer@1.2.4');viewer=await m.PptxViewer.open(await f.arrayBuffer(),$('view'),{renderMode:'slide',fitMode:'contain'});count=Number(viewer.slideCount)||0;if(!count)throw Error('沒有投影片');await textPromise;$('thumbs').innerHTML='';for(let k=0;k<count;k++){const t=document.createElement('div');t.className='thumb';t.innerHTML='<div>第 '+(k+1)+' 頁</div>';const box=document.createElement('div');box.className='tp';t.appendChild(box);t.onclick=()=>go(k);$('thumbs').appendChild(t);try{const h=viewer.renderThumbnailToContainer(k,box,{width:105});if(h&&h.ready)await h.ready}catch(e){console.warn('thumbnail',k,e)}}index=0;await go(0);say('PPT 已載入，共 '+count+' 頁。')}catch(e){console.error(e);$('view').textContent='PPT 預覽失敗：'+(e.message||e);say('PPT 預覽失敗。')}}
$('file').onchange=e=>e.target.files[0]&&loadPpt(e.target.files[0]);$('next').onclick=()=>{go(index+1);say('下一頁。')};$('prev').onclick=()=>{go(index-1);say('上一頁。')};$('goto').onclick=()=>{const n=prompt('請輸入頁碼',index+1);if(n){go(Number(n)-1)}};function pageReadingText(){const t=slideTexts[index]||'';return t.trim()||'這一頁目前沒有擷取到可讀文字。'}$('readPage').onclick=()=>{const t=pageReadingText();if(t.startsWith('這一頁目前'))return say(t);speakText(t)};

const EBOOK_SUPABASE_URL='https://clcddygkaaqqtsbswgdf.supabase.co';
const EBOOK_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJjbGNkZHlka2FhYXFxdHNibmdkZiIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE';
const EBOOK_INGEST=EBOOK_SUPABASE_URL+'/functions/v1/dark-star-ebook-ingest';
const ebookState={books:[],bookId:'',book:null,page:1,total:0,loaded:false};
async function ebookApi(payload){
  const r=await fetch(EBOOK_INGEST,{method:'POST',headers:{'Content-Type':'application/json',apikey:EBOOK_ANON_KEY,Authorization:'Bearer '+EBOOK_ANON_KEY},body:JSON.stringify(payload)});
  const raw=await r.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{}
  if(!r.ok)throw Error((data.error||data.message||('電子書服務 HTTP '+r.status)));
  return data;
}
function ebookPick(data,keys){for(const k of keys)if(data&&data[k]!=null)return data[k];return null}
async function ebookRefresh(){
  const sel=$('ebookSelect'), status=$('ebookStatus');
  status.textContent='正在讀取 AIVAULT 電子書目錄…';
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
    status.textContent=ebookState.books.length?'已載入 '+ebookState.books.length+' 本電子書，可直接匯入成教材。':'目前沒有可用電子書';
  }catch(e){status.textContent='電子書目錄讀取失敗：'+(e.message||e)}
}
async function ebookLoad(){
  const id=$('ebookSelect').value;if(!id){say('請先選擇電子書教材。');return}
  $('ebookStatus').textContent='正在載入教材…';
  try{
    const d=await ebookApi({action:'book',ebook_id:id,page_number:1});
    const payload=ebookPick(d,['data'])||d;
    const b=ebookPick(payload,['book','ebook'])||ebookState.books.find(x=>String(ebookPick(x,['ebook_id','id','book_id']))===String(id))||{};
    const pages=ebookPick(payload,['pages','items'])||[];
    ebookState.book=b;ebookState.bookId=id;ebookState.page=Number(ebookPick(payload,['page_number'])||1);ebookState.total=Number(ebookPick(payload,['total_pages','page_count'])||ebookPick(b,['total_pages','page_count'])||0);ebookState.loaded=true;
    $('ebookLesson').style.display='block';
    $('ebookStatus').textContent='教材已匯入：'+(ebookPick(b,['title','name'])||'電子書');
    await ebookRender(pages[0]||ebookPick(payload,['page'])||payload);
    say('電子書已匯入教學助理，現在可以作為老師上課教材。');
  }catch(e){$('ebookStatus').textContent='教材載入失敗：'+(e.message||e);say('電子書教材載入失敗。')}
}
async function ebookRender(pageObj){
  const p=pageObj||{};const n=Number(ebookPick(p,['page_number','page','number'])||ebookState.page||1);
  ebookState.page=n;
  const text=String(ebookPick(p,['content','page_content','text','body','html'])||'').replace(/<[^>]+>/g,'').trim();
  $('ebookLessonTitle').textContent='📚 '+(ebookPick(ebookState.book,['title','name'])||'電子書教材');
  $('ebookLessonPage').textContent='第 '+n+(ebookState.total?' / '+ebookState.total:'')+' 頁';
  $('ebookLessonText').textContent=text||'本頁沒有可讀文字。';
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
$('ebookLoad').onclick=ebookLoad;
$('ebookRefresh').onclick=ebookRefresh;
$('ebookPrev').onclick=()=>ebookGo(-1);
$('ebookNext').onclick=()=>ebookGo(1);
$('ebookRead').onclick=()=>{const t=$('ebookLessonText').innerText.trim();if(t)speakText(t)};
$('ebookStop').onclick=stopReading;
$('ebookExport').onclick=exportTeachingToEbook;

async function exportTeachingToEbook(){
  const title=($('ebookExportTitle')?.value||'').trim() || ('AIVAULT 教學教材 '+new Date().toLocaleDateString('zh-TW'));
  let parts=[];
  if(Array.isArray(slideTexts)&&slideTexts.length){
    parts=slideTexts.map((t,i)=>('第 '+(i+1)+' 頁\\n'+(t||'')).trim()).filter(Boolean);
  }else if(ebookState.loaded){
    parts=[($('ebookLessonTitle').textContent||'電子書教材'),($('ebookLessonText').innerText||'')].join('\\n');
  }
  const content=parts.join('\\n\\n');
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
    $('ebookStatus').textContent='已轉換成電子書：'+title+(newId?'（已存入 AIVAULT 書架）':'');
    say('教學教材已轉換成電子書並存入 AIVAULT。');
    await ebookRefresh();
    if(newId)$('ebookSelect').value=newId;
  }catch(e){$('ebookStatus').textContent='轉換電子書失敗：'+(e.message||e);say('教學教材轉換失敗。')}
}
ebookRefresh();
async function enter(){if(!count&&!ebookState.loaded)return say('請先上傳 PPT 或匯入電子書教材。');classMode=true;$('panel').classList.add('class');$('ppt').classList.toggle('focusPpt',!!count&&!ebookState.loaded);$('ebookLesson').style.display=ebookState.loaded?'block':$('ebookLesson').style.display;$('start').style.display='none';$('exit').style.display='inline-block';document.body.style.overflow='hidden';if(ebookState.loaded&&!count){$('ppt').style.display='none';}else{$('ppt').style.display='block';}try{await $('panel').requestFullscreen()}catch{}say(ebookState.loaded&&!count?'開始電子書教材課程。':'開始上課。')}async function exit(){classMode=false;$('panel').classList.remove('class');$('ppt').classList.remove('focusPpt');$('start').style.display='inline-block';$('exit').style.display='none';document.body.style.overflow='';hideResearch();stopReading();try{if(document.fullscreenElement)await document.exitFullscreen()}catch{}say('已回到主畫面。')}$('start').onclick=enter;$('exit').onclick=exit;
function hideResearch(){researchOpen=false;researchBig=false;$('research').classList.remove('on','big')}
function showResearch(q){q=(q||'').trim();if(!q)return;researchOpen=true;$('q').value=q;$('research').classList.add('on');$('rbody').textContent=q;say('已開啟研究。')}
$('search').onclick=()=>showResearch($('q').value);$('rClose').onclick=hideResearch;$('rPpt').onclick=()=>{hideResearch();say('已回到 PPT。')};$('rBig').onclick=()=>{$('research').classList.toggle('big')};$('rRead').onclick=()=>{const t=$('rbody').innerText.trim();if(t)speakText(t)};
function yid(u){try{const x=new URL(u);return x.searchParams.get('v')||x.pathname.split('/').pop()}catch{return''}}$('openV').onclick=()=>{const id=yid($('yu').value.trim());if(!id)return say('請輸入 YouTube 網址。');$('video').innerHTML='<iframe style="width:100%;aspect-ratio:16/9" src="https://www.youtube.com/embed/'+encodeURIComponent(id)+'" allowfullscreen></iframe>'};$('closeV').onclick=()=>{$('video').innerHTML=''};
async function detectMicrophone(){const el=$('mic');try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>t.stop());el.className='mic ok';el.textContent='✅ 已偵測到麥克風';return true}catch(e){el.className='mic warn';el.textContent='⚠️ 麥克風尚未允許';return false}}
function startRec(){if(!rec||listening)return;try{rec.start();listening=true}catch{}}
function setup(){const S=window.SpeechRecognition||window.webkitSpeechRecognition;if(!S){voice=false;$('vs').textContent='此瀏覽器不支援語音辨識';return}rec=new S();rec.lang='zh-TW';rec.continuous=false;rec.interimResults=true;rec.onstart=()=>{listening=true;if(voice)$('vs').textContent='聲控啟用'};rec.onerror=()=>{listening=false};rec.onresult=e=>{let t='';for(let k=e.resultIndex;k<e.results.length;k++)if(e.results[k].isFinal)t+=e.results[k][0].transcript;if(t){$('tr').textContent=t}};rec.onend=()=>{listening=false;setTimeout(()=>{if(rec&&voice)startRec()},350)};$('voiceStart').onclick=()=>{voice=true;$('vs').textContent='聲控啟用';startRec()};$('voiceStop').onclick=()=>{voice=false;$('vs').textContent='聲控已取消';try{rec.stop()}catch{}};startRec()}
setSpeechEnabled(true);detectMicrophone();setup();

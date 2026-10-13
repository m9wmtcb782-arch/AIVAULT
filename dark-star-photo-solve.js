(()=>{'use strict';
const $=id=>document.getElementById(id);
const base='https://clcddygkaaqqtsbswgdf.supabase.co';
let image='',busy=false,version=0;
const buttons=['recognize','solve','search','refresh'];
function state(){buttons.forEach(id=>$(id).disabled=busy||(['recognize','solve'].includes(id)&&!image));$('photo').disabled=busy;}
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
async function api(body){
 const response=await fetch(base+'/functions/v1/dark-star-ebook-ingest?feature=photo-solve',{method:'POST',headers:{'Content-Type':'application/json',apikey:AIVAULTEbook.ANON_KEY,Authorization:'Bearer '+AIVAULTEbook.ANON_KEY},body:JSON.stringify(body),signal:AbortSignal.timeout(360000)});
 const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'暗星處理失敗');return data;
}
async function run(fn){if(busy)return;busy=true;state();try{await fn();}catch(e){status(e.name==='TimeoutError'?'處理逾時，請稍後重試。':e.message,true);}finally{busy=false;state();}}
async function books(){const d=await api({action:'books'}),selected=$('book').value;$('book').replaceChildren(new Option('全部已匯入電子書',''));for(const b of d.books)$('book').add(new Option(b.title+'（'+b.total_pages+' 頁）',b.id));if(d.books.some(b=>b.id===selected))$('book').value=selected;$('catalogStatus').textContent='後端可搜尋教材：'+d.books.length+' 本。新教材請先在匯入頁按「開始匯入」並等待完成，再重新載入。';}
async function prepare(file){
 if(!file||!file.type.startsWith('image/'))throw Error('請選擇圖片');if(file.size>25*1024*1024)throw Error('照片過大，請選擇小於 25 MB 的圖片');
 const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(1,1800/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.9);}finally{URL.revokeObjectURL(url);}
}
function law(d){if(d.jurisdiction){const j=d.jurisdiction;$('lawStatus').textContent='辨識：'+j.script+'｜'+j.label+'。'+j.reason;}}
function show(d){law(d);$('result').hidden=false;$('answer').textContent=d.answer||(d.found?'已找到相關教材。可按「搜尋教材／官方法源並解題」。':'後端沒有找到相關教材。解題時會依設定上網補查。');$('sources').replaceChildren();for(const s of d.sources||[]){const article=document.createElement('article'),title=document.createElement('strong'),meta=document.createElement('div'),p=document.createElement('p');title.textContent='['+s.ref+'] '+s.book_title;if(s.kind==='web'){const link=document.createElement('a');link.href=s.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='開啟官方原文';meta.textContent='官方網路來源｜擷取時間：'+new Date(s.retrieved_at).toLocaleString('zh-TW')+' ';meta.append(link);}else{meta.textContent='教材｜電子書第 '+s.page_number+' 頁'+(s.chapter?'・'+s.chapter:'');}p.textContent=s.excerpt;article.append(title,meta,p);$('sources').append(article);}if(d.web?.error){const note=document.createElement('p');note.textContent=d.web.error;$('sources').prepend(note);}}

function payload(action){return {action,image,jurisdiction:$('jurisdiction').value,allow_web:$('allowWeb').checked,question:$('question').value.trim(),terms:$('terms').value.split(/[,，、\n]/).map(s=>s.trim()).filter(Boolean),ebook_id:$('book').value||null};}
$('photo').addEventListener('change',()=>run(async()=>{const current=++version;image='';$('preview').style.display='none';$('question').value='';$('terms').value='';$('result').hidden=true;$('lawStatus').textContent='等待辨識新題目的字體與法域。';const prepared=await prepare($('photo').files[0]);if(current!==version)return;image=prepared;$('preview').src=image;$('preview').style.display='block';status('照片已準備好，請先辨識題目，確認後解題。');}));
$('recognize').onclick=()=>run(async()=>{status('暗星正在辨識題目…');const d=await api(payload('ocr'));$('question').value=d.question;$('terms').value=d.terms.join('、');law(d);status('辨識完成。請確認題目與關鍵詞，再搜尋教材並解題。');});
$('search').onclick=()=>run(async()=>{if(!$('question').value.trim())throw Error('請先輸入或辨識題目');status('正在搜尋後端電子書正文…');const d=await api(payload('search'));show(d);status(d.found?'已找到 '+d.sources.length+' 段教材依據。':'已搜尋，沒有找到相關教材。');});
$('solve').onclick=()=>run(async()=>{status('暗星正在辨識法域、搜尋教材與官方來源，請稍候…');const d=await api(payload('solve'));if(d.question)$('question').value=d.question;show(d);if(d.status==='JURISDICTION_REQUIRED'){$('jurisdiction').focus();status('請先選擇大陸或臺灣法律，再按解題。');}else if(d.status==='WEB_UNAVAILABLE'||d.status==='NO_MATCH'||d.status==='INSUFFICIENT_SOURCES'){status('已完成查詢，來源不足以確定答案，詳見下方說明。');}else{status('已完成解題；'+(d.source_mode==='WEB_AND_BOOKS'?'已查官方網路來源。':'依教材分析。'));}});

$('refresh').onclick=()=>run(async()=>{await books();status('教材清單已更新。');});
run(books);
})();

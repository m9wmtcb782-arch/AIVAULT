import { citationTarget, statuteMatches, exactArticleText } from './legal-citation.ts';
export type Jurisdiction='CN'|'TW'|'UNKNOWN'|'GENERAL';
export function identifyLaw(question:string,selected='auto'){
  const simplified=[...question].filter(c=>'这为与国华条规权义务诉讼审罚证据认赔偿损伤劳动产买卖约违宪议复厅机关检护设应当过从对无会书学问'.includes(c)).length;
  const traditional=[...question].filter(c=>'這為與國華條規權義務訴訟審罰證據認賠償損傷勞動產買賣約違憲議復廳機關檢護設應當過從對無會書學問'.includes(c)).length;
  const script=simplified>traditional?'簡體':traditional>simplified?'繁體':'共用字／無法判定';
  const cn=question.match(/中[华華]人民共和[国國]|中[国國]大[陆陸]|大[陆陸](?:的)?(?:法|地[区區])|民法典|人民法院|最高人民[检檢]察院|人民代表大[会會]|人大常委|[国國][务務]院|行政[复複復][议議]|治安管理[处處][罚罰]法/g)||[];
  const foreign=/德[國国]|日本|韓國|韩国|美國|美国|英國|英国|法國|法国|歐盟|欧盟|香港|澳門|澳门/.test(question);
  if(foreign&&cn.every(x=>x==='民法典'))cn.length=0;
  const tw=question.match(/中華民國|中华民国|[台臺][湾灣]|司法院|憲法法庭|宪法法庭|釋字|释字|行政程序法|中央法規標準法|中央法规标准法|勞動基準法|劳动基准法|訴願法|诉愿法|立法院/g)||[];
  const legal=cn.length>0||tw.length>0||/法律|法[條条典規规]|[憲宪]法|刑法|民法|行政法|司法|法院|比例原[則则]|[違违]法|[違违][憲宪]|第.{0,12}[條条]|基本[權权]/.test(question);
  let code:Jurisdiction='GENERAL',reason='未辨識為法律題';
  if(selected==='CN'||selected==='TW'){code=selected;reason='依使用者指定法域';}
  else if(cn.length&&tw.length){code='UNKNOWN';reason='題目同時涉及兩岸法域，請選擇本次要解答的法域';}
  else if(cn.length){code='CN';reason='題目出現大陸法律／機關線索：'+[...new Set(cn)].join('、');}
  else if(tw.length){code='TW';reason='題目出現臺灣法律／機關線索：'+[...new Set(tw)].join('、');}
  else if(legal&&foreign){code='UNKNOWN';reason='題目涉及其他法域，不能直接套用大陸或臺灣法律';}
  else if(legal){code=simplified>traditional&&simplified>=2?'CN':'UNKNOWN';reason=code==='CN'?'簡體法律題暫按大陸法律判讀，可手動改選':'繁體或共用字不能確定法域，請選擇大陸或臺灣法律';}
  return {code,foreign_reference:foreign,label:{CN:'大陸法律',TW:'臺灣法律',UNKNOWN:'待確認法律法域',GENERAL:'一般題目'}[code],script,reason,legal,confirmed:selected==='CN'||selected==='TW'||cn.length>0||tw.length>0};
}
export function officialUrl(raw:string,code:Jurisdiction){
  try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port)return false;const h=u.hostname.toLowerCase();
    if(code==='CN')return h.endsWith('.gov.cn')||h==='npc.gov.cn'||h.endsWith('.npc.gov.cn')||h==='court.gov.cn'||h.endsWith('.court.gov.cn');
    if(code==='TW')return h.endsWith('.gov.tw')||h==='judicial.gov.tw'||h.endsWith('.judicial.gov.tw');
    return /\.(gov|edu)(\.[a-z]{2})?$/.test(h)||h.endsWith('.edu.tw')||h.endsWith('.edu.cn');
  }catch{return false;}
}
export function cleanHtml(raw:string){return raw.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code<=0x10ffff?String.fromCodePoint(code):'';}).replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\s+/g,' ').trim();}
export function legalHtml(raw:string){const marked=raw.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<(?:br|hr)\b[^>]*>|<\/(?:p|div|tr|li|h[1-6]|section|article)>/gi,'\n');return marked.split(/\r?\n/).map(cleanHtml).filter(Boolean).join('\n');}
function decode(s:string){return s.replace(/&amp;/g,'&');}
export function parseResults(text:string){
  const rows:{title:string,url:string,snippet:string}[]=[];
  for(const m of text.matchAll(/<item>([\s\S]*?)<\/item>/g)){const x=m[1],url=decode(x.match(/<link>([\s\S]*?)<\/link>/)?.[1]||'');rows.push({title:cleanHtml(x.match(/<title>([\s\S]*?)<\/title>/)?.[1]||''),url,snippet:cleanHtml(x.match(/<description>([\s\S]*?)<\/description>/)?.[1]||'')});}
  for(const m of text.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)){let url=decode(m[1]);try{if(url.startsWith('//'))url='https:'+url;const u=new URL(url);url=u.searchParams.get('uddg')||url;}catch{continue;}rows.push({title:cleanHtml(m[2]),url,snippet:''});}
  return rows;
}
async function getText(url:string,limit=2000000,timeout=12000){
  const r=await fetch(url,{redirect:'manual',headers:{Accept:'text/html,application/xhtml+xml,application/rss+xml,text/plain'},signal:AbortSignal.timeout(timeout)});
  if(r.status>=300&&r.status<400)return {redirect:new URL(r.headers.get('location')||'',url).href,text:''};
  if(!r.ok)throw Error('來源 HTTP '+r.status);
  if(!/text|xml|json/i.test(r.headers.get('content-type')||''))throw Error('來源格式尚不支援');
  const reader=r.body?.getReader();if(!reader)throw Error('來源沒有正文');const chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('來源過大');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const x of chunks){bytes.set(x,offset);offset+=x.length;}return {text:new TextDecoder().decode(bytes),redirect:''};
}
export async function researchWeb(question:string,terms:string[],code:Jurisdiction,lawHint=''){
  const target=citationTarget(question,lawHint);
  if(target.missing_law||target.conflict)return {query:'',sources:[],checked_at:new Date().toISOString(),error:'請先確認完整法律名稱'};
  if(target.articles.length)terms=[target.law_name];
  const domain=code==='CN'?'site:gov.cn':code==='TW'?'site:gov.tw':'(site:edu.tw OR site:gov.tw OR site:edu.cn OR site:gov.cn)';
  let queryText=terms.slice(0,5).join(' ')+' '+(question.match(/第[一二三四五六七八九十百千0-9]{1,12}[條条]|(?:19|20)[0-9]{2}年/g)||[]).join(' ');
  if(code==='CN'){const pairs=['華华','國国','條条','規规','權权','義义','務务','訴诉','訟讼','審审','罰罚','證证','據据','認认','賠赔','償偿','損损','傷伤','勞劳','動动','產产','買买','賣卖','約约','違违','憲宪','議议','復复','廳厅','機机','關关','檢检','護护','設设','應应','當当','過过','對对','無无','會会','書书','學学','問问'];const map=Object.fromEntries(pairs.map(x=>[x[0],x[1]]));queryText=[...queryText].map(c=>map[c]||c).join('');}
  const query=(queryText+' '+domain).slice(0,700);
  let results:ReturnType<typeof parseResults>=[];
  if(code==='TW'){
    // Read the official site's own result links; statute identifiers are discovered, not invented.
    const termsToSearch=terms.filter(t=>/[\u3400-\u9fff]/.test(t)).slice(0,2);
    const pages=await Promise.allSettled(termsToSearch.map(t=>getText('https://law.moj.gov.tw/Law/LawSearchResult.aspx?ty=ONEBAR&kw='+encodeURIComponent(t))));
    for(const page of pages)if(page.status==='fulfilled')for(const m of page.value.text.matchAll(/<a[^>]+id="hlkLawLink"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)){
      try{const link=new URL(decode(m[1]),'https://law.moj.gov.tw/Law/');const pcode=link.searchParams.get('pcode')||link.searchParams.get('PCODE');if(pcode&&/^[A-Z][0-9]{7}$/i.test(pcode))results.push({title:cleanHtml(m[2]),url:'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode='+pcode,snippet:''});}catch{}
    }
    const weight=(x:{title:string})=>terms.reduce((n,t)=>n+(x.title.replace(/\s+/g,'')===t?100:x.title.includes(t)?t.length:0),0);
    results.sort((a,b)=>weight(b)-weight(a));
    const exact=results.filter(x=>terms.some(t=>x.title.replace(/\s+/g,'')===t));if(exact.length)results=exact;
  }
  for(const url of ['https://www.bing.com/search?format=rss&q='+encodeURIComponent(query),'https://html.duckduckgo.com/html/?q='+encodeURIComponent(query)]){
    if(results.length)break;
    try{const r=await getText(url,700000);results=parseResults(r.text).map(x=>({...x,url:x.url.replace(/^http:\/\//,'https://')})).filter(x=>officialUrl(x.url,code));if(results.length)break;}catch{ /* try the other search provider */ }
  }
  const sources:any[]=[];
  const unique=results.filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i).slice(0,6);
  const fetched=await Promise.allSettled(unique.map(async item=>{
    let url=item.url,text='';for(let i=0;i<4;i++){if(!officialUrl(url,code))throw Error('非本法域官方來源');const r=await getText(url,2000000,30000);if(r.redirect){url=r.redirect;continue;}text=legalHtml(r.text);break;}
    if(text.length<200)throw Error('來源缺乏可讀正文');
    if(target.articles.length){
      if(!statuteMatches(item.title,text,target))throw Error('來源法律名稱不符');
      const exact=exactArticleText(text,target.articles);
      if(!target.articles.every(id=>exact.matched.includes(id)))throw Error('來源未包含指定條文正文');
      return {kind:'web',book_title:item.title,title:item.title,url,excerpt:exact.excerpt,jurisdiction:code,law_name:target.law_name,matched_articles:exact.matched,retrieved_at:new Date().toISOString(),fetched:true};
    }
    // Keep relevant passages rather than only the site's header/navigation.
    const targets=[...(question.match(/第[一二三四五六七八九十百千0-9]{1,12}[條条]/g)||[]),...terms.slice().reverse()];
    const anchors=targets.map(t=>text.indexOf(t)).filter(n=>n>=0);
    const starts=[...new Set(anchors.map(n=>Math.max(0,n-500)))].filter((n,i,a)=>a.slice(0,i).every(x=>Math.abs(x-n)>2500)).slice(0,4);
    const excerpt=text.slice(0,1200)+'\n…\n'+(starts.length?starts.map(n=>text.slice(n,n+4000)).join('\n…\n'):text.slice(1200,14000));
    return {kind:'web',book_title:item.title||new URL(url).hostname,title:item.title,url,excerpt,jurisdiction:code,retrieved_at:new Date().toISOString(),fetched:true};
  }));
  for(const r of fetched)if(r.status==='fulfilled')sources.push(r.value);
  return {query,sources,checked_at:new Date().toISOString(),error:sources.length?'':'未取得可讀的官方法源正文；不以搜尋摘要或模型記憶冒充已查證答案'};
}

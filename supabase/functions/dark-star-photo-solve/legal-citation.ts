const pairs=['華华','國国','條条','規规','權权','義义','務务','訴诉','訟讼','審审','罰罚','證证','據据','認认','賠赔','償偿','損损','傷伤','勞劳','動动','產产','買买','賣卖','約约','違违','憲宪','議议','復复','廳厅','機机','關关','檢检','護护','設设','應应','當当','過过','對对','無无','會会','書书','學学','問问','則则','辦办','護护','險险','環环','衛卫','準准','願愿','標标'];
const map=Object.fromEntries(pairs.map(x=>[x[0],x[1]]));
export const canonical=(s:string)=>[...s].map(c=>map[c]||c).join('').replace(/\s+/g,'');
export function chineseNumber(raw:string):number{
  const s=raw.replace(/\s+/g,'');if(/^\d+$/.test(s))return Number(s);
  const digits:Record<string,number>={'零':0,'〇':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'兩':2,'两':2};
  if(!/[十百千萬万]/.test(s))return Number([...s].map(c=>digits[c]??'').join(''));
  let total=0,section=0,n=0;for(const c of s){if(c in digits){n=digits[c];continue;}const unit=({'十':10,'百':100,'千':1000,'萬':10000,'万':10000} as Record<string,number>)[c];if(!unit)return NaN;if(unit===10000){total+=(section+n||1)*unit;section=0;}else section+=(n||1)*unit;n=0;}return total+section+n;
}
export function chineseOrdinal(n:number):string{
  if(n===0)return '零';const d='零一二三四五六七八九';if(n<10)return d[n];
  if(n<20)return '十'+(n%10?d[n%10]:'');
  if(n<100)return d[Math.floor(n/10)]+'十'+(n%10?d[n%10]:'');
  if(n<1000)return d[Math.floor(n/100)]+'百'+(n%100?(n%100<10?'零':'')+chineseOrdinal(n%100):'');
  if(n<10000)return d[Math.floor(n/1000)]+'千'+(n%1000?(n%1000<100?'零':'')+chineseOrdinal(n%1000):'');
  return String(n);
}
export function articleForms(id:string){const [n,suffix]=id.split('-');const chinese=chineseOrdinal(Number(n));return [id,chinese+(suffix?'之'+chineseOrdinal(Number(suffix)):'')];}
const number='[零〇一二三四五六七八九十百千萬万兩两0-9\\s]+';
export function articleReferences(text:string){
  const ids:string[]=[];for(const m of text.matchAll(new RegExp('第\\s*('+number+')\\s*[條条](?:\\s*之\\s*('+number+'))?','g'))){const n=chineseNumber(m[1]);if(!Number.isFinite(n)||n<1)continue;const suffix=m[2]?'-'+chineseNumber(m[2]):'';ids.push(String(n)+suffix);}return [...new Set(ids)];
}
function lawName(question:string){
  const quoted=[...question.matchAll(/[《〈]([^》〉]{2,60})[》〉]/g)].map(x=>x[1]).find(x=>/(?:法|法典|條例|条例|辦法|办法|規則|规则)$/.test(x));if(quoted)return quoted;
  const named=['食品安全衛生管理法','食品安全管理法','中華人民共和國憲法','中华人民共和国宪法','民法典','民法通則','民法通则','刑事訴訟法','刑事诉讼法','民事訴訟法','民事诉讼法','行政訴訟法','行政诉讼法','行政程序法','行政復議法','行政复议法','勞動合同法','劳动合同法','勞動基準法','劳动基准法','中央法規標準法','中央法规标准法','個人資料保護法','个人信息保护法','治安管理處罰法','治安管理处罚法','食品安全法','消費者權益保護法','消费者权益保护法','著作權法','著作权法','行政處罰法','行政处罚法','行政許可法','行政许可法','憲法','宪法','刑法','民法','公司法','勞動法','劳动法','訴願法','诉愿法'];
  const found=named.find(n=>question.includes(n));if(found)return found;
  return question.match(/中[華华]人民共和[國国]([^第《》\s，,？?]{2,35}?(?:法典|法|条例|條例|辦法|办法|規則|规则))(?=第|[\s，,？?]|$)/)?.[1]||'';
}
export function citationTarget(question:string,hint=''){
  const articles=articleReferences(question),explicit=lawName(question),provided=lawName(hint);
  const strip=(s:string)=>canonical(s).replace(/^中华人民共和国|^中华民国/,'');
  const conflict=Boolean(explicit&&provided&&strip(explicit)!==strip(provided));
  const law_name=explicit||provided;
  return {articles,law_name,law_key:strip(law_name),missing_law:articles.length>0&&!law_name,conflict};
}
export type CitationTarget=ReturnType<typeof citationTarget>;
export function statuteMatches(title:string,text:string,target:CitationTarget){
  if(!target.law_name)return true;
  const strip=(s:string)=>canonical(s).replace(/中华人民共和国|中华民国/g,'');
  const titleValue=strip(title),key=target.law_key;
  if(titleValue===key)return true;
  // Match the document title or a standalone statute heading, never an incidental citation in its body.
  let at=titleValue.indexOf(key);while(at>=0){const after=titleValue.slice(at+key.length);if(!after||/^[《》〈〉（()）\-—_·:：｜|\d第]/.test(after))return true;at=titleValue.indexOf(key,at+1);}
  return text.slice(0,4000).split('\n').some(line=>{
    const v=strip(line).replace(/^[《〈]|[》〉]$/g,'');
    return v===key||v.startsWith('法規名稱：'+key+'修正日期')||v.startsWith('法规名称：'+key+'发布日期');
  });
}

export function exactArticleText(text:string,articles:string[]){
  if(!articles.length)return {excerpt:text,matched:[] as string[]};
  const regex=new RegExp('(?:^|\\n)\\s*第\\s*('+number+')\\s*[條条](?:\\s*之\\s*('+number+'))?','g');
  const headings=[...text.matchAll(regex)].map(m=>({start:m.index!,end:m.index!+m[0].length,id:String(chineseNumber(m[1]))+(m[2]?'-'+chineseNumber(m[2]):'')}));
  const chunks:string[]=[],matched:string[]=[];
  for(let i=0;i<headings.length;i++){const h=headings[i];if(!articles.includes(h.id))continue;const end=i+1<headings.length?headings[i+1].start:text.length;const body=text.slice(h.end,end).trim();if(body.length<4)continue;chunks.push(text.slice(h.start,Math.min(end,h.start+16000)).trim());matched.push(h.id);}
  return {excerpt:chunks.join('\n\n'),matched:[...new Set(matched)]};
}

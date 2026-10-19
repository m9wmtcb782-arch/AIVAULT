'use strict';
const {source}=require('./argument.cjs');
const {classifyPage}=require('./section.cjs');
// CPU passage retrieval only. A match is not an adopted proposition or legal answer.
function retrieve(question,snapshot,{allowedBookIds,termGroups=[]}={}){
 if(!snapshot||!allowedBookIds?.includes(snapshot.meta?.bookId))return{status:'BLOCKED',reasons:['BOOK_NOT_AUTHORIZED']};
 try{
  if(source(snapshot.meta,snapshot.pages).sourceHash!==snapshot.sourceHash)throw Error('SOURCE_CHANGED');
  if(typeof question!=='string'||!question.trim()||question.length>500||!Array.isArray(termGroups)||termGroups.length>32)throw Error('INVALID_RETRIEVAL_INPUT');
  const groups=termGroups.map(g=>{
   if(!Array.isArray(g)||!g.length||g.length>20||g.some(s=>typeof s!=='string'||s.length<2||s.length>100))throw Error('INVALID_TERM_GROUP');return[...new Set(g)];
  });
  const query=question.replace(/\s+/gu,'');
  const vocabulary=new Map();groups.forEach((g,i)=>g.forEach(s=>{if(vocabulary.has(s)&&vocabulary.get(s)!==i)throw Error('AMBIGUOUS_TERMS');vocabulary.set(s,i);}));
  const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern=new RegExp([...vocabulary.keys()].sort((a,b)=>b.length-a.length).map(escape).join('|'),'gu');
  const ids=new Set();if(vocabulary.size)for(const m of query.matchAll(pattern))ids.add(vocabulary.get(m[0]));
  const requested=[...ids].map(i=>groups[i]);
  // Unknown topics are not guessed from character overlap or a book title.
  if(!requested.length)return{status:'UNSUPPORTED',text:'問題沒有命中目前可辨識的書中詞語，尚不能可靠定位原文。',modelCalls:0};
  const candidates=[],candidateIds=new Set();let windows=0;
  for(const page of snapshot.pages){
   if(['FRONT_MATTER','TABLE_OF_CONTENTS'].includes(classifyPage(page.text).role))continue;
   // Adjacent complete paragraphs form a reading window; never synthesize a sentence.
   const rows=[];let start=0;
   for(const m of page.text.matchAll(/\n\s*\n/gu)){if(m.index>start)rows.push({start,end:m.index});start=m.index+m[0].length;}
   if(start<page.text.length)rows.push({start,end:page.text.length});
   for(let i=0;i<rows.length;i++){
    if(++windows>2048)return{status:'NEEDS_SMALLER_WINDOW',modelCalls:0};
    const a=rows[Math.max(0,i-1)].start,b=rows[Math.min(rows.length-1,i+1)].end;
    if(b-a>12000)continue;
    const text=page.text.slice(a,b),compactText=text.replace(/\s+/gu,''),hits=requested.map(g=>g.filter(s=>compactText.includes(s)));
    const coverage=hits.filter(g=>g.length).length;
    // A multi-concept question needs all requested concepts in one window.
    if(coverage!==requested.length)continue;
    // Ranking cue only: shared terms in an assertion-like sentence can be more
    // useful than chapter-heading co-occurrence. This never approves a claim.
    const sharedSentence=requested.length>1&&text.split(/[。！？!?]/u).some(sentence=>{
     const c=sentence.replace(/\s+/gu,'');return /屬|属|包括|包含|不等|區分|区分|研究|調整|调整/u.test(c)&&requested.every(g=>g.some(t=>c.includes(t)));
    });
    const score=coverage*100+(sharedSentence?30:0)+hits.reduce((n,h)=>n+h.length,0)-text.length/20000;
    const key=page.pdfPage+':'+a+':'+b;
    if(!candidateIds.has(key)){if(candidates.length>=256)return{status:'NEEDS_SMALLER_WINDOW',modelCalls:0};candidateIds.add(key);candidates.push({key,score,evidence:{pdfPage:page.pdfPage,start:a,end:b,text},matchedTerms:hits.flat()});}
   }
  }
  candidates.sort((a,b)=>b.score-a.score||a.evidence.pdfPage-b.evidence.pdfPage||a.evidence.start-b.evidence.start);
  const selected=[];let chars=0;
  for(const candidate of candidates){
   if(selected.some(c=>c.evidence.pdfPage===candidate.evidence.pdfPage&&c.evidence.start<candidate.evidence.end&&candidate.evidence.start<c.evidence.end))continue;
   if(selected.length>=3||chars+candidate.evidence.text.length>16000)continue;
   selected.push(candidate);chars+=candidate.evidence.text.length;
  }
  if(!selected.length)return{status:'NEEDS_EVIDENCE',text:'目前已取得的頁窗沒有同時涵蓋問題詞語的完整段落，不能據此猜答。',requestedTerms:requested,modelCalls:0};
  return{status:'BOOK_PASSAGES',text:'找到以下相關原文；尚未判定它能完整回答本題。\n\n'+selected.map(c=>'《'+snapshot.meta.title+'》PDF第'+c.evidence.pdfPage+'頁：\n'+c.evidence.text).join('\n\n'),
   passages:selected.map(({evidence,matchedTerms})=>({evidence,matchedTerms})),requestedTerms:requested,
   citation:{title:snapshot.meta.title,edition:snapshot.meta.edition,pdfPages:[...new Set(selected.map(c=>c.evidence.pdfPage))]},
   sourceHash:snapshot.sourceHash,generatedLegalConclusion:false,automaticAuthorStance:false,modelCalls:0,
   limitation:'依可信詞語別名定位完整原文段落；尚未核定作者立場、條件例外或本題適用性。僅搜尋已授權且已取得的頁窗，不代表全書檢索。'};
 }catch{return{status:'BLOCKED',reasons:['INVALID_RETRIEVAL_SOURCE_OR_TERMS']};}
}
module.exports={retrieve};

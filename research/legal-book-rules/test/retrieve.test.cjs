'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {source,digest}=require('../src/argument.cjs');const {retrieve}=require('../src/retrieve.cjs');const {solve}=require('../src/solve.cjs');
const meta={bookId:'retrieval-fixture',title:'合成檢索教材',author:'測試',edition:'v1',jurisdiction:'未核對',asOf:'未核對'};
const snapshot=source(meta,[{pdfPage:1,text:'第一章\n\n国家行政属于公行政，但公行政不等同国家行政。\n\n有人問：私行政是否也是公行政？\n\n本文另有條件，不可略去。'},{pdfPage:2,text:'第二章\n\n行政法学研究范围的相關段落。'}]);const terms=[['國家行政','国家行政'],['公行政'],['私行政'],['研究範圍','研究范围']];const opts={allowedBookIds:[meta.bookId],termGroups:terms};
test('different wording and script locate raw book text without full-question aliases',()=>{const r=retrieve('想知道國家行政跟公行政在書裡怎麼說',snapshot,opts);assert.equal(r.status,'BOOK_PASSAGES');assert.equal(r.passages[0].evidence.pdfPage,1);assert(r.text.includes('国家行政属于公行政，但公行政不等同国家行政。'));assert.equal(r.generatedLegalConclusion,false);});
test('every retrieved passage is an exact original slice including punctuation',()=>{const r=retrieve('公行政',snapshot,opts);for(const p of r.passages){const e=p.evidence;assert.equal(snapshot.pages.find(p=>p.pdfPage===e.pdfPage).text.slice(e.start,e.end),e.text);}});
test('surrounding questions and limitations remain source text rather than an affirmative answer',()=>{const r=retrieve('私行政與公行政的說明',snapshot,opts);assert.equal(r.status,'BOOK_PASSAGES');assert(r.text.includes('是否也是公行政？'));assert(r.text.includes('不可略去'));assert.equal(r.automaticAuthorStance,false);});
test('no known topic does not produce a best-guess answer',()=>assert.equal(retrieve('刑事拘留期限',snapshot,opts).status,'UNSUPPORTED'));
test('all recognized topics must occur in one context window',()=>assert.equal(retrieve('國家行政與研究範圍',snapshot,opts).status,'NEEDS_EVIDENCE'));
test('authorization precedes access to private source',()=>{const r=retrieve('公行政',{meta:{bookId:'private'},pages:[{text:'private'}]},opts);assert.equal(r.status,'BLOCKED');assert.deepEqual(r.reasons,['BOOK_NOT_AUTHORIZED']);assert.equal(r.passages,undefined);});
test('modified source is blocked',()=>{const s=structuredClone(snapshot);s.pages[0].text+='新增';assert.equal(retrieve('公行政',s,opts).status,'BLOCKED');});
test('ambiguous aliases across topic groups are rejected',()=>assert.equal(retrieve('公行政',snapshot,{...opts,termGroups:[['公行政'],['公行政','國家行政']]}).status,'BLOCKED'));
test('quotes cannot trigger network or a model fallback',()=>{const before=global.fetch;global.fetch=()=>{throw Error('network forbidden');};try{assert.equal(retrieve('公行政',snapshot,opts).modelCalls,0);}finally{global.fetch=before;}});
test('front matter and table of contents cannot masquerade as body results',()=>{
 const s=source(meta,[{pdfPage:1,text:'前言\n公行政的研究範圍。'},{pdfPage:2,text:'目录\n公行政..................10'}]);assert.equal(retrieve('公行政',s,opts).status,'NEEDS_EVIDENCE');
});
test('unified route can retrieve new wording when explicitly enabled',()=>{const r=solve({question:'書裡有關公行政怎麼說？'},{snapshot},{allowedBookIds:[meta.bookId],allowPassageRetrieval:true,retrievalTermGroups:terms});assert.equal(r.route,'book_passages');assert.equal(r.status,'BOOK_PASSAGES');});
test('retrieval is optional and never discards supplied case facts',()=>{
 assert.equal(solve({question:'公行政'},{snapshot},{allowedBookIds:[meta.bookId]}).status,'UNSUPPORTED');
 const r=solve({question:'公行政',factsText:'本案另有特殊限制。'},{snapshot},{allowedBookIds:[meta.bookId],allowPassageRetrieval:true,retrievalTermGroups:terms});assert.equal(r.status,'UNSUPPORTED');assert.equal(r.route,undefined);
});
test('longest vocabulary match does not accidentally add a shorter topic',()=>{const r=retrieve('國家公行政',snapshot,{...opts,termGroups:[['國家公行政','国家行政'],['公行政']]});assert.equal(r.requestedTerms.length,1);});
test('dense source requires a smaller window instead of silently truncating matches',()=>{const s=source(meta,[{pdfPage:1,text:'第一章\n\n'+Array(300).fill('公行政的段落。').join('\n\n')}]);const r=retrieve('公行政',s,opts);assert.equal(r.status,'NEEDS_SMALLER_WINDOW');assert.equal(r.passages,undefined);});
test('a trusted legacy card with no exact question match can fall through to passage retrieval',()=>{
 const card={id:'legacy',sourceHash:snapshot.sourceHash,kind:'reviewed_reading',scope:'book_view_only',questions:['另一個已核對的問題'],review:{method:'extracted_text_comparison',reviewer:'fixture',checkedAt:'fixture'}};
 const r=solve({question:'書裡公行政的原文在哪裡？'},{snapshot,card},{allowedBookIds:[meta.bookId],allowPassageRetrieval:true,retrievalTermGroups:terms,getReviewedDigest:()=>digest(card)});assert.equal(r.status,'BOOK_PASSAGES');
});
test('a failed legacy review is not bypassed by the passage-retrieval route',()=>{
 const r=solve({question:'公行政的原文'},{snapshot,card:{id:'untrusted'}},{allowedBookIds:[meta.bookId],allowPassageRetrieval:true,retrievalTermGroups:terms});assert.equal(r.status,'BLOCKED');assert.equal(r.passages,undefined);
});

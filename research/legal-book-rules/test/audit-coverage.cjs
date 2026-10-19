'use strict';
// Expanded wording/composition checks on an existing narrow source domain.
// Retrieval hits are explicitly not counted as solved legal questions.
const fs=require('node:fs'),assert=require('node:assert/strict');const {solve}=require('../src/solve.cjs');const {digest}=require('../src/argument.cjs');
const k=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const caps={allowedBookIds:[k.snapshot.meta.bookId],getReviewedDigest:id=>id===k.graph.id?k.graphDigest:id===k.reasonCard.id?k.reasonCardDigest:id===k.caseCard.id?k.caseCardDigest:null,allowPassageRetrieval:true,retrievalTermGroups:[['國家行政','国家行政'],['公行政'],['私行政'],['社會公權力組織','社会公权力组织'],['行政法學','行政法学']]};
assert.equal(digest(k.graph),k.graphDigest);assert.equal(digest(k.reasonCard),k.reasonCardDigest);
const retrievalQuestions=['公行政在書裡是怎麼描述的？','想看國家行政與公行政相關的原文','私行政和公行政的原文放一起給我','社會公權力組織的說明在哪裡？','行政法學研究範圍與私行政的段落','請找國家行政的討論，保留前後文'];
const retrieval=retrievalQuestions.map(question=>{
 const r=solve({question},k,caps);assert.equal(r.status,'BOOK_PASSAGES',question);assert.equal(r.generatedLegalConclusion,false);
 for(const {evidence:e}of r.passages)assert.equal(k.snapshot.pages.find(p=>p.pdfPage===e.pdfPage).text.slice(e.start,e.end),e.text);
 return{question,status:r.status,pages:r.citation.pdfPages,countsAsSolvedQuestion:false};
});
const why='為什麼現代行政法要將社會公權力組織的公行政納入調整範圍？';
const cases=[
 ['公行政跟國家行政的差異？國家行政屬於公行政嗎？','SUPPORTED_MULTIPART_BOOK_ANSWER',2],
 ['所有國家行政都属于公行政吗？公行政不包括國家行政，對嗎？','SUPPORTED_MULTIPART_BOOK_ANSWER',2],
 [why+'公行政跟國家行政的差異？','SUPPORTED_MULTIPART_BOOK_ANSWER',2],
 ['公行政跟國家行政的差異？這個案例是否合法？','PARTIAL_BOOK_ANSWER',1]
];
const multipart=cases.map(([question,status,count])=>{
 const r=solve({question},k,caps);assert.equal(r.status,status,question);assert.equal(r.parts.filter(p=>p.result.status.startsWith('SUPPORTED_')).length,count);
 for(const part of r.parts){assert.equal(question.slice(part.start,part.end),part.text);if(part.result.status.startsWith('SUPPORTED_'))assert(part.result.citation);}
 if(status==='PARTIAL_BOOK_ANSWER')assert.deepEqual(r.unanswered,[2]);
 return{question,status,supportedSubquestions:count,independentNewLegalDomain:false};
});
const unrelated=solve({question:'刑事拘留期限是多少？'},k,caps);assert.equal(unrelated.status,'UNSUPPORTED');
console.log(JSON.stringify({retrieval,multipart,unrelatedStatus:unrelated.status,independentExpertBlindTest:false,scoreOutOf100:null,modelCalls:0},null,2));

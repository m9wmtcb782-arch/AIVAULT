'use strict';
// Repeatable developer evaluation of the private real-book package.
// Previously failed prompts are regression probes, not a fresh independent blind test.
const {readFileSync}=require('node:fs');const{digest}=require('../src/argument.cjs');const{answerConceptQuestion}=require('../src/concept-question.cjs');const{answerReasonQuestion}=require('../src/reason-question.cjs');
if(!process.argv[2])throw Error('Provide private knowledge package path');const p=JSON.parse(readFileSync(process.argv[2],'utf8'));
const old=[['公行政與國家行政有何差別？',null],['國家行政是不是公行政的一部分？',true],['公行政是否還包含國家行政以外的活動？',true],['請比較公行政和國家行政。',null],['依本書，公行政與國家行政是同一概念嗎?',null],['依本書，公行政與國家行政是否相同？',null]];
const extra=[['公行政跟國家行政的差異？',null],['國家行政屬於公行政嗎？',true],['國家行政是否包含公行政？',false],['公行政不包括國家行政，對嗎？',false],['所有國家行政都属于公行政吗？',true],['根据本书公行政和国家行政的区别是什么？',null]];
const conceptOpts={allowedBookIds:[p.snapshot.meta.bookId],getReviewedDigest:()=>digest(p.graph)};
const check=rows=>rows.map(([question,expected])=>{const r=answerConceptQuestion(question,p.graph,p.snapshot,conceptOpts);return{question,status:r.status,correct:r.status==='SUPPORTED_CONCEPT_RELATION'&&r.propositionHolds===expected};});
const conceptRegression=check(old),additionalConcepts=check(extra);
const reasonChecks=p.reasonValidation.map(v=>{const r=answerReasonQuestion(v.question,p.reasonCard,p.snapshot,{allowedBookIds:[p.snapshot.meta.bookId],getReviewedDigest:()=>digest(p.reasonCard)});return{question:v.question,status:r.status,correct:r.status==='SUPPORTED_BOOK_REASONS'&&r.reasons.length===3&&r.reasons.every((e,i)=>e.text===p.reasonCard.reasons[i].text)};});
const summary={conceptRegression:{passed:conceptRegression.filter(r=>r.correct).length,total:old.length},additionalConcepts:{passed:additionalConcepts.filter(r=>r.correct).length,total:extra.length},reasonChecks:{passed:reasonChecks.filter(r=>r.correct).length,total:reasonChecks.length},independentExpertBlindTest:false,modelCalls:0};
console.log(JSON.stringify({summary,conceptRegression,additionalConcepts,reasonChecks},null,2));if([...conceptRegression,...additionalConcepts,...reasonChecks].some(r=>!r.correct))process.exitCode=1;

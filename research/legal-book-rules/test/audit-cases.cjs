'use strict';
const{readFileSync}=require('node:fs');const{digest}=require('../src/argument.cjs');const{solve}=require('../src/solve.cjs');
if(!process.argv[2])throw Error('Provide private book case knowledge package');const p=JSON.parse(readFileSync(process.argv[2],'utf8'));
const registry=new Map([p.graph,p.reasonCard,p.caseCard,p.card].filter(Boolean).map(c=>[c.id,digest(c)]));const capabilities={allowedBookIds:[p.snapshot.meta.bookId],getReviewedDigest:id=>registry.get(id)};
const rows=p.caseValidation.map(v=>{const r=solve(v.input,p,capabilities);return{name:v.name,status:r.status,expected:v.expected.status,correct:r.status===v.expected.status&&(!v.expected.polarity||r.conclusion?.polarity===v.expected.polarity),substantiveAnswer:r.status==='SUPPORTED_BOOK_CASE'};});
const result={total:rows.length,expectedBehavior:rows.filter(r=>r.correct).length,substantiveAnswers:rows.filter(r=>r.substantiveAnswer).length,unresolvedOrConflicting:rows.filter(r=>!r.substantiveAnswer).length,independentExpertEvaluation:false,modelCalls:0,rows};console.log(JSON.stringify(result,null,2));if(rows.some(r=>!r.correct))process.exitCode=1;

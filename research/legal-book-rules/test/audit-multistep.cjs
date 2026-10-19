'use strict';
// Reproducible book-text comparison, not an independent expert blind evaluation.
// Private source text stays in the supplied package and is never embedded in repo.
const fs=require('node:fs');const assert=require('node:assert/strict');const {digest}=require('../src/argument.cjs');const {solve}=require('../src/solve.cjs');
const k=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
assert.equal(digest(k.graph),k.graphDigest);assert.equal(digest(k.caseCard),k.caseCardDigest);
const relation=k.graph.relations.find(r=>r.sub==='state_administration'&&r.super==='public_administration');
assert.equal(relation.boundaryReviewed,true);assert.equal(relation.conditions.length,0);assert.equal(relation.exceptions.length,0);
const c=structuredClone(k.caseCard);c.id+='-multistep-audit';
c.factSchemas=c.factSchemas.filter(f=>f.key!=='PUBLIC_ADMIN');
c.factSchemas.push({key:'STATE_ADMIN',label:'本案活動是否屬於國家行政',subjectAliases:['本案活動','本案活动'],trueForms:['屬於國家行政','属于国家行政'],falseForms:['不屬於國家行政','不属于国家行政']});
c.derivations=[{id:'state-to-public',direction:'sufficient',exceptionsComplete:true,exceptions:[],when:{fact:'STATE_ADMIN'},evidence:relation.evidence,context:relation.context,conclusion:{key:'PUBLIC_ADMIN',polarity:'positive',text:'本案活動屬於公行政'}}];
// The definition in the relation evidence is author narration. The larger
// context also quotes Marx and reports cases as background; those passages are
// not used as the rule. This is developer text comparison, not expert/image QA.
c.derivations[0].sourceReview={speaker:'本書作者（正文概念界定）',stance:'adopted',contextChecked:true,note:'已依既有第50–52頁抽取文字核對：包含關係為第51頁作者敘述；馬克思引文及判例背景不作為本條規則。原始OCR未經PDF影像核對。'};
c.rules.find(r=>r.id==='public-in-study').explanation='本書先界定國家行政屬於公行政，再以公行政作為行政法學的研究對象；依題目給定的國家行政性質，可經這兩項書中界定推得研究範圍結論。';
const rows=[
 ['國家行政兩步推導','本案活動屬於國家行政。','SUPPORTED_BOOK_CASE'],
 ['具名活動兩步推導','本案活動名為乙事項。乙事項屬於國家行政。','SUPPORTED_BOOK_CASE'],
 ['簡體兩步推導','本案活动属于国家行政。','SUPPORTED_BOOK_CASE'],
 ['非國家機關不阻斷已給定活動性質','本案組織不是國家行政機關。本案活動屬於國家行政。','SUPPORTED_BOOK_CASE'],
 ['否定國家行政不能反推研究範圍','本案活動不屬於國家行政。','NEEDS_FACTS'],
 ['組織身分不足以分類活動','本案組織是國家行政機關。','NEEDS_FACTS'],
 ['疑問不是前提','本案活動屬於國家行政？','NEEDS_FACT_REVIEW'],
 ['附帶未明例外','本案活動屬於國家行政，但另有特殊規定。','NEEDS_FACT_REVIEW'],
 ['原始分類矛盾','本案活動屬於國家行政。本案活動不屬於國家行政。','CONFLICTING_FACTS']
].map(([name,factsText,expected])=>{
 const r=solve({question:'本案活動是否屬於行政法學的研究範圍？',factsText},{snapshot:k.snapshot,caseCard:c},{allowedBookIds:[k.snapshot.meta.bookId],getReviewedDigest:()=>digest(c)});
 if(r.status==='SUPPORTED_BOOK_CASE'){assert.equal(r.trace.proof[0].key,'PUBLIC_ADMIN');assert.equal(r.facts.values.PUBLIC_ADMIN,undefined);assert(r.citation.pdfPages.includes(51)&&r.citation.pdfPages.includes(52));assert(r.trace.applied.some(p=>p.key==='STATE_ADMIN'));}
 assert.equal(r.status,expected,name);return{name,status:r.status,expected};
});
console.log(JSON.stringify({total:rows.length,expectedBehavior:rows.length,substantiveAnswers:rows.filter(r=>r.status==='SUPPORTED_BOOK_CASE').length,independentExpertEvaluation:false,pdfImageVerification:false,sourceStanceReview:"developer_extracted_text_comparison",modelCalls:0,rows},null,2));

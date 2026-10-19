'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {source,digest}=require('../src/argument.cjs');const {solve}=require('../src/solve.cjs');const {inspectRuleLanguage}=require('../src/source-language.cjs');
function fixture(text,evidenceText,sourceReview){
 const snapshot=source({bookId:'stance-fixture',title:'合成立場教材',author:'測試',edition:'v1',jurisdiction:'未核對',asOf:'未核對'},[{pdfPage:3,text}]);
 const at=text.indexOf(evidenceText),evidence={pdfPage:3,start:at,end:at+evidenceText.length,text:evidenceText},context=[{pdfPage:3,start:0,end:text.length,text}];
 const rule={id:'stance-rule',direction:'sufficient',exceptionsComplete:true,exceptions:[],when:{fact:'A'},evidence,context,conclusion:{key:'SCOPE',polarity:'positive',text:'本案活動屬於測試範圍'}};
 if(sourceReview!==undefined)rule.sourceReview=sourceReview;
 const card={id:'stance-card',kind:'reviewed_book_case',scope:'book_concept_application',sourceHash:snapshot.sourceHash,subjectAliases:['本案活動'],factSchemas:[{key:'A',label:'甲類',trueForms:['屬於甲類'],falseForms:['不屬於甲類']}],targetAliases:['測試範圍'],exclusiveGroups:[],ruleBoundaryReviewed:true,review:{method:'extracted_text_comparison',reviewer:'synthetic-fixture',checkedAt:'fixture'},rules:[rule]};
 const options={allowedBookIds:['stance-fixture'],getReviewedDigest:()=>digest(card)};
 return{snapshot,card,rule,run:(cap=options)=>solve({question:'本案活動是否屬於測試範圍？',factsText:'本案活動屬於甲類。'},{snapshot,caseCard:card},cap),options};
}
const claim='甲類活動納入測試範圍。';const adopted={speaker:'本書作者',stance:'adopted',contextChecked:true};
test('plain reviewed assertion remains usable without pretending stance was automatically inferred',()=>{const f=fixture('第一章\n'+claim,claim);const r=f.run();assert.equal(r.status,'SUPPORTED_BOOK_CASE');assert.equal(r.trace.sourceLanguageChecks[0].automaticAuthorStance,false);});
test('a quote inside evidence needs an explicit source-stance review',()=>assert.equal(fixture('第一章\n有學者說：「'+claim+'」','「'+claim+'」').run().status,'BLOCKED'));
test('a rejection outside evidence but inside context prevents implicit promotion',()=>{const f=fixture('第一章\n有學者認為：'+claim+'本書不採此說。',claim);assert.equal(f.run().status,'BLOCKED');const a=inspectRuleLanguage(f.rule,f.snapshot);assert(a.cues.some(c=>c.kind==='rejection'));});
test('adoption wording is a cue, not an automatic author endorsement',()=>assert.equal(fixture('第一章\n本書認為：'+claim,claim).run().status,'BLOCKED'));
test('reported, rejected and unresolved stances cannot act as adopted rules',()=>{for(const stance of ['reported','rejected','unresolved'])assert.equal(fixture('第一章\n'+claim,claim,{...adopted,stance}).run().status,'BLOCKED');});
test('explicit reviewed adoption can resolve quotation without changing original evidence',()=>{const text='第一章\n本書採取此界定：「'+claim+'」';const f=fixture(text,'「'+claim+'」',adopted);const r=f.run();assert.equal(r.status,'SUPPORTED_BOOK_CASE');assert(r.text.includes('「'+claim+'」'));assert.equal(r.trace.sourceLanguageChecks[0].review.stance,'adopted');});
test('stance-review changes invalidate the trusted package digest',()=>{const f=fixture('第一章\n有學者認為：'+claim,claim,adopted),old=digest(f.card);f.rule.sourceReview.speaker='另一位作者';assert.equal(f.run({...f.options,getReviewedDigest:()=>old}).status,'BLOCKED');});
test('stance review cannot override an interrogative evidence passage',()=>assert.equal(fixture('第一章\n甲類活動納入測試範圍？','甲類活動納入測試範圍？',adopted).run().status,'BLOCKED'));
test('unresolved cross-reference in context requires explicit review',()=>assert.equal(fixture('第一章\n依前述見解，'+claim,claim).run().status,'BLOCKED'));
test('source cue offsets preserve every original character including astral characters',()=>{const f=fixture('第一章\n📚本書認為：「'+claim+'」',claim);const a=inspectRuleLanguage(f.rule,f.snapshot);assert(a.cues.length);for(const cue of a.cues)assert.equal(f.snapshot.pages[0].text.slice(cue.start,cue.end),cue.text);});
test('authorization precedes inspection of quoted private text',()=>{const f=fixture('第一章\n有學者認為：'+claim,claim);const r=f.run({...f.options,allowedBookIds:[]});assert.equal(r.status,'BLOCKED');assert.deepEqual(r.reasons,['BOOK_NOT_AUTHORIZED']);assert.equal(r.facts,undefined);});
test('incomplete or invalid stance review fails closed',()=>{for(const review of [{speaker:'作者',stance:'adopted'},null,{...adopted,stance:'approve'}])assert.equal(fixture('第一章\n'+claim,claim,review).run().status,'BLOCKED');});
test('draft reading flags rejection in adjacent context without changing or approving the candidate',()=>{
 const {draftCards}=require('../src/draft.cjs');const f=fixture('第一章\n'+claim+'本書不採此說。',claim);const r=draftCards({status:'DRAFT_SOURCE',snapshot:f.snapshot});const candidate=r.drafts.find(d=>d.raw.includes(claim));assert(candidate);assert(candidate.sourceLanguage.cues.some(c=>c.kind==='rejection'));assert(candidate.roles.includes('author_stance_needs_review'));assert.equal(candidate.eligibleAsConclusion,false);assert.equal(candidate.stance,null);
});
test('dense punctuation cannot trigger unbounded source-language work',()=>{
 const f=fixture('第一章\n'+claim+'「」'.repeat(1100),claim);assert.throws(()=>inspectRuleLanguage(f.rule,f.snapshot),/SOURCE_LANGUAGE_LIMIT/);assert.equal(f.run().status,'BLOCKED');
});
test('evidence and overlapping context do not duplicate source cue offsets',()=>{
 const f=fixture('第一章\n本書認為：'+claim,'本書認為：'+claim);const a=inspectRuleLanguage(f.rule,f.snapshot);const ids=a.cues.map(c=>[c.kind,c.pdfPage,c.start,c.end].join(':'));assert.equal(new Set(ids).size,ids.length);
});

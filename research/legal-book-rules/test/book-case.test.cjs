'use strict';
const{test}=require('node:test');const assert=require('node:assert/strict');const{source,digest}=require('../src/argument.cjs');const{extractFacts,answerBookCase}=require('../src/book-case.cjs');
// Fictional teaching rule only; no assertion about applicable law.
const text='第一章\n甲類活動納入測試範圍，但丁例外成立時除外。乙類活動不納入測試範圍。';const s=source({bookId:'fixture',title:'合成案例教材',author:'測試',edition:'v1',jurisdiction:'未核對',asOf:'未核對'},[{pdfPage:1,text}]);const span=t=>({pdfPage:1,start:text.indexOf(t),end:text.indexOf(t)+t.length,text:t});const ruleEvidence=span('甲類活動納入測試範圍，但丁例外成立時除外。');
const schemas=[{key:'A',label:'本案活動是否屬於甲類',trueForms:['屬於甲類','属于甲类'],falseForms:['不屬於甲類','不属于甲类']},{key:'B',label:'本案活動是否屬於乙類',trueForms:['屬於乙類'],falseForms:['不屬於乙類']},{key:'E',label:'丁例外是否成立',trueForms:['具備丁例外'],falseForms:['沒有丁例外']}];
const card={id:'case-f',kind:'reviewed_book_case',scope:'book_concept_application',sourceHash:s.sourceHash,subjectAliases:['本案活動','本案活动'],factSchemas:schemas,targetAliases:['測試範圍'],exclusiveGroups:[['A','B']],ruleBoundaryReviewed:true,rules:[{id:'rule-a',direction:'sufficient',when:{fact:'A'},exceptions:[{fact:'E'}],exceptionsComplete:true,evidence:ruleEvidence,context:[ruleEvidence],conclusion:{key:'IN_SCOPE',polarity:'positive',text:'屬於測試範圍'}}],review:{method:'extracted_text_comparison',reviewer:'synthetic-fixture',checkedAt:'fixture-only'}};
const opts={allowedBookIds:['fixture'],getReviewedDigest:()=>digest(card)},q='依本書，本案活動是否屬於測試範圍？';const run=factsText=>answerBookCase({question:q,factsText},card,s,opts);
test('complete explicit facts produce source/facts/conclusion answer',()=>{const r=run('本案活動屬於甲類。本案活動沒有丁例外。');assert.equal(r.status,'SUPPORTED_BOOK_CASE');assert.equal(r.conclusion.polarity,'positive');assert(r.text.includes(ruleEvidence.text));assert.equal(r.trace.applied.length,2);assert.equal(r.modelCalls,0);});
test('fact provenance exactly matches source question slices',()=>{const t='本案活動屬於甲類；\n本案活動沒有丁例外。';const r=run(t);for(const p of r.trace.applied)assert.equal(t.slice(p.start,p.end),p.text);});
test('unknown exception blocks conclusion',()=>{const r=run('本案活動屬於甲類。');assert.equal(r.status,'NEEDS_FACTS');assert.deepEqual(r.missing,['E']);});
test('true exception blocks general conclusion',()=>assert.equal(run('本案活動屬於甲類。本案活動具備丁例外。').status,'EXCEPTION_APPLIES'));
test('negated premise does not imply opposite conclusion',()=>{const r=run('本案活動不屬於甲類。本案活動沒有丁例外。');assert.equal(r.status,'NO_APPLICABLE_RULE');assert.equal(r.conclusion,undefined);});
test('missing premise is unknown',()=>assert.equal(run('本案活動沒有丁例外。').status,'NEEDS_FACTS'));
test('same fact and its negation conflict',()=>assert.equal(run('本案活動屬於甲類。本案活動不屬於甲類。').status,'CONFLICTING_FACTS'));
test('exclusive classifications conflict',()=>assert.equal(run('本案活動屬於甲類。本案活動屬於乙類。').status,'CONFLICTING_FACTS'));
for(const t of ['本案活動可能屬於甲類。','本案活動屬於甲類？','有人說：「本案活動屬於甲類。」','如果本案活動屬於甲類，就可能適用。','本案活動屬於甲類，但有未說明的限制。','本案活動屬於甲類！'])test('unresolved modality/quotation/clause is not an established fact: '+t,()=>assert.equal(run(t).status,'NEEDS_FACT_REVIEW'));
test('unknown extra fact cannot be dropped before giving conclusion',()=>assert.equal(run('本案活動屬於甲類。本案活動沒有丁例外。但另有特殊規定。').status,'NEEDS_FACT_REVIEW'));
test('different actor not silently used as this case fact',()=>assert.equal(run('其他活動屬於甲類。本案活動沒有丁例外。').status,'NEEDS_FACT_REVIEW'));
test('current law request rejected',()=>assert.equal(answerBookCase({question:'依現行臺灣法，本案活動是否屬於測試範圍？',factsText:'本案活動屬於甲類。'},card,s,opts).status,'UNSUPPORTED'));
test('unreviewed card cannot apply',()=>assert.equal(answerBookCase({question:q,factsText:'本案活動屬於甲類。'},card,s,{allowedBookIds:['fixture']}).status,'BLOCKED'));
test('scope authorization checked before processing case text',()=>assert.equal(answerBookCase({question:q,factsText:'本案活動屬於甲類。'},card,s,{...opts,allowedBookIds:[]}).status,'BLOCKED'));
test('case text limits',()=>assert.throws(()=>extractFacts('甲'.repeat(16001),schemas,['本案活動'])));
test('subject-specific predicate does not migrate to an organization',()=>{const r=extractFacts('本案組織屬於甲類。',[{...schemas[0],subjectAliases:['本案活動']}],['本案活動','本案組織']);assert.equal(r.values.A,undefined);assert.equal(r.unknownClauses.length,1);});
test('removing exception review invalidates card',()=>{const d={...card,rules:[{...card.rules[0],exceptionsComplete:false}]};assert.equal(answerBookCase({question:q,factsText:'本案活動屬於甲類。本案活動沒有丁例外。'},d,s,{...opts,getReviewedDigest:()=>digest(d)}).status,'BLOCKED');});

function runCompeting(factsText,change={}) {
 const d={...card,exclusiveGroups:[],rules:[{...card.rules[0],exceptions:[]},{...card.rules[0],id:'rule-b',when:{fact:'B'},exceptions:[],evidence:span('乙類活動不納入測試範圍。'),context:[span('乙類活動不納入測試範圍。')],conclusion:{key:'IN_SCOPE',polarity:'negative',text:'不屬於測試範圍'}}],...change};
 return answerBookCase({question:q,factsText},d,s,{...opts,getReviewedDigest:()=>digest(d)});
}
test('unresolved opposite sufficient rule prevents premature conclusion',()=>{
 const r=runCompeting('本案活動屬於甲類。');assert.equal(r.status,'NEEDS_FACTS');assert.deepEqual(r.missing,['B']);assert.equal(r.conclusion,undefined);assert.deepEqual(r.pendingRuleIds,['rule-b']);
});
test('explicitly false opposing premise permits supported conclusion',()=>assert.equal(runCompeting('本案活動屬於甲類。本案活動不屬於乙類。').status,'SUPPORTED_BOOK_CASE'));
test('reviewed mutual exclusion rules out competing premise without pretending it was stated',()=>{
 const r=runCompeting('本案活動屬於甲類。',{exclusiveGroups:[['A','B']]});assert.equal(r.status,'SUPPORTED_BOOK_CASE');assert.equal(r.facts.values.B,undefined);assert.equal(r.trace.excludedCompetingRules[0].ruleId,'rule-b');
});
test('two established opposite rules retain disagreement',()=>assert.equal(runCompeting('本案活動屬於甲類。本案活動屬於乙類。').status,'MULTIPLE_VIEWS'));
test('unknown same-direction rule does not block sufficient proof',()=>{
 const base={...card.rules[0],exceptions:[]};const r=runCompeting('本案活動屬於甲類。',{rules:[base,{...base,id:'another-positive',when:{fact:'B'}}]});assert.equal(r.status,'SUPPORTED_BOOK_CASE');
});
test('unknown exception on an otherwise applicable opposite rule requires clarification',()=>{
 const base={...card.rules[0],exceptions:[]};const opposite={...base,id:'opposite',when:{fact:'A'},exceptions:[{fact:'E'}],conclusion:{key:'IN_SCOPE',polarity:'negative',text:'不屬於測試範圍'}};
 const r=runCompeting('本案活動屬於甲類。',{rules:[base,opposite]});assert.equal(r.status,'NEEDS_FACTS');assert.deepEqual(r.missing,['E']);
});
test('established exception disables an opposite rule',()=>{
 const base={...card.rules[0],exceptions:[]};const opposite={...base,id:'opposite',exceptions:[{fact:'E'}],conclusion:{key:'IN_SCOPE',polarity:'negative',text:'不屬於測試範圍'}};
 assert.equal(runCompeting('本案活動屬於甲類。本案活動具備丁例外。',{rules:[base,opposite]}).status,'SUPPORTED_BOOK_CASE');
});
test('mutual exclusion does not invent a positive classification from two negative facts',()=>{
 const r=runCompeting('本案活動不屬於甲類。本案活動不屬於乙類。',{exclusiveGroups:[['A','B']]});assert.equal(r.status,'NO_APPLICABLE_RULE');assert.equal(r.conclusion,undefined);
});
test('a true exception does not prove the rule premise was applicable',()=>{
 const r=run('本案活動具備丁例外。');assert.equal(r.status,'NEEDS_FACTS');assert.deepEqual(r.missing,['A']);assert.equal(r.conclusion,undefined);
});
test('one blocked rule does not hide missing facts for another possible rule',()=>{
 const base={...card.rules[0],exceptions:[{fact:'E'}]};const another={...base,id:'another',when:{fact:'B'},exceptions:[]};
 const r=runCompeting('本案活動屬於甲類。本案活動具備丁例外。',{rules:[base,another]});assert.equal(r.status,'NEEDS_FACTS');assert.deepEqual(r.missing,['B']);
});
test('mixed final conclusion keys cannot answer an unbound target using the first rule',()=>{
 const base={...card.rules[0],exceptions:[]};const unrelated={...base,id:'other-target',conclusion:{key:'OTHER_GOAL',polarity:'positive',text:'這是另一個目標'}};
 assert.equal(runCompeting('本案活動屬於甲類。',{rules:[unrelated,base]}).status,'BLOCKED');
});
test('a misspelled predicate is invalid knowledge rather than a new fact question',()=>{
 assert.equal(runCompeting('本案活動屬於甲類。',{rules:[{...card.rules[0],when:{fact:'TYPO'},exceptions:[]}]}).status,'BLOCKED');
});
test('a malformed mutual-exclusion group cannot manufacture a conflict',()=>{
 assert.equal(runCompeting('本案活動屬於甲類。',{exclusiveGroups:[['A','A']]}).status,'BLOCKED');
});
test('explicit target key must match the single reviewed conclusion key',()=>{
 assert.equal(runCompeting('本案活動屬於甲類。',{targetKey:'SOMETHING_ELSE'}).status,'BLOCKED');
 const base={...card.rules[0],exceptions:[]};const r=runCompeting('本案活動屬於甲類。',{targetKey:'IN_SCOPE',rules:[base]});assert.equal(r.status,'SUPPORTED_BOOK_CASE');assert.equal(r.trace.targetKey,'IN_SCOPE');
});
test('the final conclusion cannot be injected as an input fact to prove itself',()=>{
 const schema={key:'IN_SCOPE',label:'結果',trueForms:['在範圍內'],falseForms:['不在範圍內']};const base={...card.rules[0],when:{fact:'IN_SCOPE'},exceptions:[]};assert.equal(runCompeting('本案活動在範圍內。',{factSchemas:[...schemas,schema],rules:[base]}).status,'BLOCKED');
});
test('an undeclared dependency in an inactive rule is still a program error',()=>{
 const base={...card.rules[0],exceptions:[]};const invalid={...base,id:'inactive-invalid',when:{all:[{fact:'B'},{fact:'TYPO'}]}};assert.equal(runCompeting('本案活動屬於甲類。本案活動不屬於乙類。',{rules:[base,invalid]}).status,'BLOCKED');
});
test('a typo in an exception is not a request for an undeclared user fact',()=>{
 const base={...card.rules[0],exceptions:[{fact:'TYPO'}]};assert.equal(runCompeting('本案活動屬於甲類。',{rules:[base]}).status,'BLOCKED');
});
test('mutual exclusions must refer only to declared predicates',()=>{
 assert.equal(runCompeting('本案活動屬於甲類。',{exclusiveGroups:[['A','TYPO']]}).status,'BLOCKED');
});
test('unknown premise plus a definite exception cannot defeat another independently established sufficient rule',()=>{
 const positive={...card.rules[0],exceptions:[]};const disabledOpposite={...positive,id:'disabled',when:{fact:'B'},exceptions:[{fact:'E'}],conclusion:{key:'IN_SCOPE',polarity:'negative',text:'不屬於測試範圍'}};
 const r=runCompeting('本案活動屬於甲類。本案活動具備丁例外。',{rules:[positive,disabledOpposite]});assert.equal(r.status,'SUPPORTED_BOOK_CASE');
});
test('excluding an opposing final rule preserves the actual exclusion fact and rule source',()=>{
 const r=runCompeting('本案活動屬於甲類。本案活動不屬於乙類。');assert.equal(r.status,'SUPPORTED_BOOK_CASE');assert.deepEqual(r.trace.checkedRuleIds,['rule-b']);assert(r.trace.applied.some(p=>p.key==='B'&&p.value==='FALSE'));assert(r.text.includes('已核對並排除的相反規則：乙類活動不納入測試範圍。'));assert.equal(r.nonDecisiveFacts.length,0);
});
test('unknown opposite premise disabled by an exception cites the exception fact rather than the unknown premise',()=>{
 const positive={...card.rules[0],exceptions:[]};const disabled={...positive,id:'disabled',when:{fact:'B'},exceptions:[{fact:'E'}],conclusion:{key:'IN_SCOPE',polarity:'negative',text:'不屬於測試範圍'}};
 const r=runCompeting('本案活動屬於甲類。本案活動具備丁例外。',{rules:[positive,disabled]});assert.equal(r.status,'SUPPORTED_BOOK_CASE');assert.deepEqual(r.trace.applied.map(p=>p.key),['A','E']);assert.deepEqual(r.trace.checkedRuleIds,['disabled']);
});

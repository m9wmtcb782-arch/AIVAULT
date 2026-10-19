'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {source,digest}=require('../src/argument.cjs');const {solve}=require('../src/solve.cjs');
// Synthetic teaching text; this is deliberately not a statement about any real law.
const pages=[{pdfPage:2,text:'第一章\n甲類活動屬於乙類活動。'},{pdfPage:9,text:'第二章\n乙類活動納入測試範圍。'}];
const snapshot=source({bookId:'chain-fixture',title:'合成多步教材',author:'測試',edition:'v1',jurisdiction:'未核對',asOf:'未核對'},pages);
const span=(page,text)=>({pdfPage:page,start:pages.find(p=>p.pdfPage===page).text.indexOf(text),end:pages.find(p=>p.pdfPage===page).text.indexOf(text)+text.length,text});
const first=span(2,'甲類活動屬於乙類活動。'),second=span(9,'乙類活動納入測試範圍。');
const make=(id,evidence,when,key,text)=>({id,direction:'sufficient',exceptionsComplete:true,exceptions:[],evidence,context:[evidence],when,conclusion:{key,text,polarity:'positive'}});
const card={id:'chain-card',kind:'reviewed_book_case',scope:'book_concept_application',sourceHash:snapshot.sourceHash,subjectAliases:['本案活動'],factSchemas:[{key:'A',label:'是否甲類',trueForms:['屬於甲類'],falseForms:['不屬於甲類']}],targetAliases:['測試範圍'],exclusiveGroups:[],ruleBoundaryReviewed:true,review:{method:'extracted_text_comparison',reviewer:'synthetic-fixture',checkedAt:'fixture'},derivations:[make('a-to-b',first,{fact:'A'},'B','本案活動屬於乙類')],rules:[make('b-to-scope',second,{fact:'B'},'SCOPE','本案活動屬於測試範圍')]};
function run(factsText,c=card,cap={}){return solve({question:'本案活動是否屬於測試範圍？',factsText},{snapshot,caseCard:c},{allowedBookIds:['chain-fixture'],getReviewedDigest:()=>digest(c),...cap});}
test('unified route performs cross-page two-step proof with source and leaf fact trace',()=>{const r=run('本案活動屬於甲類。');assert.equal(r.route,'book_case');assert.equal(r.status,'SUPPORTED_BOOK_CASE');assert.equal(r.facts.values.B,undefined);assert.equal(r.trace.proof[0].key,'B');assert.equal(r.trace.applied[0].key,'A');assert.equal(r.nonDecisiveFacts.length,0);assert.deepEqual(r.citation.pdfPages,[9,2]);assert(r.text.includes(first.text));assert(r.text.includes(second.text));assert(r.text.includes('推得：本案活動屬於乙類'));assert.equal(r.modelCalls,0);});
test('missing leaf is requested rather than asking user to assert the intermediate conclusion',()=>{const r=run('');assert.equal(r.status,'NEEDS_FACTS');assert.deepEqual(r.missing,['A']);assert.equal(r.proof.nodes[0].value,'UNKNOWN');});
test('negative base input does not invert a sufficient rule',()=>{const r=run('本案活動不屬於甲類。');assert.notEqual(r.status,'SUPPORTED_BOOK_CASE');assert.equal(r.conclusion,undefined);});
test('cycles cannot self-support the final answer',()=>{const c=structuredClone(card);c.derivations[0].when={fact:'B'};assert.equal(run('本案活動屬於甲類。',c).status,'BLOCKED');});
test('intermediate evidence mutation blocks the complete answer',()=>{const c=structuredClone(card);c.derivations[0].evidence.text='被替換的原文';assert.equal(run('本案活動屬於甲類。',c).status,'BLOCKED');});
test('intermediate rules still require the package review digest',()=>{assert.equal(run('本案活動屬於甲類。',card,{getReviewedDigest:()=>null}).status,'BLOCKED');});
test('contradictory intermediate rules stop before downstream conclusion',()=>{const c=structuredClone(card);c.derivations.push({...c.derivations[0],id:'negative-b',conclusion:{key:'B',polarity:'negative',text:'本案活動不屬於乙類'}});const r=run('本案活動屬於甲類。',c);assert.equal(r.status,'MULTIPLE_VIEWS');assert.equal(r.conclusion,undefined);});
test('unparsed facts are not discarded just because a chain can answer',()=>assert.equal(run('本案活動屬於甲類，但另有特殊規定。').status,'NEEDS_FACT_REVIEW'));
test('mutual exclusion applies to derived and stated facts even when only one target rule exists',()=>{
 const c=structuredClone(card);c.factSchemas.push({key:'OTHER',label:'丙類',trueForms:['屬於丙類'],falseForms:['不屬於丙類']});c.exclusiveGroups=[['B','OTHER']];
 const r=run('本案活動屬於甲類。本案活動屬於丙類。',c);assert.equal(r.status,'INCONSISTENT_PROOF');assert.equal(r.conclusion,undefined);
});
test('a true disjunction cites the sufficient branch, not an unrelated false branch',()=>{
 const c=structuredClone(card);c.factSchemas.push({key:'OTHER',label:'丙類',trueForms:['屬於丙類'],falseForms:['不屬於丙類']});c.rules[0].when={any:[{fact:'B'},{fact:'OTHER'}]};
 const r=run('本案活動屬於甲類。本案活動不屬於丙類。',c);assert.equal(r.status,'SUPPORTED_BOOK_CASE');assert.deepEqual(r.trace.applied.map(p=>p.key),['A']);assert.equal(r.nonDecisiveFacts.length,1);
});
test('inactive same-direction derivation is not presented as support for the chosen proof',()=>{
 const c=structuredClone(card);c.factSchemas.push({key:'OTHER',label:'丙類',trueForms:['屬於丙類'],falseForms:['不屬於丙類']});c.derivations.push({...c.derivations[0],id:'other-to-b',when:{fact:'OTHER'}});
 const r=run('本案活動屬於甲類。本案活動不屬於丙類。',c);assert.equal(r.status,'SUPPORTED_BOOK_CASE');assert.deepEqual(r.trace.applied.map(p=>p.key),['A']);assert.equal(r.nonDecisiveFacts.length,1);assert.deepEqual(r.trace.proof[0].witness.supportRuleId,'a-to-b');
});
test('a false conjunct excludes a competing intermediate rule without unrelated facts in support',()=>{
 const c=structuredClone(card);
 c.factSchemas.push({key:'E',label:'丙類',trueForms:['屬於丙類'],falseForms:['不屬於丙類']},{key:'F',label:'丁類',trueForms:['屬於丁類'],falseForms:['不屬於丁類']});
 c.derivations.push({...c.derivations[0],id:'opposite-b',when:{all:[{fact:'E'},{fact:'F'}]},conclusion:{key:'B',polarity:'negative',text:'本案活動不屬於乙類'}});
 const r=run('本案活動屬於甲類。本案活動不屬於丙類。',c);assert.equal(r.status,'SUPPORTED_BOOK_CASE');assert.deepEqual(r.trace.applied.map(p=>p.key),['A','E']);assert.deepEqual(r.trace.checkedRuleIds,['opposite-b']);assert(r.text.includes('已核對並排除的相反規則'));assert(!r.trace.applied.some(p=>p.key==='F'));
});
test('removing an unused alternative keeps the proof while removing its decisive leaf destroys it',()=>{
 const c=structuredClone(card);c.factSchemas.push({key:'OTHER',label:'丙類',trueForms:['屬於丙類'],falseForms:['不屬於丙類']});c.rules[0].when={any:[{fact:'B'},{fact:'OTHER'}]};
 const full=run('本案活動屬於甲類。本案活動不屬於丙類。',c),pruned=run('本案活動屬於甲類。',c),withoutSupport=run('本案活動不屬於丙類。',c);
 assert.equal(pruned.status,'SUPPORTED_BOOK_CASE');assert.deepEqual(full.conclusion,pruned.conclusion);assert.notEqual(withoutSupport.status,'SUPPORTED_BOOK_CASE');assert.equal(withoutSupport.conclusion,undefined);
});
test('removing a counterrule exclusion prevents an answer even when the supporting chain is unchanged',()=>{
 const c=structuredClone(card);c.factSchemas.push({key:'E',label:'丙類',trueForms:['屬於丙類'],falseForms:['不屬於丙類']});c.derivations.push({...c.derivations[0],id:'opposite-b',when:{fact:'E'},conclusion:{key:'B',polarity:'negative',text:'本案活動不屬於乙類'}});
 assert.equal(run('本案活動屬於甲類。本案活動不屬於丙類。',c).status,'SUPPORTED_BOOK_CASE');const missing=run('本案活動屬於甲類。',c);assert.equal(missing.status,'NEEDS_FACTS');assert.deepEqual(missing.missing,['E']);
});

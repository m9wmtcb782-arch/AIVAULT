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

'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {source,digest}=require('../src/argument.cjs');const {checkLogicLanguage}=require('../src/logic-language.cjs');const {solve}=require('../src/solve.cjs');
const a={key:'A',polarity:'positive',text:'甲類活動'},b={key:'SCOPE',polarity:'positive',text:'納入測試範圍'};
function fixture(sentence,when={fact:'A'},conclusion={key:'SCOPE',polarity:'positive',text:'本案活動屬於測試範圍'},terms=[a,b]){
 const text='第一章\n'+sentence,snapshot=source({bookId:'logic-fixture',title:'合成條件方向教材',author:'測試',edition:'v1',jurisdiction:'未核對',asOf:'未核對'},[{pdfPage:4,text}]);
 const span={pdfPage:4,start:4,end:text.length,text:sentence};
 const rule={id:'conditional',direction:'sufficient',when,exceptions:[],exceptionsComplete:true,evidence:span,context:[span],conclusion,logicTerms:terms};
 return{snapshot,rule,check:()=>checkLogicLanguage(rule,snapshot)};
}
test('as long as P then Q verifies P to Q',()=>{const f=fixture('只要甲類活動，就納入測試範圍。');assert.equal(f.check().status,'DIRECTION_VERIFIED');assert.equal(f.check().applied.kind,'sufficient');});
test('only P then Q cannot be used to infer Q from P',()=>assert.throws(()=>fixture('只有甲類活動，才納入測試範圍。').check(),/DIRECTION_MISMATCH/));
test('only P then Q verifies the necessary direction Q to P',()=>{const f=fixture('只有甲類活動，才納入測試範圍。',{fact:'SCOPE'},{key:'A',polarity:'positive',text:'本案活動屬於甲類'});assert.equal(f.check().applied.kind,'necessary');});
test('if and only if supports either reviewed direction',()=>{assert.equal(fixture('甲類活動，當且僅當納入測試範圍。').check().status,'DIRECTION_VERIFIED');assert.equal(fixture('甲類活動，當且僅當納入測試範圍。',{fact:'SCOPE'},{key:'A',polarity:'positive',text:'甲類'}).check().status,'DIRECTION_VERIFIED');});
test('negated bound consequence keeps negative polarity',()=>{const no={...b,polarity:'negative',text:'不納入測試範圍'};assert.equal(fixture('只要甲類活動，就不納入測試範圍。',{fact:'A'},{key:'SCOPE',polarity:'negative',text:'不屬於範圍'},[a,no]).check().applied.to.polarity,'negative');});
test('a bound negative antecedent remains an explicit not expression',()=>{const no={...a,polarity:'negative',text:'不是甲類活動'};assert.equal(fixture('如果不是甲類活動，則納入測試範圍。',{not:{fact:'A'}},undefined,[no,b]).check().status,'DIRECTION_VERIFIED');assert.throws(()=>fixture('如果不是甲類活動，則納入測試範圍。',{fact:'A'},undefined,[no,b]).check(),/DIRECTION_MISMATCH/);});
test('source whitespace and ASCII comma affect only the analysis copy',()=>{const f=fixture('只要甲類活動,\n 就納入測試範圍。');assert.equal(f.check().status,'DIRECTION_VERIFIED');assert.equal(f.check().source.text,'只要甲類活動,\n 就納入測試範圍。');});
test('missing bindings cannot be replaced with a sufficient-direction flag',()=>{const f=fixture('只有甲類活動，才納入測試範圍。');delete f.rule.logicTerms;assert.throws(f.check,/BINDING_REQUIRED/);});
test('additional qualifier cannot be dropped to match the bounded grammar',()=>assert.throws(()=>fixture('只要甲類活動，就納入測試範圍，但另有特殊限制。').check(),/OUTSIDE_GRAMMAR/));
test('unless cannot be used in its affirmative antecedent direction',()=>assert.throws(()=>fixture('除非甲類活動，否則納入測試範圍。').check(),/DIRECTION_MISMATCH/));
test('a compound formal premise cannot be justified by a simple source implication',()=>assert.throws(()=>fixture('只要甲類活動，就納入測試範圍。',{any:[{fact:'A'},{fact:'OTHER'}]}).check(),/DIRECTION_MISMATCH/));
test('ambiguous term surfaces are rejected',()=>assert.throws(()=>fixture('只要甲類活動，就納入測試範圍。',undefined,undefined,[a,{...b,text:a.text}]).check(),/AMBIGUOUS_LOGIC_TERMS/));
test('term mapping cannot hide a conditional clause or sentence punctuation',()=>{for(const surface of ['只有甲類活動','甲類活動。'])assert.throws(()=>fixture('只有甲類活動，才納入測試範圍。',undefined,undefined,[{...a,text:surface},b]).check(),/INVALID_LOGIC_TERM/);});
function run(sentence){
 const {snapshot,rule}=fixture(sentence);const c={id:'direction-card',kind:'reviewed_book_case',scope:'book_concept_application',sourceHash:snapshot.sourceHash,subjectAliases:['本案活動'],factSchemas:[{key:'A',label:'甲類',trueForms:['屬於甲類'],falseForms:['不屬於甲類']}],targetAliases:['測試範圍'],exclusiveGroups:[],ruleBoundaryReviewed:true,review:{method:'extracted_text_comparison',reviewer:'synthetic-fixture',checkedAt:'fixture'},rules:[rule]};
 return solve({question:'本案活動是否屬於測試範圍？',factsText:'本案活動屬於甲類。'},{snapshot,caseCard:c},{allowedBookIds:['logic-fixture'],getReviewedDigest:()=>digest(c)});
}
test('unified case route rejects only-if inversion before answering',()=>assert.equal(run('只有甲類活動，才納入測試範圍。').status,'BLOCKED'));
test('unified case route preserves verified direction with the answer trace',()=>{const r=run('只要甲類活動，就納入測試範圍。');assert.equal(r.status,'SUPPORTED_BOOK_CASE');assert.equal(r.trace.logicLanguageChecks[0].applied.kind,'sufficient');});
test('unless E otherwise Q verifies not E to Q, without deciding the E case',()=>{
 const f=fixture('除非甲類活動，否則納入測試範圍。',{not:{fact:'A'}});assert.equal(f.check().status,'DIRECTION_VERIFIED');assert.equal(f.check().applied.from.polarity,'negative');
});
test('an explicit source exception must match the formal rule exception',()=>{
 const e={key:'E',polarity:'positive',text:'有特別規定'};const f=fixture('只要甲類活動，就納入測試範圍，但有特別規定除外。',undefined,undefined,[a,b,e]);f.rule.exceptions=[{fact:'E'}];assert.equal(f.check().status,'DIRECTION_VERIFIED');assert.deepEqual(f.check().applied.exceptions,[{key:'E',polarity:'positive'}]);
});
const exceptionTerm={key:'E',polarity:'positive',text:'有特別規定'};
function runBound(f,factsText){
 const card={id:'exception-card',kind:'reviewed_book_case',scope:'book_concept_application',sourceHash:f.snapshot.sourceHash,subjectAliases:['本案活動'],factSchemas:[{key:'A',label:'是否甲類',trueForms:['屬於甲類'],falseForms:['不屬於甲類']},{key:'E',label:'是否有特別規定',trueForms:['有特別規定'],falseForms:['沒有特別規定']}],targetAliases:['測試範圍'],exclusiveGroups:[],ruleBoundaryReviewed:true,review:{method:'extracted_text_comparison',reviewer:'synthetic-fixture',checkedAt:'fixture'},rules:[f.rule]};
 return solve({question:'本案活動是否屬於測試範圍？',factsText},{snapshot:f.snapshot,caseCard:card},{allowedBookIds:['logic-fixture'],getReviewedDigest:()=>digest(card)});
}
function unlessFixture(){return fixture('除非有特別規定，否則納入測試範圍。',{not:{fact:'E'}},undefined,[exceptionTerm,b]);}
function exceptFixture(){const f=fixture('只要甲類活動，就納入測試範圍，但有特別規定除外。',undefined,undefined,[a,b,exceptionTerm]);f.rule.exceptions=[{fact:'E'}];return f;}
test('unless permits the consequent only after an explicit negative exception fact',()=>{
 const r=runBound(unlessFixture(),'本案活動沒有特別規定。');assert.equal(r.status,'SUPPORTED_BOOK_CASE');assert.equal(r.conclusion.polarity,'positive');assert.equal(r.trace.logicLanguageChecks[0].applied.kind,'unless');assert.equal(r.trace.applied[0].value,'FALSE');
});
test('established unless condition never implies the opposite answer',()=>{
 const r=runBound(unlessFixture(),'本案活動有特別規定。');assert.equal(r.status,'NO_APPLICABLE_RULE');assert.equal(r.conclusion,undefined);
});
test('unknown unless condition cannot be treated as absent',()=>{const r=runBound(unlessFixture(),'');assert.equal(r.status,'NEEDS_FACTS');assert.deepEqual(r.missing,['E']);});
test('source-matched exception absent permits the reviewed sufficient rule',()=>{
 const r=runBound(exceptFixture(),'本案活動屬於甲類。本案活動沒有特別規定。');assert.equal(r.status,'SUPPORTED_BOOK_CASE');assert.equal(r.trace.logicLanguageChecks[0].applied.exceptions[0].key,'E');
});
test('source-matched exception established blocks the general rule',()=>{const r=runBound(exceptFixture(),'本案活動屬於甲類。本案活動有特別規定。');assert.equal(r.status,'EXCEPTION_APPLIES');assert.equal(r.conclusion,undefined);});
test('source-matched exception unknown requests that fact',()=>{const r=runBound(exceptFixture(),'本案活動屬於甲類。');assert.equal(r.status,'NEEDS_FACTS');assert.deepEqual(r.missing,['E']);});
test('an explicit source exception cannot be silently removed from the formal rule',()=>{const f=exceptFixture();f.rule.exceptions=[];assert.equal(runBound(f,'本案活動屬於甲類。').status,'BLOCKED');});
test('an explicit source exception cannot be negated in the formal rule',()=>{const f=exceptFixture();f.rule.exceptions=[{not:{fact:'E'}}];assert.equal(runBound(f,'本案活動屬於甲類。本案活動沒有特別規定。').status,'BLOCKED');});
test('extra formal exception cannot be attributed to an unconditional source statement',()=>{const f=fixture('只要甲類活動，就納入測試範圍。');f.rule.exceptions=[{fact:'E'}];assert.equal(runBound(f,'本案活動屬於甲類。本案活動沒有特別規定。').status,'BLOCKED');});
test('unless cannot be strengthened into a conclusion negation when its exception holds',()=>{
 const f=unlessFixture();f.rule.when={fact:'E'};f.rule.conclusion.polarity='negative';f.rule.conclusion.text='本案活動不屬於測試範圍';assert.equal(runBound(f,'本案活動有特別規定。').status,'BLOCKED');
});
test('the other type of unless construction is not guessed from matching keywords',()=>assert.throws(()=>fixture('除非有特別規定，才納入測試範圍。',{not:{fact:'E'}},undefined,[exceptionTerm,b]).check(),/OUTSIDE_GRAMMAR/));

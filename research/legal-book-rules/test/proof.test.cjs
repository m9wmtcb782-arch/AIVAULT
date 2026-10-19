'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {derive,missingLeaves}=require('../src/proof.cjs');
const rule=(id,key,when,polarity='positive',exceptions=[])=>({id,when,exceptions,conclusion:{key,polarity}});
const chain=[rule('second','C',{fact:'B'}),rule('first','B',{fact:'A'})];
test('multi-step derivation is independent of declaration order and preserves input',()=>{const facts={A:'TRUE'};const p=derive(chain,facts,['A']);assert.equal(p.values.C,'TRUE');assert.deepEqual(facts,{A:'TRUE'});assert.deepEqual(p.nodes.map(n=>n.key),['B','C']);assert.deepEqual(p.nodes[1].rules[0].dependencies,['B']);});
test('missing intermediate fact resolves to original missing input',()=>{const p=derive(chain,{},['A']);assert.equal(p.values.C,'UNKNOWN');assert.deepEqual(missingLeaves(['C'],p),['A']);});
test('negative intermediate conclusion supports explicit not premise',()=>{const p=derive([rule('no-b','B',{fact:'A'},'negative'),rule('then-c','C',{not:{fact:'B'}})],{A:'TRUE'},['A']);assert.equal(p.values.C,'TRUE');assert.equal(p.values.B,'FALSE');});
test('false sufficient premise never implies false conclusion',()=>assert.equal(derive(chain,{A:'FALSE'},['A']).values.C,'UNKNOWN'));
test('unknown exception never becomes absent by default',()=>{const p=derive([rule('one','B',{fact:'A'},'positive',[{fact:'E'}]),rule('two','C',{fact:'B'})],{A:'TRUE'},['A','E']);assert.equal(p.values.C,'UNKNOWN');assert.deepEqual(missingLeaves(['C'],p),['E']);});
test('established exception disables intermediate proof',()=>{const p=derive([rule('one','B',{fact:'A'},'positive',[{fact:'E'}])],{A:'TRUE',E:'TRUE'},['A','E']);assert.equal(p.values.B,'UNKNOWN');assert.equal(p.nodes[0].rules[0].status,'INACTIVE');});
test('opposite intermediate proofs produce a conflict and cannot propagate a positive value',()=>{const p=derive([...chain,rule('opposite','B',{fact:'A'},'negative')],{A:'TRUE'},['A']);assert.deepEqual(p.conflicts,['B']);assert.equal(p.values.C,'UNKNOWN');});
test('pending opposite intermediate proof blocks a supported direction',()=>{const p=derive([rule('one','B',{fact:'A'}),rule('opposite','B',{fact:'E'},'negative')],{A:'TRUE'},['A','E']);assert.equal(p.values.B,'UNKNOWN');assert.deepEqual(p.nodes[0].missing,['E']);});
test('pending same direction does not defeat a sufficient proof',()=>{const p=derive([rule('one','B',{fact:'A'}),rule('another','B',{fact:'E'})],{A:'TRUE'},['A','E']);assert.equal(p.values.B,'TRUE');});
test('conjunction requires all stated inputs',()=>{const p=derive([rule('both','B',{all:[{fact:'A'},{fact:'E'}]})],{A:'TRUE'},['A','E']);assert.equal(p.values.B,'UNKNOWN');});
test('disjunction permits an independently satisfied branch',()=>{const p=derive([rule('either','B',{any:[{fact:'A'},{fact:'E'}]})],{A:'TRUE'},['A','E']);assert.equal(p.values.B,'TRUE');});
for(const rules of [[rule('self','B',{fact:'B'})],[rule('one','B',{fact:'C'}),rule('two','C',{fact:'B'})],[rule('one','B',{fact:'A'},'positive',[{fact:'C'}]),rule('two','C',{fact:'B'})]])test('cycles including exception dependencies are rejected: '+rules.map(r=>r.id),()=>assert.throws(()=>derive(rules,{},['A']),/CYCLIC_PROOF/));
test('intermediate facts cannot be supplied by input',()=>assert.throws(()=>derive(chain,{B:'TRUE'},['A']),/INVALID_BASE_FACT/));
test('derived heads cannot overwrite input predicates',()=>assert.throws(()=>derive([rule('bad','A',{fact:'E'})],{},['A','E']),/INVALID_DERIVATION/));
test('undeclared dependency and duplicate rule ids fail closed',()=>{assert.throws(()=>derive(chain,{},[]),/UNDECLARED_FACT/);assert.throws(()=>derive([chain[0],chain[0]],{},['A']),/INVALID_DERIVATION/);});
test('bounded proof graph rejects oversized input',()=>assert.throws(()=>derive(Array.from({length:17},(_,i)=>rule('r'+i,'B'+i,{fact:'A'})),{},['A']),/INVALID_DERIVATIONS/));
test('three-step chain carries missing base exception through every intermediate node',()=>{
 const rs=[rule('last','D',{fact:'C'}),rule('middle','C',{fact:'B'}),rule('first','B',{fact:'A'},'positive',[{fact:'E'}])];
 const pending=derive(rs,{A:'TRUE'},['A','E']);assert.equal(pending.values.D,'UNKNOWN');assert.deepEqual(missingLeaves(['D'],pending),['E']);
 const complete=derive(rs,{A:'TRUE',E:'FALSE'},['A','E']);assert.equal(complete.values.D,'TRUE');assert.equal(complete.nodes.length,3);
});
test('conclusive disjunction does not depend on an unknown alternative',()=>{
 const p=derive([rule('choice','B',{any:[{fact:'A'},{fact:'E'}]})],{A:'TRUE'},['A','E']);assert.deepEqual(p.nodes[0].witness.dependencies,['A']);
});
test('one false conjunct suffices to exclude an opposing rule',()=>{
 const p=derive([rule('yes','B',{fact:'A'}),rule('no','B',{all:[{fact:'E'},{fact:'F'}]},'negative')],{A:'TRUE',E:'FALSE'},['A','E','F']);assert.equal(p.values.B,'TRUE');assert.deepEqual(p.nodes[0].witness.checkedOppositeRuleIds,['no']);assert.deepEqual(p.nodes[0].witness.dependencies,['A','E']);
});
test('a true exception can exclude an opposing rule without establishing its premise',()=>{
 const p=derive([rule('yes','B',{fact:'A'}),rule('no','B',{fact:'E'},'negative',[{fact:'F'}])],{A:'TRUE',F:'TRUE'},['A','E','F']);assert.equal(p.values.B,'TRUE');assert.deepEqual(p.nodes[0].witness.dependencies,['A','F']);
});
test('a negative disjunction witness requires both alternatives to be false',()=>{
 const p=derive([rule('yes','B',{fact:'A'}),rule('no','B',{any:[{fact:'E'},{fact:'F'}]},'negative')],{A:'TRUE',E:'FALSE',F:'FALSE'},['A','E','F']);assert.equal(p.values.B,'TRUE');assert.deepEqual(p.nodes[0].witness.dependencies,['A','E','F']);
});

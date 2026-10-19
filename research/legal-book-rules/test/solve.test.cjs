'use strict';
const{test}=require('node:test');const assert=require('node:assert/strict');const{solve}=require('../src/solve.cjs');
test('authorization precedes routing',()=>assert.equal(solve({question:'測試'},{}).status,'BLOCKED'));
test('missing question cannot run a handler',()=>assert.equal(solve({}, {snapshot:{meta:{bookId:'f'}}},{allowedBookIds:['f']}).status,'UNSUPPORTED'));
test('unknown question causes no network fallback',()=>{const old=global.fetch;global.fetch=()=>{throw Error('network forbidden');};try{const r=solve({question:'這個案例是否合法？'},{snapshot:{meta:{bookId:'f'}}},{allowedBookIds:['f']});assert.equal(r.status,'UNSUPPORTED');assert.equal(r.modelCalls,0);}finally{global.fetch=old;}});
test('case facts cannot be silently discarded to answer a different question',()=>{const r=solve({question:'比較甲乙',factsText:'另有例外'},{snapshot:{meta:{bookId:'f'}}},{allowedBookIds:['f']});assert.equal(r.status,'UNSUPPORTED');assert(r.reasons.includes('CASE_RULE_REQUIRED'));});

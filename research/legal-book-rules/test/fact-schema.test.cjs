'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {compileFactSchemas}=require('../src/fact-schema.cjs');const {extractFacts}=require('../src/book-case.cjs');
const subjects=['本案組織','本案组织','本案活動','本案活动'];const roles=[{canonical:'本案組織',aliases:['本案組織','本案组织'],references:['該組織']},{canonical:'本案活動',aliases:['本案活動','本案活动'],references:['該活動']}];
const schema=(key,aliases)=>({key,subjectAliases:aliases,trueForms:['具有資格'],falseForms:['不具有資格']});
test('identical predicates for different actors remain separate facts',()=>{
 const schemas=[schema('ORG',['本案組織']),schema('ACT',['本案活動'])];const r=extractFacts('本案組織具有資格。本案活動不具有資格。',schemas,subjects,roles);assert.equal(r.values.ORG,'TRUE');assert.equal(r.values.ACT,'FALSE');assert.equal(r.provenance.ORG[0].subjectCanonical,'本案組織');assert.equal(r.provenance.ACT[0].subjectCanonical,'本案活動');
});
test('scope aliases use the same reviewed canonical actor in either script',()=>{
 const schemas=[schema('ACT',['本案活动'])];const r=extractFacts('本案活動具有資格。',schemas,subjects,roles);assert.equal(r.values.ACT,'TRUE');assert.equal(r.provenance.ACT[0].subjectCanonical,'本案活動');
});
test('an unscoped predicate cannot overlap a specific actor with a different meaning',()=>{const a=schema('ANY');delete a.subjectAliases;assert.throws(()=>compileFactSchemas([a,schema('ACT',['本案活動'])],subjects,roles),/AMBIGUOUS_FACT_SCHEMA/);});
test('cross-key positive and negative forms cannot share the same actor and wording',()=>{
 const a=schema('A',['本案活動']),b=schema('B',['本案活動']);b.trueForms=['另一條件'];b.falseForms=['具有資格'];assert.throws(()=>compileFactSchemas([a,b],subjects,roles),/AMBIGUOUS_FACT_SCHEMA/);
});
test('unknown actor scopes are not silently ignored',()=>assert.throws(()=>compileFactSchemas([schema('A',['其他活動'])],subjects,roles),/INVALID_FACT_SUBJECT/));
test('duplicate fact keys are rejected before text parsing',()=>assert.throws(()=>extractFacts('',[schema('A',['本案組織']),schema('A',['本案活動'])],subjects,roles),/INVALID_FACT_SCHEMA/));
test('duplicated or whitespace-only forms cannot become parser configuration',()=>{
 const a=schema('A',['本案活動']);a.trueForms.push(a.trueForms[0]);assert.throws(()=>compileFactSchemas([a],subjects,roles),/AMBIGUOUS_FACT_SCHEMA/);a.trueForms=['  '];assert.throws(()=>compileFactSchemas([a],subjects,roles),/INVALID_FACT_FORM/);
});
test('shared deictic reference across roles is a configuration error',()=>{const bad=structuredClone(roles);bad[1].references=['該組織'];assert.throws(()=>compileFactSchemas([],subjects,bad),/AMBIGUOUS_NARRATIVE_ROLE/);});
test('duplicate role canonical identifiers are rejected',()=>assert.throws(()=>compileFactSchemas([],subjects,[roles[0],roles[0]]),/AMBIGUOUS_NARRATIVE_ROLE/));
test('named and deictic references preserve actor scope after index compilation',()=>{
 const r=extractFacts('本案組織名為甲協會。本案活動名為乙事項。甲協會具有資格。該活動不具有資格。',[schema('ORG',['本案組織']),schema('ACT',['本案活動'])],subjects,roles);assert.equal(r.values.ORG,'TRUE');assert.equal(r.values.ACT,'FALSE');assert.equal(r.unknownClauses.length,0);assert.equal(r.provenance.ACT[0].binding.name,'乙事項');
});

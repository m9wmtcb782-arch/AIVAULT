'use strict';
const {createResolver}=require('./narrative.cjs');
// Validate before parsing text. One actor + one exact predicate has one meaning.
// Any additional logical implication belongs in a reviewed derivation rule.
function compileFactSchemas(schemas,subjectAliases,roles=[]){
 createResolver(subjectAliases,roles);
 if(!Array.isArray(schemas)||schemas.length>32)throw Error('INVALID_FACT_SCHEMA');
 const canonical=s=>roles.find(r=>r.aliases.includes(s))?.canonical||s;
 const actors=[...new Set(subjectAliases.map(canonical))],index=new Map(actors.map(a=>[a,new Map()])),keys=new Set();
 for(const schema of schemas){
  if(!schema||typeof schema.key!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(schema.key)||keys.has(schema.key)||!Array.isArray(schema.trueForms)||!Array.isArray(schema.falseForms)||schema.trueForms.length>20||schema.falseForms.length>20||schema.trueForms.length+schema.falseForms.length===0)throw Error('INVALID_FACT_SCHEMA');
  keys.add(schema.key);
  if(schema.subjectAliases!==undefined&&(!Array.isArray(schema.subjectAliases)||!schema.subjectAliases.length||schema.subjectAliases.length>12||new Set(schema.subjectAliases).size!==schema.subjectAliases.length||schema.subjectAliases.some(a=>!subjectAliases.includes(a))))throw Error('INVALID_FACT_SUBJECT');
  const allowed=[...new Set((schema.subjectAliases||subjectAliases).map(canonical))];
  for(const [forms,value]of [[schema.trueForms,'TRUE'],[schema.falseForms,'FALSE']])for(const form of forms){
   if(typeof form!=='string'||form.length<2||form.length>100||/\s/u.test(form))throw Error('INVALID_FACT_FORM');
   for(const actor of allowed){
    const predicates=index.get(actor);if(predicates.has(form))throw Error('AMBIGUOUS_FACT_SCHEMA');predicates.set(form,{key:schema.key,value});
   }
  }
 }
 return index;
}
module.exports={compileFactSchemas};

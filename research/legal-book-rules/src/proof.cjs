'use strict';
const {evaluate}=require('./argument.cjs');
const atom=k=>typeof k==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(k);
function dependencies(expr){
  evaluate(expr,{});const keys=new Set();
  function visit(e){if(e.fact)keys.add(e.fact);if(e.not)visit(e.not);for(const c of e.all||e.any||[])visit(c);}
  visit(expr);return [...keys];
}
// A decisive witness records only the branch needed for this expression's value.
// Validation by evaluate happens before recursion, preserving its depth/node budget.
function witness(expr,facts){
  evaluate(expr,facts);
  function visit(e){
    const result=evaluate(e,facts);
    if(e.fact)return{...result,dependencies:[e.fact]};
    if(e.not)return{...result,dependencies:visit(e.not).dependencies};
    const children=(e.all||e.any).map(visit);
    const decisive=e.all&&result.value==='FALSE'?'FALSE':e.any&&result.value==='TRUE'?'TRUE':null;
    const chosen=decisive?[children.find(c=>c.value===decisive)]:children;
    return{...result,dependencies:[...new Set(chosen.flatMap(c=>c.dependencies))]};
  }
  return visit(expr);
}
// Internal bounded logic engine. The caller must verify every rule against its source
// and trusted review digest before using its results in an answer.
function derive(rules,baseFacts,baseKeys){
  if(!Array.isArray(rules)||rules.length>16||!Array.isArray(baseKeys)||baseKeys.some(k=>!atom(k))||new Set(baseKeys).size!==baseKeys.length)throw Error('INVALID_DERIVATIONS');
  const groups=new Map(),ids=new Set();
  for(const rule of rules){
    if(typeof rule.id!=='string'||!rule.id.length||ids.has(rule.id)||!atom(rule.conclusion?.key)||!['positive','negative'].includes(rule.conclusion.polarity)||baseKeys.includes(rule.conclusion.key)||!Array.isArray(rule.exceptions)||rule.exceptions.length>16)throw Error('INVALID_DERIVATION');
    ids.add(rule.id);const deps=[...new Set([...dependencies(rule.when),...rule.exceptions.flatMap(dependencies)])];
    if(!groups.has(rule.conclusion.key))groups.set(rule.conclusion.key,[]);groups.get(rule.conclusion.key).push({rule,deps});
  }
  const known=new Set([...baseKeys,...groups.keys()]);
  for(const rs of groups.values())for(const r of rs)if(r.deps.some(k=>!known.has(k)))throw Error('UNDECLARED_FACT');
  for(const [k,v]of Object.entries(baseFacts))if(!baseKeys.includes(k)||!['TRUE','FALSE','UNKNOWN'].includes(v))throw Error('INVALID_BASE_FACT');
  const visiting=new Set(),done=new Set(),order=[];
  function visit(key){
    if(done.has(key))return;if(visiting.has(key))throw Error('CYCLIC_PROOF');visiting.add(key);
    for(const r of groups.get(key)||[])for(const dep of r.deps)if(groups.has(dep))visit(dep);
    visiting.delete(key);done.add(key);order.push(key);
  }
  for(const key of groups.keys())visit(key);
  const values=Object.assign(Object.create(null),baseFacts),nodes=[],conflicts=[];
  for(const key of order){
    const assessments=groups.get(key).map(({rule,deps})=>{
      const premise=witness(rule.when,values),exceptions=rule.exceptions.map(e=>witness(e,values));
      const status=premise.value==='FALSE'||exceptions.some(e=>e.value==='TRUE')?'INACTIVE':premise.value==='TRUE'&&exceptions.every(e=>e.value==='FALSE')?'APPLIED':'PENDING';
      const decisiveDependencies=status==='INACTIVE'?(premise.value==='FALSE'?premise.dependencies:exceptions.find(e=>e.value==='TRUE').dependencies):[...new Set([...premise.dependencies,...exceptions.flatMap(e=>e.dependencies)])];
      return{ruleId:rule.id,polarity:rule.conclusion.polarity,status,premise,exceptions,dependencies:deps,decisiveDependencies};
    });
    const applied=assessments.filter(r=>r.status==='APPLIED'),polarities=new Set(applied.map(r=>r.polarity));
    const competing=assessments.filter(r=>r.status==='PENDING'&&applied.some(a=>a.polarity!==r.polarity));
    let value='UNKNOWN';
    if(polarities.size>1)conflicts.push(key);
    else if(polarities.size===1&&!competing.length)value=applied[0].polarity==='positive'?'TRUE':'FALSE';
    values[key]=value;
    const blockers=assessments.filter(r=>r.status==='PENDING'&&(!applied.length||competing.includes(r)));
    const missing=[...new Set(blockers.flatMap(r=>[...r.premise.missing,...r.exceptions.flatMap(e=>e.missing)]))];
    const support=['TRUE','FALSE'].includes(value)?applied[0]:null;
    const checkedOpposite=support?assessments.filter(r=>r.polarity!==support.polarity):[];
    const proofWitness=support?{supportRuleId:support.ruleId,checkedOppositeRuleIds:checkedOpposite.map(r=>r.ruleId),dependencies:[...new Set([support,...checkedOpposite].flatMap(r=>r.decisiveDependencies))]}:null;
    nodes.push({key,value,conflict:polarities.size>1,rules:assessments,missing,witness:proofWitness});
  }
  return{values,nodes,conflicts};
}
function missingLeaves(keys,proof){
 const byKey=new Map(proof.nodes.map(n=>[n.key,n])),out=new Set(),visited=new Set();
 function visit(key){if(visited.has(key))return;visited.add(key);const node=byKey.get(key);if(!node){out.add(key);return;}for(const dep of node.missing)visit(dep);}
 keys.forEach(visit);return[...out];
}
module.exports={derive,dependencies,missingLeaves,witness};

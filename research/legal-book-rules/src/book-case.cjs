'use strict';
const { source, digest, takeSpan, evaluate } = require('./argument.cjs');
const { derive, missingLeaves, witness, dependencies } = require('./proof.cjs');
const { checkRuleLanguage } = require('./source-language.cjs');
const { scan } = require('./engine.cjs');
const { classifyPage } = require('./section.cjs');
const { narrativeClauses, createResolver } = require('./narrative.cjs');
function extractFacts(text, schemas, subjectAliases, narrativeRoles=[]) {
  if (typeof text !== 'string' || text.length > 16000 || !Array.isArray(schemas) || schemas.length > 32 || !Array.isArray(subjectAliases) || !subjectAliases.length || subjectAliases.length > 12) throw Error('INVALID_CASE_INPUT');
  const values = Object.create(null), provenance = Object.create(null), unknownClauses = [];
  const resolver=createResolver(subjectAliases,narrativeRoles);
  let lastSubject=null;
  const chunks = narrativeClauses(text);
  for (const m of chunks) {
    const raw = m.text, compact = raw.replace(/\s+/gu, '').replace(/[。；;，,]+$/u, '').replace(/^(?:但是|然而|不過|不过|而且|並且|并且|但)/u,'');
    if (!compact) continue;
    if(m.guarded||/[?？「」『』“”"！!]|是否|能否|可能|也許|也许|據說|据说|假如|如果|除非|未必|不一定/u.test(compact)){unknownClauses.push({start:m.start,end:m.end});lastSubject=null;continue;}
    const bound=resolver.bind(compact,{start:m.start,end:m.end,text:raw});
    if(bound.matched){if(bound.ambiguous)unknownClauses.push({start:m.start,end:m.end});lastSubject=null;continue;}
    let resolved=resolver.resolve(compact);
    if(!resolved&&lastSubject?.sentenceStart===m.sentenceStart)resolved={surface:'',canonical:lastSubject.canonical,kind:'elliptic_subject',binding:lastSubject.origin,activate:()=>{}};
    const subject=resolved?.canonical;
    if(!subject){unknownClauses.push({start:m.start,end:m.end});continue;}
    const predicate = compact.slice(resolved.surface.length); let matched = false;
    for (const schema of schemas) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(schema.key) || !Array.isArray(schema.trueForms) || !Array.isArray(schema.falseForms) || schema.trueForms.length > 20 || schema.falseForms.length > 20 || [...schema.trueForms,...schema.falseForms].some(v => typeof v !== 'string' || v.length < 2 || v.length > 100)) throw Error('INVALID_FACT_SCHEMA');
      if (schema.subjectAliases && !schema.subjectAliases.includes(subject)) continue;
      const pos=schema.trueForms.includes(predicate), neg=schema.falseForms.includes(predicate);
      if(!pos&&!neg)continue;
      if(pos&&neg)throw Error('AMBIGUOUS_FACT_SCHEMA');
      const v=pos?'TRUE':'FALSE';
      if(!provenance[schema.key])provenance[schema.key]=[];
      provenance[schema.key].push({start:m.start,end:m.end,text:raw,value:v,subjectSurface:resolved.surface,subjectCanonical:subject,resolvedBy:resolved.kind,binding:resolved.binding});
      values[schema.key]=values[schema.key]&&values[schema.key]!==v?'CONFLICT':v;matched=true;
    }
    if(!matched){unknownClauses.push({start:m.start,end:m.end});lastSubject=null;}else{const origin={start:m.start,end:m.end,text:raw,canonical:subject};resolved.activate(origin);lastSubject={canonical:subject,sentenceStart:m.sentenceStart,origin};}
  }
  return{values,provenance,unknownClauses,bindings:resolver.bindings()};
}
function validateRule(rule,snapshot){
      if(!rule||typeof rule.id!=='string'||!rule.id.trim()||rule.id.length>80||rule.direction!=='sufficient'||rule.exceptionsComplete!==true||!Array.isArray(rule.exceptions)||rule.exceptions.length>16||!rule.conclusion||typeof rule.conclusion.key!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(rule.conclusion.key)||!['positive','negative'].includes(rule.conclusion.polarity)||typeof rule.conclusion.text!=='string'||!rule.conclusion.text.trim()||rule.conclusion.text.length>300||(rule.explanation!==undefined&&(typeof rule.explanation!=='string'||rule.explanation.length>1500)))throw Error('INVALID_RULE');
      const original=takeSpan(snapshot,rule.evidence);const a=scan(original);if(a.errors.length||a.flags.includes('question'))throw Error('INVALID_EVIDENCE');
      const page=snapshot.pages.find(p=>p.pdfPage===rule.evidence.pdfPage);if(['FRONT_MATTER','TABLE_OF_CONTENTS'].includes(classifyPage(page.text).role))throw Error('NON_BODY_RULE');
      if(!Array.isArray(rule.context)||!rule.context.length||rule.context.length>32||!rule.context.some(e=>e.pdfPage===rule.evidence.pdfPage&&e.start<=rule.evidence.start&&e.end>=rule.evidence.end))throw Error('INCOMPLETE_CONTEXT');rule.context.forEach(e=>takeSpan(snapshot,e));
      checkRuleLanguage(rule,snapshot);
      return original;
}
function validateProgram(card,snapshot){
    const derivations=card.derivations===undefined?[]:card.derivations;
    if(!Array.isArray(derivations)||derivations.length>16||!Array.isArray(card.factSchemas)||card.factSchemas.length>32)throw Error('INVALID_PROGRAM');
    const baseKeys=card.factSchemas.map(f=>f.key),derivedKeys=derivations.map(r=>r.conclusion?.key);
    if(baseKeys.some(k=>typeof k!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(k))||new Set(baseKeys).size!==baseKeys.length)throw Error('INVALID_FACT_KEYS');
    const known=new Set([...baseKeys,...derivedKeys]);
    const finalKeys=new Set(card.rules.map(r=>r.conclusion?.key));
    if(finalKeys.size!==1)throw Error('AMBIGUOUS_TARGET');
    const targetKey=[...finalKeys][0];
    if(known.has(targetKey)||(card.targetKey!==undefined&&card.targetKey!==targetKey))throw Error('INVALID_TARGET');
    const all=[...derivations,...card.rules];
    if(new Set(all.map(r=>r.id)).size!==all.length)throw Error('DUPLICATE_RULE_ID');
    for(const rule of all){
      validateRule(rule,snapshot);
      const referenced=[...dependencies(rule.when),...rule.exceptions.flatMap(dependencies)];
      if(referenced.some(k=>!known.has(k)))throw Error('UNDECLARED_FACT');
    }
    for(const group of card.exclusiveGroups)if(!Array.isArray(group)||group.length<2||group.length>32||new Set(group).size!==group.length||group.some(k=>!known.has(k)))throw Error('INVALID_GROUP');
    return{derivations,targetKey};
}
function answerBookCase(input,card,snapshot,{allowedBookIds,getReviewedDigest}={}){
  if(!snapshot||!allowedBookIds?.includes(snapshot.meta?.bookId))return{status:'BLOCKED',reasons:['BOOK_NOT_AUTHORIZED']};
  try{
    if(source(snapshot.meta,snapshot.pages).sourceHash!==snapshot.sourceHash||card.sourceHash!==snapshot.sourceHash)throw Error('SOURCE_CHANGED');
    if(typeof getReviewedDigest!=='function'||getReviewedDigest(card.id)!==digest(card))throw Error('REVIEW_REQUIRED');
    if(card.kind!=='reviewed_book_case'||card.scope!=='book_concept_application'||card.review?.method!=='extracted_text_comparison'||!card.review.reviewer||!card.review.checkedAt||card.ruleBoundaryReviewed!==true)throw Error('INVALID_CARD');
    if(!input||typeof input.question!=='string'||input.question.length>500||!Array.isArray(card.targetAliases)||!card.targetAliases.length||card.targetAliases.length>12||!Array.isArray(card.rules)||!card.rules.length||card.rules.length>16||!Array.isArray(card.exclusiveGroups)||card.exclusiveGroups.length>16)throw Error('INVALID_INPUT');
    const compact=input.question.replace(/\s+/gu,'').replace(/[?？。]+$/u,'').replace(/^(?:依本書|依本书)[，,]?/u,'');
    const target=card.targetAliases.some(a=>compact===`本案活動是否屬於${a}`||compact===`本案活动是否属于${a}`);
    if(!target)return{status:'UNSUPPORTED',reasons:['QUESTION_OUTSIDE_REVIEWED_CASE_TARGET']};
    const {derivations,targetKey}=validateProgram(card,snapshot);
    const facts=extractFacts(input.factsText,card.factSchemas,card.subjectAliases,card.narrativeRoles||[]);
    const conflicts=Object.keys(facts.values).filter(k=>facts.values[k]==='CONFLICT');
    for(const group of card.exclusiveGroups){if(!Array.isArray(group)||group.length>32)throw Error('INVALID_GROUP');if(group.filter(k=>facts.values[k]==='TRUE').length>1)conflicts.push(...group);}
    if(conflicts.length)return{status:'CONFLICTING_FACTS',text:'題目事實有矛盾，尚不能下結論。',conflicts:[...new Set(conflicts)],facts,modelCalls:0};
    // Unknown clauses may contain a qualifier or different actor. Never discard them.
    if(facts.unknownClauses.length)return{status:'NEEDS_FACT_REVIEW',text:'題目有尚未解析的敘述，可能影響條件或例外；本輪先不下結論。',facts,modelCalls:0};
    const proof=derive(derivations,facts.values,card.factSchemas.map(f=>f.key));
    if(proof.conflicts.length)return{status:'MULTIPLE_VIEWS',text:'中間推導出現相反結果，不能沿用它作成結論。',facts,proof,modelCalls:0};
    const reasoningValues=proof.values;
    const inconsistentGroups=card.exclusiveGroups.filter(group=>group.filter(k=>reasoningValues[k]==='TRUE').length>1);
    if(inconsistentGroups.length)return{status:'INCONSISTENT_PROOF',text:'書中規則推得的命題與已知事實違反互斥關係，不能繼續下結論。',facts,proof,inconsistentGroups,modelCalls:0};
    const matched=[],pending=[],assessments=[],missing=new Set(),exceptionRules=[];
    for(const rule of card.rules){
      const original=validateRule(rule,snapshot);
      const premise=witness(rule.when,reasoningValues),exceptions=rule.exceptions.map(e=>witness(e,reasoningValues));
      const inactive=premise.value==='FALSE'||exceptions.some(e=>e.value==='TRUE');
      assessments.push({ruleId:rule.id,polarity:rule.conclusion.polarity,status:inactive?'INACTIVE':premise.value==='TRUE'&&exceptions.every(e=>e.value==='FALSE')?'APPLIED':'PENDING',dependencies:inactive?(premise.value==='FALSE'?premise.dependencies:exceptions.find(e=>e.value==='TRUE').dependencies):[]});
      if(premise.value==='FALSE')continue;
      if(exceptions.some(e=>e.value==='TRUE')){
        if(premise.value==='UNKNOWN')missingLeaves(premise.missing,proof).forEach(k=>missing.add(k));
        else exceptionRules.push(rule.id);
        continue;
      }
      if(premise.value==='UNKNOWN'||exceptions.some(e=>e.value==='UNKNOWN')){missingLeaves([...premise.missing,...exceptions.flatMap(e=>e.missing)],proof).forEach(k=>missing.add(k));pending.push({rule,premise,exceptions});continue;}
      matched.push({rule,original,premise,exceptions});
    }
    if(!matched.length){const labels=[...missing].map(k=>card.factSchemas.find(f=>f.key===k)?.label||k);return{status:missing.size?'NEEDS_FACTS':exceptionRules.length?'EXCEPTION_APPLIES':'NO_APPLICABLE_RULE',text:missing.size?'目前不能判定。需要題目明示：'+labels.join('、')+'。':exceptionRules.length?'已命中書中規則的例外，不能沿用一般結論。':'本次已核對規則不能推出結論；前提不成立也不能直接推出相反答案。',missing:[...missing],exceptionRules,facts,proof,modelCalls:0};}
    const conclusions=new Map();for(const r of matched){const k=r.rule.conclusion.key;if(!conclusions.has(k))conclusions.set(k,new Set());conclusions.get(k).add(r.rule.conclusion.polarity);}
    if([...conclusions.values()].some(v=>v.size>1))return{status:'MULTIPLE_VIEWS',text:'目前有相反的規則結果，應保留差異，不合併為單一結論。',facts,modelCalls:0};
    // Unknown facts cannot be ignored when they could activate an opposite rule.
    // Reviewed exclusivity constrains possibility; it never becomes an asserted fact.
    const possibleFacts=Object.assign(Object.create(null),reasoningValues),exclusions=[];
    for(const group of card.exclusiveGroups){
      const established=group.find(k=>reasoningValues[k]==='TRUE');
      if(established)for(const key of group)if(key!==established&&possibleFacts[key]===undefined){possibleFacts[key]='FALSE';exclusions.push({key,because:established,group:[...group]});}
    }
    const unresolvedOpposite=[],excludedCompetingRules=[];
    for(const candidate of pending){
      if(!matched.some(m=>m.rule.conclusion.key===candidate.rule.conclusion.key&&m.rule.conclusion.polarity!==candidate.rule.conclusion.polarity))continue;
      const premise=evaluate(candidate.rule.when,possibleFacts),exceptions=candidate.rule.exceptions.map(e=>evaluate(e,possibleFacts));
      if(premise.value==='FALSE'||exceptions.some(e=>e.value==='TRUE')){excludedCompetingRules.push({ruleId:candidate.rule.id,premise,exceptions,exclusions});continue;}
      unresolvedOpposite.push({ruleId:candidate.rule.id,missing:missingLeaves([...premise.missing,...exceptions.flatMap(e=>e.missing)],proof)});
    }
    if(unresolvedOpposite.length){
      const missing=[...new Set(unresolvedOpposite.flatMap(r=>r.missing))];
      return{status:'NEEDS_FACTS',text:'已有規則支持一個方向，但相反規則的條件或例外尚未釐清，現在不能作成單一結論。需要核對：'+missing.map(k=>card.factSchemas.find(f=>f.key===k)?.label||k).join('、')+'。',missing,pendingRuleIds:unresolvedOpposite.map(r=>r.ruleId),facts,modelCalls:0};
    }
    const chosen=matched[0],usedKeys=new Set();
    for(const key of witness(chosen.rule.when,reasoningValues).dependencies)usedKeys.add(key);
    for(const e of chosen.rule.exceptions)for(const key of witness(e,reasoningValues).dependencies)usedKeys.add(key);
    const checkedTargetIds=assessments.filter(a=>a.polarity!==chosen.rule.conclusion.polarity&&a.status==='INACTIVE').map(a=>a.ruleId);
    for(const id of checkedTargetIds)for(const key of assessments.find(a=>a.ruleId===id).dependencies)usedKeys.add(key);
    for(const checked of excludedCompetingRules){
      checkedTargetIds.push(checked.ruleId);
      const r=card.rules.find(r=>r.id===checked.ruleId),p=witness(r.when,possibleFacts),es=r.exceptions.map(e=>witness(e,possibleFacts));
      const deps=p.value==='FALSE'?p.dependencies:es.find(e=>e.value==='TRUE').dependencies;
      for(const key of deps){const excluded=exclusions.find(e=>e.key===key);usedKeys.add(excluded?excluded.because:key);}
    }
    const usedProof=[];
    function expand(key){
      const node=proof.nodes.find(n=>n.key===key);if(!node||usedProof.includes(node))return;
      if(!node.witness)throw Error('UNPROVEN_INTERMEDIATE');
      for(const dep of node.witness.dependencies){usedKeys.add(dep);expand(dep);}
      usedProof.push(node);
    }
    [...usedKeys].forEach(expand);
    const proofRules=usedProof.map(n=>derivations.find(d=>d.id===n.witness.supportRuleId));
    const checkedRules=[...usedProof.flatMap(n=>n.witness.checkedOppositeRuleIds.map(id=>derivations.find(d=>d.id===id))),...checkedTargetIds.map(id=>card.rules.find(r=>r.id===id))];
    const proofText=proofRules.map(r=>'書中規則：'+takeSpan(snapshot,r.evidence)+'\n推得：'+r.conclusion.text).join('\n');
    const checkedText=checkedRules.map(r=>'已核對並排除的相反規則：'+takeSpan(snapshot,r.evidence)).join('\n');
    const applied=[...usedKeys].flatMap(k=>(facts.provenance[k]||[]).map(p=>({key:k,...p})));
    const nonDecisiveFacts=Object.keys(facts.provenance).filter(k=>!usedKeys.has(k)).flatMap(k=>facts.provenance[k]);
    return{status:'SUPPORTED_BOOK_CASE',text:'依本書的概念界定，'+chosen.rule.conclusion.text+'。\n\n'+(chosen.rule.explanation?'理由：'+chosen.rule.explanation+'\n\n':'')+'書中原文：\n'+chosen.original+(proofText?'\n\n中間推導：\n'+proofText:'')+(checkedText?'\n\n'+checkedText:'')+'\n\n題目對照：\n'+applied.map(p=>p.text).join('\n')+'\n\n'+(proofRules.length?'上述題目事實經列示規則推導後，符合結論規則的條件；此結論限於題目給定前提。':'上述明示事實符合這項書中規則的條件；此結論限於題目給定前提。')+(nonDecisiveFacts.length?'\n題目中的「'+nonDecisiveFacts.map(p=>p.text).join('；')+'」未單獨作為本次推導的充分條件。':''),
      conclusion:chosen.rule.conclusion,facts,trace:{sourceLanguageChecks:[chosen.rule,...proofRules,...checkedRules].map(r=>({ruleId:r.id,...checkRuleLanguage(r,snapshot)})),targetKey,targetAssessments:assessments,checkedRuleIds:checkedRules.map(r=>r.id),proof:usedProof,excludedCompetingRules,ruleId:chosen.rule.id,sourceHash:snapshot.sourceHash,premise:chosen.premise,exceptions:chosen.exceptions,applied},
      citation:{title:snapshot.meta.title,edition:snapshot.meta.edition,pdfPage:chosen.rule.evidence.pdfPage,pdfPages:[...new Set([...chosen.rule.context,...[...proofRules,...checkedRules].flatMap(r=>r.context)].map(e=>e.pdfPage))]},nonDecisiveFacts,
      limitation:'此為書中概念規則對明示假設事實的適用，不是活動性質的獨立法律認定，也不是現行法或個案合法性判斷。',modelCalls:0};
  }catch{return{status:'BLOCKED',reasons:['INVALID_SOURCE_OR_CASE_RULE']};}
}
module.exports={extractFacts,answerBookCase};

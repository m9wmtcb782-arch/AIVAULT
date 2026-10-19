'use strict';
const { source, digest, takeSpan, evaluate } = require('./argument.cjs');
const { scan } = require('./engine.cjs');
const { classifyPage } = require('./section.cjs');
function extractFacts(text, schemas, subjectAliases) {
  if (typeof text !== 'string' || text.length > 16000 || !Array.isArray(schemas) || schemas.length > 32 || !Array.isArray(subjectAliases) || !subjectAliases.length || subjectAliases.length > 12) throw Error('INVALID_CASE_INPUT');
  const values = Object.create(null), provenance = Object.create(null), unknownClauses = [];
  const chunks = text.matchAll(/[^。；;\n]+[。；;\n]?/gu);
  for (const m of chunks) {
    const raw = m[0], compact = raw.replace(/\s+/gu, '').replace(/[。；;]+$/u, '');
    if (!compact) continue;
    const subject = subjectAliases.filter(a => typeof a === 'string' && a.length >= 2 && a.length <= 40).sort((a,b)=>b.length-a.length).find(a => compact.startsWith(a));
    if (!subject || /[?？「」『』“”"！!]|是否|能否|可能|也許|也许|據說|据说|假如|如果|除非|未必|不一定/u.test(compact)) { unknownClauses.push({start:m.index,end:m.index+raw.length}); continue; }
    const predicate = compact.slice(subject.length); let matched = false;
    for (const schema of schemas) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(schema.key) || !Array.isArray(schema.trueForms) || !Array.isArray(schema.falseForms) || schema.trueForms.length > 20 || schema.falseForms.length > 20 || [...schema.trueForms,...schema.falseForms].some(v => typeof v !== 'string' || v.length < 2 || v.length > 100)) throw Error('INVALID_FACT_SCHEMA');
      if (schema.subjectAliases && !schema.subjectAliases.includes(subject)) continue;
      const pos=schema.trueForms.includes(predicate), neg=schema.falseForms.includes(predicate);
      if(!pos&&!neg)continue;
      if(pos&&neg)throw Error('AMBIGUOUS_FACT_SCHEMA');
      const v=pos?'TRUE':'FALSE';
      if(!provenance[schema.key])provenance[schema.key]=[];
      provenance[schema.key].push({start:m.index,end:m.index+raw.length,text:raw,value:v});
      values[schema.key]=values[schema.key]&&values[schema.key]!==v?'CONFLICT':v;matched=true;
    }
    if(!matched)unknownClauses.push({start:m.index,end:m.index+raw.length});
  }
  return{values,provenance,unknownClauses};
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
    const facts=extractFacts(input.factsText,card.factSchemas,card.subjectAliases);
    const conflicts=Object.keys(facts.values).filter(k=>facts.values[k]==='CONFLICT');
    for(const group of card.exclusiveGroups){if(!Array.isArray(group)||group.length>32)throw Error('INVALID_GROUP');if(group.filter(k=>facts.values[k]==='TRUE').length>1)conflicts.push(...group);}
    if(conflicts.length)return{status:'CONFLICTING_FACTS',text:'題目事實有矛盾，尚不能下結論。',conflicts:[...new Set(conflicts)],facts,modelCalls:0};
    // Unknown clauses may contain a qualifier or different actor. Never discard them.
    if(facts.unknownClauses.length)return{status:'NEEDS_FACT_REVIEW',text:'題目有尚未解析的敘述，可能影響條件或例外；本輪先不下結論。',facts,modelCalls:0};
    const matched=[],missing=new Set(),exceptionRules=[];
    for(const rule of card.rules){
      if(rule.direction!=='sufficient'||rule.exceptionsComplete!==true||!Array.isArray(rule.exceptions)||rule.exceptions.length>16||!rule.conclusion||typeof rule.conclusion.key!=='string'||!['positive','negative'].includes(rule.conclusion.polarity)||typeof rule.conclusion.text!=='string'||rule.conclusion.text.length>300||(rule.explanation!==undefined&&(typeof rule.explanation!=='string'||rule.explanation.length>1500)))throw Error('INVALID_RULE');
      const original=takeSpan(snapshot,rule.evidence);const a=scan(original);if(a.errors.length||a.flags.includes('question'))throw Error('INVALID_EVIDENCE');
      const page=snapshot.pages.find(p=>p.pdfPage===rule.evidence.pdfPage);if(['FRONT_MATTER','TABLE_OF_CONTENTS'].includes(classifyPage(page.text).role))throw Error('NON_BODY_RULE');
      if(!Array.isArray(rule.context)||!rule.context.length||rule.context.length>32||!rule.context.some(e=>e.pdfPage===rule.evidence.pdfPage&&e.start<=rule.evidence.start&&e.end>=rule.evidence.end))throw Error('INCOMPLETE_CONTEXT');rule.context.forEach(e=>takeSpan(snapshot,e));
      const premise=evaluate(rule.when,facts.values),exceptions=rule.exceptions.map(e=>evaluate(e,facts.values));
      if(premise.value==='FALSE')continue;
      if(exceptions.some(e=>e.value==='TRUE')){exceptionRules.push(rule.id);continue;}
      if(premise.value==='UNKNOWN'||exceptions.some(e=>e.value==='UNKNOWN')){[...premise.missing,...exceptions.flatMap(e=>e.missing)].forEach(k=>missing.add(k));continue;}
      matched.push({rule,original,premise,exceptions});
    }
    if(!matched.length){const labels=[...missing].map(k=>card.factSchemas.find(f=>f.key===k)?.label||k);return{status:exceptionRules.length?'EXCEPTION_APPLIES':missing.size?'NEEDS_FACTS':'NO_APPLICABLE_RULE',text:exceptionRules.length?'已命中書中規則的例外，不能沿用一般結論。':missing.size?'目前不能判定。需要題目明示：'+labels.join('、')+'。':'本次已核對規則不能推出結論；前提不成立也不能直接推出相反答案。',missing:[...missing],exceptionRules,facts,modelCalls:0};}
    const conclusions=new Map();for(const r of matched){const k=r.rule.conclusion.key;if(!conclusions.has(k))conclusions.set(k,new Set());conclusions.get(k).add(r.rule.conclusion.polarity);}
    if([...conclusions.values()].some(v=>v.size>1))return{status:'MULTIPLE_VIEWS',text:'目前有相反的規則結果，應保留差異，不合併為單一結論。',facts,modelCalls:0};
    const chosen=matched[0],usedKeys=new Set();
    const collect=e=>{if(e.fact)usedKeys.add(e.fact);if(e.not)collect(e.not);for(const x of e.all||e.any||[])collect(x);};collect(chosen.rule.when);chosen.rule.exceptions.forEach(collect);
    const applied=[...usedKeys].flatMap(k=>(facts.provenance[k]||[]).map(p=>({key:k,...p})));
    const nonDecisiveFacts=Object.keys(facts.provenance).filter(k=>!usedKeys.has(k)).flatMap(k=>facts.provenance[k]);
    return{status:'SUPPORTED_BOOK_CASE',text:'依本書的概念界定，'+chosen.rule.conclusion.text+'。\n\n'+(chosen.rule.explanation?'理由：'+chosen.rule.explanation+'\n\n':'')+'書中原文：\n'+chosen.original+'\n\n題目對照：\n'+applied.map(p=>p.text).join('\n')+'\n\n上述明示事實符合這項書中規則的條件；此結論限於題目給定前提。'+(nonDecisiveFacts.length?'\n題目中的「'+nonDecisiveFacts.map(p=>p.text).join('；')+'」未單獨作為本次推導的充分條件。':''),
      conclusion:chosen.rule.conclusion,facts,trace:{ruleId:chosen.rule.id,sourceHash:snapshot.sourceHash,premise:chosen.premise,exceptions:chosen.exceptions,applied},
      citation:{title:snapshot.meta.title,edition:snapshot.meta.edition,pdfPage:chosen.rule.evidence.pdfPage,pdfPages:[...new Set(chosen.rule.context.map(e=>e.pdfPage))]},nonDecisiveFacts,
      limitation:'此為書中概念規則對明示假設事實的適用，不是活動性質的獨立法律認定，也不是現行法或個案合法性判斷。',modelCalls:0};
  }catch{return{status:'BLOCKED',reasons:['INVALID_SOURCE_OR_CASE_RULE']};}
}
module.exports={extractFacts,answerBookCase};

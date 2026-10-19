'use strict';
const {takeSpan}=require('./argument.cjs');
const CUE=/只有|只要|僅當|仅当|當且僅當|当且仅当|如果|假如|除非|若/u;
const compact=s=>s.replace(/\s+/gu,'').replace(/,/gu,'，').replace(/。$/u,'');
function literal(expr){
 if(expr&&Object.keys(expr).length===1&&typeof expr.fact==='string')return{key:expr.fact,polarity:'positive'};
 if(expr&&Object.keys(expr).length===1&&expr.not&&Object.keys(expr.not).length===1&&typeof expr.not.fact==='string')return{key:expr.not.fact,polarity:'negative'};
 return null;
}
const atom=t=>({key:t.key,polarity:t.polarity});
const opposite=t=>({key:t.key,polarity:t.polarity==='positive'?'negative':'positive'});
const same=(a,b)=>a&&b&&a.key===b.key&&a.polarity===b.polarity;
// Deliberately restricted source grammar. Bindings belong to the reviewed card;
// this does not identify legal concepts or conditions from arbitrary prose.
function checkLogicLanguage(rule,snapshot){
 const raw=takeSpan(snapshot,rule.evidence),text=compact(raw);
 if(!CUE.test(text)&&rule.logicTerms===undefined)return{status:'NO_EXPLICIT_DIRECTION_CUE',automaticFormalization:false};
 if(!Array.isArray(rule.logicTerms)||rule.logicTerms.length<2||rule.logicTerms.length>8)throw Error('LOGIC_BINDING_REQUIRED');
 const terms=rule.logicTerms.map(t=>{
  if(!t||typeof t.key!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(t.key)||!['positive','negative'].includes(t.polarity)||typeof t.text!=='string'||t.text.length<2||t.text.length>100)throw Error('INVALID_LOGIC_TERM');
  const surface=compact(t.text);
  if(CUE.test(surface)||/[，,。；;?？!！「」『』“”"()（）]/u.test(t.text)||!text.includes(surface))throw Error('INVALID_LOGIC_TERM');
  return{...t,surface};
 });
 if(new Set(terms.map(t=>t.surface)).size!==terms.length)throw Error('AMBIGUOUS_LOGIC_TERMS');
 const implications=[];
 for(const a of terms)for(const b of terms){
  if(a===b||a.key===b.key)continue;
  const forms=[
   ['sufficient',`只要${a.surface}，就${b.surface}`,a,b],
   ['sufficient',`如果${a.surface}，則${b.surface}`,a,b],
   ['sufficient',`如果${a.surface}，则${b.surface}`,a,b],
   ['necessary',`只有${a.surface}，才${b.surface}`,b,a],
   ['necessary',`僅當${a.surface}，才${b.surface}`,b,a],
   ['necessary',`仅当${a.surface}，才${b.surface}`,b,a],
   ['equivalent',`${a.surface}，當且僅當${b.surface}`,a,b],
   ['equivalent',`${a.surface}，当且仅当${b.surface}`,a,b]
  ];
  for(const [kind,form,from,to]of forms){
   if(text===form){implications.push({kind,from:atom(from),to:atom(to),exceptions:[]});if(kind==='equivalent')implications.push({kind,from:atom(to),to:atom(from),exceptions:[]});}
   // Only an explicit sufficient rule with a single, fully matched exception.
   if(kind==='sufficient')for(const e of terms)if(e.key!==a.key&&e.key!==b.key&&text===form+'，但'+e.surface+'除外')implications.push({kind:'sufficient_with_exception',from:atom(from),to:atom(to),exceptions:[atom(e)]});
  }
  if(text===`除非${a.surface}，否則${b.surface}`||text===`除非${a.surface}，否则${b.surface}`)implications.push({kind:'unless',from:opposite(a),to:atom(b),exceptions:[]});
 }
 if(!implications.length)throw Error('SOURCE_LOGIC_OUTSIDE_GRAMMAR');
 const sourceDirection=implications.filter(i=>same(i.from,literal(rule.when))&&same(i.to,rule.conclusion));
 const applied=sourceDirection.find(i=>i.exceptions.length===rule.exceptions.length&&i.exceptions.every((e,n)=>same(e,literal(rule.exceptions[n]))));
 if(sourceDirection.length&&!applied)throw Error('SOURCE_LOGIC_EXCEPTION_MISMATCH');
 if(!applied)throw Error('SOURCE_RULE_DIRECTION_MISMATCH');
 return{status:'DIRECTION_VERIFIED',source:rule.evidence,implications,applied,automaticFormalization:false,bindingOrigin:'trusted_reviewed_card'};
}
module.exports={checkLogicLanguage};

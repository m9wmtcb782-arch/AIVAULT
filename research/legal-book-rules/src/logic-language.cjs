'use strict';
const {takeSpan,evaluate}=require('./argument.cjs');
const CUE=/只有|只要|僅當|仅当|當且僅當|当且仅当|如果|假如|除非|若/u;
const CONNECTORS=[['並且','all'],['并且','all'],['而且','all'],['或者','any'],['且','all'],['或','any']];
const compact=s=>s.replace(/\s+/gu,'').replace(/,/gu,'，').replace(/。$/u,'');
function literal(expr){
 if(expr&&Object.keys(expr).length===1&&typeof expr.fact==='string')return{key:expr.fact,polarity:'positive'};
 if(expr&&Object.keys(expr).length===1&&expr.not&&Object.keys(expr.not).length===1&&typeof expr.not.fact==='string')return{key:expr.not.fact,polarity:'negative'};
 return null;
}
const atom=t=>({key:t.key,polarity:t.polarity});
const asExpr=t=>t.expression||(t.polarity==='positive'?{fact:t.key}:{not:{fact:t.key}});
const describe=e=>literal(e)||{expression:e};
function canonical(expr){
 evaluate(expr,{});
 function visit(e){
  if(e.fact)return JSON.stringify(['fact',e.fact]);
  if(e.not)return JSON.stringify(['not',visit(e.not)]);
  const key=e.all?'all':'any';return JSON.stringify([key,e[key].map(visit).sort()]);
 }
 return visit(expr);
}
function parseExpression(text,terms,depth=0,budget={left:32}){
 if(depth>6||--budget.left<0||!text||text.length>1200)throw Error('SOURCE_EXPRESSION_LIMIT');
 const term=terms.find(t=>t.surface===text);if(term)return asExpr(term);
 const pieces=[],ops=[];let level=0,start=0;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(c==='('){level++;continue;}if(c===')'){if(--level<0)throw Error('INVALID_SOURCE_PARENTHESES');continue;}
  if(level)continue;
  const op=CONNECTORS.find(([s])=>text.startsWith(s,i));
  if(op){pieces.push(text.slice(start,i));ops.push(op[1]);i+=op[0].length-1;start=i+1;}
 }
 if(level)throw Error('INVALID_SOURCE_PARENTHESES');
 if(ops.length){
  if(new Set(ops).size>1)throw Error('AMBIGUOUS_SOURCE_PRECEDENCE');
  pieces.push(text.slice(start));if(pieces.length>8)throw Error('SOURCE_EXPRESSION_LIMIT');
  return{[ops[0]]:pieces.map(p=>parseExpression(p,terms,depth+1,budget))};
 }
 if(text.startsWith('(')&&text.endsWith(')'))return parseExpression(text.slice(1,-1),terms,depth+1,budget);
 throw Error('SOURCE_LOGIC_OUTSIDE_GRAMMAR');
}
// Restricted source grammar using atom meanings supplied by the trusted card.
// No automatic identification of legal concepts, source adoption, or real facts.
function checkLogicLanguage(rule,snapshot){
 const raw=takeSpan(snapshot,rule.evidence),text=compact(raw);
 if(!CUE.test(text)&&rule.logicTerms===undefined)return{status:'NO_EXPLICIT_DIRECTION_CUE',automaticFormalization:false};
 if(!Array.isArray(rule.logicTerms)||rule.logicTerms.length<2||rule.logicTerms.length>8)throw Error('LOGIC_BINDING_REQUIRED');
 const terms=rule.logicTerms.map(t=>{
  if(!t||typeof t.key!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(t.key)||!['positive','negative'].includes(t.polarity)||typeof t.text!=='string'||t.text.length<2||t.text.length>100)throw Error('INVALID_LOGIC_TERM');
  const surface=compact(t.text);
  if(CUE.test(surface)||CONNECTORS.some(([c])=>surface.includes(c))||/[，,。；;?？!！「」『』“”"()（）]/u.test(t.text)||!text.includes(surface))throw Error('INVALID_LOGIC_TERM');
  return{...t,surface};
 });
 if(new Set(terms.map(t=>t.surface)).size!==terms.length)throw Error('AMBIGUOUS_LOGIC_TERMS');
 const parse=s=>parseExpression(s.replace(/（/gu,'(').replace(/）/gu,')'),terms);
 const parseAtom=s=>{const t=terms.find(t=>t.surface===s);if(!t)throw Error('SOURCE_LOGIC_OUTSIDE_GRAMMAR');return atom(t);};
 const implications=[];let m;
 if((m=text.match(/^(只要|如果)(.+)，(就|則|则)(.+)$/u))){
  if((m[1]==='只要'&&m[3]!=='就')||(m[1]==='如果'&&m[3]==='就'))throw Error('SOURCE_LOGIC_OUTSIDE_GRAMMAR');
  const tail=m[4].split('，但');if(tail.length>2)throw Error('SOURCE_LOGIC_OUTSIDE_GRAMMAR');
  const to=parseAtom(tail[0]),from=describe(parse(m[2])),exceptions=[];
  if(tail.length===2){if(!tail[1].endsWith('除外'))throw Error('SOURCE_LOGIC_OUTSIDE_GRAMMAR');exceptions.push(describe(parse(tail[1].slice(0,-2))));}
  implications.push({kind:exceptions.length?'sufficient_with_exception':'sufficient',from,to,exceptions});
 }else if((m=text.match(/^(只有|僅當|仅当)(.+)，才(.+)$/u))){
  implications.push({kind:'necessary',from:parseAtom(m[3]),to:parseAtom(m[2]),exceptions:[]});
 }else if((m=text.match(/^(.+)，(?:當且僅當|当且仅当)(.+)$/u))){
  const a=parseAtom(m[1]),b=parseAtom(m[2]);implications.push({kind:'equivalent',from:a,to:b,exceptions:[]},{kind:'equivalent',from:b,to:a,exceptions:[]});
 }else if((m=text.match(/^除非(.+)，(?:否則|否则)(.+)$/u))){
  const exception=parse(m[1]),lit=literal(exception);
  const negated=lit?{key:lit.key,polarity:lit.polarity==='positive'?'negative':'positive'}:{expression:{not:exception}};
  implications.push({kind:'unless',from:negated,to:parseAtom(m[2]),exceptions:[]});
 }
 if(!implications.length)throw Error('SOURCE_LOGIC_OUTSIDE_GRAMMAR');
 const sourceDirection=implications.filter(i=>canonical(asExpr(i.from))===canonical(rule.when)&&i.to.key===rule.conclusion.key&&i.to.polarity===rule.conclusion.polarity);
 const applied=sourceDirection.find(i=>i.exceptions.length===rule.exceptions.length&&i.exceptions.every((e,n)=>canonical(asExpr(e))===canonical(rule.exceptions[n])));
 if(sourceDirection.length&&!applied)throw Error('SOURCE_LOGIC_EXCEPTION_MISMATCH');
 if(!applied)throw Error('SOURCE_RULE_DIRECTION_MISMATCH');
 return{status:'DIRECTION_VERIFIED',source:rule.evidence,implications,applied,automaticFormalization:false,bindingOrigin:'trusted_reviewed_card'};
}
module.exports={checkLogicLanguage};

'use strict';
const {takeSpan}=require('./argument.cjs');
// These are review cues, not a classifier of author intent. Keep original offsets.
const CUES=[
 ['quotation',/[「」『』“”"‘’]/gu],
 ['attribution',/有學者|有学者|某學者|某学者|學說|学说|某說|某说|通說|通说|認為|认为|主張|主张|指出|判決|判决|法院/gu],
 ['rejection',/不採|不采|不贊同|不赞同|不能認同|不能认同|不足採|不足采|值得商榷|此說有誤|此说有误|上述說法錯誤|上述说法错误/gu],
 ['adoption',/本書認為|本书认为|本文認為|本文认为|本文採取|本文采取|本書採取|本书采取/gu],
 ['reference',/前述|上述|下述|見前|见前|參見|参见|同上|前項|前项|後述|后述/gu],
 ['context_question',/[?？]|是否|能否|何以|為何|为何|難道|难道|豈|岂/gu]
];
function inspectSpans(spans,snapshot){
 if(!Array.isArray(spans)||spans.length>64)throw Error('SOURCE_LANGUAGE_LIMIT');
 const seen=new Set(),cueIds=new Set(),cues=[];let inspected=0;
 for(const span of spans){
  const raw=takeSpan(snapshot,span),id=[span.pdfPage,span.start,span.end].join(':');if(seen.has(id))continue;seen.add(id);inspected+=raw.length;if(inspected>256000)throw Error('SOURCE_LANGUAGE_LIMIT');
  for(const [kind,re]of CUES)for(const m of raw.matchAll(re)){
   const start=span.start+m.index,end=start+m[0].length;
   const cueId=[kind,span.pdfPage,start,end].join(':');
   if(!cueIds.has(cueId)){cueIds.add(cueId);if(cues.length>=2048)throw Error('SOURCE_LANGUAGE_LIMIT');cues.push({kind,pdfPage:span.pdfPage,start,end,text:m[0]});}
  }
 }
 return{requiresReview:cues.length>0,cues,automaticAuthorStance:false};
}
function inspectRuleLanguage(rule,snapshot){return inspectSpans([rule.evidence,...rule.context],snapshot);}
function checkRuleLanguage(rule,snapshot){
 const analysis=inspectRuleLanguage(rule,snapshot),review=rule.sourceReview;
 if(review!==undefined&&(!review||typeof review.speaker!=='string'||!review.speaker.trim()||review.speaker.length>200||!['adopted','reported','rejected','unresolved'].includes(review.stance)||review.contextChecked!==true))throw Error('INVALID_SOURCE_REVIEW');
 if(review&&review.stance!=='adopted')throw Error('SOURCE_STANCE_NOT_ADOPTED');
 if(analysis.requiresReview&&!review)throw Error('SOURCE_STANCE_REVIEW_REQUIRED');
 return{...analysis,review:review||null};
}
module.exports={inspectSpans,inspectRuleLanguage,checkRuleLanguage};

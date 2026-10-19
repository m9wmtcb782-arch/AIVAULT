'use strict';
const { source, digest, takeSpan } = require('./argument.cjs');
const { scan } = require('./engine.cjs');
function parseReasonQuestion(question, card) {
  if (typeof question !== 'string' || question.length > 500 || /[«»]/u.test(question)) return false;
  let t = question.replace(/\s+/gu, '').replace(/^(?:依本書|依本书|根據本書|根据本书)[，,]?/u, '').replace(/[?？。!！]+$/u, '');
  const aliases = new Map();
  for (const [key, terms] of [['S', card.subjectAliases], ['O', card.objectAliases]]) {
    if (!Array.isArray(terms) || !terms.length || terms.length > 20) return false;
    for (const a of terms) { if (typeof a !== 'string' || a.length < 2 || a.length > 100 || /[«»]/u.test(a) || (aliases.has(a) && aliases.get(a) !== key)) return false; aliases.set(a, key); }
  }
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  t = t.replace(new RegExp([...aliases.keys()].sort((a,b)=>b.length-a.length).map(esc).join('|'), 'gu'), a => '«'+aliases.get(a)+'»');
  return /^(?:為什麼|为什么|為何|为何)«S»(?:要|會|会)?(?:將|将|把)?«O»(?:納入|纳入)(?:其)?(?:調整|调整|研究)(?:範圍|范围)$/u.test(t)
    || /^«S»(?:為何|为何|為什麼|为什么)(?:要|會|会)?(?:研究|調整|调整)«O»$/u.test(t)
    || /^«S»(?:將|将|把)«O»(?:納入|纳入)(?:調整|调整|研究)(?:範圍|范围)(?:的)?(?:理由|原因)(?:是什麼|是什么)$/u.test(t);
}
function answerReasonQuestion(question, card, snapshot, { allowedBookIds, getReviewedDigest } = {}) {
  if (!snapshot || !allowedBookIds?.includes(snapshot.meta?.bookId)) return { status: 'BLOCKED', reasons: ['BOOK_NOT_AUTHORIZED'] };
  try {
    if (source(snapshot.meta,snapshot.pages).sourceHash !== snapshot.sourceHash || card.sourceHash !== snapshot.sourceHash) throw Error('SOURCE_CHANGED');
    if (typeof getReviewedDigest !== 'function' || getReviewedDigest(card.id) !== digest(card)) throw Error('REVIEW_REQUIRED');
    if (card.kind !== 'reviewed_reason_card' || card.scope !== 'book_view_only' || card.review?.method !== 'extracted_text_comparison' || !card.review.reviewer || !card.review.checkedAt || card.reasonListComplete !== true) throw Error('UNREVIEWED_REASONS');
    if (!Array.isArray(card.reasons) || !card.reasons.length || card.reasons.length > 12 || !Array.isArray(card.context) || !card.context.length || card.context.length > 32) throw Error('INVALID_REASON_LIST');
    const thesis = takeSpan(snapshot,card.thesis);
    const spans = [card.thesis,...card.reasons];
    for (const e of spans) {
      const a=scan(takeSpan(snapshot,e));
      if(a.errors.length || a.flags.includes('question') || !card.context.some(c=>c.pdfPage===e.pdfPage&&c.start<=e.start&&c.end>=e.end)) throw Error('UNSUPPORTED_REASON');
    }
    card.context.forEach(e=>takeSpan(snapshot,e));
    if(!parseReasonQuestion(question,card)) return {status:'UNSUPPORTED',reasons:['QUESTION_OUTSIDE_REASON_GRAMMAR']};
    const reasons=card.reasons.map(e=>({...e,text:takeSpan(snapshot,e)}));
    return {status:'SUPPORTED_BOOK_REASONS',text:'依本書，理由如下：\n'+reasons.map((e,i)=>(i+1)+'. '+e.text).join('\n'),thesis,reasons,
      citation:{title:snapshot.meta.title,edition:snapshot.meta.edition,pdfPages:[...new Set(spans.map(e=>e.pdfPage))]},
      limitation:'只整理此版書中已核對的理由，不補寫因果，不代表現行法或個案結論。原文尚未比對PDF影像。',modelCalls:0};
  }catch{return{status:'BLOCKED',reasons:['INVALID_OR_UNREVIEWED_REASON_CARD']};}
}
module.exports={parseReasonQuestion,answerReasonQuestion};

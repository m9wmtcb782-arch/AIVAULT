'use strict';
const { source, takeSpan, digest } = require('./argument.cjs');
const { scan } = require('./engine.cjs');
const { classifyPage } = require('./section.cjs');
// Reviewed reading answers are distinct from case-application rules.
// Only explicit question aliases are accepted; no bag-of-words legal conclusions.
function answerReadingCard(question, card, snapshot, { allowedBookIds, getReviewedDigest } = {}) {
  if (!snapshot || !allowedBookIds?.includes(snapshot.meta?.bookId)) return { status: 'BLOCKED', reasons: ['BOOK_NOT_AUTHORIZED'] };
  try {
    if (source(snapshot.meta, snapshot.pages).sourceHash !== snapshot.sourceHash || card.sourceHash !== snapshot.sourceHash) return { status: 'BLOCKED', reasons: ['SOURCE_CHANGED'] };
    if (typeof getReviewedDigest !== 'function' || getReviewedDigest(card.id) !== digest(card)) return { status: 'BLOCKED', reasons: ['REVIEW_REQUIRED'] };
    if (card.kind !== 'reviewed_reading' || card.scope !== 'book_view_only' || card.review?.method !== 'extracted_text_comparison' || !card.review?.reviewer || !card.review?.checkedAt) return { status: 'BLOCKED', reasons: ['READING_SCOPE_REQUIRED'] };
    const norm = t => typeof t === 'string' ? t.replace(/\s+/gu, '') : '';
    if (!Array.isArray(card.questions) || !card.questions.length || card.questions.length > 20 || card.questions.some(q => typeof q !== 'string' || q.length > 300)) return { status: 'BLOCKED', reasons: ['EXPLICIT_QUESTIONS_REQUIRED'] };
    if (!card.questions.some(q => norm(q) === norm(question))) return { status: 'NO_MATCH', reasons: ['QUESTION_OUTSIDE_REVIEWED_SCOPE'] };
    if (!Array.isArray(card.context) || !card.context.length || card.context.length > 32) return { status: 'BLOCKED', reasons: ['CONTEXT_REQUIRED'] };
    const quote = takeSpan(snapshot, card.answer);
    if (!card.context.some(e => e.pdfPage === card.answer.pdfPage && e.start <= card.answer.start && e.end >= card.answer.end)) return { status: 'BLOCKED', reasons: ['ANSWER_OUTSIDE_CONTEXT'] };
    const analysis = scan(quote);
    if (analysis.errors.length || analysis.flags.includes('question')) return { status: 'BLOCKED', reasons: ['ANSWER_NOT_ASSERTION'] };
    const evidence = card.context.map(e => {
      const text = takeSpan(snapshot, e);
      const p = snapshot.pages.find(p => p.pdfPage === e.pdfPage);
      if (['FRONT_MATTER', 'TABLE_OF_CONTENTS'].includes(classifyPage(p.text).role)) throw Error('NON_BODY_SOURCE');
      return { ...e, text };
    });
    return { status: 'REVIEWED_BOOK_PASSAGE', text: '本書原文（僅回答本書觀點）：\n' + quote,
      quote, evidence, citation: { bookId: snapshot.meta.bookId, title: snapshot.meta.title, edition: snapshot.meta.edition, pdfPage: card.answer.pdfPage },
      review: card.review, limitation: '核對對象是書籍服務所存文字，尚未比對原始PDF影像；不代表現行法查核或新案例判斷。', modelCalls: 0 };
  } catch { return { status: 'BLOCKED', reasons: ['INVALID_SOURCE_OR_REVIEW_CARD'] }; }
}
module.exports = { answerReadingCard };

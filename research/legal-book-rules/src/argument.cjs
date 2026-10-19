'use strict';
// Isolated Node CPU prototype. No automatic parsing-to-rule promotion.
const { createHash } = require('node:crypto');
const { scan } = require('./engine.cjs');
const sha = text => createHash('sha256').update(text, 'utf8').digest('hex');
const stable = value => {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  if (value === undefined || typeof value === 'function' || (typeof value === 'number' && !Number.isFinite(value))) throw Error('INVALID_SERIALIZABLE_DATA');
  return JSON.stringify(value);
};
const digest = value => sha(stable(value));
function source(meta, pages) {
  if (!meta || !['bookId', 'title', 'author', 'edition', 'jurisdiction', 'asOf'].every(k => typeof meta[k] === 'string' && meta[k].length && meta[k].length <= 500)) throw Error('SOURCE_METADATA_REQUIRED');
  if (!Array.isArray(pages) || !pages.length || pages.length > 64) throw Error('PAGE_LIMIT');
  const ids = new Set();
  const normalized = pages.map(p => {
    if (!Number.isInteger(p.pdfPage) || p.pdfPage < 1 || ids.has(p.pdfPage) || typeof p.text !== 'string' || !p.text.length || p.text.length > 64000) throw Error('INVALID_PAGE');
    ids.add(p.pdfPage);
    return { pdfPage: p.pdfPage, text: p.text, textHash: sha(p.text) };
  }).sort((a, b) => a.pdfPage - b.pdfPage);
  const data = { meta: { bookId: meta.bookId, title: meta.title, author: meta.author, edition: meta.edition, jurisdiction: meta.jurisdiction, asOf: meta.asOf }, pages: normalized };
  return { ...data, sourceHash: digest(data) };
}
function validateSource(s) {
  try { return s.sourceHash === source(s.meta, s.pages).sourceHash; } catch { return false; }
}
function takeSpan(s, span) {
  const p = s.pages.find(p => p.pdfPage === span.pdfPage);
  if (!p || !Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.end <= span.start || span.end > p.text.length) throw Error('INVALID_SOURCE_SPAN');
  const text = p.text.slice(span.start, span.end);
  if (text !== span.text) throw Error('SOURCE_SPAN_CHANGED');
  return text;
}
const values = new Set(['TRUE', 'FALSE', 'UNKNOWN']);
// No numeric comparisons or NLP guesses. Facts have to be explicit input.
function evaluate(expr, facts, depth = 0, budget = { remaining: 512 }) {
  if (!expr || depth > 12 || --budget.remaining < 0) throw Error('INVALID_EXPRESSION');
  const keys = Object.keys(expr).sort().join(',');
  if (keys === 'fact' && typeof expr.fact === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(expr.fact)) {
    const v = Object.hasOwn(facts, expr.fact) ? facts[expr.fact] : 'UNKNOWN';
    if (!values.has(v)) throw Error('INVALID_FACT_VALUE');
    return { value: v, missing: v === 'UNKNOWN' ? [expr.fact] : [] };
  }
  if (keys === 'not') { const r = evaluate(expr.not, facts, depth + 1, budget); return { value: r.value === 'TRUE' ? 'FALSE' : r.value === 'FALSE' ? 'TRUE' : 'UNKNOWN', missing: r.missing }; }
  const key = keys === 'all' ? 'all' : keys === 'any' ? 'any' : null;
  if (!key || !Array.isArray(expr[key]) || !expr[key].length || expr[key].length > 16) throw Error('INVALID_EXPRESSION');
  const rs = expr[key].map(e => evaluate(e, facts, depth + 1, budget));
  const vs = rs.map(r => r.value);
  const value = key === 'all' ? vs.includes('FALSE') ? 'FALSE' : vs.includes('UNKNOWN') ? 'UNKNOWN' : 'TRUE' : vs.includes('TRUE') ? 'TRUE' : vs.includes('UNKNOWN') ? 'UNKNOWN' : 'FALSE';
  return { value, missing: value === 'UNKNOWN' ? [...new Set(rs.flatMap(r => r.missing))] : [] };
}
function validateCard(card, s, getReviewedDigest) {
  const reasons = [];
  if (!validateSource(s)) return ['SOURCE_CHANGED'];
  if (!card || typeof card !== 'object') return ['CARD_REQUIRED'];
  // A field in a JSON card cannot approve itself. Registry belongs to trusted caller.
  if (typeof getReviewedDigest !== 'function' || getReviewedDigest(card.id) !== digest(card)) reasons.push('REVIEW_REQUIRED');
  if (card.sourceHash !== s.sourceHash) reasons.push('CARD_SOURCE_MISMATCH');
  if (card.direction !== 'sufficient') reasons.push('DIRECTION_NOT_SUPPORTED');
  if (!card.speaker || card.stance !== 'adopted' || card.contextComplete !== true || card.exceptionsComplete !== true || !card.scope) reasons.push('ARGUMENT_CONTEXT_UNRESOLVED');
  if (!card.conclusion || typeof card.conclusion.key !== 'string' || !card.conclusion.key || !['positive', 'negative'].includes(card.conclusion.polarity)) reasons.push('INVALID_CONCLUSION');
  if (!Array.isArray(card.evidence) || !card.evidence.length || card.evidence.length > 32) reasons.push('EVIDENCE_REQUIRED');
  else for (const e of card.evidence) {
    try { const text = takeSpan(s, e); if (scan(text).errors.length) reasons.push('BROKEN_EVIDENCE_TEXT'); } catch (e) { reasons.push(e.message); }
  }
  try {
    const text = takeSpan(s, card.conclusion.span);
    const a = scan(text);
    if (a.errors.length || a.flags.includes('question')) reasons.push('CONCLUSION_NOT_ASSERTION');
    if (!card.evidence?.some(e => e.pdfPage === card.conclusion.span.pdfPage && e.start <= card.conclusion.span.start && e.end >= card.conclusion.span.end)) reasons.push('CONCLUSION_OUTSIDE_EVIDENCE');
  } catch { reasons.push('CONCLUSION_SOURCE_REQUIRED'); }
  try { evaluate(card.when, {}); if (!Array.isArray(card.exceptions) || card.exceptions.length > 16) throw Error(); for (const e of card.exceptions) evaluate(e, {}); } catch { reasons.push('INVALID_EXPRESSION'); }
  return [...new Set(reasons)];
}
function applyCard(card, s, query, getReviewedDigest) {
  // Do not inspect or return private raw text until authorization is established.
  if (!query || query.allowed !== true) return { status: 'BLOCKED', reasons: ['BOOK_NOT_AUTHORIZED'] };
  let reasons;
  try { reasons = validateCard(card, s, getReviewedDigest); } catch { return { status: 'BLOCKED', reasons: ['INVALID_SOURCE_OR_CARD'] }; }
  if (reasons.length) return { status: 'BLOCKED', reasons };
  if ([s.meta.jurisdiction, s.meta.asOf, card.scope].some(v => typeof v !== 'string' || !v.trim() || /未核對|未核对|待核對|待核对|未標示|未标示|unknown|unresolved/iu.test(v))) reasons.push('UNRESOLVED_SOURCE_SCOPE');
  if (query.jurisdiction !== s.meta.jurisdiction || query.asOf !== s.meta.asOf || query.scope !== card.scope) reasons.push('SCOPE_MISMATCH');
  if (!query.facts || typeof query.facts !== 'object' || Array.isArray(query.facts)) reasons.push('FACTS_REQUIRED');
  if (reasons.length) return { status: 'BLOCKED', reasons };
  let premise, exceptions;
  try { premise = evaluate(card.when, query.facts); exceptions = card.exceptions.map(e => evaluate(e, query.facts)); } catch { return { status: 'BLOCKED', reasons: ['INVALID_FACT_VALUE'] }; }
  const trace = { cardId: card.id, ruleDigest: digest(card), sourceHash: s.sourceHash, premise, exceptions };
  if (exceptions.some(e => e.value === 'TRUE')) return { status: 'EXCEPTION_APPLIES', trace, conclusion: null };
  if (premise.value === 'FALSE') return { status: 'NOT_APPLICABLE', trace, conclusion: null };
  const missing = [...new Set([...premise.missing, ...exceptions.flatMap(e => e.missing)])];
  if (premise.value === 'UNKNOWN' || exceptions.some(e => e.value === 'UNKNOWN')) return { status: 'NEEDS_FACTS', missing, trace, conclusion: null };
  return { status: 'SUPPORTED_BY_REVIEWED_RULE', trace, conclusion: { key: card.conclusion.key, polarity: card.conclusion.polarity },
    quote: takeSpan(s, card.conclusion.span), citation: { ...s.meta, pdfPage: card.conclusion.span.pdfPage },
    evidence: card.evidence.map(e => ({ pdfPage: e.pdfPage, start: e.start, end: e.end, text: takeSpan(s, e) })), modelCalls: 0 };
}
function applyCards(cards, s, query, getReviewedDigest) {
  if (!Array.isArray(cards) || cards.length > 64) throw Error('CARD_LIMIT');
  const results = cards.map(c => applyCard(c, s, query, getReviewedDigest));
  const supported = results.filter(r => r.status === 'SUPPORTED_BY_REVIEWED_RULE');
  const seen = new Map();
  for (const r of supported) { const k = r.conclusion.key; if (!seen.has(k)) seen.set(k, new Set()); seen.get(k).add(r.conclusion.polarity); }
  return { status: [...seen.values()].some(s => s.size > 1) ? 'MULTIPLE_VIEWS' : supported.length ? 'SUPPORTED_BY_REVIEWED_RULE' : 'NO_SUPPORTED_CONCLUSION', results, modelCalls: 0 };
}
module.exports = { source, takeSpan, digest, evaluate, validateCard, applyCard, applyCards };

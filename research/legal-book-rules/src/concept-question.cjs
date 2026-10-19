'use strict';
const { source, digest, takeSpan } = require('./argument.cjs');
const { scan } = require('./engine.cjs');
// Bounded grammar over reviewed concepts, not a list of complete question aliases.
function parseQuestion(question, concepts) {
  if (typeof question !== 'string' || question.length > 500 || /[«»]/u.test(question)) return { status: 'UNSUPPORTED' };
  if (!Array.isArray(concepts) || !concepts.length || concepts.length > 32) return { status: 'UNSUPPORTED' };
  const aliases = new Map();
  for (const c of concepts) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(c.id) || !Array.isArray(c.aliases) || c.aliases.length > 20) return { status: 'UNSUPPORTED' };
    for (const a of c.aliases) {
      if (typeof a !== 'string' || a.length < 2 || a.length > 80 || /[«»]/u.test(a)) return { status: 'UNSUPPORTED' };
      if (aliases.has(a) && aliases.get(a) !== c.id) return { status: 'AMBIGUOUS' };
      aliases.set(a, c.id);
    }
  }
  if (!aliases.size) return { status: 'UNSUPPORTED' };
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp([...aliases.keys()].sort((a,b) => b.length-a.length).map(esc).join('|'), 'gu');
  // This copy is for question parsing only; evidence remains untouched.
  let t = question.replace(/\s+/gu, '').replace(/^(?:依本書|依本书|根據本書|根据本书)[，,]?/u, '').replace(/^(?:請|请)/u, '').replace(/[?？。!！]+$/u, '');
  t = t.replace(re, a => '«' + aliases.get(a) + '»');
  const atom = '«([A-Za-z][A-Za-z0-9_]{0,31})»';
  const join = '(?:與|与|和|跟|及)';
  const rules = [
    ['compare', false, false, '^' + atom + join + atom + '(?:是同一概念(?:嗎|吗)?|是否相同|是否一樣|是否一样|一樣嗎|一样吗|相同嗎|相同吗|有何差別|有何差别|有什麼差別|有什么差别|的區別是什麼|的区别是什么)$'],
    ['compare', false, false, '^(?:比較|比较)' + atom + join + atom + '$'],
    ['compare', false, false, '^' + atom + join + atom + '(?:的)?(?:區別|区别|差異|差异)$'],
    ['subset', false, false, '^' + atom + '(?:是不是|是否屬於|是否属于|屬於|属于)' + atom + '(?:的一部分|的一種|的一种)?(?:嗎|吗)?$'],
    ['subset', false, false, '^所有' + atom + '都(?:屬於|属于)' + atom + '(?:嗎|吗)?$'],
    ['subset', true, false, '^' + atom + '(?:是否)?(?:包含|包括)' + atom + '(?:嗎|吗)?$'],
    ['subset', true, true, '^' + atom + '(?:是否)?不(?:包含|包括)' + atom + '(?:[，,]?(?:對嗎|对吗))?$'],
    ['beyond', false, false, '^' + atom + '(?:是否)?(?:還|还)?(?:包含|包括)' + atom + '(?:以外|之外)(?:的)?(?:活動|活动|內容|内容|部分)(?:嗎|吗)?$']
  ];
  for (const [intent, reverse, negated, pattern] of rules) {
    const m = t.match(new RegExp(pattern, 'u'));
    if (m) return { status: 'PARSED', original: question, intent, left: reverse ? m[2] : m[1], right: reverse ? m[1] : m[2], negated };
  }
  return { status: 'UNSUPPORTED', original: question };
}
function answerConceptQuestion(question, graph, snapshot, { allowedBookIds, getReviewedDigest } = {}) {
  if (!snapshot || !allowedBookIds?.includes(snapshot.meta?.bookId)) return { status: 'BLOCKED', reasons: ['BOOK_NOT_AUTHORIZED'] };
  try {
    if (source(snapshot.meta, snapshot.pages).sourceHash !== snapshot.sourceHash || graph.sourceHash !== snapshot.sourceHash) return { status: 'BLOCKED', reasons: ['SOURCE_CHANGED'] };
    if (typeof getReviewedDigest !== 'function' || getReviewedDigest(graph.id) !== digest(graph)) return { status: 'BLOCKED', reasons: ['REVIEW_REQUIRED'] };
    if (graph.kind !== 'reviewed_concept_graph' || graph.scope !== 'book_view_only' || graph.review?.method !== 'extracted_text_comparison' || !graph.review.reviewer || !graph.review.checkedAt) throw Error('INVALID_REVIEW');
    if (!Array.isArray(graph.relations) || graph.relations.length > 64 || !Array.isArray(graph.concepts) || graph.concepts.length > 32) throw Error('LIMIT');
    const ids = new Set(graph.concepts.map(c => c.id));
    if (ids.size !== graph.concepts.length || graph.concepts.some(c => typeof c.label !== 'string' || c.label.length < 2 || c.label.length > 80)) throw Error('INVALID_CONCEPTS');
    const adjacency = new Map(graph.concepts.map(c => [c.id, []]));
    for (const r of graph.relations) {
      if (r.type !== 'proper_subset' || !ids.has(r.sub) || !ids.has(r.super) || r.sub === r.super || r.boundaryReviewed !== true || !Array.isArray(r.conditions) || r.conditions.length || !Array.isArray(r.exceptions) || r.exceptions.length || !Array.isArray(r.context) || !r.context.length || r.context.length > 32) throw Error('INVALID_RELATION');
      const quote = takeSpan(snapshot, r.evidence), a = scan(quote);
      if (a.errors.length || a.flags.includes('question')) throw Error('INVALID_ASSERTION');
      const compact = quote.replace(/\s+/gu, '');
      if (![r.sub, r.super].every(id => graph.concepts.find(c => c.id === id).aliases.some(name => compact.includes(name)))) throw Error('CONCEPT_NOT_IN_EVIDENCE');
      if (!r.context.some(e => e.pdfPage === r.evidence.pdfPage && e.start <= r.evidence.start && e.end >= r.evidence.end)) throw Error('MISSING_CONTEXT');
      r.context.forEach(e => takeSpan(snapshot, e));
      adjacency.get(r.sub).push(r.super);
    }
    const seen = new Set(), active = new Set();
    const visit = id => { if (active.has(id)) throw Error('CONCEPT_CYCLE'); if (seen.has(id)) return; active.add(id); for (const n of adjacency.get(id)) visit(n); active.delete(id); seen.add(id); };
    for (const id of ids) visit(id);
    const parsed = parseQuestion(question, graph.concepts);
    if (parsed.status !== 'PARSED') return { status: parsed.status, reasons: ['UNSUPPORTED_OR_AMBIGUOUS_GRAMMAR'] };
    const r = graph.relations.find(r => (r.sub === parsed.left && r.super === parsed.right) || (r.super === parsed.left && r.sub === parsed.right));
    if (!r) return { status: 'NEEDS_EVIDENCE', parsed };
    const sub = graph.concepts.find(c => c.id === r.sub).label, sup = graph.concepts.find(c => c.id === r.super).label;
    const relation = `${sub}屬於${sup}，但${sup}還包含${sub}以外的部分，因此兩者不相同。`;
    let holds = parsed.intent === 'compare' ? null : parsed.intent === 'subset' ? parsed.left === r.sub : parsed.left === r.super;
    if (parsed.negated) holds = !holds;
    const lead = parsed.intent === 'compare' ? '兩者不同。' : holds ? '是。' : '不是。';
    return { status: 'SUPPORTED_CONCEPT_RELATION', text: lead + '按本書的概念區分，' + relation,
      propositionHolds: holds, parsed, evidence: { ...r.evidence, text: takeSpan(snapshot, r.evidence) },
      citation: { title: snapshot.meta.title, edition: snapshot.meta.edition, pdfPage: r.evidence.pdfPage },
      derivation: { rule: 'REVIEWED_PROPER_SUBSET', sub: r.sub, super: r.super, questionNegated: parsed.negated },
      limitation: '僅運用已核對的書中概念關係；不作現行法查核或個案法律判斷。', modelCalls: 0 };
  } catch { return { status: 'BLOCKED', reasons: ['INVALID_OR_CONFLICTING_CONCEPT_GRAPH'] }; }
}
module.exports = { parseQuestion, answerConceptQuestion };

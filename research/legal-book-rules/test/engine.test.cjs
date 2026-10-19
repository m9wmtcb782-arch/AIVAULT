'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scan, screen, answer } = require('../src/engine.cjs');
// All passages are synthetic language fixtures, not statements of applicable law.
const query = { intent: 'locate_passage', terms: ['甲措施', '乙目的'], jurisdiction: 'SYNTHETIC', asOf: 'fixture-v1', scope: 'narrow' };
function fixture(text, overrides = {}) { return { text, meta: { bookId: 'fixture', title: '合成測試文本', edition: 'v1', pdfPage: 3, sourceHash: 'fixture-only', allowed: true, contextComplete: true, textVerified: true, jurisdiction: 'SYNTHETIC', asOf: 'fixture-v1', scope: 'narrow', ...overrides } }; }
test('preserve all symbols and source text', () => {
  const s = '甲措施：乙目的（10%／$100）！\n「甲？」'; assert.equal(scan(s).raw, s);
});
test('statement/question minimal pair', () => {
  assert.equal(screen(query, fixture('甲措施有助於乙目的。')).status, 'PASSAGE_ONLY');
  assert(screen(query, fixture('甲措施有助於乙目的？')).reasons.includes('QUESTION_IS_NOT_A_CONCLUSION'));
});
for (const q of ['甲措施有助於乙目的?', '甲措施是否有助於乙目的。', '難道甲措施無助於乙目的！']) test(`question/rhetoric unresolved: ${q}`, () => assert(screen(query, fixture(q)).reasons.includes('QUESTION_IS_NOT_A_CONCLUSION')));
test('quotation does not become author position', () => assert(screen(query, fixture('甲說：「甲措施有助於乙目的。」')).reasons.includes('SPEAKER_UNRESOLVED')));
test('attribution without quotation is unresolved', () => assert(screen(query, fixture('有學者認為甲措施有助於乙目的。')).reasons.includes('SPEAKER_UNRESOLVED')));
test('negation is kept, never inverted', () => { const r = answer(query, [fixture('甲措施無助於乙目的。')]); assert(r.text.includes('無助於')); assert.equal(r.generatedLegalConclusion, false); });
test('conditions and exceptions remain attached', () => { const s = '只有具備丙條件，甲措施始能達成乙目的；但丁情形除外。'; const a = scan(s); assert(a.flags.includes('condition')); assert(a.flags.includes('exception')); assert(answer(query, [fixture(s)]).text.includes(s)); });
test('AND and OR are never interchanged', () => { for (const c of ['且', '或']) { const s = `甲措施須具備丙${c}丁，以達成乙目的。`; assert(answer(query, [fixture(s)]).text.includes(s)); } });
test('double negation marked, not simplified', () => { const s = '不能認為甲措施並非無助於乙目的。'; assert(scan(s).flags.includes('negation')); assert.equal(scan(s).raw, s); });
for (const s of ['甲措施（乙目的。', '甲措施「乙目的。', '甲措施）乙目的。', '甲措施（乙目的]。']) test(`broken boundary: ${s}`, () => assert(scan(s).errors.length));
test('OCR replacement character blocked', () => assert(screen(query, fixture('甲措施�乙目的。')).reasons.includes('TEXT_CORRUPTION')));
test('cross-reference requires context', () => assert(screen(query, fixture('依前述，甲措施有助於乙目的。')).reasons.includes('REFERENCE_UNRESOLVED')));
for (const [key, value, reason] of [['allowed', false, 'BOOK_NOT_AUTHORIZED'], ['contextComplete', false, 'CONTEXT_INCOMPLETE'], ['textVerified', false, 'TEXT_NOT_VERIFIED'], ['jurisdiction', 'OTHER', 'JURISDICTION_UNRESOLVED'], ['asOf', 'old', 'TIME_SCOPE_UNRESOLVED'], ['scope', 'broad', 'CONCEPT_SCOPE_UNRESOLVED'], ['sourceHash', '', 'SOURCE_HASH_REQUIRED']]) test(`metadata gate: ${key}`, () => assert(screen(query, fixture('甲措施有助於乙目的。', { [key]: value })).reasons.includes(reason)));
test('keyword match cannot produce legal conclusion', () => { const r = screen(query, fixture('甲措施有助於乙目的。')); assert.equal(r.eligibleAsConclusion, false); });
test('case application is explicitly unavailable', () => assert(screen({ ...query, intent: 'apply_to_case' }, fixture('甲措施有助於乙目的。')).reasons.includes('APPLICATION_NOT_IMPLEMENTED')));
test('no excerpt from unchecked book in output or diagnostics', () => { const s = '甲措施有助於乙目的。'; const r = answer(query, [fixture(s, { allowed: false })]); assert.equal(r.status, 'NEEDS_CONTEXT'); assert(!JSON.stringify(r).includes(s)); });
test('resource limits', () => { assert.throws(() => scan('甲'.repeat(64001))); assert.throws(() => answer(query, Array(65))); });
test('network use is impossible in module execution path', () => { const old = global.fetch; global.fetch = () => { throw Error('network forbidden'); }; try { assert.equal(answer(query, [fixture('甲措施有助於乙目的。')]).modelCalls, 0); } finally { global.fetch = old; } });

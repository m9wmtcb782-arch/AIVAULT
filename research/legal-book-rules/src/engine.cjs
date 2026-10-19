'use strict';
// CPU-only candidate screening, v0.1. Flags are not semantic proofs.
// No network, model API, WebGPU, eval, or automatic legal conclusions.
const VERSION = '0.1.0';
const MAX_CHARS = 64000;
const MARKERS = [
  ['question', /[?？]|是否|能否|何以|為何|为何|難道|难道|豈|岂/u],
  ['quotation', /[「」『』“”"‘’]/u],
  ['attribution', /有學者|有学者|學說|学说|通說|通说|判決|判决|法院|某說|某说|認為|认为|主張|主张|指出|表示/u],
  ['negation', /不|未|無|无|非|否|禁止|不得/u],
  ['condition', /如果|若|只要|只有|僅當|仅当|限於|限于|始得|始能|必須|必须|除非|前提/u],
  ['exception', /但|然而|不過|不过|例外|除外|除非|原則上|原则上/u],
  ['definition_scope', /廣義|广义|狹義|狭义|包括|包含|不包括|不包含|係指|系指|所謂|所谓/u],
  ['logical_link', /以及|並且|并且|而且|或者|或|且|及|因此|所以|故|因為|因为|由於|由于/u],
  ['modality', /應|应|得|可以|可能|必然|推定|視為|视为/u],
  ['cross_reference', /前述|上述|下述|見前|见前|參見|参见|同上|前項|前项|後述|后述/u],
  ['numeric_or_symbol', /[0-9０-９%％$＄@＠/／≤≥<>≦≧=＝−－-]/u],
  ['parenthetical', /[（()）【】\[\]]/u],
  ['emphasis', /[!！]/u]
];
function scan(text) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  if (text.length > MAX_CHARS) throw new RangeError('passage exceeds CPU work limit');
  const pairs = new Map([['（', '）'], ['(', ')'], ['「', '」'], ['『', '』'], ['“', '”'], ['‘', '’'], ['【', '】'], ['[', ']']]);
  const closers = new Set(pairs.values()), stack = [], errors = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (pairs.has(c)) stack.push({ close: pairs.get(c), offset: i });
    else if (closers.has(c)) {
      if (!stack.length || stack[stack.length - 1].close !== c) errors.push({ code: 'UNBALANCED_DELIMITER', offset: i });
      else stack.pop();
    }
  }
  for (const item of stack) errors.push({ code: 'UNCLOSED_DELIMITER', offset: item.offset });
  if ((text.match(/"/g) || []).length % 2) errors.push({ code: 'UNCLOSED_ASCII_QUOTE' });
  if (/\uFFFD/u.test(text)) errors.push({ code: 'TEXT_CORRUPTION' });
  const flags = MARKERS.filter(([, re]) => re.test(text)).map(([name]) => name);
  // Preserve every character, including punctuation and whitespace. Offsets use JS UTF-16.
  return { version: VERSION, raw: text, start: 0, end: text.length, offsetUnit: 'UTF-16', flags, errors,
    role: flags.includes('question') ? 'QUESTION_OR_RHETORIC_UNRESOLVED' : 'UNVERIFIED_PASSAGE',
    eligibleAsConclusion: false };
}
function screen(query, passage) {
  const reasons = [], meta = passage && passage.meta || {};
  // Authorization precedes parsing and diagnostics: never return unselected text.
  if (meta.allowed !== true) return { status: 'NEEDS_CONTEXT', reasons: ['BOOK_NOT_AUTHORIZED'], eligibleAsConclusion: false };
  const analysis = scan(passage && passage.text || '');
  if (!query || !Array.isArray(query.terms) || !query.terms.length || query.terms.length > 12 || query.terms.some(t => typeof t !== 'string' || t.length < 2 || t.length > 80)) reasons.push('EXPLICIT_TERMS_REQUIRED');
  if (query && query.intent !== 'locate_passage') reasons.push('APPLICATION_NOT_IMPLEMENTED');
  if (!meta.bookId || !meta.title || !meta.edition || !Number.isInteger(meta.pdfPage) || meta.pdfPage < 1) reasons.push('SOURCE_METADATA_REQUIRED');
  if (!meta.sourceHash) reasons.push('SOURCE_HASH_REQUIRED');
  if (meta.allowed !== true) reasons.push('BOOK_NOT_AUTHORIZED');
  if (meta.contextComplete !== true) reasons.push('CONTEXT_INCOMPLETE');
  if (meta.textVerified !== true) reasons.push('TEXT_NOT_VERIFIED');
  if (!query || !query.jurisdiction || query.jurisdiction !== meta.jurisdiction) reasons.push('JURISDICTION_UNRESOLVED');
  if (!query || !query.asOf || query.asOf !== meta.asOf) reasons.push('TIME_SCOPE_UNRESOLVED');
  if (!query || !query.scope || query.scope !== meta.scope) reasons.push('CONCEPT_SCOPE_UNRESOLVED');
  if (query && Array.isArray(query.terms) && !query.terms.every(t => typeof t === 'string' && analysis.raw.includes(t))) reasons.push('TERMS_NOT_ALL_PRESENT');
  for (const e of analysis.errors) reasons.push(e.code);
  if (analysis.flags.includes('question')) reasons.push('QUESTION_IS_NOT_A_CONCLUSION');
  if (analysis.flags.includes('quotation') || analysis.flags.includes('attribution')) reasons.push('SPEAKER_UNRESOLVED');
  if (analysis.flags.includes('cross_reference')) reasons.push('REFERENCE_UNRESOLVED');
  return { status: reasons.length ? 'NEEDS_CONTEXT' : 'PASSAGE_ONLY', reasons: [...new Set(reasons)], analysis,
    citation: { bookId: meta.bookId, title: meta.title, edition: meta.edition, pdfPage: meta.pdfPage, sourceHash: meta.sourceHash },
    eligibleAsConclusion: false };
}
function answer(query, passages) {
  if (!Array.isArray(passages) || passages.length > 64) throw new RangeError('expected at most 64 passages');
  const results = passages.map(p => screen(query, p));
  const accepted = results.filter(r => r.status === 'PASSAGE_ONLY');
  // Whole blocks only: no keyword deletion, sentence splicing, or connective insertion.
  return { version: VERSION, status: accepted.length ? 'PASSAGE_ONLY' : 'NEEDS_CONTEXT',
    text: accepted.length ? '找到相關書中段落；以下是原文，尚未判定為本題結論。\n' + accepted.map(r => `《${r.citation.title}》${r.citation.edition}，PDF第${r.citation.pdfPage}頁：\n${r.analysis.raw}`).join('\n\n') : '目前不足以形成答案；需補齊語意、來源或適用範圍。',
    results, modelCalls: 0, generatedLegalConclusion: false };
}
module.exports = { VERSION, scan, screen, answer };

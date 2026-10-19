'use strict';
const { scan } = require('./engine.cjs');
const { source } = require('./argument.cjs');
function draftCards(acquired) {
  if (acquired?.status !== 'DRAFT_SOURCE' || !acquired.snapshot) return { status: 'BLOCKED', drafts: [], reasons: ['SOURCE_REQUIRED'] };
  const s = acquired.snapshot;
  if (source(s.meta, s.pages).sourceHash !== s.sourceHash) return { status: 'BLOCKED', drafts: [], reasons: ['SOURCE_CHANGED'] };
  // No whitespace normalization or inserted page separators in the analysis copy.
  const pages = [...s.pages].sort((a, b) => a.pdfPage - b.pdfPage);
  for (let i = 1; i < pages.length; i++) if (pages[i].pdfPage !== pages[i - 1].pdfPage + 1) return { status: 'BLOCKED', drafts: [], reasons: ['NONCONTIGUOUS_PAGES'] };
  const ranges = []; let joined = '';
  for (const p of pages) { ranges.push({ page: p.pdfPage, start: joined.length, end: joined.length + p.text.length }); joined += p.text; }
  const evidenceFor = (start, end) => ranges.filter(r => r.end > start && r.start < end).map(r => {
    const a = Math.max(start, r.start), b = Math.min(end, r.end);
    return { pdfPage: r.page, start: a - r.start, end: b - r.start, text: joined.slice(a, b) };
  });
  const open = new Map([['（', '）'], ['(', ')'], ['「', '」'], ['『', '』'], ['“', '”'], ['‘', '’'], ['【', '】'], ['[', ']']]);
  const close = new Set(open.values()), stack = []; let asciiQuote = false, start = 0;
  const units = [];
  for (let i = 0; i < joined.length; i++) {
    const c = joined[i];
    if (c === '"') asciiQuote = !asciiQuote;
    if (!asciiQuote) {
      if (open.has(c)) stack.push(open.get(c));
      else if (close.has(c) && stack[stack.length - 1] === c) stack.pop();
    }
    // A decimal dot, colon, slash or semicolon is never an automatic sentence boundary.
    if (!asciiQuote && !stack.length && /[。！？!?]/u.test(c)) { units.push({ start, end: i + 1 }); start = i + 1; }
  }
  if (start < joined.length) units.push({ start, end: joined.length });
  // Hard cap: do not silently present a truncated batch as complete.
  if (units.length > 512) return { status: 'NEEDS_SMALLER_WINDOW', drafts: [], reasons: ['DRAFT_LIMIT'] };
  const drafts = [];
  for (const u of units) {
    const raw = joined.slice(u.start, u.end); if (!raw.trim()) continue;
    if (raw.length > 64000) return { status: 'NEEDS_SMALLER_WINDOW', drafts: [], reasons: ['UNIT_TOO_LONG'] };
    const a = scan(raw), roles = [];
    if (a.flags.includes('question')) roles.push('question_or_rhetoric');
    if (a.flags.includes('attribution') || a.flags.includes('quotation')) roles.push('speaker_needs_review');
    if (a.flags.includes('condition')) roles.push('condition_candidate');
    if (a.flags.includes('exception')) roles.push('exception_candidate');
    if (a.flags.includes('definition_scope')) roles.push('definition_scope_candidate');
    if (/因此|所以|從而|从而|可見|可见|故|結論|结论/u.test(raw)) roles.push('conclusion_candidate');
    const evidence = evidenceFor(u.start, u.end);
    // Adjacency is context only, never a supports/opposes relation.
    const ctxStart = Math.max(0, units[Math.max(0, units.indexOf(u) - 1)].start);
    const ctxEnd = units[Math.min(units.length - 1, units.indexOf(u) + 1)].end;
    drafts.push({ id: 'draft-' + s.sourceHash.slice(0, 12) + '-' + u.start, status: 'UNREVIEWED', sourceHash: s.sourceHash,
      raw, roles: roles.length ? roles : ['unclassified'], flags: a.flags, errors: a.errors, evidence,
      adjacentContext: evidenceFor(ctxStart, ctxEnd), crossesPageBoundary: evidence.length > 1,
      speaker: null, stance: null, when: null, exceptions: null, conclusion: null,
      contextComplete: false, textVerified: false, eligibleAsConclusion: false });
  }
  return { status: 'DRAFTS_ONLY', sourceHash: s.sourceHash, sourceMeta: s.meta, drafts, modelCalls: 0,
    note: '候選角色只是字面線索；未建立條件到結論關係，不能直接交給規則作答。' };
}
module.exports = { draftCards };

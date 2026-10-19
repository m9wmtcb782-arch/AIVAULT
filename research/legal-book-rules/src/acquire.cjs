'use strict';
const { source } = require('./argument.cjs');
// read is an injected, authenticated transport for existing read-only actions.
// Never accepts credentials; never creates, modifies, or indexes remote data.
async function acquire({ bookId, from, to, allowedBookIds, read, signal }) {
  if (!Array.isArray(allowedBookIds) || !allowedBookIds.includes(bookId)) return { status: 'BLOCKED', reasons: ['BOOK_NOT_AUTHORIZED'] };
  if (typeof read !== 'function' || !Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to - from >= 21) return { status: 'BLOCKED', reasons: ['INVALID_WINDOW'] };
  const checkAbort = () => { if (signal?.aborted) throw Error('ABORTED'); };
  let listing, response;
  try {
    checkAbort(); listing = await read({ action: 'list', limit: 100 }, { signal }); checkAbort();
    if (!listing || listing.error || listing.ok === false || listing.__http >= 400) throw Error('BOOK_LIST_FAILED');
    const book = (listing.books || listing.items || []).find(b => String(b.id || b.ebook_id) === bookId);
    if (!book) return { status: 'BLOCKED', reasons: ['BOOK_NOT_READABLE'] };
    if (!Number.isInteger(book.total_pages) || book.total_pages < to) return { status: 'BLOCKED', reasons: ['PAGE_OUT_OF_RANGE'] };
    const center = Math.floor((from + to) / 2), radius = Math.max(center - from, to - center);
    response = await read({ action: 'context', ebook_id: bookId, page_number: center, radius }, { signal }); checkAbort();
    if (!response || response.error || response.ok === false || response.__http >= 400 || !Array.isArray(response.pages)) throw Error('PAGE_READ_FAILED');
    const byPage = new Map(), reasons = [];
    for (const p of response.pages) {
      if (p.page_number < from || p.page_number > to) continue;
      if (p.ebook_id !== bookId || !Number.isInteger(p.page_number) || byPage.has(p.page_number) || typeof p.content !== 'string' || !p.content.length || p.content.length > 64000) return { status: 'BLOCKED', reasons: ['INVALID_PAGE_RESPONSE'] };
      byPage.set(p.page_number, { pdfPage: p.page_number, text: p.content });
    }
    const missingPages = []; for (let n = from; n <= to; n++) if (!byPage.has(n)) missingPages.push(n);
    if (missingPages.length) return { status: 'NEEDS_CONTEXT', reasons: ['MISSING_PAGES'], missingPages };
    // Missing bibliographic information stays explicit; do not invent author/edition/law date.
    const rawMeta = { bookId, title: book.title, author: book.author, edition: book.edition, jurisdiction: book.metadata?.jurisdiction, asOf: book.metadata?.as_of };
    for (const k of ['title', 'author', 'edition', 'jurisdiction', 'asOf']) if (typeof rawMeta[k] !== 'string' || !rawMeta[k].trim()) reasons.push('UNRESOLVED_' + k.toUpperCase());
    const meta = Object.fromEntries(Object.entries(rawMeta).map(([k, v]) => [k, typeof v === 'string' && v.trim() ? v : '未標示：待核對']));
    const snapshot = source(meta, [...byPage.values()]);
    return { status: 'DRAFT_SOURCE', snapshot, requested: { from, to }, receivedPages: byPage.size, totalPages: book.total_pages,
      reasons, metadataComplete: !reasons.length, contextComplete: false, textVerified: false,
      boundaryNote: '只確認指定頁窗取得完整；未確認章節論證、跨窗接續、OCR或法規時間。', modelCalls: 0 };
  } catch (e) { return { status: signal?.aborted || e.message === 'ABORTED' ? 'CANCELLED' : 'READ_FAILED', reasons: [signal?.aborted ? 'ABORTED' : e.message === 'BOOK_LIST_FAILED' ? 'BOOK_LIST_FAILED' : e.message === 'PAGE_READ_FAILED' ? 'PAGE_READ_FAILED' : 'READ_OR_VALIDATION_FAILED'] }; }
}
module.exports = { acquire };

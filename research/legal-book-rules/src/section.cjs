'use strict';
// Classification concerns document function, not legal truth or source authority.
function classifyPage(text) {
  if (typeof text !== 'string') throw Error('TEXT_REQUIRED');
  const head = text.split(/\r?\n/u).map(x => x.trim()).filter(Boolean).slice(0, 3).join(' ');
  const heading = head.slice(0, 100);
  const front = /^(?:第[一二三四五六七八九十0-9]+版(?:說明|说明|序言|前言)|(?:修訂|修订|再版|新版|編者|编者)?(?:說明|说明|序言|前言|後記|后记|序)|內容簡介|内容简介|作者簡介|作者简介|出版說明|出版说明|Abstract\b|Preface\b|Foreword\b)/iu;
  if (front.test(heading)) return { role: 'FRONT_MATTER', reason: 'EXPLICIT_FRONT_MATTER_HEADING' };
  if (/^(?:目\s*[錄录次]|[簡简細细]目|Contents\b|(?:Table|Summary) of Contents\b)/iu.test(heading)) return { role: 'TABLE_OF_CONTENTS', reason: 'EXPLICIT_CONTENTS_HEADING' };
  const leaderLines = text.split(/\r?\n/u).filter(line => /(?:[.．·…]{4,}|[—─]{4,})/u.test(line) && /[（(]\s*[0-9lI ]+\s*[）)]/u.test(line));
  if (leaderLines.length >= 2) return { role: 'TABLE_OF_CONTENTS', reason: 'REPEATED_CONTENTS_LEADERS' };
  if (/^(?:第[一二三四五六七八九十百0-9]+[編编章節节]|Chapter\s+\d+)/iu.test(heading)) return { role: 'BODY_CANDIDATE', reason: 'CHAPTER_HEADING_ONLY' };
  return { role: 'UNKNOWN', reason: 'NO_RELIABLE_SECTION_HEADING' };
}
async function locateChapter({ bookId, allowedBookIds, title, read, signal }) {
  if (!allowedBookIds?.includes(bookId)) return { status: 'BLOCKED', reasons: ['BOOK_NOT_AUTHORIZED'] };
  if (typeof title !== 'string' || title.length < 2 || title.length > 100 || typeof read !== 'function') return { status: 'BLOCKED', reasons: ['EXPLICIT_CHAPTER_TITLE_REQUIRED'] };
  try {
    if (signal?.aborted) return { status: 'CANCELLED' };
    const r = await read({ action: 'toc', ebook_id: bookId }, { signal });
    if (signal?.aborted) return { status: 'CANCELLED' };
    if (r?.error || r?.ok === false || r?.__http >= 400) return { status: 'READ_FAILED' };
    const rows = r?.toc || r?.items;
    if (!Array.isArray(rows) || rows.length > 10000) return { status: 'READ_FAILED' };
    const matches = rows.filter(x => typeof x.title === 'string' && x.title.includes(title) && Number.isInteger(x.page_number) && x.page_number > 0).map(x => ({ title: x.title, pdfPage: x.page_number, level: x.level }));
    // Some existing records store the TOC's source page, not the chapter target.
    const suspicious = matches.some(m => /[.．·…]{4,}/u.test(m.title) || rows.filter(x => x.page_number === m.pdfPage).length >= 3);
    return { status: suspicious ? 'NEEDS_PAGE_VERIFICATION' : matches.length === 1 ? 'LOCATED' : matches.length ? 'AMBIGUOUS' : 'NO_MATCH', matches,
      ...(suspicious ? { reasons: ['TOC_MAY_POINT_TO_CONTENTS_PAGE'] } : {}) };
  } catch { return { status: signal?.aborted ? 'CANCELLED' : 'READ_FAILED' }; }
}
module.exports = { classifyPage, locateChapter };

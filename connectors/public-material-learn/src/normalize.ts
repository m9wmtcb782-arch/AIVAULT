import type { MaterialListItem, NormalizedQuery } from './types.js';

const EXT_RE = /\.(pdf|pptx?|docx?)$/i;

/** Strip common lecture prefixes for matching (keep substance). */
const PREFIX_RE = /^(參考資料[：:]\s*|附件[：:\d\-]*\s*|講義[：:]\s*)/i;

export function decodeNameParam(raw: string): string {
  let s = raw.trim();
  try {
    s = decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    /* keep raw */
  }
  // If full URL slipped in, pull name=
  const m = s.match(/[?&]name=([^&]+)/i);
  if (m) {
    try {
      s = decodeURIComponent(m[1].replace(/\+/g, ' '));
    } catch {
      s = m[1];
    }
  }
  return s;
}

export function normalizeTitle(input: string): string {
  let s = input.normalize('NFKC').trim();
  s = s.replace(EXT_RE, '');
  s = s.replace(PREFIX_RE, '');
  // fullwidth space etc. already NFKC; collapse whitespace / _ / -
  s = s.replace(/[_\-－—–]+/g, ' ');
  s = s.replace(/[\s\u3000]+/g, ' ').trim();
  // drop light punctuation noise but keep CJK and alnum
  s = s.replace(/[【】\[\]（）()《》〈〉「」『』、，。；：:：！!？?·•]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  return s;
}

export function tokenize(normalized: string): string[] {
  if (!normalized) return [];
  // Split on spaces; also emit overlapping CJK bigrams for short titles
  const parts = normalized.split(' ').filter(Boolean);
  const tokens = new Set<string>(parts);
  const joined = parts.join('');
  if (/[\u4e00-\u9fff]/.test(joined) && joined.length >= 2) {
    for (let i = 0; i < joined.length - 1; i++) {
      tokens.add(joined.slice(i, i + 2));
    }
  }
  return [...tokens];
}

export function resolveRawTitle(item: MaterialListItem): string {
  if (item.humanLock && item.humanChosenUrl) {
    // title still from filename fields
  }
  const fromName = item.tronclassNameParam
    ? decodeNameParam(item.tronclassNameParam)
    : '';
  return (item.fileName || fromName || item.courseTitle || '').trim();
}

export function toNormalizedQuery(item: MaterialListItem): NormalizedQuery {
  const rawTitle = resolveRawTitle(item);
  const normalizedTitle = normalizeTitle(rawTitle);
  return {
    rawTitle,
    normalizedTitle,
    tokens: tokenize(normalizedTitle),
    hints: [...(item.hints ?? [])].map((h) => h.normalize('NFKC').toLowerCase()),
    courseTitle: item.courseTitle,
  };
}

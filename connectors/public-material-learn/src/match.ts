import { normalizeTitle, tokenize, toNormalizedQuery } from './normalize.js';
import type {
  MatchCandidate,
  MatchResult,
  MatchThresholds,
  MatchWeights,
  MaterialListItem,
  PublicCatalogEntry,
} from './types.js';

export const DEFAULT_WEIGHTS: MatchWeights = {
  exactNormalizedTitle: 0.55,
  tokenOverlap: 0.25,
  keywordHit: 0.15,
  fingerprintBonus: 0.05,
};

export const DEFAULT_THRESHOLDS: MatchThresholds = {
  autoAcceptThreshold: 0.82,
  reviewThreshold: 0.55,
};

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function containment(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return shorter / longer;
  }
  return 0;
}

export function scoreAgainstEntry(
  item: MaterialListItem,
  entry: PublicCatalogEntry,
  weights: MatchWeights = DEFAULT_WEIGHTS,
): MatchCandidate {
  const q = toNormalizedQuery(item);
  const entryNorm = entry.normalizedTitle || normalizeTitle(entry.title);
  const entryTokens = tokenize(entryNorm);
  const reasons: string[] = [];
  let score = 0;

  if (q.normalizedTitle && q.normalizedTitle === entryNorm) {
    score += weights.exactNormalizedTitle;
    reasons.push('exact_normalized_title');
  } else {
    const c = containment(q.normalizedTitle, entryNorm);
    if (c >= 0.85) {
      score += weights.exactNormalizedTitle * c;
      reasons.push(`title_containment:${c.toFixed(2)}`);
    }
  }

  const jac = jaccard(q.tokens, entryTokens);
  if (jac > 0) {
    score += weights.tokenOverlap * jac;
    reasons.push(`token_jaccard:${jac.toFixed(2)}`);
  }

  const hay = `${entry.title} ${entry.keywords.join(' ')} ${entry.agency ?? ''}`.toLowerCase();
  let hits = 0;
  for (const h of q.hints) {
    if (h && hay.includes(h.toLowerCase())) hits++;
  }
  // also check query tokens against keywords
  for (const t of q.tokens) {
    if (t.length >= 2 && entry.keywords.some((k) => k.includes(t) || t.includes(k))) {
      hits++;
    }
  }
  if (hits > 0) {
    const kw = Math.min(1, hits / 3);
    score += weights.keywordHit * kw;
    reasons.push(`keyword_hits:${hits}`);
  }

  if (item.sha256 && entry.sha256 && item.sha256 === entry.sha256) {
    score += Math.max(weights.fingerprintBonus, 0.2);
    reasons.push('sha256_equal');
  } else if (
    item.pageCount &&
    entry.pageCount &&
    item.pageCount === entry.pageCount &&
    item.abstractFingerprint &&
    entry.abstractFingerprint &&
    item.abstractFingerprint === entry.abstractFingerprint
  ) {
    score += weights.fingerprintBonus;
    reasons.push('page_abstract_fingerprint');
  }

  score = Math.min(1, score);
  return { entry, score, reasons };
}

export function matchMaterial(
  item: MaterialListItem,
  catalog: PublicCatalogEntry[],
  thresholds: MatchThresholds = DEFAULT_THRESHOLDS,
  weights: MatchWeights = DEFAULT_WEIGHTS,
): MatchResult {
  const query = toNormalizedQuery(item);

  if (item.humanLock && item.humanChosenUrl) {
    const locked = catalog.find((e) => e.url === item.humanChosenUrl);
    if (locked) {
      const cand: MatchCandidate = {
        entry: locked,
        score: 1,
        reasons: ['human_lock'],
      };
      return {
        query,
        best: cand,
        candidates: [cand],
        decision: 'human_locked',
      };
    }
  }

  const candidates = catalog
    .map((e) => scoreAgainstEntry(item, e, weights))
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  let decision: MatchResult['decision'] = 'no_match';
  if (best && best.score >= thresholds.autoAcceptThreshold) decision = 'auto_accept';
  else if (best && best.score >= thresholds.reviewThreshold) decision = 'pending_review';

  return { query, best, candidates, decision };
}

import type { MatchCandidate, MatchResult, MatchThresholds, MatchWeights, MaterialListItem, PublicCatalogEntry } from './types.js';
export declare const DEFAULT_WEIGHTS: MatchWeights;
export declare const DEFAULT_THRESHOLDS: MatchThresholds;
export declare function scoreAgainstEntry(item: MaterialListItem, entry: PublicCatalogEntry, weights?: MatchWeights): MatchCandidate;
export declare function matchMaterial(item: MaterialListItem, catalog: PublicCatalogEntry[], thresholds?: MatchThresholds, weights?: MatchWeights): MatchResult;

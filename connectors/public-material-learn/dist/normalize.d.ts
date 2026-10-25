import type { MaterialListItem, NormalizedQuery } from './types.js';
export declare function decodeNameParam(raw: string): string;
export declare function normalizeTitle(input: string): string;
export declare function tokenize(normalized: string): string[];
export declare function resolveRawTitle(item: MaterialListItem): string;
export declare function toNormalizedQuery(item: MaterialListItem): NormalizedQuery;

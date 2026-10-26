import type { MaterialProvenance, PublicCatalogEntry } from './types.js';
export declare function buildPublicProvenance(opts: {
    entry?: PublicCatalogEntry;
    url?: string;
    matchScore?: number;
    matchReasons?: string[];
    retrievedAt?: string;
}): MaterialProvenance;
export declare function assertPublicNotTronclassE2e(p: MaterialProvenance): void;

import { type AllowlistConfig } from './registry.js';
import type { FetchResult, PublicCatalogEntry } from './types.js';
export type FetchImpl = (url: string) => Promise<{
    ok: boolean;
    status: number;
    body: Uint8Array;
}>;
export declare function sha256Hex(bytes: Uint8Array): string;
export declare class PublicMaterialFetcher {
    private readonly allowlist;
    private readonly fetchImpl?;
    constructor(allowlist?: AllowlistConfig, fetchImpl?: FetchImpl | undefined);
    /** Offline: no HTTP */
    fromBytes(entry: PublicCatalogEntry, bytes: Uint8Array, matchScore?: number, matchReasons?: string[]): FetchResult;
    fetch(entry: PublicCatalogEntry, matchScore?: number, matchReasons?: string[]): Promise<FetchResult>;
}

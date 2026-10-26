import type { PublicCatalogEntry } from './types.js';
export interface AllowlistConfig {
    allowlistDomains: string[];
    allowlistDomainSuffixes: string[];
    blockedHosts: string[];
}
export declare const DEFAULT_ALLOWLIST: AllowlistConfig;
export declare function isUrlAllowed(url: string, cfg?: AllowlistConfig): boolean;
export declare class PublicSourceRegistry {
    private readonly allowlist;
    private entries;
    constructor(allowlist?: AllowlistConfig);
    getAllowlist(): AllowlistConfig;
    list(): PublicCatalogEntry[];
    register(entry: Omit<PublicCatalogEntry, 'normalizedTitle'> & {
        normalizedTitle?: string;
    }): void;
    registerMany(entries: Array<Omit<PublicCatalogEntry, 'normalizedTitle'> & {
        normalizedTitle?: string;
    }>): void;
}
/** Built-in offline catalog: 中藥材／食安公開稿（與先前衛福部匯入同源類型） */
export declare function builtinMohwCatalog(): Array<Omit<PublicCatalogEntry, 'normalizedTitle'> & {
    normalizedTitle?: string;
}>;

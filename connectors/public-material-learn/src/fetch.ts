import { createHash } from 'node:crypto';
import { isUrlAllowed, type AllowlistConfig, DEFAULT_ALLOWLIST } from './registry.js';
import { buildPublicProvenance, assertPublicNotTronclassE2e } from './provenance.js';
import type { FetchResult, PublicCatalogEntry } from './types.js';

export type FetchImpl = (
  url: string,
) => Promise<{ ok: boolean; status: number; body: Uint8Array }>;

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export class PublicMaterialFetcher {
  constructor(
    private readonly allowlist: AllowlistConfig = DEFAULT_ALLOWLIST,
    private readonly fetchImpl?: FetchImpl,
  ) {}

  /** Offline: no HTTP */
  fromBytes(entry: PublicCatalogEntry, bytes: Uint8Array, matchScore?: number, matchReasons?: string[]): FetchResult {
    const provenance = buildPublicProvenance({
      entry,
      url: entry.url,
      matchScore,
      matchReasons,
    });
    assertPublicNotTronclassE2e(provenance);
    return {
      ok: true,
      bytes,
      sha256: sha256Hex(bytes),
      url: entry.url,
      provenance,
      tronclassE2eSuccess: false,
      publicSourceSuccess: true,
    };
  }

  async fetch(
    entry: PublicCatalogEntry,
    matchScore?: number,
    matchReasons?: string[],
  ): Promise<FetchResult> {
    if (!isUrlAllowed(entry.url, this.allowlist)) {
      return {
        ok: false,
        provenance: buildPublicProvenance({ entry, matchScore, matchReasons }),
        tronclassE2eSuccess: false,
        publicSourceSuccess: false,
        error: 'URL 不在 allowlist 或屬 TronClass／tcmedia 封鎖',
      };
    }
    if (/tcmedia\.scu\.edu\.tw|tronclass\.scu\.edu\.tw/i.test(entry.url)) {
      return {
        ok: false,
        provenance: buildPublicProvenance({ entry }),
        tronclassE2eSuccess: false,
        publicSourceSuccess: false,
        error: '拒絕：不得抓取 TronClass／tcmedia URL',
      };
    }
    if (!this.fetchImpl) {
      return {
        ok: false,
        provenance: buildPublicProvenance({ entry, matchScore, matchReasons }),
        tronclassE2eSuccess: false,
        publicSourceSuccess: false,
        error: '無 fetchImpl（離線 scaffold 預設不發網；測試請用 fromBytes）',
      };
    }
    try {
      const res = await this.fetchImpl(entry.url);
      if (!res.ok) {
        return {
          ok: false,
          provenance: buildPublicProvenance({ entry, matchScore, matchReasons }),
          tronclassE2eSuccess: false,
          publicSourceSuccess: false,
          error: `HTTP ${res.status}`,
        };
      }
      const provenance = buildPublicProvenance({
        entry,
        url: entry.url,
        matchScore,
        matchReasons,
      });
      assertPublicNotTronclassE2e(provenance);
      return {
        ok: true,
        bytes: res.body,
        sha256: sha256Hex(res.body),
        url: entry.url,
        provenance,
        tronclassE2eSuccess: false,
        publicSourceSuccess: true,
      };
    } catch (err) {
      return {
        ok: false,
        provenance: buildPublicProvenance({ entry, matchScore, matchReasons }),
        tronclassE2eSuccess: false,
        publicSourceSuccess: false,
        error: (err as Error).message,
      };
    }
  }
}

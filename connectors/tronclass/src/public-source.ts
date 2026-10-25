/**
 * PublicSourceAdapter — SEPARATE from TronClassClient.
 *
 * Retrieves openly published documents (e.g. MOHW PDFs).
 * Success here MUST NEVER be reported as TronClass E2E success.
 *
 * Offline/unit mode: inject fetchImpl; default fetch is for future use only
 * and is NOT called by TronClass sync paths.
 */

import { sha256Hex } from './dedup.js';
import { buildPublicSourceProvenance, assertNotTronClassE2e } from './provenance.js';
import type { MaterialProvenance, StoredFileRecord, SyncRunResult } from './types.js';

export interface PublicSourceRequest {
  label: string;
  /** Public HTTPS URL — never a TronClass signed download URL */
  url: string;
  fileName: string;
}

export interface PublicSourceFetchResult {
  ok: boolean;
  bytes?: Uint8Array;
  sha256?: string;
  provenance: MaterialProvenance;
  /** Always false — public channel ≠ TronClass E2E */
  tronclassE2eSuccess: false;
  publicSourceSuccess: boolean;
  error?: string;
}

export type FetchImpl = (
  url: string,
) => Promise<{ ok: boolean; status: number; body: Uint8Array }>;

export class PublicSourceAdapter {
  constructor(private readonly fetchImpl?: FetchImpl) {}

  /**
   * Offline mock: provide bytes directly without HTTP.
   */
  fromBytes(label: string, fileName: string, bytes: Uint8Array): PublicSourceFetchResult {
    const sha = sha256Hex(bytes);
    const provenance = buildPublicSourceProvenance({ label, urlHint: `offline://${fileName}` });
    const result: PublicSourceFetchResult = {
      ok: true,
      bytes,
      sha256: sha,
      provenance,
      tronclassE2eSuccess: false,
      publicSourceSuccess: true,
    };
    return result;
  }

  async fetch(req: PublicSourceRequest): Promise<PublicSourceFetchResult> {
    if (/tcmedia\.scu\.edu\.tw|tronclass\.scu\.edu\.tw/i.test(req.url)) {
      return {
        ok: false,
        provenance: buildPublicSourceProvenance({ label: req.label }),
        tronclassE2eSuccess: false,
        publicSourceSuccess: false,
        error: '拒絕：PublicSourceAdapter 不得抓取 TronClass／tcmedia URL',
      };
    }
    if (!this.fetchImpl) {
      return {
        ok: false,
        provenance: buildPublicSourceProvenance({ label: req.label, urlHint: req.url }),
        tronclassE2eSuccess: false,
        publicSourceSuccess: false,
        error: 'PublicSourceAdapter: 無 fetchImpl（離線 scaffold 預設不發網）',
      };
    }
    try {
      const res = await this.fetchImpl(req.url);
      if (!res.ok) {
        return {
          ok: false,
          provenance: buildPublicSourceProvenance({ label: req.label, urlHint: req.url }),
          tronclassE2eSuccess: false,
          publicSourceSuccess: false,
          error: `HTTP ${res.status}`,
        };
      }
      const sha = sha256Hex(res.body);
      return {
        ok: true,
        bytes: res.body,
        sha256: sha,
        provenance: buildPublicSourceProvenance({ label: req.label, urlHint: req.url }),
        tronclassE2eSuccess: false,
        publicSourceSuccess: true,
      };
    } catch (err) {
      return {
        ok: false,
        provenance: buildPublicSourceProvenance({ label: req.label, urlHint: req.url }),
        tronclassE2eSuccess: false,
        publicSourceSuccess: false,
        error: (err as Error).message,
      };
    }
  }

  /** Build a SyncRunResult that cannot claim TronClass E2E. */
  toSyncRunResult(fetchResult: PublicSourceFetchResult): SyncRunResult {
    return {
      ok: fetchResult.ok,
      storedCount: fetchResult.ok ? 1 : 0,
      skippedDedup: 0,
      errors: fetchResult.error ? [fetchResult.error] : [],
      tronclassE2eSuccess: false,
      publicSourceSuccess: fetchResult.publicSourceSuccess,
      stopped: false,
      sessionInvalid: false,
    };
  }

  /** Guard used by tests / callers after storing a public file. */
  guardStoredRecord(record: StoredFileRecord): void {
    assertNotTronClassE2e(record);
    if (record.provenance?.source !== 'public_source') {
      throw new Error('PublicSourceAdapter stored record must have source=public_source');
    }
  }
}

/** Type-level separation marker — never subclass TronClassClient. */
export const PUBLIC_SOURCE_ADAPTER_KIND = 'public_source_adapter' as const;
export const TRONCLASS_CLIENT_KIND = 'tronclass_client' as const;

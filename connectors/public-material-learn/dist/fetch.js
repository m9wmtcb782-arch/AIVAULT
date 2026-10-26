import { createHash } from 'node:crypto';
import { isUrlAllowed, DEFAULT_ALLOWLIST } from './registry.js';
import { buildPublicProvenance, assertPublicNotTronclassE2e } from './provenance.js';
export function sha256Hex(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}
export class PublicMaterialFetcher {
    allowlist;
    fetchImpl;
    constructor(allowlist = DEFAULT_ALLOWLIST, fetchImpl) {
        this.allowlist = allowlist;
        this.fetchImpl = fetchImpl;
    }
    /** Offline: no HTTP */
    fromBytes(entry, bytes, matchScore, matchReasons) {
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
    async fetch(entry, matchScore, matchReasons) {
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
        }
        catch (err) {
            return {
                ok: false,
                provenance: buildPublicProvenance({ entry, matchScore, matchReasons }),
                tronclassE2eSuccess: false,
                publicSourceSuccess: false,
                error: err.message,
            };
        }
    }
}

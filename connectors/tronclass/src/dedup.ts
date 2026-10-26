import { createHash } from 'node:crypto';
import type { DedupKey, StoredFileRecord } from './types.js';

/** SHA-256 hex digest of raw bytes. */
export function sha256Hex(data: Uint8Array | Buffer | string): string {
  const buf =
    typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
  return createHash('sha256').update(buf).digest('hex');
}

/** Build composite dedup identity: fileId + updatedAt + sha256. */
export function buildDedupKey(
  fileId: string,
  updatedAt: string,
  sha256: string,
): DedupKey {
  return { fileId, updatedAt, sha256 };
}

export function dedupKeyString(key: DedupKey): string {
  return `${key.fileId}|${key.updatedAt}|${key.sha256}`;
}

/**
 * Return true if an equivalent record already exists (same fileId+updatedAt+sha256).
 */
export function isDuplicate(
  candidate: DedupKey,
  existing: Iterable<StoredFileRecord | DedupKey>,
): boolean {
  const target = dedupKeyString(candidate);
  for (const row of existing) {
    const key = buildDedupKey(row.fileId, row.updatedAt, row.sha256);
    if (dedupKeyString(key) === target) return true;
  }
  return false;
}

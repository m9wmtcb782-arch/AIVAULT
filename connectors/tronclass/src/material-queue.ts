/**
 * Incremental material queue with fileId + updatedAt + SHA-256 dedup.
 * Offline-safe: no network.
 */

import { buildDedupKey, isDuplicate, sha256Hex } from './dedup.js';
import type { DedupKey, MaterialMeta, StoredFileRecord } from './types.js';

export type QueueItemStatus = 'pending' | 'skipped_dedup' | 'stored' | 'failed' | 'stopped';

export interface QueueItem {
  meta: MaterialMeta;
  status: QueueItemStatus;
  sha256?: string;
  error?: string;
  attempts: number;
}

export interface MaterialQueueOptions {
  maxRetries?: number;
}

/**
 * Build an ordered work queue from material list, marking items already in index as skipped.
 * SHA is unknown until download — first-pass dedup uses fileId+updatedAt against index;
 * after download, full fileId+updatedAt+sha256 dedup applies.
 */
export class MaterialQueue {
  readonly items: QueueItem[] = [];
  #maxRetries: number;

  constructor(opts: MaterialQueueOptions = {}) {
    this.#maxRetries = opts.maxRetries ?? 3;
  }

  enqueueAll(materials: MaterialMeta[]): void {
    for (const meta of materials) {
      this.items.push({ meta, status: 'pending', attempts: 0 });
    }
  }

  /** Pre-mark items whose fileId+updatedAt already match an indexed record (before bytes). */
  applySoftDedup(existing: Iterable<StoredFileRecord>): void {
    const soft = new Set(
      [...existing].map((r) => `${r.fileId}|${r.updatedAt}`),
    );
    for (const item of this.items) {
      if (item.status !== 'pending') continue;
      if (soft.has(`${item.meta.fileId}|${item.meta.updatedAt}`)) {
        item.status = 'skipped_dedup';
      }
    }
  }

  /** Hard dedup after bytes known. */
  shouldSkipAfterHash(
    meta: MaterialMeta,
    sha256: string,
    existing: Iterable<StoredFileRecord | DedupKey>,
  ): boolean {
    const key = buildDedupKey(meta.fileId, meta.updatedAt, sha256);
    return isDuplicate(key, existing);
  }

  pending(): QueueItem[] {
    return this.items.filter((i) => i.status === 'pending');
  }

  markStored(item: QueueItem, sha256: string): void {
    item.status = 'stored';
    item.sha256 = sha256;
  }

  markFailed(item: QueueItem, error: string): boolean {
    item.attempts += 1;
    item.error = error;
    if (item.attempts >= this.#maxRetries) {
      item.status = 'failed';
      return false; // no more retries
    }
    item.status = 'pending';
    return true; // retry later
  }

  markStopped(): void {
    for (const item of this.items) {
      if (item.status === 'pending') item.status = 'stopped';
    }
  }

  summary(): { pending: number; stored: number; skipped: number; failed: number; stopped: number } {
    const c = { pending: 0, stored: 0, skipped: 0, failed: 0, stopped: 0 };
    for (const i of this.items) {
      if (i.status === 'pending') c.pending++;
      else if (i.status === 'stored') c.stored++;
      else if (i.status === 'skipped_dedup') c.skipped++;
      else if (i.status === 'failed') c.failed++;
      else if (i.status === 'stopped') c.stopped++;
    }
    return c;
  }
}

export { sha256Hex, buildDedupKey, isDuplicate };

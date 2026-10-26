/**
 * Sync control surface: stopSync, revokeAuth, retry helpers, error log.
 */

import type { AuthProvider } from './auth.js';
import type { SyncLogEntry } from './types.js';

export interface SyncControls {
  stop(): void;
  isStopped(): boolean;
}

export function createSyncControls(): SyncControls {
  let stopped = false;
  return {
    stop: () => {
      stopped = true;
    },
    isStopped: () => stopped,
  };
}

export class ErrorLog {
  #entries: SyncLogEntry[] = [];

  get entries(): readonly SyncLogEntry[] {
    return this.#entries;
  }

  push(
    level: SyncLogEntry['level'],
    message: string,
    extra?: Partial<SyncLogEntry>,
  ): void {
    this.#entries.push({
      at: new Date().toISOString(),
      level,
      message,
      ...extra,
    });
  }

  errors(): SyncLogEntry[] {
    return this.#entries.filter((e) => e.level === 'error');
  }

  clear(): void {
    this.#entries = [];
  }
}

/** stopSync — cooperative cancel flag. */
export function stopSync(controls: SyncControls): void {
  controls.stop();
}

/** revokeAuth — drop opaque session; does not touch TronClass server state. */
export async function revokeAuth(auth: AuthProvider): Promise<void> {
  await auth.revoke();
}

/**
 * retry — exponential-ish backoff wrapper for offline/unit use.
 * sleepMs may be stubbed to 0 in tests.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: {
    maxRetries: number;
    backoffMs: number;
    sleepMs?: (ms: number) => Promise<void>;
    shouldRetry?: (err: unknown, attempt: number) => boolean;
    onAttemptError?: (err: unknown, attempt: number) => void;
  },
): Promise<T> {
  const sleep =
    opts.sleepMs ??
    ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const shouldRetry = opts.shouldRetry ?? (() => true);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      opts.onAttemptError?.(err, attempt);
      if (attempt >= opts.maxRetries || !shouldRetry(err, attempt)) break;
      await sleep(opts.backoffMs * attempt);
    }
  }
  throw lastErr;
}

/**
 * Event stubs: Dark Star KB notify + ebook shelf classify enqueue.
 * Isolation: no import of Dark Star core / dark-star-ebook.html.
 * Classify failures must NEVER roll back or block private storage.
 */

import type { DarkStarNotifyEvent, MaterialMeta, StoredFileRecord } from './types.ts';

export type NotifyHandler = (event: DarkStarNotifyEvent) => void | Promise<void>;

/** Payload aligned with feat/ebook-shelf-dual-classify-v1 enqueueClassify(materialMeta). */
export interface MaterialStoredEvent {
  type: 'tronclass.material.stored';
  materialMeta: MaterialMeta;
  stored: StoredFileRecord;
}

export type ClassifyEnqueueHandler = (
  materialMeta: MaterialMeta,
  stored: StoredFileRecord,
) => void | Promise<void>;

const handlers: NotifyHandler[] = [];
const classifyHandlers: ClassifyEnqueueHandler[] = [];

export function onDarkStarNotify(handler: NotifyHandler): void {
  handlers.push(handler);
}

export async function notifyDarkStarIndexed(event: DarkStarNotifyEvent): Promise<void> {
  for (const h of handlers) {
    await h(event);
  }
}

export async function stubNotifyConsole(event: DarkStarNotifyEvent): Promise<void> {
  console.info('[tronclass-notify:stub]', JSON.stringify(event));
}

/** Register dual-classify consumer (other branch owns UI / classifier). */
export function onMaterialStored(handler: ClassifyEnqueueHandler): void {
  classifyHandlers.push(handler);
}

/**
 * Hook: onMaterialStored → enqueueClassify(materialMeta).
 * Errors are swallowed/logged — storage already committed; never rethrow to sync.
 */
export async function enqueueClassify(
  materialMeta: MaterialMeta,
  stored: StoredFileRecord,
): Promise<void> {
  for (const h of classifyHandlers) {
    try {
      await h(materialMeta, stored);
    } catch (err) {
      console.warn(
        '[tronclass-classify:stub] enqueueClassify failed (non-blocking):',
        (err as Error).message,
      );
    }
  }
  if (classifyHandlers.length === 0) {
    console.info('[tronclass-classify:stub] enqueueClassify', {
      type: 'tronclass.material.stored',
      fileId: materialMeta.fileId,
      courseCode: materialMeta.courseCode,
      fileName: materialMeta.fileName,
      privatePath: stored.privatePath,
    });
  }
}

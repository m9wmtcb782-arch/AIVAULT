/**
 * Sync pipeline: discoverCourses → diff → provision → sync materials.
 *
 * Goal: auto-sync course materials only (read-only).
 * Gated: no live TronClass I/O until schoolAuthorizationConfirmed.
 * Dynamic courses: never a permanent fixed five-course list.
 * Offline tests inject MockTronClassClient — never claim that as real E2E.
 */

import { filterByAllowlist } from './allowlist.js';
import {
  SchoolAuthGateError,
  SessionInvalidError,
  type AuthProvider,
  type AuthSessionProvider,
} from './auth.js';
import type { TronClassClient } from './client.js';
import {
  createSyncControls,
  ErrorLog,
  revokeAuth,
  stopSync,
  withRetry,
  type SyncControls,
} from './controls.js';
import { buildDedupKey, isDuplicate, sha256Hex } from './dedup.js';
import { MaterialQueue } from './material-queue.js';
import { enqueueClassify, notifyDarkStarIndexed } from './notify.js';
import { buildTronClassProvenance } from './provenance.js';
import type { PrivateStorage } from './storage.js';
import type {
  ConnectorConfig,
  CourseDiff,
  CourseRecord,
  DiscoveredCourse,
  MaterialMeta,
  StoredFileRecord,
  SyncLogEntry,
  SyncRunResult,
} from './types.js';

export interface CourseRepository {
  listKnown(): Promise<CourseRecord[]>;
  upsert(course: CourseRecord): Promise<void>;
  /** Historical courses remain; do not delete materials on inactivity */
  markInactive?(courseId: string): Promise<void>;
}

export { createSyncControls, stopSync, revokeAuth, withRetry };
export type { SyncControls };

export function courseIdentityKey(
  c: Pick<DiscoveredCourse, 'academicYear' | 'semester' | 'courseCode' | 'courseId'>,
): string {
  return `${c.academicYear}|${c.semester}|${c.courseCode}|${c.courseId}`;
}

/** Diff discovered platform courses against DB records (by year/term/code/id). */
export function diffCourses(
  discovered: DiscoveredCourse[],
  known: CourseRecord[],
): CourseDiff {
  const knownMap = new Map(known.map((k) => [courseIdentityKey(k), k]));
  const seen = new Set<string>();
  const added: DiscoveredCourse[] = [];
  const unchanged: DiscoveredCourse[] = [];
  for (const d of discovered) {
    const key = courseIdentityKey(d);
    seen.add(key);
    if (knownMap.has(key)) unchanged.push(d);
    else added.push(d);
  }
  const removedOrInactive = known.filter((k) => !seen.has(courseIdentityKey(k)));
  return { added, unchanged, removedOrInactive };
}

export class SyncEngine {
  #errors = new ErrorLog();
  #controls = createSyncControls();

  constructor(
    private readonly config: ConnectorConfig,
    private readonly auth: AuthProvider,
    private readonly client: TronClassClient,
    private readonly storage: PrivateStorage,
    private readonly courses: CourseRepository,
  ) {}

  get syncLog(): readonly SyncLogEntry[] {
    return this.#errors.entries;
  }

  stop(): void {
    stopSync(this.#controls);
    this.#errors.push('info', '同步已停止（stop flag）');
  }

  async revokeAuthorization(): Promise<void> {
    await revokeAuth(this.auth);
    this.#errors.push('info', '已撤銷授權 session（本地 opaque ref）');
  }

  private log(
    level: SyncLogEntry['level'],
    message: string,
    extra?: Partial<SyncLogEntry>,
  ): void {
    this.#errors.push(level, message, extra);
  }

  private assertGate(): void {
    if (!this.config.schoolAuthorizationConfirmed) {
      throw new SchoolAuthGateError(
        '學校授權未確認：禁止背景同步／discover／download',
      );
    }
    if (this.config.courseDiscovery?.fixedCourseListForbidden === false) {
      throw new Error('設定錯誤：禁止關閉 fixedCourseListForbidden');
    }
  }

  private async assertSession(): Promise<void> {
    const probe = this.auth as AuthSessionProvider;
    if (typeof probe.isSessionValid === 'function') {
      const ok = await probe.isSessionValid();
      if (!ok) {
        throw new SessionInvalidError(
          '授權 session 失效 — 已暫停同步，請於東吳 TronClass 官方頁重新登入後再 handoff',
        );
      }
    } else if (!this.auth.hasSession()) {
      throw new SessionInvalidError('無有效授權 session');
    }
  }

  /** Step 1 — fetch latest course list via school-allowed auth interface. */
  async discoverCourses(): Promise<DiscoveredCourse[]> {
    this.assertGate();
    await this.assertSession();
    const list = await this.client.listCourses();
    this.log('info', `發現 ${list.length} 門課程（動態）`);
    return list;
  }

  /** Step 2 — compare with DB by academicYear, semester, courseCode (+ courseId). */
  async diffWithDb(discovered: DiscoveredCourse[]): Promise<CourseDiff> {
    const known = await this.courses.listKnown();
    const diff = diffCourses(discovered, known);
    this.log(
      'info',
      `diff: added=${diff.added.length} unchanged=${diff.unchanged.length} inactive=${diff.removedOrInactive.length}`,
    );
    return diff;
  }

  /** Step 3 — auto-create course record, private dirs, search index slot. */
  async provisionNewCourses(added: DiscoveredCourse[]): Promise<CourseRecord[]> {
    this.assertGate();
    const out: CourseRecord[] = [];
    for (const d of added) {
      if (this.#controls.isStopped()) break;
      if (!d.accessAuthorized) {
        this.log('warn', '新課程尚未取得合法存取授權，暫不 provision', {
          courseId: d.courseId,
          courseCode: d.courseCode,
        });
        continue;
      }
      const record: CourseRecord = {
        ...d,
        provisionedAt: new Date().toISOString(),
        privateStoragePath: '',
        indexId: `idx_${d.academicYear}_${d.semester}_${d.courseCode}_${d.courseId}`,
        syncEnabled: true,
      };
      record.privateStoragePath = await this.storage.provisionCourseDirs(record);
      await this.courses.upsert(record);
      out.push(record);
      this.log('info', '已建立課程紀錄與私人目錄', {
        courseId: d.courseId,
        courseCode: d.courseCode,
      });
    }
    return out;
  }

  /**
   * Step 4 — sync materials for provisioned+authorized courses.
   * Allowlist PDF/PPT/PPTX/DOC/DOCX; dedup fileId+mtime+SHA-256; retain history.
   */
  async syncCourseMaterials(course: CourseRecord): Promise<StoredFileRecord[]> {
    this.assertGate();
    await this.assertSession();
    if (!course.syncEnabled) return [];
    const stored: StoredFileRecord[] = [];
    let materials: MaterialMeta[];
    try {
      materials = await withRetry(
        () => this.client.listMaterials(course.courseId),
        {
          maxRetries: this.config.maxRetries,
          backoffMs: this.config.retryBackoffMs,
          sleepMs: async () => undefined,
          onAttemptError: (err, attempt) => {
            this.log('warn', `列出教材重試 ${attempt}: ${(err as Error).message}`, {
              courseId: course.courseId,
              attempt,
            });
          },
        },
      );
    } catch (err) {
      if (err instanceof SessionInvalidError) {
        const probe = this.auth as AuthSessionProvider;
        if (typeof probe.markInvalid === 'function') {
          await probe.markInvalid(err.message);
        }
      }
      this.log('error', `列出教材失敗：${(err as Error).message}`, {
        courseId: course.courseId,
        courseCode: course.courseCode,
      });
      throw err;
    }
    const allowed = filterByAllowlist(materials, this.config.allowlistExtensions).filter(
      (m) => m.downloadAllowed,
    );
    const existing = await this.storage.readIndex(course);
    const queue = new MaterialQueue({ maxRetries: this.config.maxRetries });
    queue.enqueueAll(allowed);
    queue.applySoftDedup(existing);

    for (const item of queue.pending()) {
      if (this.#controls.isStopped()) {
        queue.markStopped();
        break;
      }
      const meta = item.meta;
      try {
        const bytes = await withRetry(
          () => this.client.downloadMaterial(meta),
          {
            maxRetries: this.config.maxRetries,
            backoffMs: this.config.retryBackoffMs,
            sleepMs: async () => undefined,
            onAttemptError: (err, attempt) => {
              this.log('warn', `下載重試 ${attempt}: ${(err as Error).message}`, {
                courseId: course.courseId,
                fileId: meta.fileId,
                attempt,
              });
            },
          },
        );
        const sha = sha256Hex(bytes);
        const key = buildDedupKey(meta.fileId, meta.updatedAt, sha);
        if (isDuplicate(key, existing) || queue.shouldSkipAfterHash(meta, sha, existing)) {
          item.status = 'skipped_dedup';
          item.sha256 = sha;
          this.log('info', '去重略過（已下載）', {
            courseId: course.courseId,
            fileId: meta.fileId,
          });
          continue;
        }
        const provenance = buildTronClassProvenance(meta);
        const record = await this.storage.storeMaterial(meta, bytes, sha, provenance);
        queue.markStored(item, sha);
        stored.push(record);
        existing.push(record);
        // Dual-classify hook (feat/ebook-shelf-dual-classify-v1): never blocks/rolls back storage
        await enqueueClassify(meta, record);
        if (this.config.darkStarNotify.enabled) {
          try {
            await notifyDarkStarIndexed({
              type: 'tronclass.materials.indexed',
              academicYear: meta.academicYear,
              semester: meta.semester,
              courseId: meta.courseId,
              courseCode: meta.courseCode,
              fileId: meta.fileId,
              sha256: sha,
              privatePath: record.privatePath,
              sourceLabel: `TronClass ${meta.academicYear}-${meta.semester} ${meta.courseCode}`,
            });
          } catch (notifyErr) {
            this.log('warn', `暗星通知失敗（不回滾儲存）：${(notifyErr as Error).message}`, {
              courseId: course.courseId,
              fileId: meta.fileId,
            });
          }
        }
      } catch (err) {
        if (err instanceof SessionInvalidError) {
          const probe = this.auth as AuthSessionProvider;
          if (typeof probe.markInvalid === 'function') {
            await probe.markInvalid(err.message);
          }
          queue.markStopped();
          this.log('error', `session 失效，暫停同步：${err.message}`, {
            courseId: course.courseId,
            fileId: meta.fileId,
          });
          break;
        }
        const retrying = queue.markFailed(item, (err as Error).message);
        this.log('error', `下載／儲存失敗：${(err as Error).message}`, {
          courseId: course.courseId,
          fileId: meta.fileId,
        });
        void retrying;
      }
    }
    return stored;
  }

  /** Full poll cycle — for gated background scheduler only. Offline mock OK; live = BLOCKED. */
  async runOnce(): Promise<SyncRunResult> {
    const result: SyncRunResult = {
      ok: false,
      storedCount: 0,
      skippedDedup: 0,
      errors: [],
      tronclassE2eSuccess: false, // NEVER flipped by mock / public source
      publicSourceSuccess: false,
      stopped: false,
      sessionInvalid: false,
    };
    try {
      this.assertGate();
      await this.assertSession();
    } catch (err) {
      result.errors.push((err as Error).message);
      if (err instanceof SessionInvalidError) result.sessionInvalid = true;
      return result;
    }
    try {
      const discovered = await this.discoverCourses();
      const diff = await this.diffWithDb(discovered);
      await this.provisionNewCourses(diff.added);
      const known = await this.courses.listKnown();
      for (const course of known) {
        if (this.#controls.isStopped()) {
          result.stopped = true;
          break;
        }
        if (!course.syncEnabled || !course.accessAuthorized) continue;
        const stored = await this.syncCourseMaterials(course);
        result.storedCount += stored.length;
      }
      result.ok = result.errors.length === 0 && !result.sessionInvalid;
      result.stopped = this.#controls.isStopped();
      // Collect error messages from log
      for (const e of this.#errors.errors()) {
        result.errors.push(e.message);
      }
      // Explicit: offline mock success is NOT TronClass E2E
      result.tronclassE2eSuccess = false;
      return result;
    } catch (err) {
      result.errors.push((err as Error).message);
      if (err instanceof SessionInvalidError) result.sessionInvalid = true;
      result.tronclassE2eSuccess = false;
      return result;
    }
  }
}

/** In-memory course repo for offline tests. */
export class MemoryCourseRepository implements CourseRepository {
  #map = new Map<string, CourseRecord>();

  async listKnown(): Promise<CourseRecord[]> {
    return [...this.#map.values()];
  }

  async upsert(course: CourseRecord): Promise<void> {
    this.#map.set(courseIdentityKey(course), course);
  }
}

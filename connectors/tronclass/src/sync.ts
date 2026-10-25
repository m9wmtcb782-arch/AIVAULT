/**
 * Sync pipeline (scaffold): discoverCourses → diff → provision → sync materials.
 *
 * Goal: auto-sync course materials only (read-only).
 * Gated: no live TronClass I/O until schoolAuthorizationConfirmed.
 * Dynamic courses: never a permanent fixed five-course list.
 */

import { filterByAllowlist } from './allowlist.ts';
import { SchoolAuthGateError, type AuthProvider } from './auth.ts';
import type { TronClassClient } from './client.ts';
import { buildDedupKey, isDuplicate, sha256Hex } from './dedup.ts';
import { enqueueClassify, notifyDarkStarIndexed } from './notify.ts';
import type { PrivateStorage } from './storage.ts';
import type {
  ConnectorConfig,
  CourseDiff,
  CourseRecord,
  DiscoveredCourse,
  MaterialMeta,
  StoredFileRecord,
  SyncLogEntry,
} from './types.ts';

export interface CourseRepository {
  listKnown(): Promise<CourseRecord[]>;
  upsert(course: CourseRecord): Promise<void>;
  /** Historical courses remain; do not delete materials on inactivity */
  markInactive?(courseId: string): Promise<void>;
}

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

export function courseIdentityKey(c: Pick<DiscoveredCourse, 'academicYear' | 'semester' | 'courseCode' | 'courseId'>): string {
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
  #log: SyncLogEntry[] = [];
  #controls = createSyncControls();

  constructor(
    private readonly config: ConnectorConfig,
    private readonly auth: AuthProvider,
    private readonly client: TronClassClient,
    private readonly storage: PrivateStorage,
    private readonly courses: CourseRepository,
  ) {}

  get syncLog(): readonly SyncLogEntry[] {
    return this.#log;
  }

  stop(): void {
    this.#controls.stop();
    this.log('info', '同步已停止（stop flag）');
  }

  private log(
    level: SyncLogEntry['level'],
    message: string,
    extra?: Partial<SyncLogEntry>,
  ): void {
    this.#log.push({
      at: new Date().toISOString(),
      level,
      message,
      ...extra,
    });
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

  /** Step 1 — fetch latest course list via school-allowed auth interface. */
  async discoverCourses(): Promise<DiscoveredCourse[]> {
    this.assertGate();
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
    if (!course.syncEnabled) return [];
    const stored: StoredFileRecord[] = [];
    let materials: MaterialMeta[];
    try {
      materials = await this.client.listMaterials(course.courseId);
    } catch (err) {
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
    for (const meta of allowed) {
      if (this.#controls.isStopped()) break;
      try {
        const bytes = await this.client.downloadMaterial(meta);
        const sha = sha256Hex(bytes);
        const key = buildDedupKey(meta.fileId, meta.updatedAt, sha);
        if (isDuplicate(key, existing)) {
          this.log('info', '去重略過（已下載）', {
            courseId: course.courseId,
            fileId: meta.fileId,
          });
          continue;
        }
        const record = await this.storage.storeMaterial(meta, bytes, sha);
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
        this.log('error', `下載／儲存失敗：${(err as Error).message}`, {
          courseId: course.courseId,
          fileId: meta.fileId,
        });
      }
    }
    return stored;
  }

  /** Full poll cycle — for gated background scheduler only. */
  async runOnce(): Promise<void> {
    this.assertGate();
    const discovered = await this.discoverCourses();
    const diff = await this.diffWithDb(discovered);
    await this.provisionNewCourses(diff.added);
    const known = await this.courses.listKnown();
    for (const course of known) {
      if (this.#controls.isStopped()) break;
      if (!course.syncEnabled || !course.accessAuthorized) continue;
      await this.syncCourseMaterials(course);
    }
  }
}

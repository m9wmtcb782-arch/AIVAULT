/**
 * Private storage layout by academicYear / semester / courseCode (or course name slug).
 * NEVER write under GitHub Pages / public site trees.
 */

import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import type { ConnectorConfig, CourseRecord, MaterialMeta, StoredFileRecord } from './types.ts';

const PUBLIC_FORBIDDEN = [
  'docs/',
  '.github/pages',
  'gh-pages',
  'aivault-home',
  'dark-star-ebook.html',
];

export function courseStorageDir(
  root: string,
  academicYear: string,
  semester: string,
  courseCode: string,
): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, '_');
  return path.join(root, safe(academicYear), safe(semester), safe(courseCode));
}

export class PrivateStorage {
  constructor(private readonly config: ConnectorConfig) {
    this.assertPrivateRoot(config.privateStorageRoot);
  }

  private assertPrivateRoot(root: string): void {
    const norm = root.replace(/\\/g, '/').toLowerCase();
    for (const bad of PUBLIC_FORBIDDEN) {
      if (norm.includes(bad.toLowerCase())) {
        throw new Error(`拒絕公開路徑作為私人儲存：${root}`);
      }
    }
    if (!root.includes('private') && !root.includes('aivault-private')) {
      // Soft convention: prefer names that signal non-public
      console.warn(
        '[tronclass-storage] privateStorageRoot 建議含 private 字樣，且不得部署至 GitHub Pages',
      );
    }
  }

  pathForCourse(course: Pick<CourseRecord, 'academicYear' | 'semester' | 'courseCode'>): string {
    return courseStorageDir(
      this.config.privateStorageRoot,
      course.academicYear,
      course.semester,
      course.courseCode,
    );
  }

  async provisionCourseDirs(course: CourseRecord): Promise<string> {
    const dir = this.pathForCourse(course);
    await mkdir(dir, { recursive: true });
    await mkdir(path.join(dir, 'raw'), { recursive: true });
    await mkdir(path.join(dir, 'meta'), { recursive: true });
    return dir;
  }

  /**
   * Write raw bytes under course-isolated path. Does not overwrite other courses' trees.
   * Historical materials retained: writes use fileId+sha prefix; never wipe sibling courses.
   */
  async storeMaterial(
    meta: MaterialMeta,
    bytes: Uint8Array,
    sha256: string,
  ): Promise<StoredFileRecord> {
    const dir = courseStorageDir(
      this.config.privateStorageRoot,
      meta.academicYear,
      meta.semester,
      meta.courseCode,
    );
    await mkdir(path.join(dir, 'raw'), { recursive: true });
    const safeName = meta.fileName.replace(/[/\\]/g, '_');
    const privatePath = path.join(dir, 'raw', `${meta.fileId}_${sha256.slice(0, 12)}_${safeName}`);
    await writeFile(privatePath, bytes);
    const record: StoredFileRecord = {
      courseId: meta.courseId,
      courseCode: meta.courseCode,
      academicYear: meta.academicYear,
      semester: meta.semester,
      fileId: meta.fileId,
      fileName: meta.fileName,
      updatedAt: meta.updatedAt,
      sha256,
      privatePath,
      storedAt: new Date().toISOString(),
    };
    await writeFile(
      path.join(dir, 'meta', `${meta.fileId}.json`),
      JSON.stringify(record, null, 2),
      'utf8',
    );
    return record;
  }

  async readIndex(course: CourseRecord): Promise<StoredFileRecord[]> {
    const dir = path.join(this.pathForCourse(course), 'meta');
    try {
      await access(dir);
    } catch {
      return [];
    }
    // Scaffold: index listing left to future FS walk; return empty for now
    void readFile;
    return [];
  }
}

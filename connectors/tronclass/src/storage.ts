/**
 * Private storage layout by academicYear / semester / courseCode (or course name slug).
 * NEVER write under GitHub Pages / public site trees.
 */

import { mkdir, writeFile, readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { buildTronClassProvenance } from './provenance.js';
import type {
  ConnectorConfig,
  CourseRecord,
  MaterialMeta,
  MaterialProvenance,
  StoredFileRecord,
} from './types.js';

const PUBLIC_FORBIDDEN = [
  'docs/',
  '.github/pages',
  'gh-pages',
  'aivault-home',
  'dark-star-ebook.html',
  'github.io',
];

export function courseStorageDir(
  root: string,
  academicYear: string,
  semester: string,
  courseCode: string,
  courseTitle?: string,
): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, '_');
  const leaf = courseTitle ? `${safe(courseCode)}_${safe(courseTitle)}` : safe(courseCode);
  return path.join(root, safe(academicYear), safe(semester), leaf);
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
      console.warn(
        '[tronclass-storage] privateStorageRoot 建議含 private 字樣，且不得部署至 GitHub Pages',
      );
    }
  }

  pathForCourse(
    course: Pick<CourseRecord, 'academicYear' | 'semester' | 'courseCode'> & {
      title?: string;
    },
  ): string {
    return courseStorageDir(
      this.config.privateStorageRoot,
      course.academicYear,
      course.semester,
      course.courseCode,
      course.title,
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
    provenance?: MaterialProvenance,
  ): Promise<StoredFileRecord> {
    const dir = courseStorageDir(
      this.config.privateStorageRoot,
      meta.academicYear,
      meta.semester,
      meta.courseCode,
      meta.courseTitle,
    );
    await mkdir(path.join(dir, 'raw'), { recursive: true });
    await mkdir(path.join(dir, 'meta'), { recursive: true });
    const safeName = meta.fileName.replace(/[/\\]/g, '_');
    const privatePath = path.join(dir, 'raw', `${meta.fileId}_${sha256.slice(0, 12)}_${safeName}`);
    await writeFile(privatePath, bytes);
    const prov = provenance ?? buildTronClassProvenance(meta);
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
      provenance: prov,
    };
    await writeFile(
      path.join(dir, 'meta', `${meta.fileId}.json`),
      JSON.stringify(record, null, 2),
      'utf8',
    );
    return record;
  }

  /** Read all meta/*.json for a course — enables real dedup across runs. */
  async readIndex(course: CourseRecord): Promise<StoredFileRecord[]> {
    const dir = path.join(this.pathForCourse(course), 'meta');
    try {
      await access(dir);
    } catch {
      return [];
    }
    const names = await readdir(dir);
    const out: StoredFileRecord[] = [];
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      try {
        const raw = await readFile(path.join(dir, name), 'utf8');
        out.push(JSON.parse(raw) as StoredFileRecord);
      } catch {
        // skip corrupt meta
      }
    }
    return out;
  }
}

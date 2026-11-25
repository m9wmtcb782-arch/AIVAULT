/**
 * Provenance metadata for private shelf records.
 * Public-source retrieval MUST set source='public_source' and tronclassE2eSuccess=false.
 */

import type { MaterialMeta, MaterialProvenance, StoredFileRecord } from './types.js';

export const SCHOOL_LABEL_SCU = '東吳大學';

export function buildTronClassProvenance(
  meta: MaterialMeta,
  retrievedAt: string = new Date().toISOString(),
): MaterialProvenance {
  return {
    school: SCHOOL_LABEL_SCU,
    source: 'tronclass',
    sourceSystem: 'tronclass.scu.edu.tw',
    courseId: meta.courseId,
    courseCode: meta.courseCode,
    courseTitle: meta.courseTitle,
    academicYear: meta.academicYear,
    semester: meta.semester,
    sourceFileId: meta.fileId,
    retrievedAt,
    tronclassE2eSuccess: false, // flipped only by real E2E harness after school auth
  };
}

export function buildPublicSourceProvenance(opts: {
  label: string;
  urlHint?: string;
  retrievedAt?: string;
}): MaterialProvenance {
  return {
    school: SCHOOL_LABEL_SCU,
    source: 'public_source',
    sourceSystem: opts.urlHint ?? opts.label,
    courseId: '',
    courseCode: '',
    academicYear: '',
    semester: '',
    sourceFileId: opts.label,
    retrievedAt: opts.retrievedAt ?? new Date().toISOString(),
    tronclassE2eSuccess: false,
  };
}

/** Assert a stored record from public adapter is never labeled TronClass E2E success. */
export function assertNotTronClassE2e(record: StoredFileRecord): void {
  if (record.provenance?.source === 'public_source' && record.provenance.tronclassE2eSuccess) {
    throw new Error(
      'FORBIDDEN: public_source record marked tronclassE2eSuccess=true',
    );
  }
  if (record.provenance?.tronclassE2eSuccess === true) {
    throw new Error(
      'FORBIDDEN: tronclassE2eSuccess=true outside authorized real E2E harness',
    );
  }
}

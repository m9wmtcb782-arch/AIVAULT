/**
 * UNIT TESTS — import compiled dist/ (fake data only).
 * Does NOT constitute a real TronClass sync / download test.
 * See SYNC_TEST_REPORT.md and E2E_ACCEPTANCE.md (BLOCKED).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isAllowedExtension,
  filterByAllowlist,
} from '../dist/allowlist.js';
import { sha256Hex, buildDedupKey, isDuplicate } from '../dist/dedup.js';
import { diffCourses, courseIdentityKey } from '../dist/sync.js';
import { rejectPasswordLogin, rejectCaptchaOcr } from '../dist/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '..', 'src');

test('source modules exist', () => {
  for (const f of [
    'allowlist.ts',
    'dedup.ts',
    'sync.ts',
    'auth.ts',
    'client.ts',
    'storage.ts',
    'material-queue.ts',
    'provenance.ts',
    'public-source.ts',
    'controls.ts',
  ]) {
    assert.equal(existsSync(path.join(srcDir, f)), true, f);
  }
});

test('allowlist accepts PDF PPT PPTX DOC DOCX only', () => {
  assert.equal(isAllowedExtension('講義.PDF'), true);
  assert.equal(isAllowedExtension('slides.pptx'), true);
  assert.equal(isAllowedExtension('old.ppt'), true);
  assert.equal(isAllowedExtension('notes.docx'), true);
  assert.equal(isAllowedExtension('notes.doc'), true);
  assert.equal(isAllowedExtension('video.mp4'), false);
  assert.equal(isAllowedExtension('archive.zip'), false);
});

test('filterByAllowlist drops disallowed names', () => {
  const out = filterByAllowlist([
    { fileName: 'a.pdf' },
    { fileName: 'b.mp4' },
    { fileName: 'c.PPTX' },
  ]);
  assert.deepEqual(
    out.map((x) => x.fileName),
    ['a.pdf', 'c.PPTX'],
  );
});

test('sha256Hex is stable', () => {
  assert.equal(
    sha256Hex('hello'),
    '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
  );
});

test('dedup detects same fileId+mtime+sha256', () => {
  const sha = sha256Hex(Buffer.from('payload'));
  const key = buildDedupKey('fid-1', '2026-10-01T00:00:00Z', sha);
  const existing = [{ fileId: 'fid-1', updatedAt: '2026-10-01T00:00:00Z', sha256: sha }];
  assert.equal(isDuplicate(key, existing), true);
  assert.equal(
    isDuplicate(buildDedupKey('fid-1', '2026-10-02T00:00:00Z', sha), existing),
    false,
  );
});

test('diffCourses discovers new term/course dynamically', () => {
  const known = [
    {
      academicYear: '113',
      semester: '2',
      courseCode: 'LAW101',
      courseId: '1',
      accessAuthorized: true,
      provisionedAt: '2025-01-01',
      privateStoragePath: '/p/113/2/LAW101',
      indexId: 'idx1',
      syncEnabled: true,
    },
  ];
  const discovered = [
    { academicYear: '113', semester: '2', courseCode: 'LAW101', courseId: '1', accessAuthorized: true },
    { academicYear: '114', semester: '1', courseCode: 'LAW201', courseId: '9', accessAuthorized: true },
  ];
  const d = diffCourses(discovered, known);
  assert.equal(d.unchanged.length, 1);
  assert.equal(d.added.length, 1);
  assert.equal(d.added[0].courseCode, 'LAW201');
  assert.equal(courseIdentityKey(d.added[0]), '114|1|LAW201|9');
});

test('auth rejects password login and captcha OCR', () => {
  assert.throws(() => rejectPasswordLogin('u', 'p'), /拒絕學號/);
  assert.throws(() => rejectCaptchaOcr(), /驗證碼 OCR/);
});

test('enqueueClassify source documents non-blocking contract', () => {
  const notify = readFileSync(path.join(srcDir, 'notify.ts'), 'utf8');
  assert.match(notify, /onMaterialStored/);
  assert.match(notify, /enqueueClassify/);
  assert.match(notify, /NEVER roll back|non-blocking/i);
  const sync = readFileSync(path.join(srcDir, 'sync.ts'), 'utf8');
  assert.match(sync, /enqueueClassify\(meta, record\)/);
});

test('config.example.json has no password fields', () => {
  const cfg = readFileSync(path.join(__dirname, '..', 'config.example.json'), 'utf8');
  assert.doesNotMatch(cfg, /"password"/i);
  assert.doesNotMatch(cfg, /"username"/i);
  assert.doesNotMatch(cfg, /"studentId"/i);
  assert.match(cfg, /schoolAuthorizationConfirmed/);
});

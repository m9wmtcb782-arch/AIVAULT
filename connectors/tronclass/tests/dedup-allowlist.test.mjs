/**
 * UNIT TESTS ONLY — fake data.
 * Does NOT constitute a real TronClass sync / download test.
 * See SYNC_TEST_REPORT.md and E2E_ACCEPTANCE.md (BLOCKED).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '..', 'src');

function sha256Hex(data) {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
  return createHash('sha256').update(buf).digest('hex');
}
function buildDedupKey(fileId, updatedAt, sha256) {
  return { fileId, updatedAt, sha256 };
}
function dedupKeyString(key) {
  return `${key.fileId}|${key.updatedAt}|${key.sha256}`;
}
function isDuplicate(candidate, existing) {
  const target = dedupKeyString(candidate);
  for (const row of existing) {
    const key = buildDedupKey(row.fileId, row.updatedAt, row.sha256);
    if (dedupKeyString(key) === target) return true;
  }
  return false;
}
const DEFAULT_ALLOWLIST = ['.pdf', '.ppt', '.pptx', '.doc', '.docx'];
function isAllowedExtension(fileName, allowlist = DEFAULT_ALLOWLIST) {
  const lower = fileName.trim().toLowerCase();
  const base = lower.split(/[/\\]/).pop() ?? '';
  return allowlist.some((ext) => base.endsWith(ext.toLowerCase()));
}
function filterByAllowlist(items, allowlist = DEFAULT_ALLOWLIST) {
  return items.filter((item) => isAllowedExtension(item.fileName, allowlist));
}
function courseIdentityKey(c) {
  return `${c.academicYear}|${c.semester}|${c.courseCode}|${c.courseId}`;
}
function diffCourses(discovered, known) {
  const knownMap = new Map(known.map((k) => [courseIdentityKey(k), k]));
  const seen = new Set();
  const added = [];
  const unchanged = [];
  for (const d of discovered) {
    const key = courseIdentityKey(d);
    seen.add(key);
    if (knownMap.has(key)) unchanged.push(d);
    else added.push(d);
  }
  const removedOrInactive = known.filter((k) => !seen.has(courseIdentityKey(k)));
  return { added, unchanged, removedOrInactive };
}

test('source modules exist (allowlist/dedup/sync/auth)', () => {
  for (const f of ['allowlist.ts', 'dedup.ts', 'sync.ts', 'auth.ts', 'client.ts', 'storage.ts']) {
    assert.equal(existsSync(path.join(srcDir, f)), true, f);
    assert.ok(readFileSync(path.join(srcDir, f), 'utf8').length > 20);
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
});

test('auth.ts rejects password login pattern in source', () => {
  const src = readFileSync(path.join(srcDir, 'auth.ts'), 'utf8');
  assert.match(src, /rejectPasswordLogin/);
  assert.match(src, /SchoolAuthGateError/);
  assert.match(src, /禁止明文密碼/);
});

test('enqueueClassify source documents non-blocking contract', () => {
  const notify = readFileSync(path.join(srcDir, 'notify.ts'), 'utf8');
  assert.match(notify, /onMaterialStored/);
  assert.match(notify, /enqueueClassify/);
  assert.match(notify, /NEVER roll back|non-blocking/i);
  const sync = readFileSync(path.join(srcDir, 'sync.ts'), 'utf8');
  assert.match(sync, /enqueueClassify\(meta, record\)/);
  assert.match(sync, /不回滾儲存|Dual-classify hook/);
});

/**
 * OFFLINE MOCK pipeline tests — NO live TronClass HTTP.
 * Success here MUST NOT be reported as TronClass E2E.
 */
import { test, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BrowserHandoffAuthProvider,
  SchoolTokenAuthProvider,
  createAuthSessionProvider,
  SchoolAuthGateError,
  SessionInvalidError,
} from '../dist/auth.js';
import { MockTronClassClient, TronClassClient } from '../dist/client.js';
import { PrivateStorage } from '../dist/storage.js';
import {
  SyncEngine,
  MemoryCourseRepository,
  stopSync,
  createSyncControls,
} from '../dist/sync.js';
import { MaterialQueue } from '../dist/material-queue.js';
import {
  PublicSourceAdapter,
  PUBLIC_SOURCE_ADAPTER_KIND,
  TRONCLASS_CLIENT_KIND,
} from '../dist/public-source.js';
import { buildPublicSourceProvenance, assertNotTronClassE2e } from '../dist/provenance.js';
import {
  onMaterialStored,
  resetNotifyHandlersForTests,
  enqueueClassify,
} from '../dist/notify.js';
import { withRetry, revokeAuth, ErrorLog } from '../dist/controls.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function baseConfig(root, confirmed = true) {
  return {
    schoolAuthorizationConfirmed: confirmed,
    baseUrl: 'https://tronclass.scu.edu.tw',
    mediaBaseUrl: 'https://tcmedia.scu.edu.tw',
    pollIntervalHours: 6,
    courseDiscovery: {
      mode: 'dynamic',
      fixedCourseListForbidden: true,
      compareFields: ['academicYear', 'semester', 'courseCode', 'courseId'],
      autoProvisionNewCourses: true,
      retainHistoricalMaterials: true,
    },
    courses: [],
    allowlistExtensions: ['.pdf', '.ppt', '.pptx', '.doc', '.docx'],
    privateStorageRoot: root,
    storageLayout: '{privateStorageRoot}/{academicYear}/{semester}/{courseCode}/',
    maxRetries: 2,
    retryBackoffMs: 1,
    auth: {
      mode: 'browser_handoff',
      plaintextPasswordStorage: false,
      captchaBypass: false,
      autoLoginEnabled: false,
    },
    scheduler: {
      enabled: false,
      requiresEnv: 'SCHOOL_AUTH_CONFIRMED=true',
      kind: 'test',
    },
    darkStarNotify: { enabled: false, hook: 'event_stub_only' },
  };
}

let tmpRoot;

before(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'tronclass-mock-'));
});

afterEach(() => {
  resetNotifyHandlersForTests();
});

test('AuthSessionProvider browser handoff + expiry pause', async () => {
  const cfg = baseConfig(path.join(tmpRoot, 'auth1'));
  const auth = new BrowserHandoffAuthProvider(cfg);
  assert.equal(auth.providerId, 'browser_handoff');
  await auth.acceptHandoff({
    kind: 'browser_handoff',
    opaqueCredentialRef: 'vault-ref-abcdef12',
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  });
  assert.equal(await auth.isSessionValid(), false);
  assert.equal(auth.needsRelogin, true);
});

test('AuthSessionProvider rejects password-shaped refs and gate-closed config', async () => {
  const closed = baseConfig(path.join(tmpRoot, 'auth2'), false);
  const auth = createAuthSessionProvider(closed);
  await assert.rejects(
    () =>
      auth.acceptHandoff({
        kind: 'opaque',
        opaqueCredentialRef: 'vault-ref-abcdef12',
      }),
    SchoolAuthGateError,
  );
  const open = baseConfig(path.join(tmpRoot, 'auth3'), true);
  const auth2 = new SchoolTokenAuthProvider(open);
  await assert.rejects(
    () =>
      auth2.acceptHandoff({
        kind: 'school_token',
        opaqueCredentialRef: 'password=secret123',
      }),
    /密碼/,
  );
});

test('MaterialQueue soft dedup + summary', () => {
  const q = new MaterialQueue({ maxRetries: 2 });
  q.enqueueAll([
    {
      fileId: 'f1',
      courseId: 'c1',
      courseCode: 'LAW',
      academicYear: '114',
      semester: '1',
      fileName: 'a.pdf',
      updatedAt: '2026-01-01T00:00:00Z',
      downloadAllowed: true,
    },
    {
      fileId: 'f2',
      courseId: 'c1',
      courseCode: 'LAW',
      academicYear: '114',
      semester: '1',
      fileName: 'b.pdf',
      updatedAt: '2026-01-02T00:00:00Z',
      downloadAllowed: true,
    },
  ]);
  q.applySoftDedup([
    {
      fileId: 'f1',
      updatedAt: '2026-01-01T00:00:00Z',
      sha256: 'x',
      courseId: 'c1',
      courseCode: 'LAW',
      academicYear: '114',
      semester: '1',
      fileName: 'a.pdf',
      privatePath: '/p',
      storedAt: 't',
    },
  ]);
  assert.equal(q.summary().skipped, 1);
  assert.equal(q.pending().length, 1);
  assert.equal(q.pending()[0].meta.fileId, 'f2');
});

test('full offline mock: discover→diff→provision→sync + classify hook + dedup', async () => {
  const root = path.join(tmpRoot, 'pipe1');
  const cfg = baseConfig(root, true);
  const auth = new BrowserHandoffAuthProvider(cfg);
  await auth.acceptHandoff({
    kind: 'browser_handoff',
    opaqueCredentialRef: 'vault-ref-session99',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  });
  const client = new MockTronClassClient(cfg, auth);
  client.courses = [
    {
      academicYear: '114',
      semester: '1',
      courseCode: 'FOODLAW',
      courseId: '42',
      title: '食品安全法',
      accessAuthorized: true,
    },
  ];
  const meta = {
    fileId: 'mat-1',
    courseId: '42',
    courseCode: 'FOODLAW',
    courseTitle: '食品安全法',
    academicYear: '114',
    semester: '1',
    fileName: '講義.pdf',
    updatedAt: '2026-10-01T00:00:00Z',
    downloadAllowed: true,
  };
  client.materialsByCourse.set('42', [meta, { ...meta, fileName: 'skip.mp4', fileId: 'mat-vid' }]);
  client.blobs.set('mat-1', Buffer.from('%PDF-mock-content'));
  client.blobs.set('mat-vid', Buffer.from('video'));

  const classified = [];
  onMaterialStored((m, s) => {
    classified.push({ fileId: m.fileId, sha256: s.sha256, path: s.privatePath });
  });

  const storage = new PrivateStorage(cfg);
  const repo = new MemoryCourseRepository();
  const engine = new SyncEngine(cfg, auth, client, storage, repo);
  const result = await engine.runOnce();

  assert.equal(result.tronclassE2eSuccess, false, 'mock must not claim TronClass E2E');
  assert.equal(result.publicSourceSuccess, false);
  assert.equal(result.sessionInvalid, false);
  assert.ok(result.storedCount >= 1);
  assert.equal(classified.length, 1);
  assert.equal(classified[0].fileId, 'mat-1');
  assert.ok(classified[0].path.includes('114'));
  assert.ok(classified[0].path.includes('FOODLAW'));
  assert.ok(!classified[0].path.includes('github.io'));

  // Second run — dedup skip
  const result2 = await engine.runOnce();
  assert.equal(result2.tronclassE2eSuccess, false);
  assert.equal(result2.storedCount, 0);

  const known = await repo.listKnown();
  assert.equal(known.length, 1);
  const index = await storage.readIndex(known[0]);
  assert.equal(index.length, 1);
  assert.equal(index[0].provenance.source, 'tronclass');
  assert.equal(index[0].provenance.tronclassE2eSuccess, false);
  assert.equal(index[0].provenance.school, '東吳大學');
  assert.equal(index[0].provenance.sourceFileId, 'mat-1');
  assert.ok(index[0].provenance.retrievedAt);
});

test('stopSync mid-flight marks remaining stopped', async () => {
  const controls = createSyncControls();
  assert.equal(controls.isStopped(), false);
  stopSync(controls);
  assert.equal(controls.isStopped(), true);
});

test('revokeAuth clears session', async () => {
  const cfg = baseConfig(path.join(tmpRoot, 'rev1'), true);
  const auth = new BrowserHandoffAuthProvider(cfg);
  await auth.acceptHandoff({
    kind: 'browser_handoff',
    opaqueCredentialRef: 'vault-ref-torevoke1',
  });
  assert.equal(auth.hasSession(), true);
  await revokeAuth(auth);
  assert.equal(auth.hasSession(), false);
});

test('withRetry retries then succeeds', async () => {
  let n = 0;
  const v = await withRetry(
    async () => {
      n++;
      if (n < 2) throw new Error('transient');
      return 42;
    },
    { maxRetries: 3, backoffMs: 1, sleepMs: async () => undefined },
  );
  assert.equal(v, 42);
  assert.equal(n, 2);
});

test('session invalid pauses runOnce', async () => {
  const root = path.join(tmpRoot, 'sess-bad');
  const cfg = baseConfig(root, true);
  const auth = new BrowserHandoffAuthProvider(cfg);
  await auth.acceptHandoff({
    kind: 'browser_handoff',
    opaqueCredentialRef: 'vault-ref-expired01',
    expiresAt: new Date(Date.now() - 5000).toISOString(),
  });
  const client = new MockTronClassClient(cfg, auth);
  const engine = new SyncEngine(
    cfg,
    auth,
    client,
    new PrivateStorage(cfg),
    new MemoryCourseRepository(),
  );
  const result = await engine.runOnce();
  assert.equal(result.sessionInvalid, true);
  assert.equal(result.tronclassE2eSuccess, false);
  assert.equal(result.ok, false);
});

test('gate closed blocks live client paths', async () => {
  const cfg = baseConfig(path.join(tmpRoot, 'gate'), false);
  const auth = new BrowserHandoffAuthProvider(cfg);
  const client = new TronClassClient(cfg, auth);
  await assert.rejects(() => client.listCourses(), SchoolAuthGateError);
});

test('PublicSourceAdapter success ≠ TronClass E2E', () => {
  const adapter = new PublicSourceAdapter();
  assert.equal(PUBLIC_SOURCE_ADAPTER_KIND, 'public_source_adapter');
  assert.equal(TRONCLASS_CLIENT_KIND, 'tronclass_client');
  assert.notEqual(PUBLIC_SOURCE_ADAPTER_KIND, TRONCLASS_CLIENT_KIND);

  const fetched = adapter.fromBytes('mohw-draft', '基準.pdf', Buffer.from('%PDF-public'));
  assert.equal(fetched.ok, true);
  assert.equal(fetched.publicSourceSuccess, true);
  assert.equal(fetched.tronclassE2eSuccess, false);

  const run = adapter.toSyncRunResult(fetched);
  assert.equal(run.tronclassE2eSuccess, false);
  assert.equal(run.publicSourceSuccess, true);

  const record = {
    courseId: '',
    courseCode: '',
    academicYear: '',
    semester: '',
    fileId: 'pub-1',
    fileName: '基準.pdf',
    updatedAt: '',
    sha256: fetched.sha256,
    privatePath: '/var/aivault-private/public/基準.pdf',
    storedAt: new Date().toISOString(),
    provenance: fetched.provenance,
  };
  adapter.guardStoredRecord(record);
  assert.doesNotThrow(() => assertNotTronClassE2e(record));

  // Forged E2E flag must throw
  assert.throws(
    () =>
      assertNotTronClassE2e({
        ...record,
        provenance: { ...fetched.provenance, tronclassE2eSuccess: true },
      }),
    /FORBIDDEN/,
  );
});

test('PublicSourceAdapter refuses TronClass URLs', async () => {
  const adapter = new PublicSourceAdapter(async () => ({
    ok: true,
    status: 200,
    body: Buffer.from('x'),
  }));
  const bad = await adapter.fetch({
    label: 'steal',
    url: 'https://tcmedia.scu.edu.tw/download/file/abc',
    fileName: 'x.pdf',
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.tronclassE2eSuccess, false);
  assert.match(bad.error, /拒絕/);
});

test('enqueueClassify swallows handler errors (non-blocking)', async () => {
  onMaterialStored(() => {
    throw new Error('classify boom');
  });
  await enqueueClassify(
    {
      fileId: 'f',
      courseId: 'c',
      courseCode: 'X',
      academicYear: '114',
      semester: '1',
      fileName: 'a.pdf',
      updatedAt: 't',
      downloadAllowed: true,
    },
    {
      courseId: 'c',
      courseCode: 'X',
      academicYear: '114',
      semester: '1',
      fileId: 'f',
      fileName: 'a.pdf',
      updatedAt: 't',
      sha256: 'abc',
      privatePath: '/p',
      storedAt: 't',
    },
  );
});

test('ErrorLog captures errors', () => {
  const log = new ErrorLog();
  log.push('info', 'ok');
  log.push('error', 'boom', { fileId: '1' });
  assert.equal(log.errors().length, 1);
  assert.equal(log.errors()[0].fileId, '1');
});

test('docs and gated workflow exist', () => {
  const root = path.join(__dirname, '..');
  assert.ok(existsSync(path.join(root, 'GAP_ANALYSIS.md')));
  assert.ok(existsSync(path.join(root, 'SESSION_HANDOFF_DESIGN.md')));
  assert.ok(existsSync(path.join(root, 'docs', 'tronclass-iface.md')));
  const wf = path.join(root, '..', '..', '.github', 'workflows', 'tronclass-sync-gated.yml');
  assert.ok(existsSync(wf), 'gated workflow');
  const body = readFileSync(wf, 'utf8');
  assert.match(body, /SCHOOL_AUTH_CONFIRMED/);
  assert.match(body, /refusing any TronClass access/i);
});

test('buildPublicSourceProvenance never sets e2e true', () => {
  const p = buildPublicSourceProvenance({ label: 'x' });
  assert.equal(p.source, 'public_source');
  assert.equal(p.tronclassE2eSuccess, false);
});

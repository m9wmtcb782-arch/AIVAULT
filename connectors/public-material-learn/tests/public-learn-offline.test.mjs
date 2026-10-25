/**
 * OFFLINE tests — no live TronClass, no live MOHW HTTP required.
 * Public success MUST keep tronclassE2eSuccess=false.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeTitle,
  decodeNameParam,
  matchMaterial,
  PublicSourceRegistry,
  builtinMohwCatalog,
  isUrlAllowed,
  PublicLearnPipeline,
  onLearnNotify,
  onClassifyEnqueue,
  resetLearnHandlersForTests,
  PIPELINE_KIND,
  TRONCLASS_LOGIN_ENABLED,
} from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

afterEach(() => {
  resetLearnHandlersForTests();
});

test('pipeline flags: not TronClass login', () => {
  assert.equal(PIPELINE_KIND, 'public_material_learn');
  assert.equal(TRONCLASS_LOGIN_ENABLED, false);
});

test('normalizeTitle strips 參考資料 prefix and extension', () => {
  const n = normalizeTitle('參考資料：新可同時提供食品使用之中藥材品項1070123.pdf');
  assert.ok(n.includes('中藥材'));
  assert.ok(n.includes('1070123'));
  assert.equal(n.endsWith('pdf'), false);
});

test('decodeNameParam handles URL-encoded name=', () => {
  const raw =
    'https://tcmedia.scu.edu.tw/download/file/abc?name=%E5%8F%83%E8%80%83%E8%B3%87%E6%96%99%EF%BC%9A%E6%96%B0%E5%8F%AF%E5%90%8C%E6%99%82%E6%8F%90%E4%BE%9B%E9%A3%9F%E5%93%81%E4%BD%BF%E7%94%A8%E4%B9%8B%E4%B8%AD%E8%97%A5%E6%9D%90%E5%93%81%E9%A0%851070123%20.pdf';
  const decoded = decodeNameParam(raw);
  assert.ok(decoded.includes('中藥材') || decoded.includes('1070123'));
});

test('allowlist rejects tronclass/tcmedia', () => {
  assert.equal(isUrlAllowed('https://www.mohw.gov.tw/x.pdf'), true);
  assert.equal(isUrlAllowed('https://tcmedia.scu.edu.tw/download/file/x'), false);
  assert.equal(isUrlAllowed('https://tronclass.scu.edu.tw/course/1'), false);
});

test('registry refuses blocked host registration', () => {
  const reg = new PublicSourceRegistry();
  assert.throws(
    () =>
      reg.register({
        id: 'bad',
        title: 'x',
        url: 'https://tcmedia.scu.edu.tw/a.pdf',
        keywords: [],
        citeAs: 'x',
      }),
    /allowlist|拒絕/,
  );
});

test('match: 中藥材 1070123 標題高分 auto_accept', () => {
  const reg = new PublicSourceRegistry();
  reg.registerMany(builtinMohwCatalog());
  const result = matchMaterial(
    {
      tronclassNameParam: '參考資料：新可同時提供食品使用之中藥材品項1070123.pdf',
      hints: ['衛福部', '1070123'],
    },
    reg.list(),
  );
  assert.equal(result.decision, 'auto_accept');
  assert.ok(result.best);
  assert.equal(result.best.entry.id, 'mohw-zhongyao-food-1070123');
  assert.ok(result.best.score >= 0.82);
});

test('match: 食安標題可命中', () => {
  const reg = new PublicSourceRegistry();
  reg.registerMany(builtinMohwCatalog());
  const result = matchMaterial(
    { fileName: '食品安全管理措施限制.pdf', hints: ['食品安全'] },
    reg.list(),
  );
  assert.ok(['auto_accept', 'pending_review'].includes(result.decision));
  assert.equal(result.best?.entry.id, 'mohw-food-safety-management-measures');
});

test('E2E offline: match → provenance=public → learnNotify; tronclassE2eSuccess=false', async () => {
  const learnEvents = [];
  const classifyPayloads = [];
  onLearnNotify((e) => {
    learnEvents.push(e);
  });
  onClassifyEnqueue((p) => {
    classifyPayloads.push(p);
  });

  const bytes107 = new TextEncoder().encode('FIXTURE-MOHW-ZHONGYAO-1070123');
  const bytesDraft = new TextEncoder().encode('FIXTURE-MOHW-CRITERIA-DRAFT');
  const bytesFood = new TextEncoder().encode('FIXTURE-FDA-FOOD-SAFETY');

  const pipeline = new PublicLearnPipeline({
    offlineBytesByCatalogId: {
      'mohw-zhongyao-food-1070123': bytes107,
      'mohw-zhongyao-food-criteria-draft': bytesDraft,
      'mohw-food-safety-management-measures': bytesFood,
    },
  });

  const listPath = path.join(__dirname, '../fixtures/sample-material-list.json');
  const list = JSON.parse(readFileSync(listPath, 'utf8'));

  const summary = await pipeline.runList(list.items);

  assert.equal(summary.anyTronclassE2eSuccess, false);
  assert.ok(summary.learnNotifyCallCount >= 1);
  assert.ok(summary.publicSourceSuccessCount >= 1);
  assert.ok(learnEvents.length >= 1);

  for (const e of learnEvents) {
    assert.equal(e.type, 'darkstar.public_material.learn');
    assert.equal(e.provenance, 'public_source');
    assert.equal(e.tronclassE2eSuccess, false);
  }
  for (const r of summary.results) {
    if (r.fetch) {
      assert.equal(r.fetch.tronclassE2eSuccess, false);
      assert.equal(r.fetch.provenance.source, 'public_source');
      assert.equal(r.fetch.provenance.tronclassE2eSuccess, false);
    }
    if (r.learnEvent) {
      assert.equal(r.learnEvent.tronclassE2eSuccess, false);
    }
  }
  assert.ok(classifyPayloads.length >= 1);
  assert.equal(classifyPayloads[0].provenanceSource, 'public_source');

  // specifically the 中藥材 item should learn-notify
  const zhong = summary.results.find(
    (r) => r.learnEvent?.catalogId === 'mohw-zhongyao-food-1070123',
  );
  assert.ok(zhong, '中藥材 1070123 should complete learn path');
  assert.equal(zhong.learnNotified, true);
  assert.equal(zhong.fetch.publicSourceSuccess, true);
});

test('humanLock is not overridden by weaker catalog noise', () => {
  const reg = new PublicSourceRegistry();
  reg.registerMany(builtinMohwCatalog());
  const lockedUrl = reg.list().find((e) => e.id === 'mohw-food-safety-management-measures').url;
  const result = matchMaterial(
    {
      fileName: '參考資料：新可同時提供食品使用之中藥材品項1070123.pdf',
      humanLock: true,
      humanChosenUrl: lockedUrl,
    },
    reg.list(),
  );
  assert.equal(result.decision, 'human_locked');
  assert.equal(result.best.entry.id, 'mohw-food-safety-management-measures');
});

test('low score goes pending_review not learnNotify', async () => {
  const learnEvents = [];
  onLearnNotify((e) => learnEvents.push(e));
  const pipeline = new PublicLearnPipeline({
    thresholds: { autoAcceptThreshold: 0.99, reviewThreshold: 0.1 },
  });
  // vague title — should not auto-accept at 0.99
  const r = await pipeline.runItem({ fileName: '上課補充.pdf', hints: ['補充'] });
  assert.ok(r.pendingReview || r.blockedReason);
  assert.equal(r.learnNotified, false);
  assert.equal(learnEvents.length, 0);
});

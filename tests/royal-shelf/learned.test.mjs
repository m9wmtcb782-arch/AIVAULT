import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const L = createRequire(import.meta.url)('../../royal-library-learned.js');

test('parseProgress reads aivault_bookqa_progress_v1 and drops empty totals', () => {
  const p = L.parseProgress(JSON.stringify({ a: { have: 10, total: 10, pct: 100 }, b: { have: 3, total: 10, pct: 30 }, c: { total: 0 } }));
  assert.deepEqual(p.map(x => [x.id, x.pct]), [['a', 100], ['b', 30]]);
  assert.equal(L.progressLabel(p[0]), '已學習 ✓');
  assert.equal(L.progressLabel(p[1]), '學習中 30%');
  assert.deepEqual(L.parseProgress('not json'), []);
  assert.deepEqual(L.parseProgress(null), []);
});
test('assignedRows keeps enabled, maps titles, flags missing books, dedupes', () => {
  const rows = L.assignedRows(
    [{ ebook_id: 'x', enabled: true }, { ebook_id: 'y', enabled: false }, { ebook_id: 'z', enabled: true }, { ebook_id: 'x', enabled: true }],
    [{ id: 'x', title: '宪法学讲义' }], [{ id: 'x', pct: 100, total: 5, have: 5 }]);
  assert.deepEqual(rows.map(r => [r.id, r.title, r.missing]), [['x', '宪法学讲义', false], ['z', '', true]]);
  assert.equal(rows[0].progress.pct, 100);
});
test('novelCards uses only API fields', () => {
  const c = L.novelCards({ books: [{ id: 'n1', title: '星海之戀', genre: '愛情', status: 'serial', chapters_done: 13, target_chapters: 100, chars: 30958 }, { title: 'no id' }] });
  assert.equal(c.length, 1);
  assert.deepEqual(c[0], { id: 'n1', title: '星海之戀', genre: '愛情', status: '連載中', chapters: 13, target: 100, wan: 3.1 });
  assert.deepEqual(L.novelCards({}), []);
  assert.deepEqual(L.novelCards(null), []);
});

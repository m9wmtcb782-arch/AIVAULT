import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const A = createRequire(import.meta.url)('../../royal-library-ask.js');
const entry = { t: '德國基本法', src: 'https://www.gesetze-im-internet.de/gg/', parts: [[1, 20], [21, 40], [41, 60]] };

test('partsForPages：頁碼對應部分、去重、上限', () => {
  assert.deepEqual(A.partsForPages(entry, [25, 30, 5, 59], 2), [2, 1]);
  assert.deepEqual(A.partsForPages(entry, [999]), []);
  assert.deepEqual(A.partsForPages(null, [1]), []);
});
test('scorePartText：繁簡皆可命中', () => {
  assert.ok(A.scorePartText('第一條 人性尊嚴不可侵犯。人性尊嚴', ['人性尊嚴']) > A.scorePartText('其他內容', ['人性尊嚴']));
  assert.ok(A.scorePartText('人民代表大会', ['人民代表大會']) > 0);
});
test('公開且有純文字版：附 part／目錄／官方來源網址，比較基準中華民國，不要頁碼', () => {
  const s = A.buildCopyPrompt({ question: '人性尊嚴保障與我國有何不同？', book: { id: 'gg', title: '德國基本法 Grundgesetz（GG）｜德文官方版', author: 'Bundesministerium der Justiz', public: true }, entry, parts: [2] });
  assert.ok(s.includes('人性尊嚴保障與我國有何不同？'));
  assert.ok(s.includes(A.SITE + '/ebook-text/gg/part-002.txt'));
  assert.ok(s.includes(A.SITE + '/ebook-text/gg/index.txt'));
  assert.ok(s.includes('https://www.gesetze-im-internet.de/gg/'));
  assert.ok(s.includes(A.SITE + '/dark-star-ebook.html?book=gg'));
  assert.ok(s.includes('本書法域：德國'));
  assert.ok(/比對德國與中華民國/.test(s));
  assert.ok(s.includes('不要寫頁碼'));
  assert.ok(s.includes('繁體中文'));
});
test('中華民國的書：以中華民國法律分析', () => {
  const s = A.buildCopyPrompt({ question: '言論自由', book: { id: 'tw', title: '中華民國憲法', author: '中華民國（立法院三讀／主管機關發布）', public: true }, entry: { parts: [[1, 14]] }, parts: [] });
  assert.ok(s.includes('本書即中華民國法律'));
  assert.ok(s.includes('/ebook-text/tw/part-001.txt'));
});
test('非公開書：只有書名作者與說明，沒有任何網址與內文', () => {
  const s = A.buildCopyPrompt({ question: 'Q?', book: { id: 'priv', title: '私人筆記', author: '某人', public: false }, entry, parts: [1], excerpts: [{ text: '機密內容' }] });
  assert.ok(s.includes('《私人筆記》｜某人'));
  assert.ok(s.includes('非公開'));
  assert.ok(!/https?:\/\//.test(s));
  assert.ok(!s.includes('機密內容'));
});
test('公開但無純文字版：說明閱讀器需 JS，並直接附段落（上限）', () => {
  const s = A.buildCopyPrompt({ question: 'Q?', book: { id: 'tb', title: '宪法学讲义', author: '林来梵', public: true }, entry: null, excerpts: [{ text: '甲'.repeat(3000) }, { text: '乙'.repeat(3000) }, { text: '丙'.repeat(3000) }] });
  assert.ok(s.includes('沒有純文字版'));
  assert.ok(!s.includes('/ebook-text/'));
  assert.ok(s.includes('甲'.repeat(2500)) && !s.includes('甲'.repeat(2501)));
  assert.ok(!s.includes('丙'));
});

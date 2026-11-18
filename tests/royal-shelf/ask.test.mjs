import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const A = req('../../royal-library-ask.js');
const Z = req('../../royal-library-zhfold.js');

test('zhfold variants：繁→簡、簡→繁，繁體原文不反推', () => {
  assert.deepEqual(Z.variants('行政訴訟'), ['行政訴訟', '行政诉讼']);
  assert.deepEqual(Z.variants('行政复议'), ['行政复议', '行政復議']);
  assert.deepEqual(Z.variants('人民代表大會'), ['人民代表大會', '人民代表大会']);
});
test('extractTerms：去疑問詞、加兩岸用語對照與繁簡變體', () => {
  const t = A.extractTerms('訴願和行政訴訟的關係是什麼？');
  for (const x of ['訴願', '诉愿', '行政訴訟', '行政诉讼', '行政復議', '行政复议']) assert.ok(t.includes(x), x);
  assert.ok(!t.some(x => /什麼|關係/.test(x)));
  assert.ok(A.extractTerms('依中華民國憲法第11條，言論自由如何保障').includes('第11條'));
});
test('jurisOfBook：依書名／作者判讀法域', () => {
  assert.equal(A.jurisOfBook('中華民國憲法'), 'TW');
  assert.equal(A.jurisOfBook('民法 中華民國（立法院三讀／主管機關發布）；法務部全國法規資料庫'), 'TW');
  assert.equal(A.jurisOfBook('宪法学讲义（第四版）｜林来梵'), 'CN');
  assert.equal(A.jurisOfBook('德國基本法 Grundgesetz（GG）｜德文官方版'), 'DE');
  assert.equal(A.jurisOfBook('美國法典第26編 國內稅收法 United States Code Title 26（IRC）'), 'US');
  assert.deepEqual(A.compareSides(true, 'US', '問'), ['US', 'TW']);
  assert.deepEqual(A.compareSides(true, 'CN', '問'), ['CN', 'TW']);
  assert.deepEqual(A.compareSides(true, 'TW', '問'), []);
  assert.deepEqual(A.compareSides(true, 'TW', '與德國比較'), ['TW', 'DE']);
});
test('buildMessages：規則含不寫頁碼、不得編造條號、兩岸比較；資料不含頁碼', () => {
  const m = A.buildMessages('問', { title: 'B', juris: 'DE' }, { book: [{ book_title: 'B', juris: 'DE', text: '甲', page_number: 12 }], shelf: [], web: [] }, true, ['DE', 'TW']);
  assert.equal(m[0].role, 'system');
  assert.match(m[0].content, /不要寫頁碼/); assert.match(m[0].content, /資料中未找到/); assert.match(m[0].content, /## 與中華民國法律比較/); assert.match(m[0].content, /【德國】與【中華民國（台灣）】/);
  assert.ok(!/12/.test(m[1].content));
  const tw = A.buildMessages('問', { title: '民法', juris: 'TW' }, { book: [], shelf: [], web: [] }, true, []);
  assert.ok(!/## 與中華民國法律比較/.test(tw[0].content));
  const n = A.buildMessages('問', { title: 'B' }, { book: [], shelf: [], web: [] }, false, []);
  assert.ok(!/## 與中華民國法律比較/.test(n[0].content));
});
test('renderAnswer 轉義 HTML、支援表格；stripPageNumbers 移除頁碼', () => {
  const h = A.renderAnswer('## 結論\n<script>x</script>\n| 項目 | 台灣 | 大陸 |\n|---|---|---|\n| 差異 | A | B |');
  assert.ok(!h.includes('<script>')); assert.ok(h.includes('<table>')); assert.ok(h.includes('<h4>結論</h4>'));
  assert.equal(A.stripPageNumbers('見本書（第 12 頁）說明'), '見本書說明');
});
test('run：中華民國書＋問題提到兩岸→書架缺大陸資料才查網路；只呼叫 gateway 一次；不送 agent_id', async () => {
  const calls = { search: [], web: 0, research: 0, gateway: [] };
  const api = {
    search: async b => { calls.search.push(b); if (b.ebook_id === 'tw-const') return { sources: [{ page_id: 'p1', ebook_id: 'tw-const', book_title: '中華民國憲法', page_number: 3, excerpt: '人民有言論、講學、著作及出版之自由。'.repeat(3), score: 9 }] }; return { sources: [] }; },
    context: async () => [],
    webSearch: async () => { calls.web++; return { results: [{ title: '中华人民共和国宪法', url: 'https://www.npc.gov.cn/x', snippet: '中华人民共和国公民有言论、出版、集会、结社、游行、示威的自由。' }] }; },
    research: async () => { calls.research++; return { web: { sources: [] } }; },
    gateway: async (messages, o) => { calls.gateway.push({ messages, o }); return { success: true, content: '## 結論\n答案（第 3 頁）' }; }
  };
  const r = await A.run({ question: '言論自由在兩岸憲法的保障有何差異？', book: { id: 'tw-const', title: '中華民國憲法', cat: 0 }, books: [{ id: 'tw-const', title: '中華民國憲法', cat: 0, page_count: 14 }, { id: 'cn-book', title: '宪法学讲义（第四版）｜林来梵', cat: 0, page_count: 467 }], api });
  assert.equal(r.legal, true);
  assert.deepEqual(r.missing, ['CN']);
  assert.equal(calls.gateway.length, 1); assert.equal(r.calls, 1);
  assert.ok(calls.search.every(b => b.question === '書籍檢索'));
  assert.ok(calls.search.some(b => b.ebook_id === 'tw-const')); assert.ok(calls.search.some(b => !b.ebook_id));
  assert.equal(calls.web, 1); assert.equal(calls.research, 1);
  assert.ok(calls.gateway[0].messages[1].content.includes('網路來源'));
  assert.ok(!/第 3 頁/.test(r.answer));
  assert.deepEqual(r.sources.map(s => s.type), ['book', 'web']);
});
test('run：大陸教材→書架找到中華民國法規就不查網路', async () => {
  let web = 0;
  const api = {
    search: async b => ({ sources: b.ebook_id !== 'cn' ? [{ page_id: 'a', ebook_id: 'tw', book_title: '中華民國憲法', excerpt: '人民有言論自由。'.repeat(5), score: 5 }] : [{ page_id: 'b', ebook_id: 'cn', book_title: '宪法学讲义（第四版）｜林来梵', excerpt: '公民有言论自由。'.repeat(5), score: 4 }] }),
    context: async () => [], webSearch: async () => { web++; return { results: [] }; }, research: async () => { web++; return {}; },
    gateway: async () => ({ content: '答' })
  };
  const r = await A.run({ question: '言論自由保障如何', book: { id: 'cn', title: '宪法学讲义（第四版）｜林来梵', cat: 0 }, books: [{ id: 'tw', title: '中華民國憲法', cat: 0, page_count: 9 }], api });
  assert.equal(web, 0); assert.deepEqual(r.sides, ['CN', 'TW']); assert.deepEqual(r.missing, []);
  assert.deepEqual(r.sources.map(s => s.type + ':' + s.title), ['book:宪法学讲义（第四版）｜林来梵', 'shelf:中華民國憲法']);
});
test('run：aiKeywords 開啟時呼叫 gateway 兩次', async () => {
  let n = 0;
  const api = { search: async () => ({ sources: [] }), context: async () => [], webSearch: async () => ({ results: [] }), research: async () => ({}),
    gateway: async () => { n++; return { content: n === 1 ? '{"legal":true,"terms":["言論自由"],"terms_tw":["言論自由"],"terms_cn":["言论自由"],"laws_tw":["中華民國憲法"],"laws_cn":["中华人民共和国宪法"]}' : '答' }; } };
  const r = await A.run({ question: '言論自由', book: { id: 'x', title: '中華民國憲法', cat: 0 }, books: [], api, flags: { aiKeywords: true } });
  assert.equal(n, 2); assert.equal(r.calls, 2);
});

test('run：德文書自動多一次 AI 關鍵詞呼叫，並與中華民國比較；書架無中華民國資料才查網路', async () => {
  const seen = []; let n = 0, web = 0;
  const api = {
    search: async b => { seen.push(b); if (b.ebook_id === 'gg' && b.terms.includes('Würde des Menschen')) return { sources: [{ page_id: 'g1', ebook_id: 'gg', book_title: 'GG', excerpt: 'Die Würde des Menschen ist unantastbar. '.repeat(3), score: 9 }] }; return { sources: [] }; },
    context: async () => [], webSearch: async () => { web++; return { results: [{ title: '人性尊嚴', url: 'https://law.moj.gov.tw/x', snippet: '司法院釋字…人性尊嚴…'.repeat(3) }] }; }, research: async () => { web++; return {}; },
    gateway: async m => { n++; return { content: n === 1 ? '{"legal":true,"terms_book":["Würde des Menschen"],"terms_tw":["人性尊嚴"],"laws_tw":["中華民國憲法"]}' : '## 結論\n答' }; }
  };
  const r = await A.run({ question: '德國基本法對人性尊嚴的保障與我國有何不同？', book: { id: 'gg', title: '德國基本法 Grundgesetz（GG）｜德文官方版', cat: 0 }, books: [], api });
  assert.equal(n, 2); assert.equal(r.calls, 2); assert.deepEqual(r.sides, ['DE', 'TW']); assert.deepEqual(r.missing, ['TW']);
  assert.ok(web >= 1); assert.equal(r.counts.book, 1);
});
test('run：中華民國法規書、未提其他法域 → 不強制比較、不查網路', async () => {
  let web = 0;
  const api = { search: async b => ({ sources: b.ebook_id === 'civ' ? [{ page_id: 'c', ebook_id: 'civ', book_title: '民法', excerpt: '契約當事人互相表示意思一致者。'.repeat(3), score: 3 }] : [] }), context: async () => [], webSearch: async () => { web++; return {}; }, research: async () => { web++; return {}; }, gateway: async () => ({ content: '答' }) };
  const r = await A.run({ question: '契約何時成立？', book: { id: 'civ', title: '民法', author: '法務部全國法規資料庫', cat: 0 }, books: [], api });
  assert.deepEqual(r.sides, []); assert.equal(web, 0); assert.equal(r.calls, 1);
});
test('run：gateway 帶 thinking low；finish_reason=MAX_TOKENS 視為截斷', async () => {
  const seen = [];
  const mk = fr => ({ search: async () => ({ sources: [] }), context: async () => [], webSearch: async () => ({}), research: async () => ({}),
    gateway: async (m, o) => { seen.push(o); return { success: true, content: '## 結論\n答\n## 資料限制\n無', finish_reason: fr }; } });
  const book = { id: 'civ', title: '民法', cat: 0 };
  const r1 = await A.run({ question: '契約何時成立？', book, books: [], api: mk('STOP') });
  assert.deepEqual(seen.at(-1).thinking, { level: 'low' });
  assert.equal(r1.truncated, false); assert.equal(r1.finishReason, 'STOP');
  const r2 = await A.run({ question: '契約何時成立？', book, books: [], api: mk('MAX_TOKENS') });
  assert.equal(r2.truncated, true);
  await A.run({ question: '契約何時成立？', book, books: [], api: mk(null), flags: { thinking: '' } });
  assert.equal(seen.at(-1).thinking, undefined);
});

// Optional browser check: NODE_PATH=<directory containing playwright> node ui-check.cjs
const { chromium } = require('playwright');
const { readFile } = require('node:fs/promises');
const { createServer } = require('node:http');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const root = resolve(__dirname, '../..');
  const server = createServer(async (req, res) => {
    const path = req.url.split('?')[0];
    try {
      res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/html');
      res.end(await readFile(resolve(root, '.' + path)));
    } catch { res.statusCode = 404; res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/ebook/aivault-ebook-lib.js*', route => route.fulfill({ contentType: 'text/javascript', body: `
      const books = new Map(); window.imports = 0; window.saved = books;
      window.AIVAULTEbook = {SUPABASE_URL:'https://clcddygkaaqqtsbswgdf.supabase.co', ANON_KEY:'public', INGEST:'https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/dark-star-ebook-ingest',
      userToken:()=>window.testToken||'', getBook:async id=>books.get(id), saveBook:async book=>books.set(book.id,book),
      importFile:async(file,meta)=>{const book={id:'book-'+(++window.imports),...meta};books.set(book.id,book);return {book,pages:[{content:'教材正文'}]};}};` }));
    let version = 1, failure = false, calls = [];
    await page.route('**/functions/v1/dark-star-ebook-ingest?feature=tronclass-sync', async route => {
      const input = route.request().postDataJSON(); calls.push(input.action);
      let data = { ok: true, session: 'encrypted' };
      if (input.action === 'prepare') data.captcha = null;
      if (input.action === 'login') {
        assert.equal(input.password, 'test-only');
        if (failure) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'SCHOOL_LOGIN_REQUIRED' }) });
      }
      if (input.action === 'courses') data.courses = [{ id: 1, name: '行政法', semester: '115-1' }];
      if (input.action === 'materials') data.materials = [{ id: 20, name: '行政法.pdf', title: '第一章' }];
      if (input.action === 'download') return route.fulfill({ contentType: 'application/pdf', body: '%PDF-fixture-' + version });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    const url = 'http://127.0.0.1:' + server.address().port + '/aivault-tronclass.html';
    await page.goto(url); await page.click('#prepare');
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('請先登入'));
    assert.equal(calls.length, 0, 'unauthenticated browser must not send school credentials');
    assert.equal(await page.locator('#schoolForm').isVisible(), false);
    await page.evaluate(() => window.testToken = 'owner-token');
    await page.click('#prepare'); await page.locator('#schoolForm').waitFor({ state: 'visible' });
    await page.fill('#student', 'test-student'); await page.fill('#password', 'test-only'); await page.click('#login');
    await page.locator('#syncCard').waitFor({ state: 'visible' }); assert.equal(await page.inputValue('#password'), '');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'mobile overflow');
    async function sync() { await page.click('#sync'); await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('同步結束')); }
    await sync(); assert.equal(await page.evaluate(() => window.imports), 1);
    await sync(); assert.equal(await page.evaluate(() => window.imports), 1, 'same content must not duplicate');
    version = 2; await sync(); assert.equal(await page.evaluate(() => window.imports), 2);
    assert.equal(await page.evaluate(() => window.saved.get('book-1').category), 'TronClass／舊版本');
    await page.click('#clear'); assert.equal(await page.locator('#syncCard').isVisible(), false);
    failure = true; await page.click('#prepare'); await page.locator('#schoolForm').waitFor({ state: 'visible' });
    await page.fill('#student', 'test-student'); await page.fill('#password', 'test-only'); await page.click('#login');
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('東吳登入未成功'));
    assert.equal(await page.locator('#schoolForm').isVisible(), false);
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    assert.ok(!stored.includes('test-only') && !stored.includes('test-student') && !stored.includes('encrypted'));
    if (process.env.TRONCLASS_SCREENSHOT) await page.screenshot({ path: process.env.TRONCLASS_SCREENSHOT, fullPage: true });
    assert.deepEqual(errors, []); console.log('PASS: mobile layout, AIVAULT auth gate, password clearing, import, deduplication, version preservation, clear, login failure, no secret storage');
  } finally { await browser?.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });

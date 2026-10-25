import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
async function setup() {
  const { window, document } = parseHTML(await readFile(new URL('../../aivault-tronclass.html', import.meta.url), 'utf8'));
  const $ = id => document.getElementById(id), storage = new Map(), books = new Map(), calls = [];
  const state = { token: '', version: 1, imports: 0, failLogin: false };
  for (const select of document.querySelectorAll('select')) {
    Object.defineProperty(select, 'options', { get: () => [...select.children] });
    Object.defineProperty(select, 'value', { get() { return this._selected ?? this.children[0]?.getAttribute('value') ?? ''; }, set(v) { this._selected = v; } });
    select.add = option => select.append(option);
  }
  $('schoolForm').reset = () => { for (const id of ['student', 'password', 'captcha']) $(id).value = ''; };
  const localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
  window.AIVAULTEbook = { SUPABASE_URL: 'https://project.test', INGEST: 'https://project.test/ingest', ANON_KEY: 'public', userToken: () => state.token,
    getBook: async id => books.get(id), saveBook: async book => books.set(book.id, book),
    importFile: async (_file, meta) => { const book = { id: 'book-' + (++state.imports), ...meta }; books.set(book.id, book); return { book, pages: [{ content: '正文' }] }; } };
  async function fetch(_url, options) {
    const input = JSON.parse(options.body); calls.push(input.action);
    const data = { ok: true, session: 'sealed-session' };
    if (input.action === 'prepare') data.captcha = null;
    if (input.action === 'login') {
      assert.equal(input.password, 'test-only');
      if (state.failLogin) return new Response(JSON.stringify({ error: 'SCHOOL_LOGIN_REQUIRED' }), { status: 401 });
    }
    if (input.action === 'courses') data.courses = [{ id: 1, name: '行政法', semester: '115-1' }];
    if (input.action === 'materials') data.materials = [{ id: 20, name: '行政法.pdf', title: '第一章' }];
    if (input.action === 'download') return new Response('%PDF-version-' + state.version, { headers: { 'Content-Type': 'application/pdf' } });
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  }
  function Option(text, value) { const option = document.createElement('option'); option.textContent = text; option.setAttribute('value', value); return option; }
  vm.runInNewContext(await readFile(new URL('../../ebook/aivault-tronclass.js', import.meta.url), 'utf8'),
    { window, document, localStorage, crypto, TextEncoder, TextDecoder, fetch, AbortSignal, File, Option, console, Date, setTimeout });
  async function until(fn) { for (let i = 0; i < 100; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 2)); } throw Error('state did not settle'); }
  async function login() {
    await $('prepare').onclick(); $('student').value = 'student-test'; $('password').value = 'test-only';
    $('schoolForm').onsubmit({ preventDefault() {} }); await until(() => !$('syncCard').hidden || $('status').textContent.includes('登入未成功'));
  }
  return { $, state, books, storage, calls, login, until };
}
test('frontend blocks unauthenticated credential entry and clears password after verified login', async () => {
  const x = await setup(); await x.$('prepare').onclick();
  assert.equal(x.calls.length, 0); assert.ok(x.$('schoolForm').hidden);
  x.state.token = 'owner'; await x.login(); assert.ok(!x.$('syncCard').hidden); assert.equal(x.$('password').value, '');
  assert.ok(!JSON.stringify([...x.storage]).includes('student-test'));
});
test('frontend imports once, deduplicates identical bytes, preserves changed versions and clears session', async () => {
  const x = await setup(); x.state.token = 'owner'; await x.login();
  await x.$('sync').onclick(); assert.equal(x.state.imports, 1);
  await x.$('sync').onclick(); assert.equal(x.state.imports, 1);
  x.state.version = 2; await x.$('sync').onclick(); assert.equal(x.state.imports, 2);
  assert.equal(x.books.get('book-1').category, 'TronClass／舊版本');
  const stored = JSON.stringify([...x.storage]); assert.ok(!stored.includes('test-only') && !stored.includes('sealed-session'));
  x.$('clear').onclick(); assert.ok(x.$('syncCard').hidden);
});
test('frontend failed login requires a new form and does not leave password or session in persistent storage', async () => {
  const x = await setup(); x.state.token = 'owner'; x.state.failLogin = true; await x.login();
  assert.ok(x.$('schoolForm').hidden); assert.ok(x.$('syncCard').hidden); assert.equal(x.$('password').value, '');
  assert.equal(x.storage.size, 0);
});

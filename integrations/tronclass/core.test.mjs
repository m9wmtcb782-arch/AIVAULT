import test from 'node:test';
import assert from 'node:assert/strict';
import { CookieJar } from 'tough-cookie';
import { parseHTML } from 'linkedom';
import { BASE, createBridge, schoolURL, seal, unseal, limitedBytes } from './core.mjs';
const json = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
const authenticated = () => ({ phase: 'authenticated', jar: new CookieJar().serializeSync() });
test('URL allowlist rejects foreign destinations, credentials, HTTP and ports', () => {
  for (const url of ['http://tronclass.scu.edu.tw', 'https://tronclass.scu.edu.tw.evil.test',
    'https://user@tronclass.scu.edu.tw', 'https://tronclass.scu.edu.tw:8443', '//evil.test']) {
    assert.throws(() => schoolURL(url));
  }
  assert.equal(schoolURL('/api/my-courses'), BASE + '/api/my-courses');
});
test('sealed session is opaque, user-bound, tamper-resistant and expires', async () => {
  const token = await seal({ cookie: 'PRIVATE-COOKIE' }, 'server-secret', 'owner', 100);
  assert.ok(!token.includes('PRIVATE-COOKIE'));
  assert.equal((await unseal(token, 'server-secret', 'owner', 200)).cookie, 'PRIVATE-COOKIE');
  await assert.rejects(unseal(token, 'server-secret', 'other-user', 200), /SESSION_EXPIRED/);
  await assert.rejects(unseal(token, 'other-secret', 'owner', 200), /SESSION_EXPIRED/);
  await assert.rejects(unseal(token, 'server-secret', 'owner', 1000000), /SESSION_EXPIRED/);
  await assert.rejects(unseal(token.slice(0, -4) + 'AAAA', 'server-secret', 'owner', 200), /SESSION_EXPIRED/);
});
test('prepare preserves hidden form tokens and returns captcha, not raw cookies', async () => {
  let calls = 0;
  const bridge = createBridge({ CookieJar, parseHTML, fetcher: async (url, options) => {
    calls++;
    if (url.includes('/captcha')) return new Response(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'image/png' } });
    return new Response('<form id="fm1" action="/cas/login"><input type="hidden" name="lt" value="LT-test"><input type="hidden" name="execution" value="e9s2"><input name="captcha"></form><img id="captchaImg" src="/cas/captcha.jpg">',
      { headers: { 'Set-Cookie': 'SESSION=private; Secure; HttpOnly; Path=/' } });
  }});
  const data = await bridge.prepare();
  assert.equal(data.state.hidden.lt, 'LT-test'); assert.equal(data.state.hidden.execution, 'e9s2');
  assert.match(data.captcha, /^data:image\/png;base64,/); assert.equal(calls, 2);
});
test('HTML 200 after password submission is not successful login; no automatic password retries', async () => {
  let passwordPosts = 0;
  const bridge = createBridge({ CookieJar, parseHTML, fetcher: async (url, options) => {
    if (url.includes('/cas/login')) passwordPosts++;
    return new Response('<form>登入失敗</form>', { headers: { 'Content-Type': 'text/html' } });
  }});
  await assert.rejects(bridge.login({ ...authenticated(), phase: 'prepared', hidden: { lt: 'token' }, action: BASE + '/cas/login' },
    { username: 'test', password: 'test' }), /SCHOOL_LOGIN_REQUIRED/);
  assert.equal(passwordPosts, 1);
});
test('successful login verified through a JSON course response; password absent from returned state', async () => {
  const bridge = createBridge({ CookieJar, parseHTML, fetcher: async (url, options) => {
    if (url.includes('/cas/login')) {
      assert.equal(options.body.get('password'), 'test-password');
      return new Response('', { headers: { 'Content-Type': 'text/html', 'Set-Cookie': 'auth=yes; Secure; Path=/' } });
    }
    assert.equal(options.method, 'POST'); assert.match(options.headers.get('cookie'), /auth=yes/);
    return json({ courses: [] });
  }});
  const state = await bridge.login({ ...authenticated(), phase: 'prepared', hidden: { lt: 'token' }, action: BASE + '/cas/login' },
    { username: 'test', password: 'test-password' });
  assert.equal(state.phase, 'authenticated'); assert.ok(!JSON.stringify(state).includes('test-password'));
});
test('cross-host redirect cannot repost a password', async () => {
  let count = 0;
  const bridge = createBridge({ CookieJar, parseHTML, fetcher: async () => {
    count++; return new Response(null, { status: 307, headers: { Location: 'https://cas.scu.edu.tw/cas/login' } });
  }});
  await assert.rejects(bridge.login({ ...authenticated(), phase: 'prepared', hidden: {}, action: BASE + '/cas/login' },
    { username: 'test', password: 'test' }), /UNEXPECTED_LOGIN_REDIRECT/);
  assert.equal(count, 1);
});
test('course listing handles pagination and excludes raw response personal fields', async () => {
  const bridge = createBridge({ CookieJar, parseHTML, fetcher: async (_url, options) => {
    const page = JSON.parse(options.body).page;
    return json({ courses: Array.from({ length: page === 1 ? 50 : 1 }, (_, i) => ({ id: (page - 1) * 50 + i + 1, name: '法律', private_field: 'omit' })), pages: 2 });
  }});
  const rows = await bridge.courses(new CookieJar()); assert.equal(rows.length, 51); assert.equal(rows[0].private_field, undefined);
});
test('materials inspect document references and skip assignments and exams', async () => {
  const paths = [];
  const bridge = createBridge({ CookieJar, parseHTML, fetcher: async url => {
    paths.push(url);
    if (url.includes('/courses/')) return json({ activities: [{ id: 11, type: 'material', title: '第一章' }, { id: 12, type: 'exam' }] });
    return json({ upload_references: [{ id: 20, name: '行政法.pdf' }] });
  }});
  const rows = await bridge.materials(new CookieJar(), 1);
  assert.equal(rows.length, 1); assert.equal(rows[0].name, '行政法.pdf'); assert.ok(paths.every(p => !p.includes('/12/')));
});
test('each download freshly requests its URL and never sends school cookies to a different host', async () => {
  let fresh = 0;
  const jar = new CookieJar(); await jar.setCookie('school=private; Secure; Path=/', BASE);
  const bridge = createBridge({ CookieJar, parseHTML, fetcher: async (url, options) => {
    if (url.includes('/reference/')) return json({ url: 'https://tcmedia.scu.edu.tw/download/file/x?token=' + (++fresh) });
    assert.equal(options.headers.get('cookie'), '');
    assert.match(url, new RegExp('token=' + fresh + '$'));
    return new Response('%PDF-test', { headers: { 'Content-Type': 'application/pdf' } });
  }});
  await bridge.download(jar, 20); await bridge.download(jar, 20); assert.equal(fresh, 2);
});
test('foreign signed URL or redirect rejected before external fetch', async () => {
  let calls = 0;
  const bridge = createBridge({ CookieJar, parseHTML, fetcher: async () => { calls++; return json({ url: 'https://evil.test/private' }); }});
  await assert.rejects(bridge.download(new CookieJar(), 20), /UNTRUSTED_SCHOOL_URL/); assert.equal(calls, 1);
});
test('size limits cover both content-length and streamed bytes', async () => {
  await assert.rejects(limitedBytes(new Response('hello', { headers: { 'Content-Length': '100' } }), 4), /FILE_TOO_LARGE/);
  await assert.rejects(limitedBytes(new Response('hello'), 4), /FILE_TOO_LARGE/);
});
test('invalid reference IDs do not reach school servers', async () => {
  const bridge = createBridge({ CookieJar, parseHTML, fetcher: async () => { throw new Error('should not fetch'); } });
  await assert.rejects(bridge.download(new CookieJar(), '../admin'), /INVALID_ID/);
});

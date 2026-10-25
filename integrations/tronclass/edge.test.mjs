import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
let handler;
const source = (await readFile(new URL('../../supabase/functions/dark-star-ebook-ingest/tronclass-sync.ts', import.meta.url), 'utf8'))
  .replace("'npm:tough-cookie@5.1.2'", JSON.stringify(import.meta.resolve('tough-cookie')))
  .replace("'npm:linkedom@0.18.12'", JSON.stringify(import.meta.resolve('linkedom')))
  .replace("'../../../integrations/tronclass/core.mjs'", JSON.stringify(new URL('./core.mjs', import.meta.url).href))
  .replace('(body: unknown,', '(body,');
globalThis.Deno = { env: { get: name => ({ SUPABASE_URL: 'https://project.test', SUPABASE_ANON_KEY: 'public', SUPABASE_SERVICE_ROLE_KEY: 'private' })[name] }, serve: fn => { handler = fn; } };
handler = (await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64'))).tronclassSync;
let role = 'owner', valid = true, authCalls = 0;
globalThis.fetch = async (url, init) => {
  authCalls++; assert.equal(url, 'https://project.test/auth/v1/user');
  assert.ok(!JSON.stringify(init).includes('school-password'));
  return new Response(JSON.stringify(valid ? { id: 'u1', app_metadata: { role } } : { error: 'invalid' }),
    { status: valid ? 200 : 401, headers: { 'Content-Type': 'application/json' } });
};
const request = (body = { action: 'health' }, headers = {}) => new Request('https://project.test/functions/v1/tronclass-sync', {
  method: 'POST', headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body)
});
test('edge origin gate runs before any authentication or school request', async () => {
  const before = authCalls;
  assert.equal((await handler(request({}, { Origin: 'https://evil.test' }))).status, 403);
  assert.equal(authCalls, before);
});
test('edge rejects missing or invalid AIVAULT tokens', async () => {
  assert.equal((await handler(request({}, { Authorization: '' }))).status, 401);
  valid = false; assert.equal((await handler(request())).status, 401); valid = true;
});
test('edge requires trusted app_metadata owner/admin role', async () => {
  role = 'member'; assert.equal((await handler(request())).status, 403);
  role = 'owner'; const response = await handler(request()); assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).version, 'tronclass-sync-v1');
});
test('edge rejects oversized input, unauthenticated school sessions and unknown actions', async () => {
  assert.equal((await handler(request({ action: 'login', password: 'x'.repeat(100001) }))).status, 413);
  assert.equal((await handler(request({ action: 'courses', session: 'tampered' }))).status, 401);
});

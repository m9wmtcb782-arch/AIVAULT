import { CookieJar } from 'npm:tough-cookie@5.1.2';
import { parseHTML } from 'npm:linkedom@0.18.12';
import { BridgeError, createBridge, seal, unseal } from '../../../integrations/tronclass/core.mjs';

const bridge = createBridge({ CookieJar, parseHTML });
const ORIGIN = 'https://m9wmtcb782-arch.github.io';
const headers = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'authorization,apikey,content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Cache-Control': 'no-store', 'Content-Type': 'application/json',
  'Access-Control-Expose-Headers': 'X-Tronclass-Session', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function tronclassSync(req: Request) {
  if (req.headers.get('origin') && req.headers.get('origin') !== ORIGIN) return out({ error: 'ORIGIN_DENIED' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return out({ error: 'POST_REQUIRED' }, 405);
  try {
    const authorization = req.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return out({ error: 'AIVAULT_LOGIN_REQUIRED' }, 401);
    const project = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!project || !anon || !secret) return out({ error: 'SERVER_NOT_CONFIGURED' }, 503);
    const auth = await fetch(project + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: authorization }, signal: AbortSignal.timeout(10000)
    });
    if (!auth.ok) return out({ error: 'AIVAULT_LOGIN_REQUIRED' }, 401);
    const user = await auth.json();
    if (!user.id || !['owner', 'admin'].includes(user.app_metadata?.role)) return out({ error: 'OWNER_ONLY' }, 403);
    // Strictly bounded JSON; never log request bodies, credentials, cookies or signed URLs.
    const reader = req.body?.getReader(); const decoder = new TextDecoder(); let body = '', count = 0;
    if (reader) for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      count += value.length; if (count > 100000) { await reader.cancel(); return out({ error: 'REQUEST_TOO_LARGE' }, 413); }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    const input = JSON.parse(body);
    if (input.action === 'health') return out({ ok: true, version: 'tronclass-sync-v1', private_local_import: true });
    if (input.action === 'prepare') {
      const prepared = await bridge.prepare();
      return out({ ok: true, session: await seal(prepared.state, secret, user.id), captcha: prepared.captcha });
    }
    let state = await unseal(input.session, secret, user.id);
    if (input.action === 'login') {
      state = await bridge.login(state, input);
      return out({ ok: true, session: await seal(state, secret, user.id) });
    }
    if (state.phase !== 'authenticated') throw new BridgeError('SCHOOL_LOGIN_REQUIRED', 401);
    const jar = bridge.restore(state);
    let result;
    if (input.action === 'courses') result = { courses: await bridge.courses(jar) };
    else if (input.action === 'materials') result = { materials: await bridge.materials(jar, input.course_id) };
    else if (input.action === 'download') {
      const file = await bridge.download(jar, input.reference_id, input.preview === true);
      state.jar = jar.serializeSync();
      return new Response(file.bytes, { headers: { ...headers, 'Content-Type': file.type,
        'X-Tronclass-Session': await seal(state, secret, user.id) } });
    } else return out({ error: 'UNKNOWN_ACTION' }, 400);
    state.jar = jar.serializeSync();
    return out({ ok: true, ...result, session: await seal(state, secret, user.id) });
  } catch (error) {
    // Deliberately do not serialize unexpected errors: their messages may contain URLs.
    if (error instanceof BridgeError) return out({ error: error.message }, error.status);
    return out({ error: 'TRONCLASS_REQUEST_FAILED' }, 502);
  }
}

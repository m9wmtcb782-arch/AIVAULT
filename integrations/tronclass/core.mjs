// School credentials are used once; only encrypted, short-lived cookies leave the server.
export const BASE = 'https://tronclass.scu.edu.tw';
const HOSTS = new Set(['tronclass.scu.edu.tw', 'cas.scu.edu.tw', 'tcmedia.scu.edu.tw']);
const MAX_FILE = 15 * 1024 * 1024;
export class BridgeError extends Error {
  constructor(code, status = 400) { super(code); this.status = status; }
}
export function schoolURL(value, base = BASE) {
  const u = new URL(value, base);
  if (u.protocol !== 'https:' || !HOSTS.has(u.hostname) || u.port || u.username || u.password) {
    throw new BridgeError('UNTRUSTED_SCHOOL_URL');
  }
  return u.href;
}
function positiveID(value) {
  if (!/^[1-9]\d{0,15}$/.test(String(value))) throw new BridgeError('INVALID_ID');
  return String(value);
}
function b64(bytes) { return btoa(String.fromCharCode(...bytes)); }
function unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
export async function seal(state, secret, user, now = Date.now()) {
  const key = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode('AIVAULT:tronclass:v1:' + secret)), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = new TextEncoder().encode(JSON.stringify({ ...state, user, expires: now + 15 * 60e3 }));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, body);
  return b64(iv) + '.' + b64(new Uint8Array(cipher));
}
export async function unseal(token, secret, user, now = Date.now()) {
  try {
    if (typeof token !== 'string' || token.length > 100000) throw 0;
    const [iv, body] = token.split('.');
    const key = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256',
      new TextEncoder().encode('AIVAULT:tronclass:v1:' + secret)), 'AES-GCM', false, ['decrypt']);
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(body));
    const state = JSON.parse(new TextDecoder().decode(raw));
    if (state.user !== user || state.expires <= now) throw 0;
    return state;
  } catch { throw new BridgeError('SESSION_EXPIRED', 401); }
}
export async function limitedBytes(response, max = MAX_FILE) {
  if (Number(response.headers.get('content-length') || 0) > max) {
    await response.body?.cancel(); throw new BridgeError('FILE_TOO_LARGE', 413);
  }
  const reader = response.body?.getReader();
  const chunks = []; let length = 0;
  if (reader) for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    length += value.length;
    if (length > max) { await reader.cancel(); throw new BridgeError('FILE_TOO_LARGE', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export function createBridge({ CookieJar, parseHTML, fetcher = fetch }) {
  async function request(jar, path, options = {}) {
    let url = schoolURL(path), method = options.method || 'GET', body = options.body;
    for (let i = 0; i < 10; i++) {
      const headers = new Headers(options.headers);
      headers.set('Cookie', await jar.getCookieString(url));
      const response = await fetcher(url, { method, body, headers, redirect: 'manual', signal: AbortSignal.timeout(20000) });
      for (const cookie of response.headers.getSetCookie()) await jar.setCookie(cookie, url);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const next = schoolURL(response.headers.get('location'), url);
        await response.body?.cancel();
        // A password is never reposted across a redirect, even to another allowed host.
        if (method === 'POST' && [307, 308].includes(response.status)) throw new BridgeError('UNEXPECTED_LOGIN_REDIRECT');
        if (response.status === 303 || ([301, 302].includes(response.status) && method === 'POST')) {
          method = 'GET'; body = undefined;
        }
        url = next; continue;
      }
      if (!response.ok) { await response.body?.cancel(); throw new BridgeError('SCHOOL_HTTP_' + response.status, 502); }
      return { response, url };
    }
    throw new BridgeError('TOO_MANY_REDIRECTS', 502);
  }
  async function json(jar, path, options) {
    const { response } = await request(jar, path, options);
    if (!/application\/json/i.test(response.headers.get('content-type') || '')) {
      await response.body?.cancel(); throw new BridgeError('SCHOOL_LOGIN_REQUIRED', 401);
    }
    return JSON.parse(new TextDecoder().decode(await limitedBytes(response, 4 * 1024 * 1024)));
  }
  async function coursePage(jar, page = 1) {
    return await json(jar, '/api/my-courses', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, page_size: 50, fields: 'id,name,semester,academic_year', conditions: {} }) });
  }
  async function prepare() {
    const jar = new CookieJar();
    const { response, url } = await request(jar, '/login?next=/user/index');
    const { document } = parseHTML(new TextDecoder().decode(await limitedBytes(response, 1024 * 1024)));
    const form = document.querySelector('form#fm1') || document.querySelector('form');
    if (!form) throw new BridgeError('LOGIN_FORM_CHANGED', 502);
    const action = schoolURL(form.getAttribute('action') || url, url);
    if (!new URL(action).pathname.startsWith('/cas/login')) throw new BridgeError('LOGIN_FORM_CHANGED', 502);
    const hidden = {};
    for (const input of form.querySelectorAll('input[type="hidden"]')) hidden[input.name] = input.value;
    if (!hidden.lt) throw new BridgeError('LOGIN_FORM_CHANGED', 502);
    const captchaInput = form.querySelector('input[name="captcha"]');
    let image = null;
    if (captchaInput) {
      const img = document.querySelector('img#captcha, img#captchaImg, img#captchaImage, img[src*="captcha"]');
      if (!img) throw new BridgeError('CAPTCHA_LAYOUT_CHANGED', 502);
      const { response: cap } = await request(jar, schoolURL(img.getAttribute('src'), url));
      const type = (cap.headers.get('content-type') || '').split(';')[0];
      if (!/^image\/(png|jpeg|gif|webp)$/.test(type)) throw new BridgeError('CAPTCHA_FORMAT_UNSUPPORTED');
      image = 'data:' + type + ';base64,' + b64(await limitedBytes(cap, 65536));
    }
    return { state: { phase: 'prepared', jar: jar.serializeSync(), action, hidden }, captcha: image };
  }
  async function login(state, input) {
    if (state.phase !== 'prepared') throw new BridgeError('PREPARE_LOGIN_FIRST');
    if (!input.username || !input.password || String(input.username).length > 100 || String(input.password).length > 512) {
      throw new BridgeError('CREDENTIALS_REQUIRED');
    }
    const jar = CookieJar.deserializeSync(state.jar);
    const fields = new URLSearchParams({ ...state.hidden, username: String(input.username),
      password: String(input.password), captcha: String(input.captcha || ''), _eventId: 'submit', submit: '登錄' });
    const { response } = await request(jar, state.action, { method: 'POST', body: fields,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    await response.body?.cancel();
    // A 200 HTML page or redirect is not evidence of successful authentication.
    const first = await coursePage(jar);
    if (!Array.isArray(first.courses)) throw new BridgeError('COURSE_RESPONSE_CHANGED', 502);
    return { phase: 'authenticated', jar: jar.serializeSync() };
  }
  async function courses(jar) {
    const all = [];
    for (let page = 1; page <= 100; page++) {
      const data = await coursePage(jar, page);
      if (!Array.isArray(data.courses)) throw new BridgeError('COURSE_RESPONSE_CHANGED', 502);
      all.push(...data.courses.map(c => ({ id: c.id, name: c.name, semester: c.semester || '', academic_year: c.academic_year || '' })));
      if ((data.pages && page >= data.pages) || data.courses.length < 50) return all;
    }
    throw new BridgeError('COURSE_PAGE_LIMIT', 502);
  }
  async function materials(jar, courseID) {
    const course = positiveID(courseID);
    const data = await json(jar, `/api/courses/${course}/activities?sub_course_id=0`);
    if (!Array.isArray(data.activities)) throw new BridgeError('MATERIAL_RESPONSE_CHANGED', 502);
    const rows = [], seen = new Set();
    for (const activity of data.activities) {
      // Only material activities; never invoke exams, attendance, or assignments.
      if (!['material', 'document', 'file', 'online_document'].includes(activity.type)) continue;
      let refs = activity.upload_references;
      if (!Array.isArray(refs)) {
        const details = await json(jar, `/api/activities/${positiveID(activity.id)}/upload_references`);
        refs = Array.isArray(details) ? details : details.upload_references;
      }
      if (!Array.isArray(refs)) throw new BridgeError('REFERENCE_RESPONSE_CHANGED', 502);
      for (const ref of refs) {
        const id = positiveID(ref.id);
        if (seen.has(id)) continue; seen.add(id);
        rows.push({ id, activity_id: activity.id, title: activity.title || activity.name || '',
          name: ref.name || ref.upload?.name || ref.file_name || '',
          chapter: activity.module_name || activity.syllabus_name || '',
          version: ref.updated_at || ref.upload?.updated_at || '' });
      }
    }
    return rows;
  }
  async function download(jar, referenceID, preview = false) {
    const id = positiveID(referenceID);
    const data = await json(jar, `/api/uploads/reference/document/${id}/url?preview=${preview ? 'true' : 'false'}`);
    if (!data.url || typeof data.url !== 'string') throw new BridgeError('DOWNLOAD_URL_MISSING', 502);
    const { response } = await request(jar, schoolURL(data.url));
    const type = response.headers.get('content-type') || 'application/octet-stream';
    if (/text\/html|application\/json/i.test(type)) { await response.body?.cancel(); throw new BridgeError('DOWNLOAD_NOT_A_DOCUMENT', 502); }
    return { bytes: await limitedBytes(response), type };
  }
  return { prepare, login, courses, materials, download, restore: s => CookieJar.deserializeSync(s.jar) };
}

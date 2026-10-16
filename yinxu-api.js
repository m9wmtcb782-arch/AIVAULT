/* 因序小說：後端呼叫（dark-star-ebook-ingest?feature=yinxu），使用登入者 token。 */
window.YinxuAPI = (function () {
  var C = window.YINXU_CFG || {}, KEY = 'sb-clcddygkaaqqtsbswgdf-auth-token';
  var MOCK = new URLSearchParams(location.search).get('mock') === '1';
  function sess() { try { var j = JSON.parse(localStorage.getItem(KEY) || 'null'); return j && (j.currentSession || j); } catch (_) { return null; } }
  function loggedIn() { var s = sess(); return !!(s && s.refresh_token); }
  async function token() {
    var s = sess(); if (!s || !s.refresh_token) return '';
    if (s.access_token && (!s.expires_at || s.expires_at * 1000 > Date.now() + 60000)) return s.access_token;
    var r = await fetch(C.url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: C.anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) });
    if (!r.ok) return ''; var n = await r.json(); localStorage.setItem(KEY, JSON.stringify(n)); return n.access_token || '';
  }
  async function call(action, body) {
    if (MOCK && window.__yinxuMockApi) return window.__yinxuMockApi(action, body || {});
    var t = await token(); if (!t) { var e = new Error('請先登入'); e.status = 401; throw e; }
    var r = await fetch(C.url + '/functions/v1/dark-star-ebook-ingest?feature=yinxu', { method: 'POST', headers: { apikey: C.anon, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ action: action }, body || {})) });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) { var er = new Error(d.error || ('HTTP ' + r.status)); er.status = r.status; er.data = d; throw er; }
    return d;
  }
  function loginUrl() { return 'aivault-login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search); }
  return { call: call, loggedIn: function () { return MOCK || loggedIn(); }, loginUrl: loginUrl };
})();

/* AIVAULT 機密頁外殼：登入後從 Supabase（RLS：authenticated）讀取頁面內容並渲染。
   內容不在公開 repo。失敗 → 導向登入頁。 */
(function () {
  var URL_ = 'https://clcddygkaaqqtsbswgdf.supabase.co';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE';
  var KEY = 'sb-clcddygkaaqqtsbswgdf-auth-token';
  var slug = document.currentScript && document.currentScript.getAttribute('data-slug');
  var pages = ((document.currentScript && document.currentScript.getAttribute('data-pages')) || '').split(',');
  var want = new URLSearchParams(location.search).get('page');
  if (want && pages.indexOf(want) >= 0) slug = want;
  function toLogin(why) {
    try { console.warn('AIVAULT private page:', why); } catch (_) {}
    location.replace('aivault-login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search));
  }
  function sess() { try { var j = JSON.parse(localStorage.getItem(KEY) || 'null'); return j && (j.currentSession || j); } catch (_) { return null; } }
  async function token() {
    var s = sess(); if (!s || !s.refresh_token) return '';
    if (s.access_token && (!s.expires_at || s.expires_at * 1000 > Date.now() + 30000)) return s.access_token;
    var r = await fetch(URL_ + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) });
    if (!r.ok) return '';
    var n = await r.json(); localStorage.setItem(KEY, JSON.stringify(n)); return n.access_token || '';
  }
  async function run() {
    var t = await token(); if (!t) return toLogin('no session');
    var r = await fetch(URL_ + '/rest/v1/aivault_private_pages?select=html&slug=eq.' + encodeURIComponent(slug), { headers: { apikey: ANON, Authorization: 'Bearer ' + t }, cache: 'no-store' });
    if (r.status === 401) return toLogin('401');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var rows = await r.json(); if (!rows.length || !rows[0].html) return toLogin('no access');
    document.open(); document.write(rows[0].html); document.close();
  }
  if (!slug || !sess()) return toLogin('no session');
  run().catch(function (e) {
    document.documentElement.style.visibility = '';
    document.body.innerHTML = '<p style="font-family:system-ui;padding:24px">載入失敗：' + String(e && e.message || e).replace(/[<>&]/g, '') + ' <a href="">重試</a> · <a href="aivault-login.html">登入</a></p>';
  });
})();

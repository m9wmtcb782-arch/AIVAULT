/* 因序小說書架：類型分類分頁＋「1000 人工作區」長篇連載（擁有者核准後才上架）。
   獨立檔案；關閉：localStorage.yinxuFloorShelfOff = '1'。不改動原本書架的書與功能。 */
(function () {
  if (localStorage.getItem('yinxuFloorShelfOff') === '1') return;
  var URL_ = 'https://clcddygkaaqqtsbswgdf.supabase.co', KEY = 'sb-clcddygkaaqqtsbswgdf-auth-token';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE';
  var MOCK = window.__floorShelfMock;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sess() { try { var j = JSON.parse(localStorage.getItem(KEY) || 'null'); return j && (j.currentSession || j); } catch (_) { return null; } }
  async function token() { var s = sess(); if (!s || !s.refresh_token) return ''; if (s.access_token && (!s.expires_at || s.expires_at * 1000 > Date.now() + 60000)) return s.access_token;
    var r = await fetch(URL_ + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) }); if (!r.ok) return ''; var n = await r.json(); localStorage.setItem(KEY, JSON.stringify(n)); return n.access_token || ''; }
  async function api(action, body) { if (MOCK) return MOCK(action, body || {}); var t = await token(); if (!t) throw new Error('login');
    var r = await fetch(URL_ + '/functions/v1/dark-star-ebook-ingest?feature=floor', { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ action: action }, body || {})) });
    var d = await r.json().catch(function () { return {}; }); if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status)); return d; }
  var css = document.createElement('style');
  css.textContent = '.yfs-tabs{display:flex;gap:6px;overflow-x:auto;padding:4px 0 10px;-webkit-overflow-scrolling:touch}.yfs-tab{flex:none;border:1px solid #273244;background:#0f1520;color:#e5e7eb;border-radius:999px;padding:6px 12px;font:inherit;font-size:14px}.yfs-tab.on{background:#a78bfa;color:#0b0b12;border-color:#a78bfa}' +
    '.yfs-h{margin:18px 0 8px;font-size:16px}.yfs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.yfs-book{border:1px solid #1f2937;border-radius:12px;padding:10px;background:#0c111a;text-align:left;color:inherit;font:inherit}' +
    '.yfs-g{font-size:12px;border-radius:6px;padding:1px 6px;background:#1f2937}.yfs-s{font-size:12px;color:#fbbf24}.yfs-read{position:fixed;inset:0;z-index:50;background:#07090d;overflow:auto;padding:calc(env(safe-area-inset-top) + 10px) 16px 40px}.yfs-read .tx{white-space:pre-wrap;line-height:1.9;font-size:17px;max-width:720px;margin:0 auto}' +
    '.yfs-nav{display:flex;gap:8px;justify-content:space-between;max-width:720px;margin:12px auto}.yfs-nav button,.yfs-nav select{border:1px solid #273244;background:#151c29;color:#e5e7eb;border-radius:10px;padding:8px 12px;font:inherit}';
  document.head.appendChild(css);
  var shelf = document.getElementById('shelf'); if (!shelf) return;
  var tabs = document.createElement('div'); tabs.className = 'yfs-tabs'; shelf.parentNode.insertBefore(tabs, shelf);
  var box = document.createElement('div'); shelf.parentNode.insertBefore(box, shelf.nextSibling);
  var books = [], genres = [], cur = '全部';
  function drawTabs() { var list = ['全部', '因序互動'].concat(genres.filter(function (g) { return books.some(function (b) { return b.genre === g; }); }));
    tabs.innerHTML = list.map(function (g) { return '<button class="yfs-tab' + (g === cur ? ' on' : '') + '" data-g="' + esc(g) + '">' + esc(g) + (g !== '全部' && g !== '因序互動' ? ' ' + books.filter(function (b) { return b.genre === g; }).length : '') + '</button>'; }).join(''); }
  function draw() { drawTabs(); shelf.style.display = (cur === '全部' || cur === '因序互動') ? '' : 'none';
    var bs = cur === '因序互動' ? [] : books.filter(function (b) { return cur === '全部' || b.genre === cur; });
    box.innerHTML = bs.length ? '<h3 class="yfs-h">🏢 AI 工作區長篇</h3><div class="yfs-grid">' + bs.map(function (b) {
      return '<button class="yfs-book" data-b="' + b.id + '"><span class="yfs-g">' + esc(b.genre) + '</span> <span class="yfs-s">' + (b.status === 'done' ? '完結' : '連載中') + '</span><br><b>《' + esc(b.title || '未命名') + '》</b><br><small class="muted">' + b.chapters_done + '/' + b.target_chapters + ' 章 · ' + Math.round((b.chars || 0) / 1000) / 10 + ' 萬字</small><br><small>📜 看文字</small></button>'; }).join('') + '</div>' : (cur !== '全部' && cur !== '因序互動' ? '<p class="muted">這個類型還沒有核准上架的作品。</p>' : ''); }
  tabs.addEventListener('click', function (e) { var t = e.target.closest('[data-g]'); if (t) { cur = t.dataset.g; draw(); } });
  box.addEventListener('click', function (e) { var t = e.target.closest('[data-b]'); if (t) read(t.dataset.b, 1); });
  var rd = null;
  async function read(id, ch) { var b = books.filter(function (x) { return x.id === id; })[0]; if (!b) return;
    if (!rd) { rd = document.createElement('div'); rd.className = 'yfs-read'; document.body.appendChild(rd); }
    rd.style.display = 'block'; rd.innerHTML = '<p class="muted">載入中…</p>';
    try { var d = await api('shelf_chapter', { book_id: id, ch: ch }), c = d.chapter;
      var opts = b.chapters.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === ch ? ' selected' : '') + '>第' + x[0] + '章 ' + esc(x[1] || '') + '</option>'; }).join('');
      var nav = '<div class="yfs-nav"><button data-x="close">✕ 關閉</button><select data-x="sel">' + opts + '</select><span><button data-x="prev"' + (ch <= 1 ? ' disabled' : '') + '>‹</button> <button data-x="next"' + (ch >= b.chapters.length ? ' disabled' : '') + '>›</button></span></div>';
      rd.innerHTML = nav + '<div class="tx"><h2>《' + esc(b.title) + '》</h2>' + (c ? '<h3>第' + c.ch + '章 ' + esc(c.title || '') + '</h3><p class="muted" style="font-size:13px">執筆：' + esc(c.agent_name || c.agent_id) + ' · ' + esc(c.model || '') + ' · ' + c.chars + ' 字</p>' + esc(c.text) : '<p class="muted">這一章還在寫。</p>') + '</div>' + nav;
      rd.querySelectorAll('[data-x]').forEach(function (el) { var x = el.dataset.x;
        if (x === 'sel') el.onchange = function () { read(id, Number(el.value)); };
        else el.onclick = function () { if (x === 'close') rd.style.display = 'none'; if (x === 'prev') read(id, ch - 1); if (x === 'next') read(id, ch + 1); }; });
      rd.scrollTop = 0; } catch (e) { rd.innerHTML = '<p>載入失敗：' + esc(e.message) + ' <button onclick="this.closest(\'.yfs-read\').style.display=\'none\'">關閉</button></p>'; } }
  function load() { api('shelf', {}).then(function (d) { books = d.books || []; genres = d.genres || []; draw(); }).catch(function () { draw(); }); }
  draw(); load();
  window.__yinxuFloorShelf = { books: function () { return books; } };
})();

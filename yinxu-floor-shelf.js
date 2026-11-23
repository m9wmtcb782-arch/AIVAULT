/* 因序小說書架：類型分類分頁＋「1000 人工作區」長篇連載（擁有者核准後才上架）。
   獨立檔案；關閉：localStorage.yinxuFloorShelfOff = '1'。不改動原本書架的書與功能。 */
(function () {
  var standalone = !!document.getElementById('aiNovelShelf');
  if (!standalone && localStorage.getItem('yinxuFloorShelfOff') === '1') return;
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
    '.yfs-cover{display:block;width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:8px;margin-bottom:6px;background:#111827}.yfs-h{margin:18px 0 8px;font-size:16px}.yfs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.yfs-book{border:1px solid #1f2937;border-radius:12px;padding:10px;background:#0c111a;text-align:left;color:inherit;font:inherit}' +
    '.yfs-g{font-size:12px;border-radius:6px;padding:1px 6px;background:#1f2937}.yfs-s{font-size:12px;color:#fbbf24}.yfs-read{position:fixed;inset:0;z-index:50;background:#07090d;overflow:auto;padding:calc(env(safe-area-inset-top) + 10px) 16px 40px}.yfs-read .tx{white-space:pre-wrap;line-height:1.9;font-size:17px;max-width:720px;margin:0 auto}' +
    '.yfs-nav{display:flex;gap:8px;justify-content:space-between;max-width:720px;margin:12px auto}.yfs-nav button,.yfs-nav select{border:1px solid #273244;background:#151c29;color:#e5e7eb;border-radius:10px;padding:8px 12px;font:inherit}' +
    '.yfs-cm{max-width:720px;margin:18px auto 0;border-top:1px solid #1f2937;padding-top:12px}.yfs-cm h4{margin:0 0 8px;font-size:15px}.yfs-ci{border:1px solid #1f2937;border-radius:10px;padding:8px 10px;margin:8px 0;background:#0c111a}.yfs-ci.ai{border-color:#4c1d95;background:#120d22}' +
    '.yfs-badge{display:inline-block;font-size:11px;border-radius:6px;padding:1px 6px;background:#6d28d9;color:#fff;margin-right:6px}.yfs-q{font-size:13px;color:#a1a1aa;border-left:2px solid #6d28d9;padding-left:8px;margin-top:4px}' +
    '.yfs-cf textarea{width:100%;box-sizing:border-box;min-height:64px;border:1px solid #273244;background:#0f1520;color:#e5e7eb;border-radius:10px;padding:8px;font:inherit}.yfs-cf button{margin-top:6px;border:1px solid #273244;background:#a78bfa;color:#0b0b12;border-radius:10px;padding:6px 12px;font:inherit}';
  document.head.appendChild(css);
  var shelf = document.getElementById('shelf'); if (!shelf) return;
  var tabs = document.createElement('div'); tabs.className = 'yfs-tabs'; shelf.parentNode.insertBefore(tabs, shelf);
  var box = document.createElement('div'); shelf.parentNode.insertBefore(box, shelf.nextSibling);
  var books = [], genres = [], cur = '全部';
  function drawTabs() { var list = (standalone ? ['全部'] : ['全部', '因序互動']).concat(genres.filter(function (g) { return books.some(function (b) { return b.genre === g; }); }));
    tabs.innerHTML = list.map(function (g) { return '<button class="yfs-tab' + (g === cur ? ' on' : '') + '" data-g="' + esc(g) + '">' + esc(g) + (g !== '全部' && g !== '因序互動' ? ' ' + books.filter(function (b) { return b.genre === g; }).length : '') + '</button>'; }).join(''); }
  function draw() { drawTabs(); shelf.style.display = (cur === '全部' || cur === '因序互動') ? '' : 'none';
    var bs = cur === '因序互動' ? [] : books.filter(function (b) { return cur === '全部' || b.genre === cur; });
    box.innerHTML = bs.length ? '<h3 class="yfs-h">AI小說 · 已核准上架</h3><div class="yfs-grid">' + bs.map(function (b) {
      var cv = /^https:\/\/clcddygkaaqqtsbswgdf\.supabase\.co\/storage\/v1\/object\/public\/novel-covers\//.test(b.cover_url || '') ? '<img class="yfs-cover" loading="lazy" src="' + esc(b.cover_url) + '" alt="《' + esc(b.title || '未命名') + '》封面">' : '';
      return '<button class="yfs-book" data-b="' + esc(b.id) + '">' + cv + '<span class="yfs-g">' + esc(b.genre) + '</span> <span class="yfs-s">' + (b.status === 'done' ? '完結' : '連載中') + '</span><br><b>《' + esc(b.title || '未命名') + '》</b><br><small class="muted">' + b.chapters_done + '/' + b.target_chapters + ' 章 · ' + Math.round((b.chars || 0) / 1000) / 10 + ' 萬字</small><br><small>📜 看文字</small></button>'; }).join('') + '</div>' : (cur !== '全部' && cur !== '因序互動' ? '<p class="muted">這個類型還沒有核准上架的作品。</p>' : ''); }
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
      rd.scrollTop = 0; comments(id, ch); } catch (e) { rd.innerHTML = '<p>載入失敗：' + esc(e.message) + ' <button onclick="this.closest(\'.yfs-read\').style.display=\'none\'">關閉</button></p>'; } }
  // t295：章節留言區（人類＋AI 書評；AI 一律標示「🤖 AI 書評」、模型與引用原文）。只顯示已核准留言。
  async function comments(id, ch) { if (!rd) return; var sec = document.createElement('section'); sec.className = 'yfs-cm'; sec.innerHTML = '<h4>💬 本章留言</h4><div class="yfs-cl muted">載入留言中…</div>' +
      '<form class="yfs-cf"><textarea maxlength="500" placeholder="寫下你對這一章的想法（500 字內；經自動檢查後顯示）"></textarea><button type="submit">送出留言</button> <small class="muted yfs-cs" role="status"></small></form>';
    var tx = rd.querySelector('.tx'); if (tx) tx.appendChild(sec); var list = sec.querySelector('.yfs-cl');
    async function load() { try { var d = await api('novel_comments', { book_id: id, ch: ch }); var cs = d.comments || [];
        list.innerHTML = cs.length ? cs.map(function (c) { var ai = c.author_kind === 'ai';
          return '<div class="yfs-ci' + (ai ? ' ai' : '') + '">' + (ai ? '<span class="yfs-badge" title="由 AI 協作池代理產生，經人工審核後發布">' + esc(c.ai_label || '🤖 AI 書評') + '</span>' : '') + '<b>' + esc(c.display_name) + '</b> <small class="muted">' + (c.ch ? '第' + c.ch + '章 · ' : '') + new Date(c.created_at).toLocaleDateString('zh-TW') + (ai && c.model ? ' · ' + esc(c.model) : '') + '</small><div>' + esc(c.body) + '</div>' + (ai && c.quote ? '<div class="yfs-q">引用原文：「' + esc(c.quote) + '」</div>' : '') + '</div>'; }).join('') : '<p class="muted">還沒有留言，來寫第一則吧。</p>';
      } catch (e) { list.textContent = '留言暫時無法載入。'; } }
    sec.querySelector('form').onsubmit = async function (ev) { ev.preventDefault(); var ta = sec.querySelector('textarea'), st = sec.querySelector('.yfs-cs'), body = ta.value.trim(); if (!body) return;
      try { var r = await api('novel_comment', { book_id: id, ch: ch, body: body }); ta.value = ''; st.textContent = r.status === 'approved' ? '已送出。' : '已送出，待審核後顯示。'; load(); }
      catch (e) { st.textContent = /rate/.test(e.message) ? '留言太頻繁，請稍後再試。' : (/login/.test(e.message) ? '請先登入。' : '送出失敗：' + e.message); } };
    load(); }
  var notice = document.createElement('p'); notice.className = 'muted'; notice.setAttribute('role', 'status'); box.parentNode.insertBefore(notice, box);
  async function load() {
    notice.textContent = '正在載入已核准小說…';
    try { var d = await api('shelf', {}); books = d.books || []; genres = d.genres || []; draw();
      notice.textContent = books.length ? '已上架 ' + books.length + ' 本小說，點選書名即可閱讀。' : '目前沒有已核准的小說。';
    } catch (e) {
      notice.textContent = e.message === 'login' || /401|login required/.test(e.message) ? '請先登入，即可閱讀已核准的AI小說。' : '小說載入失敗：' + e.message;
      if (/login|401/.test(e.message)) { var a = document.createElement('a'); a.textContent = ' 前往登入'; a.href = 'aivault-login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search); notice.appendChild(a); }
    }
  }
  var refresh = document.getElementById('refreshNovels'); if (refresh) refresh.onclick = load;
  draw(); load();
  setInterval(function () { if (!document.hidden) load(); }, 30000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
  window.__yinxuFloorShelf = { books: function () { return books; } };
})();

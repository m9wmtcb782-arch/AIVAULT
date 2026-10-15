/* 暗星學習書籍：每位使用者自己勾選讓暗星讀哪些書（存在後端 dark_star_study_books）。
   - 書架（dark-star-ebook.html）：每張伺服器書卡加「⭐ 讓暗星學習」切換
   - 暗星頁（technical-dark-star.html）：⚙️ 設定面板內加「暗星學習書籍」勾選清單
   - 未登入：回傳 null（= 全部書，維持原行為）；已登入但沒有任何設定：預設只有宪法学讲义 */
(function (w, d) {
  "use strict";
  if (w.AIVAULTStudyBooks) return;
  var INGEST = "https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/dark-star-ebook-ingest", ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE";
  var DEFAULT_IDS = ["e0bc8c57-646d-474c-988e-d6cb3d4f8972", "840b333d-4329-4d47-80e2-a1b9d92aec03"];
  var cache = null, loading = null, serverIds = null, serverIdsLoading = null;
  function isUuid(id) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || "")); }
  async function loadServerIds(force) {
    if (serverIds && !force) return serverIds;
    if (serverIdsLoading) return serverIdsLoading;
    serverIdsLoading = fetch(INGEST, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON }, body: JSON.stringify({ action: "list", limit: 100 }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var m = {};
        ((j && (j.books || j.items)) || []).forEach(function (b) {
          var id = b && (b.id || b.ebook_id); if (id && Number(b.total_pages || b.page_count || 0) > 0) m[String(id)] = b;
        });
        serverIds = m; return m;
      })
      .catch(function () { serverIds = serverIds || {}; return serverIds; })
      .then(function (m) { serverIdsLoading = null; return m; });
    return serverIdsLoading;
  }
  function friendlyErr(err, fallback) {
    var raw = String((err && err.message) || err || "");
    try { console.error("[AIVAULTStudyBooks]", raw, err); } catch (e) {}
    if (/foreign key|ebook_id_fkey|violates foreign key/i.test(raw))
      return "這本書還沒同步到伺服器（或已從伺服器刪除），無法加入暗星學習。請只對書架上的雲端電子書按 ⭐。";
    if (/BOOK_NOT_FOUND|not found/i.test(raw))
      return "找不到這本雲端電子書，可能已刪除或尚未上傳。";
    if (/請先登入|Unauthorized|401/i.test(raw))
      return "請先登入 AIVAULT，才能設定暗星學習書籍。";
    if (/網路|Failed to fetch|NetworkError|Load failed/i.test(raw))
      return "網路錯誤，暫時無法儲存暗星學習設定，請稍後再試。";
    return fallback || ("操作失敗：" + raw.slice(0, 80));
  }
  var cache = null, loading = null;
  // 與即時語音（technical-dark-star-live-session.js accessToken）相同的取 token 方式：
  // 讀 sb-<ref>-auth-token；過期或快過期時用 refresh_token 換新並寫回（電子書頁沒有 supabase client 會自動續期）
  var AUTH_KEY = "sb-clcddygkaaqqtsbswgdf-auth-token", PUB = "sb_publishable_1D05YGthBrNGg-5L92TLCw_GiLnInBu";
  function session() { try { var j = JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); return j && typeof j === "object" ? j : null; } catch (e) { return null; } }
  var refreshing = null;
  async function token(force) {
    var j = session(); if (!j) return "";
    var cs = j.currentSession || {}, t = String(j.access_token || cs.access_token || "").trim();
    var rt = String(j.refresh_token || cs.refresh_token || "").trim(), exp = Number(j.expires_at || cs.expires_at || 0);
    if (!rt || !(force || !t || (exp > 0 && exp * 1000 - Date.now() < 60000))) return t;
    if (!refreshing) refreshing = (async function () {
      try {
        var r = await fetch("https://clcddygkaaqqtsbswgdf.supabase.co/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { "Content-Type": "application/json", apikey: PUB }, body: JSON.stringify({ refresh_token: rt }) });
        if (!r.ok) return t;
        var f = await r.json(); if (!f || !f.access_token) return t;
        var m = Object.assign({}, j, f, { access_token: f.access_token, refresh_token: f.refresh_token || rt });
        try { localStorage.setItem(AUTH_KEY, JSON.stringify(m)); } catch (e) {}
        return String(f.access_token);
      } catch (e) { return t; } finally { setTimeout(function () { refreshing = null; }, 0); }
    })();
    return refreshing;
  }
  async function call(body) {
    var t = await token(false);
    if (!t) return { ok: true, logged_in: false, reason: "no_session", books: [] };
    async function go(tok) {
      var r = await fetch(INGEST, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + tok }, body: JSON.stringify(body) });
      var j = await r.json().catch(function () { return { error: "回應不是 JSON（HTTP " + r.status + "）" }; });
      j.__status = r.status; return j;
    }
    var j;
    try { j = await go(t); }
    catch (e) { return { ok: false, logged_in: false, reason: "network", error: String(e && e.message || e), books: [] }; }
    // 平台 401／logged_in:false → 強制續期後重試一次
    if (j.__status === 401 || j.logged_in === false) {
      try {
        var t2 = await token(true);
        if (t2 && t2 !== t) j = await go(t2);
      } catch (e) { /* keep j */ }
    }
    if (j.__status === 401 || j.logged_in === false) j.reason = j.reason || "server_rejected";
    else if (j.__status >= 500 || (j.error && j.logged_in !== true && j.ok === false)) j.reason = "server_error";
    else if (j.__status && j.__status >= 400 && j.logged_in !== true) j.reason = "server_error";
    return j;
  }
  function apply(r) {
    if (!r || !r.logged_in) { cache = { logged_in: false, reason: (r && r.reason) || "error", error: r && (r.error || r.message), status: r && r.__status, enabled: null, rows: {} }; return cache; }
    var rows = {}; (r.books || []).forEach(function (x) { rows[x.ebook_id] = !!x.enabled; });
    var en = {}; var ids = Object.keys(rows);
    if (!ids.length) DEFAULT_IDS.forEach(function (id) { en[id] = 1; }); else ids.forEach(function (id) { if (rows[id]) en[id] = 1; });
    cache = { logged_in: true, enabled: en, rows: rows }; return cache;
  }
  function get(force) {
    if (cache && !force) return Promise.resolve(cache);
    if (loading) return loading;
    loading = call({ action: "study_list" }).then(apply, function (e) { return apply({ ok: false, logged_in: false, reason: "network", error: String(e && e.message || e) }); }).then(function (c) { loading = null; return c; });
    return loading;
  }
  async function set(id, on) {
    var c = await get();
    if (!c.logged_in) c = await get(true);
    if (!c.logged_in) throw new Error(loginMsg(c));
    id = String(id || "");
    if (!isUuid(id)) throw new Error("這不是雲端電子書編號，無法加入暗星學習。");
    var live = await loadServerIds(true);
    if (!live[id]) throw new Error("這本書還沒同步到伺服器（或已從伺服器刪除），無法加入暗星學習。");
    var items = [{ ebook_id: id, enabled: !!on }];
    // 第一次設定時，只寫「伺服器上仍存在」的預設書，避免 FK
    if (!Object.keys(c.rows).length) DEFAULT_IDS.forEach(function (x) {
      if (x !== id && live[x]) items.push({ ebook_id: x, enabled: true });
    });
    var r = await call({ action: "study_set", items: items });
    if (!r || r.ok === false || r.error) throw new Error(friendlyErr({ message: (r && r.error) || "儲存失敗" }));
    apply(r);
    try { w.dispatchEvent(new CustomEvent("darkstar-study-changed", { detail: cache })); } catch (e) {}
    return cache;
  }
  function loginMsg(c) {
    var detail = "";
    if (c) {
      if (c.status) detail += " HTTP " + c.status;
      if (c.error) detail += " " + String(c.error).slice(0, 120);
    }
    if (c && c.reason === "no_session") return "這個頁面找不到 AIVAULT 登入資料（同一個瀏覽器先到 AIVAULT 首頁登入，再回來重新整理）。未登入時暗星會讀全部書。";
    if (c && c.reason === "server_rejected") return "伺服器不接受目前的登入（可能已過期且無法自動續期），請重新登入 AIVAULT 後再試。" + detail;
    if (c && c.reason === "network") return "網路錯誤，暗星學習設定讀不到，請稍後再試。" + detail;
    if (c && c.reason === "server_error") return "伺服器忙碌，暗星學習設定讀不到。" + detail + "（請稍後再試）";
    return "暗星學習設定暫時無法使用，請確認已登入後重新整理再試。" + detail;
  }
  w.AIVAULTStudyBooks = { get: get, set: set, isEnabled: function (id) { return !cache || !cache.enabled || !!cache.enabled[id]; } };

  // ---- 學習進度（來自 darkstar-book-qa.js 的索引頁數／全書頁數）----
  function pctLabel(p) {
    if (!p || !p.total) return "學習 0%";
    if (p.pct >= 100) return "已學習 ✓";
    return "學習中 " + p.pct + "%";
  }
  function progressOf(id) {
    try { if (w.AIVAULTBookQA && w.AIVAULTBookQA.progress) return w.AIVAULTBookQA.progress(id); } catch (e) {}
    try {
      var o = JSON.parse(localStorage.getItem("aivault_bookqa_progress_v1") || "{}")[id];
      if (o && o.total) return { have: o.have || 0, total: o.total, pct: o.pct || 0 };
    } catch (e) {}
    return null;
  }
  function ensureBookQA(cb) {
    if (w.AIVAULTBookQA) { if (cb) cb(w.AIVAULTBookQA); return Promise.resolve(w.AIVAULTBookQA); }
    return new Promise(function (res) {
      var s = d.createElement("script"); s.src = "darkstar-book-qa.js?v=20261015-qa8"; s.onload = function () { res(w.AIVAULTBookQA); if (cb) cb(w.AIVAULTBookQA); };
      s.onerror = function () { res(null); }; d.head.appendChild(s);
    });
  }
  var indexing = false;
  function kickIndex() {
    if (indexing) return;
    ensureBookQA(function (Q) {
      if (!Q || !Q.build) return;
      indexing = true;
      Q.build().then(function () { indexing = false; paintAllProgress(); }, function () { indexing = false; paintAllProgress(); });
    });
  }
  function paintAllProgress() {
    d.querySelectorAll("[data-study-progress]").forEach(function (el) {
      var id = el.getAttribute("data-study-progress"), on = el.getAttribute("data-on") === "1";
      if (!on) { el.hidden = true; el.textContent = ""; return; }
      el.hidden = false; el.textContent = pctLabel(progressOf(id));
    });
    var bar = d.querySelector("#dsStudyOverall [data-fill]"), lab = d.querySelector("#dsStudyOverall [data-lab]");
    if (bar && lab && cache && cache.enabled) {
      var ids = Object.keys(cache.enabled), sum = 0, n = 0;
      ids.forEach(function (id) { var p = progressOf(id); if (p && p.total) { sum += p.pct; n++; } else { n++; } });
      var pct = n ? Math.round(sum / n) : 0;
      bar.style.width = pct + "%"; lab.textContent = "整體學習進度 " + pct + "%（" + n + " 本）";
    }
  }
  w.addEventListener("darkstar-learn-progress", function () { paintAllProgress(); });
  w.addEventListener("darkstar-study-changed", function () { paintAllProgress(); kickIndex(); });

  // ---- 書架書卡 ----
  function decorateCards(clickId) {
    var grid = d.getElementById("shelfGrid"); if (!grid) return;
    Promise.all([get(), loadServerIds()]).then(function (pair) {
      var c = pair[0], live = pair[1] || {};
      grid.querySelectorAll('article.card[data-open][data-src="remote"]').forEach(function (card) {
        var id = card.getAttribute("data-open");
        // 幽靈／本機誤標 remote：不顯示 ⭐，避免 FK
        if (!live[id]) {
          var ghost = card.querySelector("[data-study-book]"); if (ghost) ghost.remove();
          var gp = card.querySelector("[data-study-progress]"); if (gp) gp.remove();
          return;
        }
        var on = c.enabled ? !!c.enabled[id] : false;
        var b = card.querySelector("[data-study-book]"), prog = card.querySelector("[data-study-progress]");
        if (!b) {
          b = d.createElement("button"); b.type = "button"; b.className = "ib"; b.setAttribute("data-study-book", id);
          b.style.cssText = "margin-top:8px;position:relative;z-index:2";
          prog = d.createElement("div"); prog.setAttribute("data-study-progress", id);
          prog.style.cssText = "margin-top:4px;font-size:12px;opacity:.85;position:relative;z-index:2";
          var info = card.querySelector(".cinfo") || card; info.appendChild(b); info.appendChild(prog);
          b.onclick = function (e) {
            e.stopPropagation(); e.preventDefault();
            if (!cache || !cache.logged_in) { b.disabled = true; get(true).then(function (c2) { b.disabled = false; if (!c2.logged_in) { alert(loginMsg(c2)); return; } grid.querySelectorAll("[data-study-book]").forEach(function (x) { x.remove(); }); grid.querySelectorAll("[data-study-progress]").forEach(function (x) { x.remove(); }); decorateCards(id); }); return; }
            var next = !(cache.enabled && cache.enabled[id]); b.disabled = true; b.textContent = "⏳ 儲存中…";
            set(id, next).then(function () { paint(next); if (next) kickIndex(); paintAllProgress(); }, function (err) { paint(!next); alert(friendlyErr(err)); }).then(function () { b.disabled = false; });
          };
        } else if (!prog) {
          prog = d.createElement("div"); prog.setAttribute("data-study-progress", id);
          prog.style.cssText = "margin-top:4px;font-size:12px;opacity:.85;position:relative;z-index:2";
          b.insertAdjacentElement("afterend", prog);
        }
        function paint(v) {
          b.textContent = v ? "✅ 暗星學習中" : "⭐ 讓暗星學習"; b.setAttribute("aria-pressed", v ? "true" : "false");
          prog.setAttribute("data-on", v ? "1" : "0");
          if (v) { prog.hidden = false; prog.textContent = pctLabel(progressOf(id)); } else { prog.hidden = true; prog.textContent = ""; }
        }
        paint(on);
        if (clickId === id) setTimeout(function () { b.click(); }, 0);
      });
      if (c.enabled && Object.keys(c.enabled).length) kickIndex();
      paintAllProgress();
    });
  }
  // ---- 暗星設定面板 ----
  function decoratePanel() {
    var panel = d.getElementById("darkStarSettingsPanel"); if (!panel || d.getElementById("dsStudyBooks")) return;
    var box = d.createElement("div"); box.id = "dsStudyBooks"; box.style.cssText = "margin-top:8px;font-size:13px";
    box.innerHTML = "<b>📚 暗星學習書籍</b><div id=\"dsStudyOverall\" style=\"margin:6px 0 8px\"><div style=\"height:8px;background:#eee;border-radius:6px;overflow:hidden\"><i data-fill style=\"display:block;height:100%;width:0;background:linear-gradient(90deg,#3b82f6,#10b981)\"></i></div><div data-lab style=\"margin-top:4px;font-size:12px;opacity:.85\">整體學習進度 —</div></div><div data-list style=\"max-height:220px;overflow:auto;margin-top:4px\">載入中…</div>";
    panel.appendChild(box);
    var list = box.querySelector("[data-list]");
    Promise.all([get(true), fetch(INGEST, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON }, body: JSON.stringify({ action: "list", limit: 80 }) }).then(function (r) { return r.json(); })]).then(function (res) {
      var c = res[0], books = (res[1] && (res[1].books || res[1].items)) || [];
      if (!c.logged_in) { list.textContent = loginMsg(c); return; }
      list.innerHTML = "";
      books.filter(function (bk) { return Number(bk.total_pages || bk.page_count || 0) > 0; }).forEach(function (bk) {
        var id = bk.id || bk.ebook_id, lab = d.createElement("label"); lab.style.cssText = "display:flex;gap:6px;align-items:flex-start;margin:3px 0";
        var cb = d.createElement("input"); cb.type = "checkbox"; cb.checked = !!c.enabled[id];
        cb.onchange = function () { cb.disabled = true; set(id, cb.checked).then(function () { if (cb.checked) kickIndex(); paintAllProgress(); }).catch(function (e) { cb.checked = !cb.checked; alert(friendlyErr(e)); }).then(function () { cb.disabled = false; }); };
        var sp = d.createElement("span"); sp.style.flex = "1";
        var title = d.createElement("div"); title.textContent = bk.title || "未命名";
        var pr = d.createElement("div"); pr.setAttribute("data-study-progress", id); pr.setAttribute("data-on", cb.checked ? "1" : "0");
        pr.style.cssText = "font-size:12px;opacity:.85"; pr.textContent = cb.checked ? pctLabel(progressOf(id)) : ""; pr.hidden = !cb.checked;
        sp.appendChild(title); sp.appendChild(pr);
        lab.appendChild(cb); lab.appendChild(sp); list.appendChild(lab);
      });
      kickIndex(); paintAllProgress();
    }).catch(function () { list.textContent = "書單載入失敗"; });
  }
  function scan() { decorateCards(); decoratePanel(); }
  var t = 0; new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 150); }).observe(d.documentElement, { childList: true, subtree: true });
  if (d.readyState !== "loading") scan(); else d.addEventListener("DOMContentLoaded", scan);
})(window, document);

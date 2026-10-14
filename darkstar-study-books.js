/* 暗星學習書籍：每位使用者自己勾選讓暗星讀哪些書（存在後端 dark_star_study_books）。
   - 書架（dark-star-ebook.html）：每張伺服器書卡加「⭐ 讓暗星學習」切換
   - 暗星頁（technical-dark-star.html）：⚙️ 設定面板內加「暗星學習書籍」勾選清單
   - 未登入：回傳 null（= 全部書，維持原行為）；已登入但沒有任何設定：預設只有宪法学讲义 */
(function (w, d) {
  "use strict";
  if (w.AIVAULTStudyBooks) return;
  var INGEST = "https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/dark-star-ebook-ingest", ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE";
  var DEFAULT_IDS = ["e0bc8c57-646d-474c-988e-d6cb3d4f8972"];
  var cache = null, loading = null;
  function token() { try { var j = JSON.parse(localStorage.getItem("sb-clcddygkaaqqtsbswgdf-auth-token") || "null"); var t = j && (j.access_token || (j.currentSession && j.currentSession.access_token)); if (t && (!j.expires_at || j.expires_at * 1000 > Date.now() + 30000)) return t; } catch (e) {} return ""; }
  function call(body) {
    var t = token(); if (!t) return Promise.resolve({ ok: true, logged_in: false, books: [] });
    return fetch(INGEST, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + t }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }); });
  }
  function apply(r) {
    if (!r || !r.logged_in) { cache = { logged_in: false, enabled: null, rows: {} }; return cache; }
    var rows = {}; (r.books || []).forEach(function (x) { rows[x.ebook_id] = !!x.enabled; });
    var en = {}; var ids = Object.keys(rows);
    if (!ids.length) DEFAULT_IDS.forEach(function (id) { en[id] = 1; }); else ids.forEach(function (id) { if (rows[id]) en[id] = 1; });
    cache = { logged_in: true, enabled: en, rows: rows }; return cache;
  }
  function get(force) {
    if (cache && !force) return Promise.resolve(cache);
    if (loading) return loading;
    loading = call({ action: "study_list" }).then(apply, function () { return apply(null); }).then(function (c) { loading = null; return c; });
    return loading;
  }
  async function set(id, on) {
    var c = await get();
    if (!c.logged_in) throw new Error("請先登入 AIVAULT");
    var items = [{ ebook_id: id, enabled: !!on }];
    // 第一次設定時，把預設的宪法学讲义也寫進去，避免它因「已有設定」而消失
    if (!Object.keys(c.rows).length) DEFAULT_IDS.forEach(function (x) { if (x !== id) items.push({ ebook_id: x, enabled: true }); });
    var r = await call({ action: "study_set", items: items });
    if (!r || r.ok === false || r.error) throw new Error((r && r.error) || "儲存失敗");
    apply(r);
    try { w.dispatchEvent(new CustomEvent("darkstar-study-changed", { detail: cache })); } catch (e) {}
    return cache;
  }
  w.AIVAULTStudyBooks = { get: get, set: set, isEnabled: function (id) { return !cache || !cache.enabled || !!cache.enabled[id]; } };

  // ---- 書架書卡 ----
  function decorateCards() {
    var grid = d.getElementById("shelfGrid"); if (!grid) return;
    get().then(function (c) {
      grid.querySelectorAll('article.card[data-open][data-src="remote"]').forEach(function (card) {
        if (card.querySelector("[data-study-book]")) return;
        var id = card.getAttribute("data-open"), on = c.enabled ? !!c.enabled[id] : false;
        var b = d.createElement("button"); b.type = "button"; b.className = "ib"; b.setAttribute("data-study-book", id);
        b.style.cssText = "margin-top:8px;position:relative;z-index:2";
        function paint(v) { b.textContent = v ? "✅ 暗星學習中" : "⭐ 讓暗星學習"; b.setAttribute("aria-pressed", v ? "true" : "false"); }
        paint(on);
        b.onclick = function (e) {
          e.stopPropagation(); e.preventDefault();
          if (!c.logged_in) { alert("請先登入 AIVAULT，才能設定暗星學習書籍（未登入時暗星會讀全部書）。"); return; }
          var next = !(cache.enabled && cache.enabled[id]); b.disabled = true; b.textContent = "⏳ 儲存中…";
          set(id, next).then(function () { paint(next); }, function (err) { paint(!next); alert(err.message || err); }).then(function () { b.disabled = false; });
        };
        var info = card.querySelector(".cinfo") || card; info.appendChild(b);
      });
    });
  }
  // ---- 暗星設定面板 ----
  function decoratePanel() {
    var panel = d.getElementById("darkStarSettingsPanel"); if (!panel || d.getElementById("dsStudyBooks")) return;
    var box = d.createElement("div"); box.id = "dsStudyBooks"; box.style.cssText = "margin-top:8px;font-size:13px";
    box.innerHTML = "<b>📚 暗星學習書籍</b><div data-list style='max-height:220px;overflow:auto;margin-top:4px'>載入中…</div>";
    panel.appendChild(box);
    var list = box.querySelector("[data-list]");
    Promise.all([get(true), fetch(INGEST, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON }, body: JSON.stringify({ action: "list", limit: 80 }) }).then(function (r) { return r.json(); })]).then(function (res) {
      var c = res[0], books = (res[1] && (res[1].books || res[1].items)) || [];
      if (!c.logged_in) { list.textContent = "未登入：暗星會讀書架上全部的書。登入後可勾選。"; return; }
      list.innerHTML = "";
      books.forEach(function (bk) {
        var id = bk.id || bk.ebook_id, lab = d.createElement("label"); lab.style.cssText = "display:flex;gap:6px;align-items:flex-start;margin:3px 0";
        var cb = d.createElement("input"); cb.type = "checkbox"; cb.checked = !!c.enabled[id];
        cb.onchange = function () { cb.disabled = true; set(id, cb.checked).catch(function (e) { cb.checked = !cb.checked; alert(e.message || e); }).then(function () { cb.disabled = false; }); };
        var sp = d.createElement("span"); sp.textContent = bk.title || "未命名";
        lab.appendChild(cb); lab.appendChild(sp); list.appendChild(lab);
      });
    }).catch(function () { list.textContent = "書單載入失敗"; });
  }
  function scan() { decorateCards(); decoratePanel(); }
  var t = 0; new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 150); }).observe(d.documentElement, { childList: true, subtree: true });
  if (d.readyState !== "loading") scan(); else d.addEventListener("DOMContentLoaded", scan);
})(window, document);

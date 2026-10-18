/* 抽屜來源鎖定：電子書／百度／Google／Yahoo／YouTube。
   打勾＝鎖定該來源。打勾順序＝優先 1、2、3、4。 */
(function (w, d) {
  "use strict";
  if (w.AIVAULTSourceLocks) return;
  var KEY = "aivaultSourceLocks";
  var ITEMS = [
    { id: "ebook", label: "電子書" },
    { id: "baidu", label: "百度" },
    { id: "google", label: "Google" },
    { id: "yahoo", label: "Yahoo" },
    { id: "youtube", label: "YouTube" }
  ];
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; }
  }
  function save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function state() {
    var st = load(), on = [], order = st.order || [];
    ITEMS.forEach(function (it) { if (st[it.id]) on.push(it.id); });
    order = order.filter(function (id) { return on.indexOf(id) >= 0; });
    on.forEach(function (id) { if (order.indexOf(id) < 0) order.push(id); });
    return { on: on, order: order, ebook: !!st.ebook, baidu: !!st.baidu, google: !!st.google, yahoo: !!st.yahoo, youtube: !!st.youtube };
  }
  function paint(root, st) {
    var order = (st.order || []).filter(function (id) { return st[id]; });
    root.querySelectorAll("[data-src]").forEach(function (row) {
      var id = row.getAttribute("data-src");
      var box = row.querySelector("input");
      var num = row.querySelector(".src-pri");
      box.checked = !!st[id];
      var i = order.indexOf(id);
      num.textContent = i >= 0 ? String(i + 1) : "";
    });
  }
  function install() {
    if (d.getElementById("dsSourceLocks")) return true;
    var host = d.querySelector(".drawer-bottom");
    if (!host) return false;
    var box = d.createElement("div");
    box.id = "dsSourceLocks";
    box.style.cssText = "margin:8px 10px 4px;padding:8px;border:1px solid #eee;border-radius:12px;background:#fafafa";
    box.innerHTML = '<div style="font-size:12px;font-weight:700;margin-bottom:6px">來源鎖定</div>' +
      ITEMS.map(function (it) {
        return '<label data-src="' + it.id + '" style="display:flex;align-items:center;gap:8px;padding:5px 2px;font-size:14px">' +
          '<input type="checkbox" style="width:18px;height:18px"> ' + it.label +
          '<span class="src-pri" style="margin-left:auto;min-width:16px;text-align:right;font-weight:700;color:#111"></span></label>';
      }).join("");
    var anchor = d.getElementById("darkStarSettingsButton");
    if (anchor && anchor.parentNode === host) host.insertBefore(box, anchor.nextSibling);
    else host.insertBefore(box, host.firstChild);
    var st = load();
    paint(box, st);
    box.addEventListener("change", function (e) {
      var row = e.target.closest("[data-src]"); if (!row) return;
      var id = row.getAttribute("data-src");
      st = load();
      st.order = st.order || [];
      st[id] = !!e.target.checked;
      if (st[id]) { if (st.order.indexOf(id) < 0) st.order.push(id); }
      else st.order = st.order.filter(function (x) { return x !== id; });
      save(st); paint(box, st);
    });
    return true;
  }
  var n = 0, t = setInterval(function () { if (install() || ++n > 40) clearInterval(t); }, 200);
  w.AIVAULTSourceLocks = { state: state, items: ITEMS };
})(window, document);

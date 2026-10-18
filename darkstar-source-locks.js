/* 抽屜設定：來源鎖定。打勾＝鎖定；先打勾為優先 1。 */
(function (w, d) {
  "use strict";
  var KEY = "aivaultSourceLocks";
  var ITEMS = [
    { id: "ebook", label: "電子書" },
    { id: "baidu", label: "百度" },
    { id: "google", label: "Google" },
    { id: "yahoo", label: "Yahoo" },
    { id: "youtube", label: "YouTube" }
  ];
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function state() {
    var st = load(), on = [], order = st.order || [];
    ITEMS.forEach(function (it) { if (st[it.id]) on.push(it.id); });
    order = order.filter(function (id) { return on.indexOf(id) >= 0; });
    on.forEach(function (id) { if (order.indexOf(id) < 0) order.push(id); });
    var out = { on: on, order: order };
    ITEMS.forEach(function (it) { out[it.id] = !!st[it.id]; });
    return out;
  }
  function paint(root, st) {
    var order = (st.order || []).filter(function (id) { return st[id]; });
    root.querySelectorAll("[data-src]").forEach(function (row) {
      var id = row.getAttribute("data-src");
      row.querySelector("input").checked = !!st[id];
      var i = order.indexOf(id);
      row.querySelector(".src-pri").textContent = i >= 0 ? String(i + 1) : "";
    });
  }
  function install() {
    if (d.getElementById("dsSourceLocks")) return true;
    var host = d.querySelector(".drawer-bottom");
    if (!host) return false;
    var box = d.createElement("div");
    box.id = "dsSourceLocks";
    box.style.cssText = "display:none;margin:4px 10px 8px;padding:10px;border:1px solid #eee;border-radius:12px;background:#fff";
    box.innerHTML = '<div style="font-size:13px;font-weight:700;margin-bottom:4px">設定 · 來源鎖定</div>' +
      '<div style="font-size:11px;color:#777;margin-bottom:6px">打勾＝鎖定。先打勾為 1。</div>' +
      ITEMS.map(function (it) {
        return '<label data-src="' + it.id + '" style="display:flex;align-items:center;gap:8px;padding:6px 2px;font-size:15px">' +
          '<input type="checkbox" style="width:18px;height:18px"> ' + it.label +
          '<span class="src-pri" style="margin-left:auto;min-width:18px;text-align:right;font-weight:700"></span></label>';
      }).join("");
    var btn = d.getElementById("darkStarSettingsButton");
    if (btn && btn.parentNode === host) host.insertBefore(box, btn.nextSibling);
    else host.insertBefore(box, host.firstChild);
    if (btn) btn.addEventListener("click", function () {
      var open = box.style.display !== "block";
      box.style.display = open ? "block" : "none";
      if (open) box.scrollIntoView({ block: "nearest" });
    });
    var st = load(); paint(box, st);
    box.addEventListener("change", function (e) {
      var row = e.target.closest("[data-src]"); if (!row) return;
      var id = row.getAttribute("data-src");
      st = load(); st.order = st.order || []; st[id] = !!e.target.checked;
      if (st[id]) { if (st.order.indexOf(id) < 0) st.order.push(id); }
      else st.order = st.order.filter(function (x) { return x !== id; });
      save(st); paint(box, st);
    });
    return true;
  }
  var n = 0, t = setInterval(function () { if (install() || ++n > 40) clearInterval(t); }, 200);
  w.AIVAULTSourceLocks = { state: state, items: ITEMS };
})(window, document);

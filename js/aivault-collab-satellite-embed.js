/* 協作池最上方：台北衛星地圖面板（不影響下方原有內容） */
(function () {
  var ID = 'aiv-sat-panel';
  function build() {
    var w = document.createElement('section'); w.id = ID;
    w.style.cssText = 'position:relative;margin:8px auto 12px;max-width:1200px;width:calc(100% - 16px);height:62vh;min-height:360px;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.35);background:#0d1420;z-index:1';
    var f = document.createElement('iframe');
    f.src = 'aivault-taipei-satellite.html'; f.title = '台北衛星地圖'; f.loading = 'lazy';
    f.setAttribute('allow', 'geolocation; accelerometer; gyroscope; magnetometer');
    f.style.cssText = 'width:100%;height:100%;border:0;display:block';
    var a = document.createElement('a'); a.href = 'aivault-taipei-satellite.html'; a.target = '_blank'; a.textContent = '⤢ 全螢幕';
    a.style.cssText = 'position:absolute;right:10px;bottom:10px;z-index:2;background:rgba(13,20,32,.8);color:#fff;padding:6px 12px;border-radius:999px;font:13px system-ui;text-decoration:none';
    w.appendChild(f); w.appendChild(a); return w;
  }
  function ensure() {
    if (!document.body) return;
    var p = document.getElementById(ID);
    if (!p) p = build();
    if (document.body.firstElementChild !== p) document.body.insertBefore(p, document.body.firstChild);
  }
  ensure();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure);
  var n = 0, t = setInterval(function () { ensure(); if (++n > 20) clearInterval(t); }, 500);
})();

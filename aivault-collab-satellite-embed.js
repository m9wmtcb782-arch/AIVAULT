/* 協作池「3D 地圖」下方：台北衛星地圖面板（不影響下方原有內容） */
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
  function findAnchor() {
    var all = document.body.querySelectorAll('h1,h2,h3,h4,h5,div,span,p,strong,b');
    var head = null;
    for (var i = 0; i < all.length; i++) { var e = all[i]; if (e.id === ID || (e.closest && e.closest('#' + ID))) continue; var t = (e.textContent || '').replace(/\s+/g, ' ');
      if (t.indexOf('協作池 3D 地圖') >= 0 && t.length < 60) { head = e; } }
    if (!head) return null;
    // 往上找到含地圖畫面（canvas/iframe）的區塊，再往後找到地圖本體
    var blk = head;
    while (blk.parentElement && blk.parentElement !== document.body && !blk.parentElement.querySelector('canvas,iframe')) blk = blk.parentElement;
    if (blk.parentElement && blk.parentElement !== document.body && blk.parentElement.querySelectorAll('h1,h2,h3').length <= 2) blk = blk.parentElement;
    var n = blk; while (n && !(n.querySelector && n.querySelector('canvas,iframe')) && n.nextElementSibling) { n = n.nextElementSibling; if (n.querySelector && n.querySelector('canvas,iframe') || n.tagName === 'CANVAS' || n.tagName === 'IFRAME') break; }
    return n || blk;
  }
  var placed = false;
  function ensure() {
    if (!document.body) return;
    var p = document.getElementById(ID) || build();
    var a = findAnchor();
    if (a) { if (a.nextElementSibling !== p) a.parentNode.insertBefore(p, a.nextSibling); placed = true; }
    else if (!p.parentNode) { p.style.display = 'none'; document.body.appendChild(p); }
    if (a) p.style.display = '';
  }
  ensure();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure);
  var n = 0, t = setInterval(function () { ensure(); if (++n > 40 || (placed && n > 6)) clearInterval(t); }, 500);
})();

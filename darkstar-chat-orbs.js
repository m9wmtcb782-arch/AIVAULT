/* 聊天視窗：AI 訊息旁的彩色 ✦ 方塊頭像與歡迎畫面 ✦ → 會動的暗星黑色小球；移除頁首左側彩色 ✦ 標誌（保留頁首黑球）。 */
(function (w, d) {
  "use strict";
  if (w.__dsChatOrbs) return; w.__dsChatOrbs = 1;
  var s = d.createElement("style");
  s.textContent = ".topbar .brand>.brand-mark{display:none!important}" +
    ".message:not(.user) .message-avatar.ds-orb-av{background:none!important;animation:none!important;box-shadow:none!important;border:0!important;overflow:visible;font-size:0!important;color:transparent!important}" +
    ".welcome-mark.ds-orb-av{background:none!important;animation:none!important;box-shadow:none!important;font-size:0!important}";
  d.head.appendChild(s);
  function orbify(av, size) {
    if (av.classList.contains("ds-orb-av") || !w.DarkStarOrb) return;
    av.classList.add("ds-orb-av"); av.textContent = "";
    var sp = d.createElement("span"); av.appendChild(sp); w.DarkStarOrb.mount(sp, { size: size });
  }
  function scan() {
    d.querySelectorAll(".message:not(.user) .message-avatar").forEach(function (av) {
      var t = (av.textContent || "").trim();
      if (t === "✦" || t === "" && !av.children.length) orbify(av, 34); // 其他功能自訂的頭像（📚📸🌑）保持不變
    });
    d.querySelectorAll(".welcome-mark").forEach(function (m) { orbify(m, 72); });
  }
  var q = 0; function later() { if (!q) q = requestAnimationFrame(function () { q = 0; scan(); }); }
  function init() { scan(); new MutationObserver(later).observe(d.body, { childList: true, subtree: true }); }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init); else init();
})(window, document);

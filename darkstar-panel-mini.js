/* 暗星數字人面板：點面板 → 縮成右下角會動的小暗星；點小暗星 → 還原面板（可拍照）。
   只隱藏／縮小 UI：不中斷即時連線（socket、麥克風、播放、鏡頭串流都保持）；
   鏡頭小視窗用 opacity 近乎透明而非 display:none／移出畫面，避免 iOS 暫停 <video> 影格。 */
(function (w, d) {
  "use strict";
  if (w.AIVAULTPanelMini) return;
  var mini = null, orb = null, talkLvl = 0;
  function css() {
    var s = d.createElement("style"); s.id = "ds-panel-mini-css";
    s.textContent =
      "html.ds-panel-min #aivault-darkstar-avatar,html.ds-panel-min #dsLiveCam,html.ds-panel-min #dsLiveAuthNotice{opacity:.001!important;pointer-events:none!important}" +
      "#aivault-darkstar-avatar{transition:opacity .2s ease}" +
      "#dsPanelMini{position:fixed;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 96px);z-index:85;width:64px;height:64px;border-radius:50%;border:0;padding:0;background:radial-gradient(circle,rgba(139,124,255,.18),rgba(139,124,255,0) 70%);display:none;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;cursor:pointer}" +
      "html.ds-panel-min #dsPanelMini{display:flex}" +
      "#dsPanelMini .ring{position:absolute;inset:2px;border-radius:50%;border:2px solid transparent;pointer-events:none}" +
      "#dsPanelMini.live .ring{border-color:#42b96b;animation:dsMiniListen 1.8s ease-in-out infinite}" +
      "#dsPanelMini.talking .ring{border-color:#8b7cff;animation:dsMiniTalk .35s ease-in-out infinite alternate}" +
      "@keyframes dsMiniListen{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.1);opacity:1}}@keyframes dsMiniTalk{from{transform:scale(1)}to{transform:scale(1.14)}}" +
      "@media(min-width:701px){#dsPanelMini{top:76px;bottom:auto;right:16px}}";
    d.head.appendChild(s);
  }
  function panel() { return d.getElementById("aivault-darkstar-avatar"); }
  function isMin() { return d.documentElement.classList.contains("ds-panel-min"); }
  function minimize() { d.documentElement.classList.add("ds-panel-min"); if (orb) orb.setExpression("happy", 1200); }
  function restore() {
    d.documentElement.classList.remove("ds-panel-min");
    // 保險：若 iOS 曾暫停預覽影片，恢復播放（不重新取得鏡頭）
    var v = d.querySelector("#dsLiveCam video"); if (v && v.srcObject && v.paused) { try { var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
  }
  function live() { var L = w.AIVAULTDarkStarLive; try { return !!(L && L.isConnected && L.isConnected()); } catch (e) { return false; } }
  function hookAvatar() {
    var A = w.AIVAULTDarkStarAvatar; if (!A || A.__miniHooked) return !!A;
    A.__miniHooked = true;
    var sp = A.speak; A.speak = function (v) { talkLvl = Number(v) || 0; if (orb && isMin()) orb.setTalking(talkLvl > .035 ? Math.min(1, talkLvl * 1.6) : 0); return sp.apply(this, arguments); };
    return true;
  }
  function tick() {
    if (mini) { mini.classList.toggle("live", live()); mini.classList.toggle("talking", talkLvl > .035); }
    setTimeout(tick, 250);
  }
  function init() {
    var p = panel(); if (!p || mini) return;
    css();
    mini = d.createElement("button"); mini.id = "dsPanelMini"; mini.type = "button"; mini.setAttribute("aria-label", "展開暗星數字人"); mini.title = "點我展開暗星數字人";
    var span = d.createElement("span"); mini.appendChild(span); var ring = d.createElement("i"); ring.className = "ring"; mini.appendChild(ring);
    d.body.appendChild(mini);
    function mountOrb() { if (!orb && w.DarkStarOrb) orb = w.DarkStarOrb.mount(span, { size: 54 }); }
    mountOrb(); if (!orb) setTimeout(mountOrb, 1500);
    mini.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); restore(); });
    // 點面板（按鈕以外）→ 縮小
    p.addEventListener("click", function (e) { if (e.target.closest("button,a,input,select,textarea")) return; minimize(); });
    p.title = "點一下縮小（不會中斷即時連線）";
    d.addEventListener("darkstar:expr", function (e) { if (orb && e.detail) orb.setExpression(e.detail.expr, e.detail.ms); });
    if (!hookAvatar()) { var n = 0, t = setInterval(function () { if (hookAvatar() || ++n > 40) clearInterval(t); }, 250); }
    tick();
  }
  w.AIVAULTPanelMini = { minimize: minimize, restore: restore, isMinimized: isMin };
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init); else init();
  w.addEventListener("load", init);
})(window, document);

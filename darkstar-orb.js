/* 暗星小球 Dark Star Orb — 原創可愛黑色球體吉祥物（純 SVG/CSS/JS，無外部資源）
   用法：<span data-darkstar-orb data-size="36"></span>，或 DarkStarOrb.mount(el,{size:36}) */
(function (w, d) {
  "use strict";
  if (w.DarkStarOrb) return;
  var n = 0, CSS_ID = "darkstar-orb-css";
  var reduce = w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function css() {
    if (d.getElementById(CSS_ID)) return;
    var s = d.createElement("style"); s.id = CSS_ID;
    s.textContent =
      ".ds-orb{display:inline-block;vertical-align:middle;line-height:0;cursor:pointer;-webkit-tap-highlight-color:transparent;flex:0 0 auto}" +
      ".ds-orb svg{display:block;overflow:visible}" +
      ".ds-orb .b{transform-origin:50% 92%;animation:dsoFloat 3.2s ease-in-out infinite}" +
      ".ds-orb .glow{animation:dsoGlow 3.2s ease-in-out infinite}" +
      ".ds-orb .eye,.ds-orb .eyes,.ds-orb .mouth path{transition:transform .25s ease,opacity .2s}" +
      ".ds-orb .eye{transform-box:fill-box;transform-origin:center}" +
      ".ds-orb.blink .eye{transform:scaleY(.1)}" +
      ".ds-orb.jump .b{animation:dsoJump .55s cubic-bezier(.3,1.6,.5,1)}" +
      ".ds-orb .zz{opacity:0;transition:opacity .3s}.ds-orb[data-expr=sleepy] .zz{opacity:1;animation:dsoZ 2s ease-in-out infinite}" +
      "@keyframes dsoFloat{0%,100%{transform:translateY(0) scale(1,1)}45%{transform:translateY(-6%) scale(.98,1.02)}90%{transform:translateY(0) scale(1.04,.96)}}" +
      "@keyframes dsoJump{0%{transform:translateY(0) scale(1.1,.88)}40%{transform:translateY(-22%) scale(.94,1.06)}75%{transform:translateY(0) scale(1.08,.92)}100%{transform:translateY(0) scale(1)}}" +
      "@keyframes dsoGlow{0%,100%{opacity:.55}50%{opacity:.9}}" +
      "@keyframes dsoZ{0%{transform:translate(0,0);opacity:0}30%{opacity:1}100%{transform:translate(4px,-8px);opacity:0}}" +
      "@media (prefers-reduced-motion: reduce){.ds-orb .b,.ds-orb .glow,.ds-orb.jump .b,.ds-orb .zz{animation:none!important}}";
    d.head.appendChild(s);
  }
  // 每種表情：左右眼（open=橢圓；arc=笑眼；line=瞇眼），眼睛縮放/位移，嘴型
  var MOUTH = {
    neutral: "M43 66 Q50 71 57 66",
    happy: "M41 64 Q50 76 59 64 Q50 69 41 64Z",
    curious: "M47 67 Q50 69 53 67",
    surprised: "M50 63 a4.5 5.5 0 1 0 0.01 0Z",
    sleepy: "M46 68 Q50 69.5 54 68",
    wink: "M42 65 Q50 74 58 65"
  };
  var EYES = {
    neutral: ["open", "open", 1, 0], happy: ["arc", "arc", 1, 0], curious: ["open", "open", 1, 0],
    surprised: ["open", "open", 1.28, 0], sleepy: ["line", "line", 1, 0], wink: ["arc", "open", 1, 0]
  };
  var CYCLE = ["happy", "curious", "surprised", "sleepy", "wink"];
  function svg(id) {
    return '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">' +
      '<defs><radialGradient id="' + id + 'g" cx="36%" cy="30%" r="75%"><stop offset="0" stop-color="#4a4a58"/><stop offset=".35" stop-color="#17171d"/><stop offset="1" stop-color="#000"/></radialGradient>' +
      '<radialGradient id="' + id + 'h" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + id + 'o" cx="50%" cy="50%" r="50%"><stop offset=".55" stop-color="#8b7cff" stop-opacity=".55"/><stop offset="1" stop-color="#8b7cff" stop-opacity="0"/></radialGradient></defs>' +
      '<circle class="glow" cx="50" cy="52" r="50" fill="url(#' + id + 'o)"/>' +
      '<g class="b"><ellipse cx="50" cy="95" rx="22" ry="3.5" fill="#000" opacity=".18"/>' +
      '<circle cx="50" cy="52" r="38" fill="url(#' + id + 'g)"/>' +
      '<ellipse cx="37" cy="31" rx="11" ry="7" fill="url(#' + id + 'h)" transform="rotate(-28 37 31)"/><circle cx="64" cy="27" r="2" fill="#fff" opacity=".6"/>' +
      '<g class="eyes">' + eye("l", 38) + eye("r", 62) + '</g>' +
      '<ellipse class="cheek" cx="30" cy="63" rx="5" ry="2.6" fill="#ff8fb1" opacity=".35"/><ellipse class="cheek" cx="70" cy="63" rx="5" ry="2.6" fill="#ff8fb1" opacity=".35"/>' +
      '<g class="mouth"><path d="' + MOUTH.neutral + '" fill="#f4f0ff" stroke="#f4f0ff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>' +
      '<text class="zz" x="78" y="24" font-size="13" font-weight="700" fill="#b9b0ff" font-family="sans-serif">z</text></g></svg>';
  }
  function eye(side, cx) {
    return '<g class="eye e' + side + '">' +
      '<ellipse class="open" cx="' + cx + '" cy="50" rx="6" ry="8" fill="#f7f5ff"/><circle class="open" cx="' + (cx + 1.8) + '" cy="46.5" r="2" fill="#fff"/>' +
      '<path class="arc" d="M' + (cx - 6) + ' 52 Q' + cx + ' 42 ' + (cx + 6) + ' 52" fill="none" stroke="#f7f5ff" stroke-width="3" stroke-linecap="round"/>' +
      '<path class="line" d="M' + (cx - 6) + ' 52 Q' + cx + ' 55 ' + (cx + 6) + ' 52" fill="none" stroke="#f7f5ff" stroke-width="2.6" stroke-linecap="round"/></g>';
  }
  function mount(el, opt) {
    if (!el || el.__dsOrb) return el && el.__dsOrb;
    css(); opt = opt || {};
    var size = Number(opt.size || el.getAttribute("data-size") || 40), id = "dso" + (++n);
    el.classList.add("ds-orb"); el.style.width = el.style.height = size + "px";
    el.setAttribute("role", "img"); el.setAttribute("aria-label", "暗星小球");
    el.innerHTML = svg(id);
    var mouth = el.querySelector(".mouth path"), eyes = el.querySelector(".eyes");
    function setExpr(x) {
      var e = EYES[x] || EYES.neutral;
      el.setAttribute("data-expr", x);
      mouth.setAttribute("d", MOUTH[x] || MOUTH.neutral);
      mouth.setAttribute("fill", x === "happy" || x === "surprised" ? "#f4f0ff" : "none");
      ["l", "r"].forEach(function (s, i) {
        var g = el.querySelector(".e" + s);
        ["open", "arc", "line"].forEach(function (k) {
          g.querySelectorAll("." + k).forEach(function (p) { p.style.display = e[i] === k ? "" : "none"; });
        });
        g.style.transform = "scale(" + e[2] + ")";
      });
      eyes.style.transform = x === "curious" ? "translateX(-4px)" : "";
    }
    setExpr("neutral");
    var api = { el: el, setExpr: setExpr, timers: [] };
    el.__dsOrb = api;
    function later(fn, ms) { var t = setTimeout(fn, ms); api.timers.push(t); }
    function react() {
      setExpr("happy"); el.classList.remove("jump"); void el.offsetWidth;
      if (!reduce) el.classList.add("jump");
      later(function () { el.classList.remove("jump"); }, 600);
      later(function () { setExpr("neutral"); }, 1400);
    }
    el.addEventListener("click", react);
    el.addEventListener("mouseenter", function () { react(); });
    api.react = react;
    if (!reduce && !opt.static) {
      (function blink() {
        later(function () {
          var x = el.getAttribute("data-expr");
          if (x === "neutral" || x === "curious" || x === "surprised") {
            el.classList.add("blink"); later(function () { el.classList.remove("blink"); }, 130);
          }
          blink();
        }, 2400 + Math.random() * 3000);
      })();
      (function cycle() {
        later(function () {
          var x = CYCLE[Math.floor(Math.random() * CYCLE.length)];
          setExpr(x);
          if (x === "curious") { later(function () { eyes.style.transform = "translateX(4px)"; }, 700); }
          later(function () { setExpr("neutral"); }, x === "sleepy" ? 2600 : 1600);
          cycle();
        }, 4500 + Math.random() * 3500);
      })();
    }
    return api;
  }
  function auto() { d.querySelectorAll("[data-darkstar-orb]").forEach(function (el) { mount(el); }); }
  w.DarkStarOrb = { mount: mount, auto: auto };
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", auto); else auto();
})(window, document);

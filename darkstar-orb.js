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
      ".ds-orb .face,.ds-orb .hl{transform-box:view-box;transform-origin:50px 52px;transition:transform .35s cubic-bezier(.4,.1,.3,1)}" +
      ".ds-orb .face.m-shake{animation:dsoShake .9s ease-in-out}.ds-orb .face.m-spin{animation:dsoSpin .9s cubic-bezier(.5,0,.3,1)}.ds-orb .face.m-wobble{animation:dsoWobble .9s ease-in-out}.ds-orb .face.nod{animation:dsoNod .5s ease-in-out infinite}" +
      "@keyframes dsoShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px) rotate(-4deg)}50%{transform:translateX(7px) rotate(4deg)}80%{transform:translateX(-4px) rotate(-2deg)}}" +
      "@keyframes dsoSpin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}" +
      "@keyframes dsoWobble{0%,100%{transform:rotate(0)}25%{transform:rotate(-14deg)}60%{transform:rotate(11deg)}85%{transform:rotate(-4deg)}}" +
      "@keyframes dsoNod{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}" +
      "@media (prefers-reduced-motion: reduce){.ds-orb .face,.ds-orb .face.m-shake,.ds-orb .face.m-spin,.ds-orb .face.m-wobble,.ds-orb .face.nod{animation:none!important}}" +
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
  // 頭部動作：face 位移/旋轉；高光反向小幅移動，營造球體轉動的立體感
  var MOTIONS = {
    center: { f: "", h: "" },
    upRight: { f: "translate(6px,-6px) rotate(6deg)", h: "translate(-3px,2px)" },
    downLeft: { f: "translate(-6px,6px) rotate(-6deg)", h: "translate(3px,-2px)" },
    upLeft: { f: "translate(-6px,-5px) rotate(-5deg)", h: "translate(3px,2px)" },
    downRight: { f: "translate(6px,5px) rotate(5deg)", h: "translate(-3px,-2px)" },
    shake: { cls: "m-shake" }, spin: { cls: "m-spin" }, wobble: { cls: "m-wobble" }
  };
  var MOTION_KEYS = Object.keys(MOTIONS), IDLE_EXPR = ["neutral", "happy", "curious", "surprised", "sleepy", "wink"];
  var CYCLE = ["happy", "curious", "surprised", "sleepy", "wink"];
  function svg(id) {
    return '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">' +
      '<defs><radialGradient id="' + id + 'g" cx="36%" cy="30%" r="75%"><stop offset="0" stop-color="#4a4a58"/><stop offset=".35" stop-color="#17171d"/><stop offset="1" stop-color="#000"/></radialGradient>' +
      '<radialGradient id="' + id + 'h" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + id + 'o" cx="50%" cy="50%" r="50%"><stop offset=".55" stop-color="#8b7cff" stop-opacity=".55"/><stop offset="1" stop-color="#8b7cff" stop-opacity="0"/></radialGradient></defs>' +
      '<circle class="glow" cx="50" cy="52" r="50" fill="url(#' + id + 'o)"/>' +
      '<g class="b"><ellipse cx="50" cy="95" rx="22" ry="3.5" fill="#000" opacity=".18"/>' +
      '<circle cx="50" cy="52" r="38" fill="url(#' + id + 'g)"/>' +
      '<g class="hl"><ellipse cx="37" cy="31" rx="11" ry="7" fill="url(#' + id + 'h)" transform="rotate(-28 37 31)"/><circle cx="64" cy="27" r="2" fill="#fff" opacity=".6"/>' +
      '</g><g class="face"><g class="eyes">' + eye("l", 38) + eye("r", 62) + '</g>' +
      '<ellipse class="cheek" cx="30" cy="63" rx="5" ry="2.6" fill="#ff8fb1" opacity=".35"/><ellipse class="cheek" cx="70" cy="63" rx="5" ry="2.6" fill="#ff8fb1" opacity=".35"/>' +
      '<g class="mouth"><path d="' + MOUTH.neutral + '" fill="#f4f0ff" stroke="#f4f0ff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>' +
      '<text class="zz" x="78" y="24" font-size="13" font-weight="700" fill="#b9b0ff" font-family="sans-serif">z</text></g></g></svg>';
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
    if (el.getAttribute("data-auto") === "false") opt.auto = false;
    var size = Number(opt.size || el.getAttribute("data-size") || 40), id = "dso" + (++n);
    el.classList.add("ds-orb"); el.style.width = el.style.height = size + "px";
    el.setAttribute("role", "img"); el.setAttribute("aria-label", "暗星小球");
    el.innerHTML = svg(id);
    var mouth = el.querySelector(".mouth path"), eyes = el.querySelector(".eyes"), face = el.querySelector(".face"), hl = el.querySelector(".hl");
    function setMotion(k) {
      var m = MOTIONS[k] || MOTIONS.center;
      face.classList.remove("m-shake", "m-spin", "m-wobble");
      face.style.transform = m.f || ""; hl.style.transform = m.h || "";
      if (m.cls) { void face.getBoundingClientRect(); face.classList.add(m.cls); }
      el.setAttribute("data-motion", k);
    }
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
    var api = { el: el, setExpr: setExpr, timers: [], hold: 0, talking: 0 };
    // 外部控制：表情（鎖定一段時間，不被隨機表情覆蓋）、說話嘴型、視線
    api.setExpression = function (x, ms) { api.hold = Date.now() + (ms == null ? 2500 : ms); setExpr(x === "think" ? "curious" : (MOUTH[x] ? x : "neutral")); };
    api.setTalking = function (level) {
      level = Math.max(0, Math.min(1, Number(level) || 0)); api.talking = level;
      if (level > 0.03) {
        var ry = (1.6 + level * 6.5).toFixed(2), rx = (3.5 + level * 2.5).toFixed(2), top = (66 - ry).toFixed(2);
        mouth.setAttribute("d", "M50 " + top + " a" + rx + " " + ry + " 0 1 0 0.01 0Z"); mouth.setAttribute("fill", "#f4f0ff");
      } else if (el.__talkWas) { setExpr(el.getAttribute("data-expr") || "neutral"); }
      if (level > 0.03 && !el.__talkWas && !reduce) { setMotion("center"); face.classList.add("nod"); }
      if (level <= 0.03) face.classList.remove("nod");
      el.__talkWas = level > 0.03;
    };
    api.setMotion = setMotion;
    api.look = function (dx) { api.lookUntil = Date.now() + 1500; eyes.style.transform = "translateX(" + (Math.max(-1, Math.min(1, dx || 0)) * 4) + "px)"; };
    api.blink = function () { el.classList.add("blink"); setTimeout(function () { el.classList.remove("blink"); }, 130); };
    el.__dsOrb = api;
    function later(fn, ms) { var t = setTimeout(fn, ms); api.timers.push(t); }
    function react() {
      api.hold = Date.now() + 1400; setMotion("center"); setExpr("happy"); el.classList.remove("jump"); void el.offsetWidth;
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
      var lastM = "center", lastE = "neutral";
      (function cycle() {
        later(function () {
          var now = Date.now();
          if (now < api.hold || api.talking > 0.03 || opt.auto === false || now < (api.lookUntil || 0) || el.classList.contains("jump")) { cycle(); return; }
          var m, x;
          do { m = MOTION_KEYS[Math.floor(Math.random() * MOTION_KEYS.length)]; } while (m === lastM);
          do { x = IDLE_EXPR[Math.floor(Math.random() * IDLE_EXPR.length)]; } while (x === lastE);
          lastM = m; lastE = x;
          setExpr(x); setMotion(m);
          if (x === "curious") later(function () { if (!api.talking) eyes.style.transform = "translateX(4px)"; }, 450);
          cycle();
        }, 1000);
      })();
    }
    return api;
  }
  function auto() { d.querySelectorAll("[data-darkstar-orb]").forEach(function (el) { mount(el); }); }
  w.DarkStarOrb = { mount: mount, auto: auto };
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", auto); else auto();
})(window, document);

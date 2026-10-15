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
      ".ds-orb .ov{opacity:0;transition:opacity .25s;transform-box:fill-box;transform-origin:center}" +
      ".ds-orb[data-expr=angry] .ov-anger{opacity:1;animation:dsoPulse .5s ease-in-out infinite alternate}.ds-orb[data-expr=angry] .b circle:nth-of-type(1){filter:drop-shadow(0 0 3px #ff3b3b)}" +
      ".ds-orb[data-expr=huffy] .ov-steam{opacity:1;animation:dsoSteam 1s ease-out infinite}.ds-orb[data-expr=huffy] .cheek{opacity:.8!important;transform:scale(1.5);transform-box:fill-box;transform-origin:center}" +
      ".ds-orb[data-expr=sad] .ov-tear{opacity:1;animation:dsoTear 1.6s ease-in infinite}" +
      ".ds-orb[data-expr=love] .eyes{opacity:0}.ds-orb[data-expr=love] .ov-hearts{opacity:1;animation:dsoPulse .45s ease-in-out infinite alternate}.ds-orb[data-expr=love] .cheek{opacity:.75!important}" +
      ".ds-orb[data-expr=thinking] .ov-think{opacity:1;animation:dsoPulse .8s ease-in-out infinite alternate}" +
      ".ds-orb[data-expr=laughing] .b{animation:dsoLaugh .32s ease-in-out infinite}.ds-orb[data-expr=laughing] .ov-laugh{opacity:1}" +
      ".ds-orb[data-expr=surprised] .ov-surp{opacity:1}" +
      "@keyframes dsoPulse{from{transform:scale(.9)}to{transform:scale(1.12)}}@keyframes dsoSteam{0%{transform:translateY(0) scale(.7);opacity:.9}100%{transform:translateY(-7px) scale(1.25);opacity:0}}" +
      "@keyframes dsoTear{0%{transform:translateY(0);opacity:0}25%{opacity:1}100%{transform:translateY(12px);opacity:0}}@keyframes dsoLaugh{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-4%) rotate(3deg)}}" +
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
    wink: "M42 65 Q50 74 58 65",
    angry: "M42 70 Q50 63 58 70",
    sad: "M43 70 Q50 65 57 70",
    joy: "M40 62 Q50 80 60 62 Q50 66 40 62Z",
    huffy: "M45 69 Q50 66 55 69",
    love: "M42 64 Q50 74 58 64 Q50 68 42 64Z",
    thinking: "M45 68 L55 66",
    laughing: "M39 61 Q50 82 61 61 Q50 65 39 61Z"
  };
  // 眉毛（只有生氣／難過顯示）
  var BROWS = {
    angry: ["M31 39 L44 44", "M69 39 L56 44"],
    sad: ["M32 43 L44 39", "M68 43 L56 39"],
    huffy: ["M31 41 L44 44", "M69 41 L56 44"],
    thinking: ["M32 40 Q38 36 44 39", "M56 42 L68 42"]
  };
  var EYES = {
    neutral: ["open", "open", 1, 0], happy: ["arc", "arc", 1, 0], curious: ["open", "open", 1, 0],
    surprised: ["open", "open", 1.28, 0], sleepy: ["line", "line", 1, 0], wink: ["arc", "open", 1, 0],
    angry: ["open", "open", .9, 0], sad: ["open", "open", .92, 0], joy: ["arc", "arc", 1.1, 0],
    huffy: ["line", "line", 1, 0], love: ["arc", "arc", 1, 0], thinking: ["open", "open", .95, 0], laughing: ["line", "line", 1.1, 0]
  };
  // 表情別名（含中文）＋動作
  var ALIAS = { think: "thinking", curious: "curious", joy: "joy", laugh: "laughing", huff: "huffy", pout: "huffy", surprise: "surprised" };
  var EXPR_MOTION = { angry: "shake", huffy: "wobble", surprised: "upRight", laughing: "center", love: "center", sad: "downLeft", thinking: "upLeft", happy: "center", sleepy: "downRight" };
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
      '<g class="brows" fill="none" stroke="#f7f5ff" stroke-width="3" stroke-linecap="round"><path class="bl" d=""/><path class="br" d=""/></g>' +
      '<ellipse class="cheek" cx="30" cy="63" rx="5" ry="2.6" fill="#ff8fb1" opacity=".35"/><ellipse class="cheek" cx="70" cy="63" rx="5" ry="2.6" fill="#ff8fb1" opacity=".35"/>' +
      '<g class="mouth"><path d="' + MOUTH.neutral + '" fill="#f4f0ff" stroke="#f4f0ff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>' +
      '<g class="ov ov-anger" fill="none" stroke="#ff3b3b" stroke-width="2.6" stroke-linecap="round"><path d="M70 24 q3 3 0 6 M76 24 q-3 3 0 6 M70 24 q3 -3 6 0 M70 30 q3 3 6 0"/></g>' +
      '<g class="ov ov-steam" fill="#e9e6ff"><circle cx="19" cy="38" r="4"/><circle cx="15" cy="31" r="3"/><circle cx="81" cy="38" r="4"/><circle cx="85" cy="31" r="3"/></g>' +
      '<path class="ov ov-tear" d="M36 58 q-3 5 0 7 q3 -2 0 -7Z" fill="#7cc8ff"/>' +
      '<g class="ov ov-hearts" fill="#ff5c8a"><path d="M38 55 l-6 -6 a3.6 3.6 0 0 1 6 -4 a3.6 3.6 0 0 1 6 4Z"/><path d="M62 55 l-6 -6 a3.6 3.6 0 0 1 6 -4 a3.6 3.6 0 0 1 6 4Z"/></g>' +
      '<text class="ov ov-think" x="74" y="28" font-size="15" font-weight="700" fill="#b9b0ff" font-family="sans-serif">?</text>' +
      '<text class="ov ov-laugh" x="73" y="30" font-size="11" font-weight="700" fill="#ffd166" font-family="sans-serif">哈</text>' +
      '<text class="ov ov-surp" x="75" y="28" font-size="15" font-weight="700" fill="#ffd166" font-family="sans-serif">!</text>' +
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
      mouth.setAttribute("fill", x === "happy" || x === "surprised" || x === "joy" || x === "love" || x === "laughing" ? "#f4f0ff" : "none");
      ["l", "r"].forEach(function (s, i) {
        var g = el.querySelector(".e" + s);
        ["open", "arc", "line"].forEach(function (k) {
          g.querySelectorAll("." + k).forEach(function (p) { p.style.display = e[i] === k ? "" : "none"; });
        });
        g.style.transform = "scale(" + e[2] + ")";
      });
      eyes.style.transform = x === "curious" ? "translateX(-4px)" : x === "sad" ? "translateY(2px)" : x === "thinking" ? "translate(-3px,-3px)" : "";
      var br = BROWS[x] || ["", ""];
      el.querySelector(".brows .bl").setAttribute("d", br[0]); el.querySelector(".brows .br").setAttribute("d", br[1]);
    }
    setExpr("neutral");
    var api = { el: el, setExpr: setExpr, timers: [], hold: 0, talking: 0 };
    // 外部控制：表情（鎖定一段時間，不被隨機表情覆蓋）、說話嘴型、視線
    api.setExpression = function (x, ms) {
      x = ALIAS[x] || x; api.hold = Date.now() + (ms == null ? 2500 : ms); x = MOUTH[x] ? x : "neutral"; setExpr(x);
      var mo = EXPR_MOTION[x]; if (mo && ms !== 0 && !reduce) setMotion(mo);
      if ((x === "surprised" || x === "happy" || x === "laughing") && ms !== 0 && !reduce) { el.classList.remove("jump"); void el.offsetWidth; el.classList.add("jump"); later(function () { el.classList.remove("jump"); }, 600); }
    };
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
  // ---- 表情指令偵測（使用者說／打「做一個生氣的表情」「開心」「氣呼呼」、表情符號，或回覆中的 [表情:生氣] 標籤）----
  var CMD = [
    ["huffy", /氣呼呼|氣鼓鼓|嘟嘴|哼+[!！]*$|鼓起|不服氣|賭氣|生悶氣|😤/],
    ["angry", /生氣|憤怒|發火|火大|怒|氣死|生气|愤怒|发火|😡|😠|🤬|💢|angry/i],
    ["laughing", /大笑|哈哈哈|笑死|爆笑|狂笑|笑一個|笑一个|😂|🤣|😆|laugh/i],
    ["love", /愛心|爱心|喜歡你|喜欢你|愛你|爱你|戀愛|恋爱|心動|心动|比心|😍|🥰|❤️|💕|💖|😘|love/i],
    ["sad", /難過|难过|傷心|伤心|哭|悲傷|悲伤|委屈|😢|😭|😞|☹|🙁|sad|cry/i],
    ["surprised", /驚訝|惊讶|吃驚|吃惊|嚇一跳|吓一跳|驚喜|惊喜|😮|😲|😯|🤯|surpris/i],
    ["thinking", /思考|想一想|想想|沉思|動腦|动脑|疑惑|🤔|think/i],
    ["sleepy", /睏|困了|想睡|睡覺|睡觉|愛睏|打瞌睡|累了|😴|🥱|sleep/i],
    ["happy", /開心|开心|高興|高兴|快樂|快乐|微笑|笑容|😃|😄|😊|🙂|😀|happy|smile/i]
  ];
  var TAG = /[\[【［]\s*(?:表情|表情符號|expression|expr)\s*[:：]\s*([^\]】］]{1,8})\s*[\]】］]/i;
  var TAG_ALL = /[\[【［]\s*(?:表情|表情符號|expression|expr)\s*[:：]\s*[^\]】］]{1,8}\s*[\]】］]/gi;
  function word(t) { t = String(t || ""); for (var i = 0; i < CMD.length; i++) if (CMD[i][1].test(t)) return CMD[i][0]; var e = String(t).trim().toLowerCase(); return MOUTH[e] ? e : (ALIAS[e] || null); }
  // 明確指令：要求做表情（做／給／來／擺／變成／表情）或整句幾乎只有情緒詞／表情符號
  function detectCommand(t) {
    t = String(t || ""); var m = t.match(TAG); if (m) return word(m[1]);
    var short = t.replace(/[\s，。！？!?,.～~、]/g, "");
    if (/(做|作|給|给|來|来|擺|摆|變成|变成|露出|裝|装|show|make).{0,8}(表情|臉|脸|樣子|样子|face)|表情/.test(t) || short.length <= 6) return word(t);
    return null;
  }
  function stripTags(t) { return String(t || "").replace(TAG_ALL, "").replace(/[ \t]{2,}/g, " ").trim(); }
  w.DarkStarOrb = { mount: mount, auto: auto, detectCommand: detectCommand, exprFromTag: function (t) { var m = String(t || "").match(TAG); return m ? word(m[1]) : null; }, stripTags: stripTags,
    EXPRESSIONS: ["angry", "huffy", "happy", "sad", "surprised", "thinking", "love", "sleepy", "laughing"],
    TAG_HINT: "（若要配合情緒，可在回覆最前面加一個表情標籤，例如 [表情:開心]、[表情:生氣]、[表情:氣呼呼]、[表情:難過]、[表情:驚訝]、[表情:思考]、[表情:愛心]、[表情:想睡]、[表情:大笑]；標籤不會顯示給使用者。）" };
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", auto); else auto();
})(window, document);

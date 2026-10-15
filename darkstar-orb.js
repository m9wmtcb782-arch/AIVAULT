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
      ".ds-orb[data-ov~=streams] .ov-streams{opacity:1;animation:dsoStream .6s linear infinite}.ds-orb[data-ov~=sweat] .ov-sweat{opacity:1;animation:dsoTear 1.8s ease-in infinite}" +
      ".ds-orb[data-ov~=halo] .ov-halo{opacity:1;animation:dsoHalo 1.6s ease-in-out infinite}.ds-orb[data-ov~=tongue] .ov-tongue{opacity:1}.ds-orb[data-ov~=teeth] .ov-teeth{opacity:1}" +
      ".ds-orb[data-ov~=fhearts] .ov-fhearts{opacity:1;animation:dsoFloatUp 1.4s ease-out infinite}.ds-orb[data-ov~=blush] .ov-blush{opacity:1}.ds-orb[data-ov~=sparkle] .ov-sparkle{opacity:1;animation:dsoPulse .5s ease-in-out infinite alternate}" +
      ".ds-orb[data-ov~=lines] .ov-lines{opacity:1;animation:dsoPulse .25s ease-in-out infinite alternate}.ds-orb[data-ov~=tear] .ov-tear{opacity:1;animation:dsoTear 1.6s ease-in infinite}" +
      ".ds-orb .acc{opacity:0;transition:opacity .2s;transform-box:fill-box;transform-origin:50% 80%;font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif}.ds-orb[data-acc] .acc{opacity:1}" +
      ".ds-orb[data-acca=wave] .acc{animation:dsoWave .5s ease-in-out infinite alternate}.ds-orb[data-acca=pop] .acc{animation:dsoPop .6s cubic-bezier(.3,1.6,.5,1) infinite alternate}.ds-orb[data-acca=beat] .acc{animation:dsoBeat .8s ease-in-out infinite}" +
      ".ds-orb[data-acca=clap] .acc{animation:dsoClap .3s ease-in-out infinite alternate}.ds-orb[data-acca=bob] .acc{animation:dsoBob .6s ease-in-out infinite alternate}.ds-orb[data-acca=crack] .acc{animation:dsoShake .5s ease-in-out infinite}" +
      ".ds-orb.x-upside .face{transform:rotate(180deg)!important}.ds-orb.x-dart .eyes{animation:dsoDart 1s ease-in-out infinite}.ds-orb.x-down .eyes{transform:translateY(4px)!important}.ds-orb.x-sob .b{animation:dsoSob .3s ease-in-out infinite}" +
      ".ds-orb.x-pale circle[fill^=url]{filter:hue-rotate(190deg) brightness(1.5) saturate(.6)}.ds-orb.x-roll .face{animation:dsoRoll 1.2s ease-in-out infinite}.ds-orb.x-crazy .el{transform:scale(1.3)!important}.ds-orb.x-crazy .er{transform:scale(.7)!important}" +
      "@keyframes dsoStream{0%{transform:translateY(0);opacity:.9}100%{transform:translateY(5px);opacity:.5}}@keyframes dsoHalo{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}" +
      "@keyframes dsoFloatUp{0%{transform:translateY(4px);opacity:0}30%{opacity:1}100%{transform:translateY(-8px);opacity:0}}@keyframes dsoWave{from{transform:rotate(-14deg)}to{transform:rotate(14deg)}}" +
      "@keyframes dsoPop{from{transform:scale(.85) translateY(2px)}to{transform:scale(1.1) translateY(-3px)}}@keyframes dsoBeat{0%,40%,100%{transform:scale(1)}20%,60%{transform:scale(1.28)}}" +
      "@keyframes dsoClap{from{transform:scale(.9) rotate(-8deg)}to{transform:scale(1.12) rotate(8deg)}}@keyframes dsoBob{from{transform:translateY(-3px)}to{transform:translateY(4px)}}" +
      "@keyframes dsoDart{0%,100%{transform:translateX(-5px)}50%{transform:translateX(5px)}}@keyframes dsoSob{0%,100%{transform:translateY(0)}50%{transform:translateY(2%)}}@keyframes dsoRoll{0%,100%{transform:rotate(-25deg)}50%{transform:rotate(25deg)}}" +
      ".ds-orb .rays{transform-box:view-box;transform-origin:50px 52px;animation:dsoRays 14s linear infinite}@keyframes dsoRays{to{transform:rotate(360deg)}}" +
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
  // 擴充表情：眼型（open/arc/line/x）、嘴型、眉毛、疊加圖層（ov）、手勢配件（acc＋動畫）、整體動作（cls）
  var M2 = {
    smile: "M42 65 Q50 72 58 65", grin: "M38 61 Q50 61 62 61 Q61 75 50 75 Q39 75 38 61Z", scream: "M50 60 a6 9 0 1 0 0.01 0Z",
    anguish: "M42 71 Q50 62 58 71Z", tiredm: "M41 71 Q45 65 50 68 Q55 65 59 71Z", kiss: "M48 62 Q54 64 49 66 Q54 68 48 70", sob: "M40 71 Q50 58 60 71Z"
  };
  var DEF = {
    tired:      { e: ["x", "x", 1], m: M2.tiredm, fill: 1, br: BROWS.sad, ov: "sweat", mo: "downLeft" },
    crying:     { e: ["line", "line", 1], m: M2.sob, fill: 1, br: BROWS.sad, ov: "streams", cls: "x-sob" },
    victory:    { e: ["arc", "open", 1], m: MOUTH.happy, fill: 1, acc: "✌️", acca: "wave" },
    thumbsup:   { e: ["arc", "arc", 1], m: MOUTH.happy, fill: 1, acc: "👍", acca: "pop" },
    heartbeat:  { e: ["arc", "arc", 1], m: M2.smile, ov: "blush", acc: "💓", acca: "beat" },
    laughcry:   { e: ["x", "x", 1.05], m: MOUTH.joy, fill: 1, ov: "streams", cls: "x-sob" },
    rofl:       { e: ["x", "x", 1.05], m: MOUTH.joy, fill: 1, ov: "streams", cls: "x-roll" },
    grin:       { e: ["open", "open", 1.05], m: M2.grin, fill: 1, ov: "teeth" },
    beaming:    { e: ["arc", "arc", 1], m: M2.grin, fill: 1, ov: "teeth blush" },
    squint:     { e: ["x", "x", 1], m: MOUTH.joy, fill: 1 },
    sweatsmile: { e: ["arc", "arc", 1], m: MOUTH.happy, fill: 1, ov: "sweat" },
    heartbroken:{ e: ["open", "open", .9], m: MOUTH.sad, br: BROWS.sad, acc: "💔", acca: "crack", mo: "downLeft" },
    shocked:    { e: ["open", "open", 1.4], m: M2.scream, fill: 1, ov: "lines", mo: "upRight" },
    scream:     { e: ["open", "open", 1.45], m: M2.scream, fill: 1, ov: "lines", cls: "x-pale x-sob" },
    anguished:  { e: ["open", "open", 1.15], m: M2.anguish, fill: 1, br: BROWS.sad },
    eyes:       { e: ["open", "open", 1.15], m: MOUTH.neutral, cls: "x-dart" },
    down:       { e: ["open", "open", 1], m: MOUTH.neutral, cls: "x-down", acc: "⬇️", acca: "bob" },
    angel:      { e: ["arc", "arc", 1], m: M2.smile, ov: "halo blush" },
    tongue:     { e: ["open", "open", 1], m: MOUTH.happy, fill: 1, ov: "tongue" },
    winktongue: { e: ["line", "open", 1], m: MOUTH.happy, fill: 1, ov: "tongue" },
    zany:       { e: ["open", "open", 1], m: MOUTH.happy, fill: 1, ov: "tongue", cls: "x-crazy", mo: "wobble" },
    yum:        { e: ["arc", "arc", 1], m: MOUTH.happy, fill: 1, ov: "tongue blush" },
    kiss:       { e: ["open", "open", 1], m: M2.kiss },
    kissheart:  { e: ["line", "open", 1], m: M2.kiss, ov: "blush", acc: "❤️", acca: "pop" },
    pleading:   { e: ["open", "open", 1.35], m: MOUTH.sad, br: BROWS.sad, ov: "sparkle tear" },
    blush:      { e: ["arc", "arc", 1], m: M2.smile, ov: "blush" },
    adore:      { e: ["arc", "arc", 1], m: MOUTH.happy, fill: 1, ov: "fhearts blush" },
    upside:     { e: ["open", "open", 1], m: M2.smile, cls: "x-upside" },
    clap:       { e: ["arc", "arc", 1], m: MOUTH.happy, fill: 1, acc: "👏", acca: "clap" }
  };
  // 表情別名（含中文）＋動作
  var ALIAS = { think: "thinking", curious: "curious", joy: "joy", laugh: "laughing", huff: "huffy", pout: "huffy", surprise: "surprised", cry: "crying", heart: "heartbeat", thumbs: "thumbsup", like: "thumbsup", smile: "blush", wow: "shocked" };
  function known(x) { return !!(MOUTH[x] || DEF[x]); }
  var EXPR_MOTION = { tired: "downLeft", crying: "downLeft", heartbroken: "downLeft", shocked: "upRight", scream: "upRight", zany: "wobble", victory: "upRight", angry: "shake", huffy: "wobble", surprised: "upRight", laughing: "center", love: "center", sad: "downLeft", thinking: "upLeft", happy: "center", sleepy: "downRight" };
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
      '<g class="ov ov-streams" fill="#7cc8ff" opacity=".9"><rect x="34" y="57" width="4" height="22" rx="2"/><rect x="62" y="57" width="4" height="22" rx="2"/></g>' +
      '<path class="ov ov-sweat" d="M74 30 q-4 6 0 8 q4 -2 0 -8Z" fill="#7cc8ff"/>' +
      '<ellipse class="ov ov-halo" cx="50" cy="11" rx="15" ry="4" fill="none" stroke="#ffd166" stroke-width="2.6"/>' +
      '<ellipse class="ov ov-tongue" cx="54" cy="71" rx="4" ry="4.6" fill="#ff6b8a"/>' +
      '<path class="ov ov-teeth" d="M40 64.5 L60 64.5" stroke="#2a2a35" stroke-width="1.2"/>' +
      '<g class="ov ov-fhearts" fill="#ff5c8a"><path d="M20 30 l-4 -4 a2.4 2.4 0 0 1 4 -2.6 a2.4 2.4 0 0 1 4 2.6Z"/><path d="M82 22 l-4 -4 a2.4 2.4 0 0 1 4 -2.6 a2.4 2.4 0 0 1 4 2.6Z"/><path d="M86 48 l-3 -3 a1.8 1.8 0 0 1 3 -2 a1.8 1.8 0 0 1 3 2Z"/></g>' +
      '<g class="ov ov-blush" fill="#ff7aa2" opacity=".75"><ellipse cx="29" cy="63" rx="7" ry="3.4"/><ellipse cx="71" cy="63" rx="7" ry="3.4"/></g>' +
      '<g class="ov ov-sparkle" fill="#fff"><circle cx="36" cy="47" r="2.6"/><circle cx="60" cy="47" r="2.6"/><circle cx="40" cy="53" r="1.3"/><circle cx="64" cy="53" r="1.3"/></g>' +
      '<g class="ov ov-lines" stroke="#b9c6ff" stroke-width="2" stroke-linecap="round"><path d="M14 24 l6 6 M10 40 l7 1 M86 24 l-6 6 M90 40 l-7 1"/></g>' +
      '<text class="zz" x="78" y="24" font-size="13" font-weight="700" fill="#b9b0ff" font-family="sans-serif">z</text></g></g>' +
      '<text class="acc" x="66" y="98" font-size="30"></text></svg>';
  }
  function eye(side, cx) {
    return '<g class="eye e' + side + '">' +
      '<ellipse class="open" cx="' + cx + '" cy="50" rx="6" ry="8" fill="#f7f5ff"/><circle class="open" cx="' + (cx + 1.8) + '" cy="46.5" r="2" fill="#fff"/>' +
      '<path class="arc" d="M' + (cx - 6) + ' 52 Q' + cx + ' 42 ' + (cx + 6) + ' 52" fill="none" stroke="#f7f5ff" stroke-width="3" stroke-linecap="round"/>' +
      '<path class="line" d="M' + (cx - 6) + ' 52 Q' + cx + ' 55 ' + (cx + 6) + ' 52" fill="none" stroke="#f7f5ff" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path class="x" d="' + (side === "l" ? "M" + (cx - 5) + " 45 L" + (cx + 4) + " 50 L" + (cx - 5) + " 55" : "M" + (cx + 5) + " 45 L" + (cx - 4) + " 50 L" + (cx + 5) + " 55") + '" fill="none" stroke="#f7f5ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>';
  }
  function mount(el, opt) {
    if (!el || el.__dsOrb) return el && el.__dsOrb;
    css(); opt = opt || {};
    if (el.getAttribute("data-auto") === "false") opt.auto = false;
    var size = Number(opt.size || el.getAttribute("data-size") || 40), id = "dso" + (++n);
    el.classList.add("ds-orb"); el.style.width = el.style.height = size + "px";
    el.setAttribute("role", "img"); el.setAttribute("aria-label", "暗星小球");
    el.innerHTML = svg(id);
    var mouth = el.querySelector(".mouth path"), eyes = el.querySelector(".eyes"), face = el.querySelector(".face"), hl = el.querySelector(".hl"), acc = el.querySelector(".acc"), ink = "#f4f0ff";
    // 曙光主題：金色太陽球＋旋轉光芒，五官改深棕色
    if (opt.theme === "dawn") {
      ink = "#5b2a00"; el.classList.add("ds-orb-dawn"); el.setAttribute("aria-label", "曙光小太陽");
      var gs = el.querySelectorAll("#" + id + "g stop"); ["#fff6c2", "#ffc300", "#f77f00"].forEach(function (c, i) { if (gs[i]) gs[i].setAttribute("stop-color", c); });
      el.querySelectorAll("#" + id + "o stop").forEach(function (st) { st.setAttribute("stop-color", "#ffb703"); });
      var rays = '<g class="rays" fill="#ffb703" opacity=".9">'; for (var k = 0; k < 12; k++) rays += '<path d="M50 4 L54 13 L46 13Z" transform="rotate(' + (k * 30) + ' 50 52)"/>'; rays += "</g>";
      var bgrp = el.querySelector(".b"); bgrp.insertAdjacentHTML("afterbegin", rays);
      el.querySelectorAll(".face [fill='#f7f5ff'],.face [fill='#f4f0ff']").forEach(function (p) { p.setAttribute("fill", ink); });
      el.querySelectorAll(".face [stroke='#f7f5ff'],.face [stroke='#f4f0ff']").forEach(function (p) { p.setAttribute("stroke", ink); });
      el.querySelectorAll(".eye circle.open").forEach(function (p) { p.setAttribute("fill", "#fff"); });
    }
    function setMotion(k) {
      var m = MOTIONS[k] || MOTIONS.center;
      face.classList.remove("m-shake", "m-spin", "m-wobble");
      face.style.transform = m.f || ""; hl.style.transform = m.h || "";
      if (m.cls) { void face.getBoundingClientRect(); face.classList.add(m.cls); }
      el.setAttribute("data-motion", k);
    }
    function setExpr(x) {
      var D = DEF[x] || null, e = D ? D.e : (EYES[x] || EYES.neutral);
      el.setAttribute("data-expr", x);
      mouth.setAttribute("d", D ? D.m : (MOUTH[x] || MOUTH.neutral));
      mouth.setAttribute("fill", (D ? D.fill : (x === "happy" || x === "surprised" || x === "joy" || x === "love" || x === "laughing")) ? ink : "none");
      el.setAttribute("data-ov", D && D.ov || "");
      if (D && D.acc) { acc.textContent = D.acc; el.setAttribute("data-acc", "1"); el.setAttribute("data-acca", D.acca || ""); } else { el.removeAttribute("data-acc"); el.removeAttribute("data-acca"); }
      (el.__xcls || []).forEach(function (c) { el.classList.remove(c); }); el.__xcls = D && D.cls ? D.cls.split(" ") : []; el.__xcls.forEach(function (c) { el.classList.add(c); });
      ["l", "r"].forEach(function (s, i) {
        var g = el.querySelector(".e" + s);
        ["open", "arc", "line", "x"].forEach(function (k) {
          g.querySelectorAll("." + k).forEach(function (p) { p.style.display = e[i] === k ? "" : "none"; });
        });
        g.style.transform = "scale(" + e[2] + ")";
      });
      eyes.style.transform = x === "curious" ? "translateX(-4px)" : x === "sad" ? "translateY(2px)" : x === "thinking" ? "translate(-3px,-3px)" : "";
      var br = (D ? D.br : BROWS[x]) || ["", ""];
      el.querySelector(".brows .bl").setAttribute("d", br[0]); el.querySelector(".brows .br").setAttribute("d", br[1]);
    }
    setExpr("neutral");
    var api = { el: el, setExpr: setExpr, timers: [], hold: 0, talking: 0 };
    // 外部控制：表情（鎖定一段時間，不被隨機表情覆蓋）、說話嘴型、視線
    api.setExpression = function (x, ms) {
      x = ALIAS[x] || x; api.hold = Date.now() + (ms == null ? 2500 : ms); x = known(x) ? x : "neutral"; setExpr(x);
      var mo = EXPR_MOTION[x]; if (mo && ms !== 0 && !reduce) setMotion(mo);
      if ((x === "surprised" || x === "happy" || x === "laughing" || x === "victory" || x === "thumbsup" || x === "clap" || x === "shocked") && ms !== 0 && !reduce) { el.classList.remove("jump"); void el.offsetWidth; el.classList.add("jump"); later(function () { el.classList.remove("jump"); }, 600); }
    };
    api.setTalking = function (level) {
      level = Math.max(0, Math.min(1, Number(level) || 0)); api.talking = level;
      if (level > 0.03) {
        var ry = (1.6 + level * 6.5).toFixed(2), rx = (3.5 + level * 2.5).toFixed(2), top = (66 - ry).toFixed(2);
        mouth.setAttribute("d", "M50 " + top + " a" + rx + " " + ry + " 0 1 0 0.01 0Z"); mouth.setAttribute("fill", ink);
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
  // 表情符號 → 表情
  var EMO = { "😫": "tired", "😩": "tired", "😢": "sad", "😭": "crying", "✌️": "victory", "✌": "victory", "👍": "thumbsup", "💓": "heartbeat", "💗": "heartbeat", "😂": "laughcry", "🤣": "rofl",
    "😃": "happy", "😄": "happy", "😡": "angry", "😠": "angry", "🤬": "angry", "🤔": "thinking", "😅": "sweatsmile", "💔": "heartbroken", "😲": "shocked", "😮": "surprised", "😯": "surprised",
    "😧": "anguished", "😦": "anguished", "👀": "eyes", "⬇️": "down", "⬇": "down", "😆": "squint", "😇": "angel", "😛": "tongue", "😗": "kiss", "😙": "kiss", "🥹": "pleading", "🥺": "pleading",
    "😁": "beaming", "☺️": "blush", "☺": "blush", "😊": "blush", "🥰": "adore", "😍": "love", "🙃": "upside", "😘": "kissheart", "🤪": "zany", "😜": "winktongue", "😝": "winktongue",
    "😋": "yum", "😤": "huffy", "👏": "clap", "😱": "scream", "😴": "sleepy", "🥱": "sleepy", "😀": "grin", "🙂": "blush", "❤️": "heartbeat" };
  var EMO_RE = new RegExp(Object.keys(EMO).sort(function (a, b) { return b.length - a.length; }).map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|"), "u");
  function emojiExpr(t) { var m = String(t || "").match(EMO_RE); return m ? EMO[m[0]] : null; }
  var CMD = [
    ["tired", /好累|累死|疲憊|疲惫|崩潰|崩溃|受不了|好煩|好烦|tired|exhausted/i],
    ["crying", /大哭|嚎啕|哭哭|爆哭|痛哭|crying|sob/i],
    ["victory", /勝利|胜利|耶[!！]*$|比耶|比個耶|比个耶|贏了|赢了|victory|\bV\b/i],
    ["thumbsup", /讚|赞|按讚|好棒|厲害|厉害|比讚|thumbs ?up|good job|nice/i],
    ["heartbeat", /心跳|怦然|小鹿亂撞|小鹿乱撞|撲通|扑通|heartbeat/i],
    ["laughcry", /笑哭|笑到哭|笑出眼淚|笑出眼泪/],
    ["rofl", /笑到打滾|笑到打滚|笑翻|笑倒|rofl/i],
    ["heartbroken", /心碎|失戀|失恋|心痛|heartbroken|broken heart/i],
    ["scream", /尖叫|嚇死|吓死|恐怖|好可怕|scream/i],
    ["shocked", /震驚|震惊|傻眼|嚇呆|吓呆|shocked/i],
    ["anguished", /痛苦|苦惱|苦恼|擔心|担心|焦慮|焦虑|anguish|worried/i],
    ["eyes", /看看|偷看|盯著|盯着|東張西望|东张西望|眼睛|look around/i],
    ["down", /往下看|看下面|向下|下面|look down/i],
    ["angel", /天使|乖巧|無辜|无辜|angel|innocent/i],
    ["zany", /瘋狂|疯狂|搞怪|鬼臉|鬼脸|crazy|zany/i],
    ["winktongue", /吐舌眨眼|調皮|调皮|淘氣|淘气|wink/i],
    ["tongue", /吐舌|舌頭|舌头|tongue/i],
    ["yum", /好吃|美味|好香|yum|delicious/i],
    ["kissheart", /飛吻|飞吻|親親|亲亲|kiss/i],
    ["kiss", /嘟嘴親|啾/],
    ["pleading", /拜託|拜托|求求|可憐|可怜|感動|感动|please|pleading/i],
    ["adore", /好愛|好爱|喜歡死|喜欢死|寵愛|宠爱|adore/i],
    ["upside", /倒過來|倒过来|顛倒|颠倒|upside/i],
    ["clap", /拍手|鼓掌|掌聲|掌声|clap|applause/i],
    ["sweatsmile", /尷尬|尴尬|冒汗|流汗|苦笑|awkward/i],
    ["beaming", /露齒|露齿|咧嘴|燦笑|灿笑|grin/i],
    ["blush", /害羞|臉紅|脸红|靦腆|腼腆|blush|shy/i],
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
  function word(t) { t = String(t || ""); var em = emojiExpr(t); if (em) return em; for (var i = 0; i < CMD.length; i++) if (CMD[i][1].test(t)) return CMD[i][0]; var e = String(t).trim().toLowerCase(); return MOUTH[e] ? e : (ALIAS[e] || null); }
  // 明確指令：要求做表情（做／給／來／擺／變成／表情）或整句幾乎只有情緒詞／表情符號
  function detectCommand(t) {
    t = String(t || ""); var m = t.match(TAG); if (m) return word(m[1]);
    var short = t.replace(/[\s，。！？!?,.～~、]/g, "");
    if (/(做|作|給|给|來|来|擺|摆|變成|变成|露出|裝|装|比|show|make).{0,8}(表情|臉|脸|樣子|样子|手勢|手势|face)|表情/.test(t) || short.length <= 6) return word(t);
    var em = emojiExpr(t); if (em && short.length <= 12) return em;
    return null;
  }
  // 回答情緒：標籤 → 表情符號 → 關鍵詞（較寬鬆，用於 AI 回覆）
  var MOOD = [
    ["victory", /恭喜|成功了|做到了|通過了|通过了|贏了|赢了|congrat/i], ["clap", /太棒了|做得好|做得很好|了不起|well done|bravo/i],
    ["thumbsup", /沒問題|没问题|可以的|好的，|當然|当然|正確|正确|答對|答对|沒錯|没错|correct/i], ["heartbroken", /很遺憾|很遗憾|心碎|失戀|失恋/],
    ["sad", /難過|难过|抱歉|對不起|对不起|可惜|遺憾|遗憾|sorry|unfortunately/i], ["sweatsmile", /哈哈.*不過|不好意思|有點尷尬|有点尴尬|oops/i],
    ["laughing", /哈哈|呵呵|好笑|lol|haha/i], ["thinking", /讓我想想|让我想想|首先|分析|思考|可能|也許|也许|或許|或许|let me think/i],
    ["shocked", /竟然|居然|沒想到|没想到|天啊|wow/i], ["angry", /不可以|不應該|不应该|禁止|違法|违法/], ["happy", /很高興|很高兴|開心|开心|歡迎|欢迎|謝謝|谢谢|glad|happy/i]
  ];
  function moodOf(t) {
    t = String(t || ""); var m = t.match(TAG); if (m) { var w0 = word(m[1]); if (w0) return w0; }
    var em = emojiExpr(t); if (em) return em;
    for (var i = 0; i < MOOD.length; i++) if (MOOD[i][1].test(t)) return MOOD[i][0];
    return null;
  }
  var LABELS = { angry: "😡 生氣了", huffy: "😤 氣呼呼", happy: "😃 很開心", sad: "😢 有點難過", surprised: "😮 有點驚訝", thinking: "🤔 正在思考", love: "😍 好喜歡", sleepy: "😴 想睡了", laughing: "😆 大笑",
    tired: "😫 好累", crying: "😭 大哭", victory: "✌️ 勝利", thumbsup: "👍 讚", heartbeat: "💓 心跳加速", laughcry: "😂 笑哭", rofl: "🤣 笑到打滾", grin: "😀 咧嘴笑", beaming: "😁 燦笑", squint: "😆 笑瞇瞇",
    sweatsmile: "😅 苦笑", heartbroken: "💔 心碎", shocked: "😲 嚇到", scream: "😱 尖叫", anguished: "😧 好苦惱", eyes: "👀 看看", down: "⬇️ 往下看", angel: "😇 天使", tongue: "😛 吐舌",
    winktongue: "😜 調皮", zany: "🤪 搞怪", yum: "😋 好吃", kiss: "😗 嘟嘴", kissheart: "😘 飛吻", pleading: "🥹 感動", blush: "☺️ 害羞", adore: "🥰 好愛", upside: "🙃 倒過來", clap: "👏 拍手", joy: "🤩 好興奮", curious: "🤔 好奇" };
  function stripTags(t) { return String(t || "").replace(TAG_ALL, "").replace(/[ \t]{2,}/g, " ").trim(); }
  w.DarkStarOrb = { mount: mount, auto: auto, detectCommand: detectCommand, exprFromTag: function (t) { var m = String(t || "").match(TAG); return m ? word(m[1]) : null; }, stripTags: stripTags,
    EXPRESSIONS: ["angry", "huffy", "happy", "sad", "surprised", "thinking", "love", "sleepy", "laughing"].concat(Object.keys(DEF)), LABELS: LABELS, moodOf: moodOf, emojiExpr: emojiExpr, known: known,
    TAG_HINT: "（若要配合情緒，可在回覆最前面加一個表情標籤，例如 [表情:開心]、[表情:生氣]、[表情:氣呼呼]、[表情:難過]、[表情:大哭]、[表情:驚訝]、[表情:思考]、[表情:愛心]、[表情:想睡]、[表情:大笑]、[表情:笑哭]、[表情:勝利]、[表情:讚]、[表情:拍手]、[表情:苦笑]、[表情:心碎]、[表情:好累]、[表情:害羞]；標籤不會顯示給使用者。）" };
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", auto); else auto();
})(window, document);

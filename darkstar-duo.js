/* 曙光小太陽 × 暗星：曙光（金色太陽球、旋轉光芒，表情與暗星同一套）放在暗星數字人面板上方一起出現。
   偶爾用「本機寫好的台詞」互相鬥嘴（不呼叫任何 AI／付費 API，頻率很低）：有時暗星唸曙光，曙光就 😫／😢。
   即時連線中、面板縮小、頁面在背景時不會鬥嘴。 */
(function (w, d) {
  "use strict";
  if (w.AIVAULTDawnAvatar) return;
  var dawn = null, box = null, timer = 0, lastUser = 0;
  var SCRIPTS = [
    [["dark", "曙光，你今天又晚起了吧？", "huffy"], ["dawn", "我…我只是在充電啦…", "tired"]],
    [["dawn", "早安！今天也要元氣滿滿！", "victory"], ["dark", "小聲一點，我在思考。", "thinking"], ["dawn", "好啦…", "sad"]],
    [["dark", "剛剛那題你答錯了喔，認真一點！", "angry"], ["dawn", "嗚嗚，下次一定會對…", "crying"]],
    [["dawn", "暗星你看！我發光了！", "beaming"], ["dark", "……好啦，很亮。", "sweatsmile"]],
    [["dark", "曙光，光芒別一直轉，我頭好暈。", "huffy"], ["dawn", "可是這樣比較帥嘛～", "winktongue"]],
    [["dawn", "我們一起加油吧！", "clap"], ["dark", "嗯，一起加油。", "thumbsup"]],
    [["dark", "你是不是又偷用我的電量？", "angry"], ["dawn", "沒…沒有啦…", "tired"]],
    [["dawn", "暗星，笑一個嘛～", "pleading"], ["dark", "……哈。", "blush"]],
    [["dark", "上課不要打瞌睡！", "angry"], ["dawn", "我沒有睡…zzz", "sleepy"]],
    [["dawn", "今天的題目好難喔…", "anguished"], ["dark", "別怕，我陪你一起想。", "heartbeat"], ["dawn", "暗星最好了！", "adore"]]
  ];
  function css() {
    var s = d.createElement("style"); s.id = "dsduo-css";
    s.textContent = "#dsDawn{position:absolute;left:8px;top:8px;z-index:2;line-height:0}#aivault-darkstar-avatar .dsfacebox #dsDawn.ds-orb{width:58px!important;height:58px!important}" +
      ".dsduo-bub{position:absolute;z-index:3;max-width:150px;padding:5px 8px;border-radius:10px;background:#fff;color:#333;font:12px/1.35 system-ui,-apple-system,'PingFang TC',sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.15);opacity:0;transform:translateY(4px);transition:opacity .25s,transform .25s;pointer-events:none;white-space:normal}" +
      ".dsduo-bub.on{opacity:1;transform:none}.dsduo-bub.dawn{left:6px;top:66px;border:1px solid #ffd27a}.dsduo-bub.dark{right:6px;top:8px;border:1px solid #d9d2ff}" +
      "@media(max-width:700px){#dsDawn{left:4px;top:4px}#aivault-darkstar-avatar .dsfacebox #dsDawn.ds-orb{width:46px!important;height:46px!important}.dsduo-bub{max-width:118px;font-size:11px}.dsduo-bub.dawn{top:52px}}";
    d.head.appendChild(s);
  }
  function darkApi() { var A = w.AIVAULTDarkStarAvatar; return A; }
  function panelMin() { return d.documentElement.classList.contains("ds-panel-min"); }
  function live() { try { var L = w.AIVAULTDarkStarLive; return !!(L && L.isConnected && L.isConnected()); } catch (e) { return false; } }
  function bubble(who, text) {
    if (!box) return; var b = d.createElement("div"); b.className = "dsduo-bub " + who; b.textContent = text; box.appendChild(b);
    requestAnimationFrame(function () { b.classList.add("on"); });
    setTimeout(function () { b.classList.remove("on"); setTimeout(function () { b.remove(); }, 300); }, 3200);
  }
  function talk(orb, ms) { if (!orb) return; var t0 = Date.now(); (function f() { var k = Date.now() - t0; if (k > ms) { orb.setTalking(0); return; } orb.setTalking(.25 + .55 * Math.abs(Math.sin(k / 85))); requestAnimationFrame(f); })(); }
  // 暗星嘴型交給面板既有的 speak()（面板每幀用它驅動嘴型，直接改小球會互相搶）
  function talkDark(ms) { var A = darkApi(); if (!A || !A.speak) return; var t0 = Date.now(); (function f() { var k = Date.now() - t0; if (k > ms) { A.speak(0); return; } A.speak(.2 + .5 * Math.abs(Math.sin(k / 85))); requestAnimationFrame(f); })(); }
  function darkOrb() { var el = d.getElementById("dsorb"); return el && el.__dsOrb; }
  async function play(script) {
    for (var i = 0; i < script.length; i++) {
      var ln = script[i];
      if (ln[0] === "dawn") { if (dawn) { dawn.setExpression(ln[2], 3600); talk(dawn, 900); } }
      else { var A = darkApi(); if (A && A.expr) A.expr(ln[2], 3600); talkDark(900); }
      bubble(ln[0], ln[1]);
      await new Promise(function (r) { setTimeout(r, 2300); });
    }
  }
  function canBanter() { return dawn && !d.hidden && !panelMin() && !live() && Date.now() - lastUser > 20000; }
  function schedule(first) {
    clearTimeout(timer);
    timer = setTimeout(function () { if (canBanter()) play(SCRIPTS[Math.floor(Math.random() * SCRIPTS.length)]); schedule(false); }, first ? 40000 + Math.random() * 30000 : 90000 + Math.random() * 90000);
  }
  function init() {
    box = d.getElementById("dsfacebox"); if (!box || dawn || !w.DarkStarOrb) return;
    css();
    var span = d.createElement("span"); span.id = "dsDawn"; span.title = "曙光"; box.appendChild(span);
    var small = w.matchMedia && w.matchMedia("(max-width:700px)").matches;
    dawn = w.DarkStarOrb.mount(span, { size: small ? 46 : 58, theme: "dawn" });
    ["keydown", "pointerdown"].forEach(function (ev) { d.addEventListener(ev, function () { lastUser = Date.now(); }, true); });
    schedule(true);
  }
  w.AIVAULTDawnAvatar = {
    expr: function (x, ms) { if (dawn) dawn.setExpression(x, ms || 4000); },
    say: function (text, x) { if (x && dawn) dawn.setExpression(x, 3600); bubble("dawn", text); talk(dawn, 900); },
    banter: function (i) { return play(SCRIPTS[i == null ? Math.floor(Math.random() * SCRIPTS.length) : i % SCRIPTS.length]); },
    orb: function () { return dawn; }
  };
  if (d.readyState === "complete") init(); else w.addEventListener("load", init);
  setTimeout(init, 2500);
})(window, document);

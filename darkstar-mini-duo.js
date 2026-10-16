/* 縮小模式（darkstar-panel-mini.js）：小暗星旁邊加上同尺寸的曙光小太陽。
   嘴型：只有正在說話的那位動嘴（依 darkstar-dual-live-etiquette.js 的 darkBusy/dawnBusy）。
   吵架模式（etiquette arguing）：兩顆頭轉向對方互嗆、生氣表情；平常依說話內容的情緒（生氣／開心／大笑）。
   點任一顆都還原面板。只改 UI，不碰任何連線。停用：localStorage.dsMiniDuoOff = "1"。 */
(function (w, d) {
  "use strict";
  if (w.__dsMiniDuo) return; w.__dsMiniDuo = 1;
  try { if (localStorage.getItem("dsMiniDuoOff") === "1") return; } catch (e) {}
  var box = null, dawn = null, t0 = Date.now(), lastMood = { dark: "", dawn: "" };
  var ANGRY = /生氣|氣死|閉嘴|笨蛋|白痴|白癡|討厭|可惡|煩死|你錯了|胡說|走開|滾/, JOY = /哈哈|呵呵|太棒|太好了|好開心|耶|萬歲|好好笑/, HAPPY = /謝謝|喜歡|很好|不錯|開心|高興|好的|沒問題/;
  function css() {
    var s = d.createElement("style"); s.id = "ds-mini-duo-css";
    s.textContent =
      "#dsMiniDawn{position:fixed;z-index:85;width:64px;height:64px;border-radius:50%;border:0;padding:0;background:radial-gradient(circle,rgba(255,190,80,.2),rgba(255,190,80,0) 70%);display:none;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;cursor:pointer}" +
      "html.ds-panel-min #dsMiniDawn{display:flex}" +
      "#dsMiniDawn>span,#dsPanelMini>span:first-child{transition:transform .3s ease}" +
      "html.ds-mini-arg #dsMiniDawn>span{transform:translateX(6px) rotate(10deg);animation:dsMiniArgL .3s ease-in-out infinite alternate}" +
      "html.ds-mini-arg #dsPanelMini>span:first-child{transform:translateX(-6px) rotate(-10deg);animation:dsMiniArgR .3s ease-in-out infinite alternate}" +
      "@keyframes dsMiniArgL{from{transform:translateX(4px) rotate(8deg)}to{transform:translateX(9px) rotate(13deg)}}" +
      "@keyframes dsMiniArgR{from{transform:translateX(-4px) rotate(-8deg)}to{transform:translateX(-9px) rotate(-13deg)}}";
    d.head.appendChild(s);
  }
  function darkOrb() { var sp = d.querySelector("#dsPanelMini>span"); return sp && sp.__dsOrb; }
  function place() {
    var m = d.getElementById("dsPanelMini"); if (!m || !box) return;
    var r = m.getBoundingClientRect(); if (!r.width) return;
    box.style.top = r.top + "px"; box.style.left = (r.left - r.width - 2) + "px";
  }
  function state() { try { return w.AIVAULTEtiquette ? w.AIVAULTEtiquette.state() : null; } catch (e) { return null; } }
  function text(k) { try { return w.AIVAULTEtiquette._test.S[k].out || ""; } catch (e) { return ""; } }
  function mood(t) { return ANGRY.test(t) ? "angry" : JOY.test(t) ? "joy" : HAPPY.test(t) ? "happy" : ""; }
  function lvl(k) { var x = (Date.now() - t0) / (k === "dark" ? 110 : 95); return 0.35 + 0.45 * Math.abs(Math.sin(x)) * (0.6 + 0.4 * Math.abs(Math.sin(x * 0.37))); }
  function tick() {
    if (!d.documentElement.classList.contains("ds-panel-min")) { d.documentElement.classList.remove("ds-mini-arg"); return; }
    place();
    var st = state() || {}, D = darkOrb(), arg = !!st.arguing;
    d.documentElement.classList.toggle("ds-mini-arg", arg);
    // 嘴型：只有說話的那位動
    if (dawn) dawn.setTalking(st.dawnBusy ? lvl("dawn") : 0);
    if (D && st.dawnBusy && !st.darkBusy) D.setTalking(0);
    else if (D && st.darkBusy) D.setTalking(Math.max(D.talking || 0, lvl("dark")) > 0.03 ? lvl("dark") : 0);
    else if (D && !st.darkBusy && D.__mdDrove) D.setTalking(0);
    if (D) D.__mdDrove = !!st.darkBusy;
    // 表情
    if (arg) {
      if (D) { D.setExpression("angry", 400); D.look && D.look(-1); }
      if (dawn) { dawn.setExpression("huffy", 400); dawn.look && dawn.look(1); }
    } else {
      [["dark", D], ["dawn", dawn]].forEach(function (p) {
        if (!p[1]) return; var m = mood(text(p[0]));
        if (m && m !== lastMood[p[0]]) p[1].setExpression(m, 2500);
        lastMood[p[0]] = m;
      });
    }
  }
  function init() {
    if (box || !d.getElementById("dsPanelMini") || !w.DarkStarOrb) return false;
    css();
    box = d.createElement("button"); box.id = "dsMiniDawn"; box.type = "button"; box.setAttribute("aria-label", "展開暗星數字人"); box.title = "點我展開數字人";
    var sp = d.createElement("span"); box.appendChild(sp); d.body.appendChild(box);
    dawn = w.DarkStarOrb.mount(sp, { size: 54, theme: "dawn" });
    box.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); if (w.AIVAULTPanelMini) w.AIVAULTPanelMini.restore(); });
    w.addEventListener("resize", place);
    setInterval(tick, 80);
    return true;
  }
  var n = 0, t = setInterval(function () { if (init() || ++n > 60) clearInterval(t); }, 250);
  w.AIVAULTMiniDuo = { tick: tick, dawn: function () { return dawn; } };
})(window, document);

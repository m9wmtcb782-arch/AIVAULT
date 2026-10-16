/* 暗星即時 × 曙光即時 同時開啟時的「禮貌輪流」（不修改任何語音引擎）：
   1) 發言權：一方正在說話（依收到的音訊長度估算播放結束時間）時，另一方收到的伺服器訊息（音訊＋逐字稿）先排隊，等對方說完再依序交給引擎播放。
   2) 留言板：一方說完一輪，把整句以 {type:'text'} 告訴另一方（【留言板】…），不強迫回覆；連續機器人互相回應最多 3 輪，之後等使用者開口。
   3) 吵架模式：逐字稿出現吵架／罵人字眼 → 20 秒內允許插話（不排隊），兩邊做生氣表情。
   停用：localStorage.dsEtiquetteOff = "1"。回滾：git revert 本檔 commit。 */
(function (w, d) {
  "use strict";
  if (w.__dsEtiquette) return; w.__dsEtiquette = 1;
  try { if (localStorage.getItem("dsEtiquetteOff") === "1") return; } catch (e) {}
  var BYTES_PER_SEC = 48000; // 24kHz 16-bit mono
  var S = {
    dark: { end: 0, q: [], out: "", label: "暗星" },
    dawn: { end: 0, q: [], out: "", label: "曙光" }
  };
  var argUntil = 0, botChain = 0, MAX_CHAIN = 3;
  var ARG = /吵架|閉嘴|笨蛋|白痴|白癡|蠢|討厭你|滾|你錯了|胡說|罵|氣死|可惡|煩死|不要吵|你才|走開/;
  function other(k) { return k === "dark" ? "dawn" : "dark"; }
  function bothLive() {
    var a = false, b = false;
    try { a = !!(w.AIVAULTDarkStarLive && w.AIVAULTDarkStarLive.isConnected()); } catch (e) {}
    try { b = !!(w.DawnLightLiveVoice && w.DawnLightLiveVoice.isOpen()); } catch (e) {}
    return a && b;
  }
  function busy(k) { return Date.now() < S[k].end; }
  function arguing() { return Date.now() < argUntil; }
  function parse(raw) {
    if (typeof raw !== "string") { var n = raw && raw.byteLength || 0; return { audio: n, msg: null }; }
    var m = null; try { m = JSON.parse(raw); } catch (e) { return { audio: 0, msg: null }; }
    var c = (m && m.serverContent) || {}, parts = (c.modelTurn && c.modelTurn.parts) || [], bytes = 0;
    parts.forEach(function (p) { var id = p && p.inlineData; if (id && id.data && /audio/.test(String(id.mimeType || ""))) bytes += id.data.length * 0.75; });
    return { audio: bytes, msg: m };
  }
  function noteAudio(k, bytes) { if (!bytes) return; var s = S[k], now = Date.now(); s.end = Math.max(s.end, now) + bytes / BYTES_PER_SEC * 1000; }
  function onText(k, info) {
    var m = info.msg; if (!m) return;
    var c = m.serverContent || {};
    var inn = (c.inputTranscription && c.inputTranscription.text) || (m.type === "inputTranscription" ? m.text : "");
    var out = (c.outputTranscription && c.outputTranscription.text) || (m.type === "outputTranscription" ? m.text : "");
    if (inn && String(inn).indexOf("留言板") < 0) { botChain = 0; checkArg(inn); }
    if (out) S[k].out += out;
    if (c.turnComplete || m.turnComplete || m.type === "turnComplete") { var line = S[k].out.trim(); S[k].out = ""; if (line) finished(k, line); }
  }
  function checkArg(t) {
    if (!ARG.test(String(t || ""))) return;
    argUntil = Date.now() + 20000;
    try { var A = w.AIVAULTDarkStarAvatar; if (A && A.expr) A.expr("angry", 4000); } catch (e) {}
    try { var D = w.AIVAULTDawnAvatar; if (D && D.expr) D.expr("huffy", 4000); } catch (e) {}
  }
  function finished(k, line) {
    checkArg(line);
    if (!bothLive()) return;
    if (++botChain > MAX_CHAIN) return; // 機器人之間最多連續 3 輪，之後等使用者
    var msg = "【留言板】" + S[k].label + "剛剛說：「" + line.slice(0, 300) + "」（這是同時在線的另一位 AI 說的話。只有和你有關或需要補充時才簡短回應；正在吵架時可以回嘴；否則不用回覆。）";
    var to = other(k);
    setTimeout(function () {
      try {
        if (to === "dark") { if (w.AIVAULTDarkStarLive) w.AIVAULTDarkStarLive.sendRawText(msg); }
        else if (w.DawnLightLiveVoice) w.DawnLightLiveVoice.sendRaw(JSON.stringify({ type: "text", text: msg }));
      } catch (e) {}
    }, 400);
  }
  // 交給引擎前的閘門：對方在說話且不是吵架 → 排隊
  function gate(k, raw, deliver) {
    var info = parse(raw);
    if (!bothLive()) { onText(k, info); return deliver(raw); }
    var s = S[k];
    if (s.q.length || (busy(other(k)) && !arguing())) { s.q.push({ raw: raw, info: info, deliver: deliver }); return; }
    noteAudio(k, info.audio); onText(k, info); deliver(raw);
  }
  function flush() {
    ["dark", "dawn"].forEach(function (k) {
      var s = S[k];
      while (s.q.length && (!busy(other(k)) || arguing() || !bothLive())) { var it = s.q.shift(); noteAudio(k, it.info.audio); onText(k, it.info); try { it.deliver(it.raw); } catch (e) { console.warn("[Etiquette]", e); } }
    });
  }
  // ---- 掛勾（不改引擎）：暗星＝__dsLiveSock.onmessage（可設定屬性）；曙光＝session.onMessage（實例覆寫） ----
  var hookedSock = null, hookedDawn = false;
  function hookDark() {
    var sk = w.__dsLiveSock; if (!sk || sk === hookedSock) return;
    var fn = sk.onmessage; if (typeof fn !== "function" || fn.__dsGate) return;
    var g = function (ev) { gate("dark", ev && ev.data, function (raw) { fn({ data: raw }); }); }; g.__dsGate = 1;
    sk.onmessage = g; hookedSock = sk; S.dark.q = []; S.dark.end = 0; S.dark.out = "";
  }
  function hookDawn() {
    var A = w.DawnLightLiveVoice, s = A && A.session; if (!s || hookedDawn) return;
    var orig = s.onMessage.bind(s); hookedDawn = true;
    s.onMessage = function (raw) { gate("dawn", raw, orig); };
  }
  setInterval(function () { hookDark(); hookDawn(); flush(); }, 100);
  w.AIVAULTEtiquette = { state: function () { return { darkBusy: busy("dark"), dawnBusy: busy("dawn"), qDark: S.dark.q.length, qDawn: S.dawn.q.length, arguing: arguing(), botChain: botChain, both: bothLive() }; } };
})(window, document);

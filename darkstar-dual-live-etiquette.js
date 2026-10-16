/* 暗星即時 × 曙光即時 同時開啟時的「禮貌輪流」＋「點名回答」（不修改任何語音引擎）：
   1) 點名：使用者這句話含「曙光」→ 只有曙光出聲，暗星這一輪的音訊／逐字稿被丟掉；含「暗星」→ 只有暗星出聲。兩個都叫或都沒叫 → 輪流。
   2) 發言權：一方正在說話（實際播放佇列＋音訊長度估算）時，另一方的伺服器訊息先排隊，等對方說完再交給引擎。
   3) 防回音：一方說話時，另一方的麥克風音訊暫停上傳（避免把對方的聲音當成使用者在說話而搶著回答）。
   4) 留言板：一方說完把整句告訴另一方（被靜音的那方不送），機器人連續互回最多 3 輪。
   5) 吵架模式：出現吵架字眼 → 20 秒內允許插話，兩邊做生氣表情。
   6) 先看留言板：連線／重連時把伺服器自動招呼靜音，改送最近 14 行留言板（dsBoardFirstOff="1" 可關）。
   停用：localStorage.dsEtiquetteOff = "1"。只停用點名：localStorage.dsAddressOff = "1"。 */
(function (w, d) {
  "use strict";
  if (w.__dsEtiquette) return; w.__dsEtiquette = 1;
  try { if (localStorage.getItem("dsEtiquetteOff") === "1") return; } catch (e) {}
  var addrOn = true; try { addrOn = localStorage.getItem("dsAddressOff") !== "1"; } catch (e) {}
  var BYTES_PER_SEC = 48000, TAIL = 600, HOLD = 900;
  var S = {
    dark: { end: 0, q: [], out: "", label: "暗星", inTurn: false, holdUntil: 0 },
    dawn: { end: 0, q: [], out: "", label: "曙光", inTurn: false, holdUntil: 0 }
  };
  var argUntil = 0, botChain = 0, MAX_CHAIN = 3;
  var ARG = /吵架|閉嘴|笨蛋|白痴|白癡|蠢|討厭你|滾|你錯了|胡說|罵|氣死|可惡|煩死|不要吵|你才|走開/;
  var NAME = { dawn: /曙光|暑光|署光|書光|數光|树光|樹光|dawn/i, dark: /暗星|案星|安星|按星|岸星|dark ?star/i };
  var user = { at: 0, text: { dark: "", dawn: "" }, addr: null }; // addr: "dark" | "dawn" | null
  function other(k) { return k === "dark" ? "dawn" : "dark"; }
  function bothLive() {
    var a = false, b = false;
    try { a = !!(w.AIVAULTDarkStarLive && w.AIVAULTDarkStarLive.isConnected()); } catch (e) {}
    try { b = !!(w.DawnLightLiveVoice && w.DawnLightLiveVoice.isOpen()); } catch (e) {}
    return a && b;
  }
  function dawnPlaying() { try { var s = w.DawnLightLiveVoice.session; return !!(s && s.playCtx && s.nextPlay > s.playCtx.currentTime + 0.02); } catch (e) { return false; } }
  function busy(k, tail) { var t = Date.now() - (tail || 0); return t < S[k].end || (k === "dawn" && dawnPlaying()); }
  function arguing() { return Date.now() < argUntil; }
  function muted(k) { return addrOn && user.addr && user.addr !== k; }
  function audioBytes(m) {
    var n = 0, c = (m && m.serverContent) || m || {}, parts = (c.modelTurn && c.modelTurn.parts) || [];
    parts.forEach(function (p) { var id = p && p.inlineData; if (id && id.data && /audio/.test(String(id.mimeType || ""))) n += id.data.length * 0.75; });
    if (m.audio && m.audio.data) n += m.audio.data.length * 0.75;
    if (m.data && typeof m.data === "string" && /audio/.test(String(m.mimeType || ""))) n += m.data.length * 0.75;
    return n;
  }
  function parse(raw) {
    if (typeof raw !== "string") { var n = raw && raw.byteLength || 0; return { audio: n, msg: null, bin: true }; }
    var m = null; try { m = JSON.parse(raw); } catch (e) { return { audio: 0, msg: null }; }
    return { audio: m ? audioBytes(m) : 0, msg: m };
  }
  function txt(m) {
    var c = (m && m.serverContent) || {};
    return {
      inn: (c.inputTranscription && c.inputTranscription.text) || (m && m.type === "inputTranscription" ? m.text : "") || "",
      out: (c.outputTranscription && c.outputTranscription.text) || (m && m.type === "outputTranscription" ? m.text : "") || "",
      done: !!(c.turnComplete || (m && (m.turnComplete || m.type === "turnComplete"))),
      modelish: !!(c.modelTurn || c.outputTranscription || (m && (m.type === "outputTranscription" || m.audio || /audio/.test(String(m.mimeType || "")))))
    };
  }
  // 使用者說話（任一邊的語音辨識）→ 判斷點名
  function onUserText(k, t) {
    if (!t || String(t).indexOf("留言板") >= 0) return;
    var now = Date.now();
    if (now - user.at > 2500) { user.text = { dark: "", dawn: "" }; user.addr = null; user.turnAt = now; }
    user.at = now; botChain = 0;
    user.text[k] += t;
    var full = (user.text.dark.length >= user.text.dawn.length ? user.text.dark : user.text.dawn).trim();
    if (!user.entry || user.entry.at !== user.turnAt) { logBoard("開創者", full); user.entry = board[board.length - 1]; if (user.entry) user.entry.at = user.turnAt; } else user.entry.t = full.slice(0, 200);
    var all = user.text.dark + " " + user.text.dawn, a = NAME.dawn.test(all), b = NAME.dark.test(all);
    var na = a && !b ? "dawn" : b && !a ? "dark" : null;
    if (na !== user.addr) {
      user.addr = na;
      if (na && addrOn) silence(other(na));
    }
    checkArg(t);
  }
  // 立刻讓沒被點名的那方閉嘴（停掉已排程的聲音）
  function silence(k) {
    S[k].end = 0; S[k].out = ""; S[k].holdUntil = 0; // 排隊中的訊息保留，交付時會被去掉音訊
    try { if (k === "dawn") { var s = w.DawnLightLiveVoice.session; (s.sources || []).forEach(function (x) { try { x.stop(); } catch (e) {} }); s.sources = []; s.nextPlay = 0; } } catch (e) {}
    try { if (k === "dark" && w.AIVAULTDarkStarLive && w.AIVAULTDarkStarLive.stopAudio) w.AIVAULTDarkStarLive.stopAudio(); } catch (e) {}
  }
  // 被靜音的一方：去掉音訊與說出的文字，只留控制訊息（turnComplete 等）
  function strip(raw, info) {
    if (info.bin) return null;
    var m = info.msg; if (!m) return raw;
    var c = m.serverContent;
    if (c) { delete c.modelTurn; delete c.outputTranscription; }
    if (m.type === "outputTranscription" || m.type === "audio") return null;
    delete m.audio; if (/audio/.test(String(m.mimeType || ""))) { delete m.data; delete m.mimeType; }
    return JSON.stringify(m);
  }
  function onText(k, info) {
    var m = info.msg; if (!m) return;
    var t = txt(m);
    if (t.out) S[k].out += t.out;
    if (t.done) { S[k].inTurn = false; var line = S[k].out.trim(); S[k].out = ""; if (line) { logBoard(S[k].label, line); finished(k, line); } }
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
    var to = other(k);
    if (muted(to)) return; // 使用者只點名了 k，不要讓另一位插話
    if (++botChain > MAX_CHAIN) return;
    var msg = "【留言板】" + S[k].label + "剛剛說：「" + line.slice(0, 300) + "」（這是同時在線的另一位 AI 說的話。開創者沒有點你的名字時，只有和你有關或需要補充時才簡短回應；正在吵架時可以回嘴；否則不用回覆。）";
    setTimeout(function () {
      try {
        if (to === "dark") { if (w.AIVAULTDarkStarLive) w.AIVAULTDarkStarLive.sendRawText(msg); }
        else if (w.DawnLightLiveVoice) w.DawnLightLiveVoice.sendRaw(JSON.stringify({ type: "text", text: msg }));
      } catch (e) {}
    }, 400);
  }
  // ---- 先看留言板（連線／重連時）：伺服器會自動打招呼 → 把連線後第一段未經詢問的回答靜音，改送留言板摘要 ----
  // 模式：normal｜greet（剛連線，靜音自動招呼）｜quiet（沒有待答問題，靜音直到開創者開口）。停用：localStorage.dsBoardFirstOff = "1"
  var bfOn = true; try { bfOn = localStorage.getItem("dsBoardFirstOff") !== "1"; } catch (e) {}
  var GREET_WAIT = 3000, claimAt = 0, board = [];
  function logBoard(who, t) { t = String(t || "").trim(); if (!t || t.indexOf("【留言板】") === 0) return; board.push({ who: who, t: t.slice(0, 200) }); if (board.length > 40) board.shift(); }
  function boardLines() {
    var out = [], rows = []; try { rows = d.querySelectorAll("#messagesInner .message, #messages .message"); } catch (e) {}
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], tx = r.querySelector(".message-text"); var t = (tx ? tx.textContent : r.textContent || "").replace(/\s+/g, " ").trim(); if (!t) continue;
      var who = /\buser\b/.test(r.className) ? "開創者" : /^曙光[:：]/.test(t) ? "曙光" : (r.querySelector(".ds-dawn-av") || r.className.indexOf("dawn") >= 0 ? "曙光" : "暗星");
      t = t.replace(/^(你|曙光|暗星)[:：]\s*/, ""); if (t) out.push({ who: who, t: t.slice(0, 200) });
    }
    if (!out.length) out = board.slice();
    return out.slice(-14);
  }
  function startFresh(k) {
    if (!bfOn) return;
    var s = S[k]; s.mode = "greet"; s.freshAt = Date.now(); s.greetSeen = false; s.inTurn = false; s.out = "";
  }
  function sendNote(k) {
    var s = S[k]; if (s.mode !== "greet") return;
    var lines = boardLines(), last = lines[lines.length - 1];
    var pending = !!(last && last.who === "開創者");
    var nameMe = pending && NAME[k].test(last.t), nameOther = pending && NAME[other(k)].test(last.t);
    var mine = pending && (nameMe || (!nameOther && (Date.now() - claimAt > 20000 || claimAt === 0)));
    if (mine) claimAt = Date.now();
    var body = lines.length ? lines.map(function (l) { return l.who + "：" + l.t; }).join("\n") : "（留言板目前沒有內容）";
    var msg = "【留言板】你剛重新連線，以下是最近的對話紀錄（含另一位 AI 和開創者說的話）：\n" + body +
      "\n請先看留言板，不要打招呼；若開創者有未回答的問題就直接回答，否則安靜等待。" + (pending && !mine ? "（另一位 AI 已在回答這個問題，你不要重複回答，安靜等待。）" : "");
    s.mode = mine ? "normal" : "quiet";
    try {
      if (k === "dark") { if (w.AIVAULTDarkStarLive) w.AIVAULTDarkStarLive.sendRawText(msg); }
      else if (w.DawnLightLiveVoice) w.DawnLightLiveVoice.sendRaw(JSON.stringify({ type: "text", text: msg }));
    } catch (e) {}
  }
  function bfTick() {
    ["dark", "dawn"].forEach(function (k) { var s = S[k]; if (s.mode === "greet" && !s.greetSeen && Date.now() - s.freshAt > GREET_WAIT) sendNote(k); });
  }
  function userActive() { ["dark", "dawn"].forEach(function (k) { if (S[k].mode === "quiet") S[k].mode = "normal"; }); }
  function silentNow(k) { return S[k].mode === "greet" || S[k].mode === "quiet" || muted(k); }
  function deliverItem(k, it) {
    if (silentNow(k)) { var r = strip(it.raw, it.info); onText(k, { msg: it.info.msg ? JSON.parse(r || "{}") : null }); if (r) it.deliver(r); return; }
    noteAudio(k, it.info.audio); onText(k, it.info); it.deliver(it.raw);
  }
  function gateText(k, info) { if (S[k].mode === "greet" && info.msg) { var t = txt(info.msg); if (t.modelish || info.audio) S[k].greetSeen = true; if (t.done && S[k].greetSeen) setTimeout(function () { sendNote(k); }, 300); } }
  function noteAudio(k, bytes) { if (!bytes) return; var s = S[k], now = Date.now(); s.end = Math.max(s.end, now) + bytes / BYTES_PER_SEC * 1000; }
  function canGo(k) {
    if (!bothLive() || silentNow(k)) return true;
    if (Date.now() < S[k].holdUntil) return false; // 等點名判斷
    return !busy(other(k)) || arguing();
  }
  // 交給引擎前的閘門
  function gate(k, raw, deliver) {
    var info = parse(raw);
    var t = info.msg ? txt(info.msg) : { inn: "", modelish: info.bin };
    if (t.inn && String(t.inn).indexOf("留言板") < 0) { userActive(); }
    if (info.bin && S[k].mode === "greet") S[k].greetSeen = true;
    gateText(k, info);
    if (!bothLive()) { if (silentNow(k)) { var r0 = strip(raw, info); onText(k, { msg: info.msg ? JSON.parse(r0 || "{}") : null }); if (r0) deliver(r0); return; } onText(k, info); return deliver(raw); }
    if (t.inn) onUserText(k, t.inn);
    // 新一輪回答剛開始、使用者剛說完話 → 稍等一下讓點名判斷完成
    if ((info.audio || t.modelish) && !S[k].inTurn) { S[k].inTurn = true; if (addrOn && Date.now() - user.at < 4000 && !user.addr) S[k].holdUntil = Date.now() + HOLD; }
    var it = { raw: raw, info: info, deliver: deliver };
    if (S[k].q.length || !canGo(k)) { S[k].q.push(it); return; }
    deliverItem(k, it);
  }
  function flush() {
    ["dark", "dawn"].forEach(function (k) {
      var s = S[k];
      while (s.q.length && canGo(k)) { var it = s.q.shift(); try { deliverItem(k, it); } catch (e) { console.warn("[Etiquette]", e); } }
    });
  }
  // 防回音：對方正在說話時，不把這邊的麥克風音訊送上去（吵架時照送）
  function isMic(data) { return typeof data === "string" && data.indexOf('"type":"audio"') >= 0; }
  function wrapSend(k, sock) {
    if (!sock || sock.__dsEtqSend) return; var orig = sock.send; if (typeof orig !== "function") return;
    sock.__dsEtqSend = 1;
    sock.send = function (data) { if (typeof data === "string" && data.indexOf('"type":"text"') >= 0 && data.indexOf("【") < 0) userActive(); if (isMic(data) && bothLive() && !arguing() && busy(other(k), -TAIL)) return; return orig.apply(sock, arguments); };
  }
  // ---- 掛勾（不改引擎） ----
  var hookedSock = null, hookedDawn = false, lastDawnWs = null;
  function hookDark() {
    var sk = w.__dsLiveSock; if (!sk) return;
    wrapSend("dark", sk);
    if (sk === hookedSock) return;
    var fn = sk.onmessage; if (typeof fn !== "function" || fn.__dsGate) return;
    var g = function (ev) { gate("dark", ev && ev.data, function (raw) { fn({ data: raw }); }); }; g.__dsGate = 1;
    sk.onmessage = g; hookedSock = sk; S.dark.q = []; S.dark.end = 0; S.dark.out = ""; S.dark.inTurn = false; startFresh("dark");
  }
  function hookDawn() {
    var A = w.DawnLightLiveVoice, s = A && A.session; if (!s) return;
    if (s.ws && s.ws !== lastDawnWs) { lastDawnWs = s.ws; startFresh("dawn"); }
    if (s.ws) wrapSend("dawn", s.ws);
    if (hookedDawn) return;
    var orig = s.onMessage.bind(s); hookedDawn = true;
    s.onMessage = function (raw) { gate("dawn", raw, orig); };
  }
  setInterval(function () { hookDark(); hookDawn(); bfTick(); flush(); }, 100);
  w.AIVAULTEtiquette = { silent: function (k) { try { return silentNow(k); } catch (e) { return false; } }, state: function () { return { darkBusy: busy("dark"), dawnBusy: busy("dawn"), qDark: S.dark.q.length, qDawn: S.dawn.q.length, arguing: arguing(), botChain: botChain, both: bothLive(), addressed: user.addr, heard: user.text, modeDark: S.dark.mode || "normal", modeDawn: S.dawn.mode || "normal" }; },
    _test: { onUserText: onUserText, gate: gate, flush: flush, S: S, user: user } };
})(window, document);

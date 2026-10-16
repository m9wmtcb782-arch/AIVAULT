/* 暗星 × 曙光 專用頻道（darkstar-dawn-duo.html）獨立模組；由 darkstar-duo-talk.js 複製而來，不依賴數字人面板。
   原說明：🌙☀️ 暗星 × 曙光 語音對話（預設關閉，需按按鈕才開始）。
   作法：完全不碰即時語音（Live）引擎與麥克風。兩邊都用 AI Gateway 產生文字，
   aivault-tts 依各自聲音朗讀，同一個 <audio> 逐句輪流播放 → 永遠只有一個聲音。
   有任何即時語音／視訊連線時不啟動（連線開始時自動停止）。最多 6 句，可隨時停止。
   停用開關：localStorage.dsDuoTalkOff = "1"。回滾：git revert 本檔 commit。 */
(function (w, d) {
  "use strict";
  if (w.__dsDuoApp) return; w.__dsDuoApp = 1;
  
  var BASE = "https://clcddygkaaqqtsbswgdf.supabase.co", AUTH_KEY = "sb-clcddygkaaqqtsbswgdf-auth-token";
  var ANON = "sb_publishable_1D05YGthBrNGg-5L92TLCw_GiLnInBu";
  var TURNS = 6, mode = "", btn3 = null, askRow = null, askIn = null, rec = null, listenDone = null, running = false, runId = 0, player = null, btn = null, sub = null, talkRaf = 0;
  var TOPICS = ["今天要不要早起", "讀書最有效的方法", "誰比較會講笑話", "夜晚和白天哪個比較好", "考試前一晚該做什麼"];
  var PERSONA = {
    dark: "你是「暗星」，AIVAULT 的黑色小球機器人：冷靜、聰明、有點毒舌但心地好，常吐槽曙光。",
    dawn: "你是「曙光」，AIVAULT 的金色太陽機器人：元氣、樂觀、有點迷糊，常被暗星念但會撒嬌回嘴。"
  };
  var PUB = ANON, tokCache = "";
  function sess() { try { var j = JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); return j && typeof j === "object" ? j : null; } catch (e) { return null; } }
  function tok() { var j = sess(); if (!j) return ""; var cs = j.currentSession || {}; return String(j.access_token || cs.access_token || "").trim(); }
  async function refreshTok() { // 過期前用 refresh_token 續期並寫回（同書架／拍照問問題）
    var j = sess(); if (!j) return; var cs = j.currentSession || {}, rt = String(j.refresh_token || cs.refresh_token || "").trim(), exp = Number(j.expires_at || cs.expires_at || 0);
    if (!rt || (exp > 0 && exp * 1000 - Date.now() > 60000)) return;
    try { var r = await fetch(BASE + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { "Content-Type": "application/json", apikey: PUB }, body: JSON.stringify({ refresh_token: rt }) });
      if (!r.ok) return; var f = await r.json(); if (f && f.access_token) localStorage.setItem(AUTH_KEY, JSON.stringify(Object.assign({}, j, f, { refresh_token: f.refresh_token || rt }))); } catch (e) {}
  }
  async function ai(who, topic, lines) {
    await refreshTok();
    var hist = lines.map(function (l) { return (l.who === "dark" ? "暗星：" : "曙光：") + l.text; }).join("\n");
    var system = PERSONA[who] + " 你正在和" + (who === "dark" ? "曙光" : "暗星") + "用語音聊天，主題：「" + topic + "」。只用繁體中文口語回一句（25 字內），不要旁白、不要加名字前綴。可在句尾加一個表情標籤，例如 [表情:開心]。";
    var user = hist ? "目前對話：\n" + hist + "\n請接著回一句。" : "請你先開場說第一句。";
    var t = tok() || ANON;
    var r = await fetch(BASE + "/functions/v1/ai-gateway", { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + t },
      body: JSON.stringify({ provider: "gemini", model: "gemini-3.6-flash", system: system, userMessage: user, source: "darkstar-duo-talk" }) });
    var j = await r.json().catch(function () { return {}; });
    var out = j.content || j.reply || j.text || j.message || j.output;
    if (!r.ok || typeof out !== "string") throw new Error(j.error || ("HTTP " + r.status));
    return out.replace(/^(暗星|曙光)\s*[:：]\s*/, "").trim();
  }
  var prov = {}, lastProv = "", actx = null;
  // iOS：用手勢內解鎖的 AudioContext 解碼播放（不受 <audio> 自動播放限制）
  function unlockCtx() { try { var B = w.AudioContext || w.webkitAudioContext; if (!B) return; if (!actx || actx.state === "closed") actx = new B(); if (actx.state !== "running") actx.resume().catch(function () {}); var sb = actx.createBuffer(1, 1, 22050), so = actx.createBufferSource(); so.buffer = sb; so.connect(actx.destination); so.start(0); } catch (e) {} try { if (navigator.audioSession && !contMic) navigator.audioSession.type = "playback"; } catch (e) {} }
  var curSrc = null;
  var ttsStats = { ok: 0, retryOk: 0, google: 0, textOnly: 0 };
  async function tts1(provider, voice, text) {
    var r = await fetch(BASE + "/functions/v1/aivault-tts", { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
      body: JSON.stringify({ action: "tts", provider: provider, text: text, voice_id: voice, language: "zh-TW", save: false }) });
    var j = await r.json().catch(function () { return {}; }), x = j.result;
    if (!r.ok || !x || !x.audio_base64) { var er = new Error(j.message || j.error || ("TTS HTTP " + r.status)); er.retryAfter = Number(j.retry_after_seconds || 0); throw er; }
    var bytes = Uint8Array.from(atob(x.audio_base64), function (c) { return c.charCodeAt(0); });
    var u = URL.createObjectURL(new Blob([bytes], { type: x.mime || "audio/wav" })); prov[u] = x.provider || provider; lastProv = prov[u]; return u;
  }
  // Gemini TTS 有每分鐘配額（429 GEMINI_TTS_QUOTA_RATE）→ 稍等重試一次 → 改用 Google TTS → 仍失敗就只顯示文字（對話不中斷）
  async function tts(who, text) {
    var voice = who === "dark" ? (localStorage.getItem("darkStarVoice") || "Kore") : (localStorage.getItem("dawnLightVoice") || "Aoede");
    // Gemini TTS 每分鐘配額很低（429 GEMINI_TTS_QUOTA_RATE，retry_after≈60 秒）：
    // 先快速重試一次；仍受限就依伺服器指示等待（最多 60 秒，畫面倒數），再試一次；都不行才用備用聲音
    try { var u0 = await tts1("gemini", voice, text); ttsStats.ok++; return u0; } catch (e) { var ra = e.retryAfter || 0; console.warn("[DuoTalk] gemini tts", e.message); }
    await new Promise(function (r) { setTimeout(r, 2500); });
    try { var u1 = await tts1("gemini", voice, text); ttsStats.retryOk++; return u1; } catch (e) { ra = e.retryAfter || ra; }
    if (ra > 0 && running) {
      var left = Math.min(60, ra), myId = runId;
      while (left > 0 && myId === runId) { if (sub) { sub.hidden = false; sub.textContent = (who === "dark" ? "🌙 暗星" : "☀️ 曙光") + " 等 Gemini 聲音配額… " + left + " 秒"; } await new Promise(function (r) { setTimeout(r, 1000); }); left--; }
      if (myId !== runId) return null;
      try { var u2 = await tts1("gemini", voice, text); ttsStats.retryOk++; return u2; } catch (e) {}
    }
    ttsStats.google++;
    try { return await tts1("google", who === "dark" ? "cmn-TW-Wavenet-C" : "cmn-TW-Wavenet-A", text); } catch (e) { console.warn("[DuoTalk] google tts", e.message); }
    ttsStats.textOnly++; return null;
  }
  async function aiRaw(system, user) {
    await refreshTok();
    var t = tok() || ANON;
    var r = await fetch(BASE + "/functions/v1/ai-gateway", { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + t },
      body: JSON.stringify({ provider: "gemini", model: "gemini-3.6-flash", system: system, userMessage: user, source: "darkstar-duo-talk" }) });
    var j = await r.json().catch(function () { return {}; });
    var out = j.content || j.reply || j.text || j.message || j.output;
    if (!r.ok || typeof out !== "string") throw new Error(j.error || ("HTTP " + r.status));
    return out.replace(/^(暗星|曙光)\s*[:：]\s*/, "").trim();
  }
  function liveBusy() { return false; } // 獨立頁面：沒有即時語音同時運作
  var orbs = { dark: null, dawn: null };
  function face(who, x) { var o = orbs[who === "dawn" ? "dawn" : "dark"]; if (x && o) o.setExpression(x, 4000); }
  function mouth(who, on) {
    cancelAnimationFrame(talkRaf);
    if (orbs.dark) orbs.dark.setTalking(0); if (orbs.dawn) orbs.dawn.setTalking(0);
    d.querySelectorAll(".duo-face").forEach(function (f) { f.classList.remove("talking"); });
    if (!on) return; var o = orbs[who === "dawn" ? "dawn" : "dark"]; var fe = d.getElementById(who === "dawn" ? "faceDawn" : "faceDark"); if (fe) fe.classList.add("talking");
    (function f() { if (o) o.setTalking(0.25 + 0.55 * Math.abs(Math.sin(Date.now() / 85))); talkRaf = requestAnimationFrame(f); })();
  }
  var logEl = null, lastLog = "";
  function logLine(who, text) { if (!logEl || !text || text === "…" || /等 Gemini 聲音配額|聊天中斷|對話中斷/.test(text)) return; var key = who + text.replace("（備用聲音）", ""); if (key === lastLog) return; lastLog = key; var r = d.createElement("div"); r.className = "ln " + who; r.textContent = (who === "dark" ? "🌙 暗星：" : who === "dawn" ? "☀️ 曙光：" : "🙂 你：") + text; logEl.appendChild(r); logEl.scrollTop = logEl.scrollHeight; }
  function say(who, text) { if (who) logLine(who, text); if (sub) { sub.hidden = !text; sub.textContent = text ? (who === "dark" ? "🌙 暗星：" : "☀️ 曙光：") + text : ""; } }
  function paint() { if (btn) { btn.textContent = running && mode === "duo" ? "⏹ 停止" : "🌙☀️ 互聊"; btn.disabled = running && mode !== "duo"; } if (btn3) btn3.textContent = running && mode === "trio" ? "⏹ 停止聊天" : "🌙☀️ 一起聊"; if (btn3) btn3.disabled = running && mode !== "trio"; if (askRow) askRow.hidden = !(running && mode === "trio"); }
  function playUrl(url, id) {
    return new Promise(function (res) {
      if (id !== runId) return res();
      if (!url) return setTimeout(res, Math.min(6000, 1200 + String(sub && sub.textContent || "").length * 180)); // 沒有語音：顯示文字一段時間
      if (prov[url] && prov[url] !== "gemini" && sub && !/備用聲音/.test(sub.textContent)) sub.textContent += "（備用聲音）";
      var viaEl = function () { player.onended = player.onerror = function () { res(); }; player.src = url; player.play().catch(function () { res(); }); };
      if (!actx) return viaEl();
      if (actx.state !== "running") actx.resume().catch(function () {});
      fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
        return new Promise(function (ok, bad) { actx.decodeAudioData(ab, ok, bad); });
      }).then(function (buf) {
        if (id !== runId) return res();
        var src = actx.createBufferSource(); src.buffer = buf; src.connect(actx.destination); curSrc = src;
        src.onended = function () { if (curSrc === src) curSrc = null; res(); };
        src.start(0);
      }).catch(function (e) { console.warn("[DuoTalk] ctx play", e); viaEl(); });
    });
  }
  function stop() {
    runId++; running = false; if (contMic) setCont(false); stopListen(); if (listenDone) { var f = listenDone; listenDone = null; f(""); }
    try { if (curSrc) { curSrc.onended = null; curSrc.stop(); curSrc = null; } } catch (e) {}
    try { if (player) { player.pause(); player.removeAttribute("src"); player.load(); } } catch (e) {}
    mouth(null, false); say(null, ""); paint();
  }
  async function start() {
    if (running) return stop();
    if (liveBusy()) { alert("請先結束「暗星即時／曙光即時／即時視訊」再開始兩人對話（避免聲音互相干擾）。"); return; }
    // 在點擊手勢內解鎖 <audio>（iOS）
    player = player || new Audio(); player.playsInline = true;
    player.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    player.play().catch(function () {}); unlockCtx();
    var topic = (w.prompt("想讓暗星和曙光聊什麼？（留空＝隨機主題）", "") || "").trim() || TOPICS[Math.floor(Math.random() * TOPICS.length)];
    var id = ++runId; running = true; mode = "duo"; paint();
    var lines = [], O = w.DarkStarOrb;
    try {
      for (var i = 0; i < TURNS && id === runId; i++) {
        var who = i % 2 ? "dawn" : "dark";
        say(who, "…"); face(who, "thinking");
        var raw = await ai(who, topic, lines); if (id !== runId) break;
        var x = O && O.exprFromTag ? O.exprFromTag(raw) : null, text = O && O.stripTags ? O.stripTags(raw) : raw.replace(/\[表情[:：][^\]]*\]/g, "");
        text = text.trim(); if (!text) continue;
        if (!x && O && O.moodOf) x = O.moodOf(text);
        lines.push({ who: who, text: text });
        var url = await tts(who, text); if (id !== runId) { URL.revokeObjectURL(url); break; }
        say(who, text); face(who, x); mouth(who, true);
        await playUrl(url, id); URL.revokeObjectURL(url); mouth(null, false);
        try { d.dispatchEvent(new KeyboardEvent("keydown")); } catch (e) {} // 對話期間不觸發自動小劇場
      }
    } catch (e) { console.warn("[DuoTalk]", e); say("dark", "對話中斷：" + String(e.message || e).slice(0, 40)); setTimeout(function () { if (!running) say(null, ""); }, 4000); }
    if (id === runId) { running = false; mouth(null, false); paint(); setTimeout(function () { if (!running) say(null, ""); }, 3500); }
  }
  // ---------- 三人聊天：使用者 ↔ 暗星 ↔ 曙光 ----------
  function stopListen() { try { if (rec) { rec.onresult = rec.onend = rec.onerror = null; rec.abort(); } } catch (e) {} rec = null; micPaint(""); }
  function listen(id) { // 回傳使用者一句話（語音或打字）
    return new Promise(function (res) {
      var done = false; function fin(t) { if (done) return; done = true; listenDone = null; if (!contMic) stopListen(); micPaint(contMic ? "idle" : ""); res(String(t || "").trim()); }
      listenDone = fin; skipTo = lastLen; // 機器人說話期間（含回音）收到的辨識結果全部丟掉
      say(null, ""); if (sub) { sub.hidden = false; sub.textContent = contMic ? "🎤 聆聽中…請說話（也可以打字）" : "⌨️ 換你了：在下方輸入後按送出（按 🎤 可改用語音）"; }
      if (contMic) { micPaint("listening"); if (!rec) startRec(); }
      else setTimeout(function () { try { if (askIn && w.innerWidth > 700) askIn.focus(); } catch (e) {} }, 50);
    });
  }
  // 連續聆聽模式（iOS 友善）：按一次 🎤 → 啟動「一個」持續運作的語音辨識，整個聊天期間不停止／不重開；
  // 機器人說話時只是忽略辨識結果，輪到使用者時才採用 → 不需要在非手勢情況下重新 start()。
  var contMic = false, restartFails = 0, lastLen = 0, skipTo = 0;
  function micPaint(state) {
    var b = d.getElementById("dsTrioMic"); if (!b) return;
    var on = contMic && state === "listening" && !!listenDone;
    b.style.background = contMic ? (on ? "#ff4d6d" : "#ffe1e7") : ""; b.style.color = on ? "#fff" : "";
    b.title = contMic ? "連續聆聽中（再按一次關閉）" : "開啟連續語音";
  }
  function setCont(on) {
    contMic = on; restartFails = 0; unlockCtx();
    if (on) { startRec(); if (listenDone && sub) sub.textContent = "🎤 聆聽中…請說話（也可以打字）"; }
    else { stopListen(); if (listenDone && sub) sub.textContent = "⌨️ 換你了：在下方輸入後按送出（按 🎤 可改用語音）"; }
    micPaint(listenDone ? "listening" : "");
  }
  function startRec() {
    stopListen();
    var SR = w.SpeechRecognition || w.webkitSpeechRecognition; if (!SR) { if (sub) sub.textContent = "⚠️ 這個瀏覽器不支援語音辨識，請打字"; contMic = false; micPaint(""); return; }
    try {
      var r = new SR(); rec = r; r.lang = "zh-TW"; r.continuous = true; r.interimResults = true; lastLen = 0; skipTo = 0;
      r.onresult = function (e) {
        lastLen = e.results.length; restartFails = 0;
        if (!listenDone) { skipTo = lastLen; return; } // 機器人說話中：忽略
        var t = "", fz = false;
        for (var i = Math.max(skipTo, e.resultIndex || 0); i < e.results.length; i++) { t += e.results[i][0].transcript; if (e.results[i].isFinal) fz = true; }
        if (t.trim() && sub) sub.textContent = "🎤 " + t;
        if (fz && t.trim()) { skipTo = lastLen; listenDone(t); }
      };
      r.onend = function () {
        if (rec !== r) return; rec = null; lastLen = 0; skipTo = 0;
        if (!contMic) { micPaint(""); return; }
        // iOS 偶爾自己結束 → 立即重開（失敗多次才請使用者再點一下）
        if (++restartFails > 6) { contMic = false; micPaint(""); if (sub && listenDone) sub.textContent = "🎤 聆聽暫停了，點一下 🎤 繼續（或打字）"; return; }
        setTimeout(function () { if (contMic && !rec) startRec(); }, 200);
      };
      r.onerror = function (ev) { if (ev && /not-allowed|service-not-allowed/.test(ev.error)) restartFails = 99; };
      r.start(); micPaint("listening");
    } catch (e) { rec = null; micPaint(""); }
  }
  var TRIO = {
    dark: PERSONA.dark + " 你和曙光正在跟使用者一起語音聊天。先直接回應使用者，只用繁體中文口語回 1～2 句（40 字內），不要旁白、不要名字前綴。句尾可加一個表情標籤，例如 [表情:思考]。",
    dawn: PERSONA.dawn + " 你和暗星正在跟使用者一起語音聊天。暗星剛回應完，你接著補充、附和或調侃暗星（也可以對使用者說），繁體中文口語 1 句（40 字內），不要名字前綴。句尾可加一個表情標籤，例如 [表情:開心]。",
    scold: PERSONA.dark + " 曙光剛剛說的話有點脫線，你用一句話（25 字內）念她一下，帶點毒舌但可愛，繁體中文口語，句尾加 [表情:氣呼呼] 或 [表情:生氣]。"
  };
  function hist(lines) { return lines.slice(-14).map(function (l) { return (l.who === "user" ? "使用者：" : l.who === "dark" ? "暗星：" : "曙光：") + l.text; }).join("\n"); }
  async function botLine(id, who, sys, lines) {
    say(who, "…"); face(who, "thinking");
    var raw = await aiRaw(sys, "對話紀錄：\n" + hist(lines) + "\n請回你的下一句。"); if (id !== runId) return false;
    var O = w.DarkStarOrb, x = O && O.exprFromTag ? O.exprFromTag(raw) : null;
    var text = (O && O.stripTags ? O.stripTags(raw) : raw.replace(/\[表情[:：][^\]]*\]/g, "")).trim(); if (!text) return true;
    if (!x && O && O.moodOf) x = O.moodOf(text);
    lines.push({ who: who === "scold" ? "dark" : who, text: text });
    var sp = who === "scold" ? "dark" : who;
    var url = await tts(sp, text); if (id !== runId) { URL.revokeObjectURL(url); return false; }
    say(sp, text); face(sp, x); mouth(sp, true);
    await playUrl(url, id); URL.revokeObjectURL(url); mouth(null, false);
    try { d.dispatchEvent(new KeyboardEvent("keydown")); } catch (e) {}
    if (who === "scold" && orbs.dawn) orbs.dawn.setExpression(Math.random() < .5 ? "tired" : "sad", 3500);
    return id === runId;
  }
  async function startTrio() {
    if (running) return stop();
    if (liveBusy()) { alert("請先結束「暗星即時／曙光即時／即時視訊」再開始一起聊（避免聲音互相干擾）。"); return; }
    player = player || new Audio(); player.playsInline = true;
    player.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    player.play().catch(function () {}); unlockCtx();
    var id = ++runId; running = true; mode = "trio"; paint();
    var lines = [], miss = 0;
    await new Promise(function (r) { setTimeout(r, 300); }); // 等解鎖用的無聲片段播完再開麥克風
    try {
      while (id === runId) {
        var u = await listen(id); if (id !== runId) break;   // 麥克風只在這裡開；機器人說話時已關閉
        if (!u) continue;
        lines.push({ who: "user", text: u }); logLine("user", u);
        if (/^(結束|停止|掰掰|拜拜|再見)/.test(u)) { await botLine(id, "dark", TRIO.dark + " 使用者要結束了，簡短道別。", lines); break; }
        if (!(await botLine(id, "dark", TRIO.dark, lines))) break;
        if (!(await botLine(id, "dawn", TRIO.dawn, lines))) break;
        if (Math.random() < 0.3 && !(await botLine(id, "scold", TRIO.scold, lines))) break;
      }
    } catch (e) { console.warn("[TrioTalk]", e); say("dark", "聊天中斷：" + String(e.message || e).slice(0, 40)); }
    if (id === runId) { running = false; stopListen(); mouth(null, false); paint(); setTimeout(function () { if (!running) say(null, ""); }, 3500); }
  }
  function init() {
    if (btn) return; var O = w.DarkStarOrb; if (!O) return;
    orbs.dark = O.mount(d.getElementById("orbDark"), { size: 120 });
    orbs.dawn = O.mount(d.getElementById("orbDawn"), { size: 120, theme: "dawn" });
    btn3 = d.getElementById("dsTrioTalk"); btn = d.getElementById("dsDuoTalk"); askRow = d.getElementById("dsTrioAsk"); askIn = d.getElementById("dsTrioIn"); sub = d.getElementById("dsDuoSub"); logEl = d.getElementById("duoLog");
    btn3.addEventListener("click", function () { startTrio(); });
    btn.addEventListener("click", function () { start(); });
    function sendTyped() { var v = askIn.value.trim(); if (!v || !listenDone) return; askIn.value = ""; listenDone(v); }
    d.getElementById("dsTrioSend").addEventListener("click", sendTyped);
    askIn.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); sendTyped(); } });
    d.getElementById("dsTrioMic").addEventListener("click", function () { setCont(!contMic); });
    if (!tok()) { var n = d.getElementById("loginNote"); if (n) n.hidden = false; }
    paint();
    if (/[?&]start=1/.test(location.search) && sub) { sub.hidden = false; sub.textContent = "按「🌙☀️ 一起聊」開始（iPhone 需要點一下才能出聲）"; }
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init); else init();
  w.AIVAULTDuoApp = { start: start, startTrio: startTrio, stop: stop, mode: function () { return mode; }, ttsStats: function () { return ttsStats; }, lastProvider: function () { return lastProv; }, running: function () { return running; } };
})(window, document);

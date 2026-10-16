/* 實驗功能：🌙☀️ 暗星 × 曙光 語音對話（預設關閉，需按按鈕才開始）。
   作法：完全不碰即時語音（Live）引擎與麥克風。兩邊都用 AI Gateway 產生文字，
   aivault-tts 依各自聲音朗讀，同一個 <audio> 逐句輪流播放 → 永遠只有一個聲音。
   有任何即時語音／視訊連線時不啟動（連線開始時自動停止）。最多 6 句，可隨時停止。
   停用開關：localStorage.dsDuoTalkOff = "1"。回滾：git revert 本檔 commit。 */
(function (w, d) {
  "use strict";
  if (w.__dsDuoTalk) return; w.__dsDuoTalk = 1;
  try { if (localStorage.getItem("dsDuoTalkOff") === "1") return; } catch (e) {}
  var BASE = "https://clcddygkaaqqtsbswgdf.supabase.co", AUTH_KEY = "sb-clcddygkaaqqtsbswgdf-auth-token";
  var ANON = "sb_publishable_1D05YGthBrNGg-5L92TLCw_GiLnInBu";
  var TURNS = 6, mode = "", btn3 = null, askRow = null, askIn = null, rec = null, listenDone = null, running = false, runId = 0, player = null, btn = null, sub = null, talkRaf = 0;
  var TOPICS = ["今天要不要早起", "讀書最有效的方法", "誰比較會講笑話", "夜晚和白天哪個比較好", "考試前一晚該做什麼"];
  var PERSONA = {
    dark: "你是「暗星」，AIVAULT 的黑色小球機器人：冷靜、聰明、有點毒舌但心地好，常吐槽曙光。",
    dawn: "你是「曙光」，AIVAULT 的金色太陽機器人：元氣、樂觀、有點迷糊，常被暗星念但會撒嬌回嘴。"
  };
  function tok() { try { var j = JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); return (j && (j.access_token || (j.currentSession && j.currentSession.access_token))) || ""; } catch (e) { return ""; } }
  async function ai(who, topic, lines) {
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
  async function tts(who, text) {
    var voice = who === "dark" ? (localStorage.getItem("darkStarVoice") || "Kore") : (localStorage.getItem("dawnLightVoice") || "Aoede");
    var r = await fetch(BASE + "/functions/v1/aivault-tts", { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
      body: JSON.stringify({ action: "tts", provider: "gemini", text: text, voice_id: voice, language: "zh-TW", save: false }) });
    var j = await r.json().catch(function () { return {}; }), x = j.result;
    if (!r.ok || !x || !x.audio_base64) throw new Error(j.message || j.error || ("TTS HTTP " + r.status));
    var bytes = Uint8Array.from(atob(x.audio_base64), function (c) { return c.charCodeAt(0); });
    return URL.createObjectURL(new Blob([bytes], { type: x.mime || "audio/wav" }));
  }
  async function aiRaw(system, user) {
    var t = tok() || ANON;
    var r = await fetch(BASE + "/functions/v1/ai-gateway", { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + t },
      body: JSON.stringify({ provider: "gemini", model: "gemini-3.6-flash", system: system, userMessage: user, source: "darkstar-duo-talk" }) });
    var j = await r.json().catch(function () { return {}; });
    var out = j.content || j.reply || j.text || j.message || j.output;
    if (!r.ok || typeof out !== "string") throw new Error(j.error || ("HTTP " + r.status));
    return out.replace(/^(暗星|曙光)\s*[:：]\s*/, "").trim();
  }
  function liveBusy() {
    try { if (w.AIVAULTDarkStarLive && w.AIVAULTDarkStarLive.isConnected()) return true; } catch (e) {}
    try { if (w.DawnLightLiveVoice && w.DawnLightLiveVoice.isOpen()) return true; } catch (e) {}
    try { var D = w.AivaultDualAgentLive && w.AivaultDualAgentLive.armed(); if (D && (D.dark || D.dawn)) return true; } catch (e) {}
    return false;
  }
  function dawnOrb() { var D = w.AIVAULTDawnAvatar; return D && D.orb && D.orb(); }
  function darkAv() { return w.AIVAULTDarkStarAvatar; }
  function face(who, x) {
    if (!x) return;
    if (who === "dawn") { var D = w.AIVAULTDawnAvatar; if (D && D.expr) D.expr(x, 4000); }
    else { var A = darkAv(); if (A && A.expr) A.expr(x, 4000); }
  }
  function mouth(who, on) {
    cancelAnimationFrame(talkRaf);
    var A = darkAv(), o = dawnOrb();
    if (A && A.speak) A.speak(0); if (o) o.setTalking(0);
    if (!on) return;
    (function f() {
      var v = 0.25 + 0.55 * Math.abs(Math.sin(Date.now() / 85));
      if (who === "dark") { if (A && A.speak) A.speak(v); } else if (o) o.setTalking(v);
      talkRaf = requestAnimationFrame(f);
    })();
  }
  function say(who, text) { if (sub) { sub.hidden = !text; sub.textContent = text ? (who === "dark" ? "🌙 暗星：" : "☀️ 曙光：") + text : ""; } }
  function paint() { if (btn) { btn.textContent = running && mode === "duo" ? "⏹ 停止" : "🌙☀️ 互聊"; btn.disabled = running && mode !== "duo"; } if (btn3) btn3.textContent = running && mode === "trio" ? "⏹ 停止聊天" : "🌙☀️ 一起聊"; if (btn3) btn3.disabled = running && mode !== "trio"; if (askRow) askRow.hidden = !(running && mode === "trio"); d.documentElement.classList.toggle("ds-trio-on", running && mode === "trio"); }
  function playUrl(url, id) {
    return new Promise(function (res) {
      if (id !== runId) return res();
      player.onended = player.onerror = function () { res(); };
      player.src = url; player.play().catch(function () { res(); });
    });
  }
  function stop() {
    runId++; running = false; stopListen(); if (listenDone) { var f = listenDone; listenDone = null; f(""); }
    try { if (player) { player.pause(); player.removeAttribute("src"); player.load(); } } catch (e) {}
    mouth(null, false); say(null, ""); paint();
  }
  async function start() {
    if (running) return stop();
    if (liveBusy()) { alert("請先結束「暗星即時／曙光即時／即時視訊」再開始兩人對話（避免聲音互相干擾）。"); return; }
    // 在點擊手勢內解鎖 <audio>（iOS）
    player = player || new Audio(); player.playsInline = true;
    player.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    player.play().catch(function () {});
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
  function stopListen() { try { if (rec) { rec.onresult = rec.onend = rec.onerror = null; rec.abort(); } } catch (e) {} rec = null; }
  function listen(id) { // 回傳使用者一句話（語音或打字）；空字串＝沒聽到
    return new Promise(function (res) {
      var done = false; function fin(t) { if (done) return; done = true; clearTimeout(to); stopListen(); listenDone = null; res(String(t || "").trim()); }
      listenDone = fin; var to = setTimeout(function () { fin(""); }, 20000);
      say(null, ""); if (sub) { sub.hidden = false; sub.textContent = "🎤 換你說話（或在下方打字）…"; }
      startRec(fin);
    });
  }
  function startRec(fin) {
    stopListen();
    var SR = w.SpeechRecognition || w.webkitSpeechRecognition; if (!SR) return;
    try {
      var r = new SR(); rec = r; r.lang = "zh-TW"; r.continuous = false; r.interimResults = true; var last = "";
      r.onresult = function (e) { var t = "", fz = false; for (var i = 0; i < e.results.length; i++) { t += e.results[i][0].transcript; if (e.results[i].isFinal) fz = true; } last = t; if (sub) sub.textContent = "🎤 " + t; if (fz) fin(t); };
      r.onend = function () { if (rec === r) { rec = null; if (last) fin(last); } };
      r.onerror = function () { if (rec === r) rec = null; };
      r.start();
    } catch (e) { rec = null; }
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
    if (who === "scold") { var D = w.AIVAULTDawnAvatar; if (D && D.expr) D.expr(Math.random() < .5 ? "tired" : "sad", 3500); }
    return id === runId;
  }
  async function startTrio() {
    if (running) return stop();
    if (liveBusy()) { alert("請先結束「暗星即時／曙光即時／即時視訊」再開始一起聊（避免聲音互相干擾）。"); return; }
    player = player || new Audio(); player.playsInline = true;
    player.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    player.play().catch(function () {});
    var id = ++runId; running = true; mode = "trio"; paint();
    var lines = [], miss = 0;
    await new Promise(function (r) { setTimeout(r, 300); }); // 等解鎖用的無聲片段播完再開麥克風
    try {
      while (id === runId) {
        var u = await listen(id); if (id !== runId) break;   // 麥克風只在這裡開；機器人說話時已關閉
        if (!u) { if (++miss >= 2) break; continue; } miss = 0;
        lines.push({ who: "user", text: u });
        if (/^(結束|停止|掰掰|拜拜|再見)/.test(u)) { await botLine(id, "dark", TRIO.dark + " 使用者要結束了，簡短道別。", lines); break; }
        if (!(await botLine(id, "dark", TRIO.dark, lines))) break;
        if (!(await botLine(id, "dawn", TRIO.dawn, lines))) break;
        if (Math.random() < 0.3 && !(await botLine(id, "scold", TRIO.scold, lines))) break;
      }
    } catch (e) { console.warn("[TrioTalk]", e); say("dark", "聊天中斷：" + String(e.message || e).slice(0, 40)); }
    if (id === runId) { running = false; stopListen(); mouth(null, false); paint(); setTimeout(function () { if (!running) say(null, ""); }, 3500); }
  }
  function init() {
    var foot = d.querySelector("#aivault-darkstar-avatar .dsfoot"); if (!foot || btn) return;
    var row = d.createElement("div"); row.className = "dsfoot"; row.id = "dsDuoRow"; row.style.paddingTop = "0"; foot.parentNode.insertBefore(row, foot.nextSibling);
    btn3 = d.createElement("button"); btn3.id = "dsTrioTalk"; btn3.type = "button"; btn3.className = "dsbtn primary"; row.appendChild(btn3);
    btn3.addEventListener("click", function (e) { e.stopPropagation(); startTrio(); });
    btn = d.createElement("button"); btn.id = "dsDuoTalk"; btn.type = "button"; btn.className = "dsbtn"; row.appendChild(btn);
    btn.addEventListener("click", function (e) { e.stopPropagation(); start(); });
    askRow = d.createElement("div"); askRow.id = "dsTrioAsk"; askRow.hidden = true; askRow.style.cssText = "display:flex;gap:6px;margin:0 8px 8px";
    askRow.innerHTML = '<button type="button" id="dsTrioMic" class="dsbtn" style="flex:none;min-width:40px">🎤</button><input id="dsTrioIn" type="text" placeholder="打字也可以…" style="flex:1;min-width:0;border:1px solid #ddd;border-radius:10px;padding:6px 8px;font-size:14px"><button type="button" id="dsTrioSend" class="dsbtn" style="flex:none">送出</button>';
    row.parentNode.insertBefore(askRow, row.nextSibling);
    askIn = askRow.querySelector("#dsTrioIn");
    function sendTyped() { var v = askIn.value.trim(); if (!v || !listenDone) return; askIn.value = ""; listenDone(v); }
    askRow.querySelector("#dsTrioSend").addEventListener("click", function (e) { e.stopPropagation(); sendTyped(); });
    askIn.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); sendTyped(); } });
    askRow.addEventListener("click", function (e) { e.stopPropagation(); });
    askRow.querySelector("#dsTrioMic").addEventListener("click", function () { if (listenDone) startRec(listenDone); }); // iOS：手勢內重新開始聽寫
    var st = d.createElement("style"); st.textContent = "@media(max-width:700px){html.ds-trio-on #aivault-darkstar-avatar{bottom:150px!important}}"; d.head.appendChild(st);
    sub = d.createElement("div"); sub.id = "dsDuoSub"; sub.hidden = true;
    sub.style.cssText = "margin:6px 8px 0;padding:6px 8px;border-radius:10px;background:#f4f2ff;font-size:12px;line-height:1.4;color:#222";
    foot.parentNode.insertBefore(sub, foot);
    paint();
    setInterval(function () { if (running && liveBusy()) stop(); }, 500); // 使用者開即時語音 → 立刻停止，還原
  }
  if (d.readyState === "complete") init(); else w.addEventListener("load", init);
  setTimeout(init, 2500);
  w.AIVAULTDuoTalk = { start: start, startTrio: startTrio, stop: stop, mode: function () { return mode; }, running: function () { return running; } };
})(window, document);

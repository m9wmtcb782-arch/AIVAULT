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
  var TURNS = 6, running = false, runId = 0, player = null, btn = null, sub = null, talkRaf = 0;
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
  function paint() { if (btn) btn.textContent = running ? "⏹ 停止對話" : "🌙☀️ 對話"; }
  function playUrl(url, id) {
    return new Promise(function (res) {
      if (id !== runId) return res();
      player.onended = player.onerror = function () { res(); };
      player.src = url; player.play().catch(function () { res(); });
    });
  }
  function stop() {
    runId++; running = false;
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
    var id = ++runId; running = true; paint();
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
  function init() {
    var foot = d.querySelector("#aivault-darkstar-avatar .dsfoot"); if (!foot || btn) return;
    btn = d.createElement("button"); btn.id = "dsDuoTalk"; btn.type = "button"; btn.className = "dsbtn"; foot.appendChild(btn);
    btn.addEventListener("click", function (e) { e.stopPropagation(); start(); });
    sub = d.createElement("div"); sub.id = "dsDuoSub"; sub.hidden = true;
    sub.style.cssText = "margin:6px 8px 0;padding:6px 8px;border-radius:10px;background:#f4f2ff;font-size:12px;line-height:1.4;color:#222";
    foot.parentNode.insertBefore(sub, foot);
    paint();
    setInterval(function () { if (running && liveBusy()) stop(); }, 500); // 使用者開即時語音 → 立刻停止，還原
  }
  if (d.readyState === "complete") init(); else w.addEventListener("load", init);
  setTimeout(init, 2500);
  w.AIVAULTDuoTalk = { start: start, stop: stop, running: function () { return running; } };
})(window, document);

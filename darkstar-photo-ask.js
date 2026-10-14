/* 📸 拍照問問題：拍一張照（或選照片）＋最後一句語音提問 → AI Gateway（dark-star-ebook-ingest?feature=photo-solve）
   不經 Gemini Live 送畫面。答案顯示在聊天，並以 aivault-tts 朗讀（朗讀時暫停 Live 麥克風與播放）。
   用於 technical-dark-star.html（頁內即時語音）與 technical-dark-star-live-video-test.html（抽屜即時視訊）。 */
(function (w, d) {
  "use strict";
  if (w.AIVAULTPhotoAsk) return;
  var BASE = "https://clcddygkaaqqtsbswgdf.supabase.co", ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE";
  var busy = false;
  function inPage() { return !!(w.AIVAULTDarkStarLive && w.AIVAULTDarkStarLive.tools); }
  function tools() { return inPage() ? w.AIVAULTDarkStarLive.tools() : w.__AIVAULT_DS_LIVE_TOOLS__; }
  function token() { try { var j = JSON.parse(localStorage.getItem("sb-clcddygkaaqqtsbswgdf-auth-token") || "null"); var t = j && (j.access_token || (j.currentSession && j.currentSession.access_token)); if (t && (!j.expires_at || j.expires_at * 1000 > Date.now() + 30000)) return t; } catch (e) {} return ANON; }

  // ---- 聊天泡泡 ----
  function bubble(html, who) {
    var row = d.createElement("div");
    if (inPage() && d.getElementById("messagesInner")) {
      var inner = d.getElementById("messagesInner");
      row.className = "message"; row.setAttribute("data-ds-photoask", who || "ai");
      var av = d.createElement("div"); av.className = "message-avatar"; av.textContent = who === "user" ? "📸" : "🌑";
      var body = d.createElement("div"); body.className = "message-body"; body.style.whiteSpace = "pre-wrap";
      body.appendChild(html); row.appendChild(av); row.appendChild(body); inner.appendChild(row);
      try { var m = d.getElementById("messages"); if (m) m.scrollTop = m.scrollHeight; } catch (e) {}
    } else {
      var chat = d.getElementById("chat"); if (!chat) return;
      row.className = "bubble " + (who === "user" ? "user" : "ai");
      var b = d.createElement("b"); b.textContent = who === "user" ? "你（📸）" : "暗星（📸）"; row.appendChild(b); row.appendChild(html);
      chat.appendChild(row); chat.scrollTop = chat.scrollHeight;
    }
    return row;
  }
  function textNode(t) { var e = d.createElement("div"); e.style.whiteSpace = "pre-wrap"; e.textContent = t; return e; }

  // ---- 取得照片 ----
  function shrink(src, max) {
    return new Promise(function (res, rej) {
      var img = new Image(); img.onload = function () { var k = Math.min(1, max / Math.max(img.width, img.height)); var c = d.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", .85)); };
      img.onerror = function () { rej(new Error("無法讀取照片")); }; img.src = src;
    });
  }
  function pickFile() {
    return new Promise(function (res, rej) {
      var i = d.createElement("input"); i.type = "file"; i.accept = "image/*"; i.setAttribute("capture", "environment"); i.style.display = "none";
      i.onchange = function () { var f = i.files && i.files[0]; i.remove(); if (!f) return rej(new Error("沒有選照片")); var u = URL.createObjectURL(f); shrink(u, 1280).then(function (x) { URL.revokeObjectURL(u); res(x); }, rej); };
      d.body.appendChild(i); i.click();
    });
  }
  function photo() { var T = tools(), f = T && T.grabFrame && T.grabFrame(1280); return f ? Promise.resolve(f) : pickFile(); }

  // ---- 書架段落（繁簡皆可比對，來自 darkstar-book-qa.js）----
  function bookQA() {
    if (w.AIVAULTBookQA) return Promise.resolve(w.AIVAULTBookQA);
    return new Promise(function (res) { var s = d.createElement("script"); s.src = "darkstar-book-qa.js?v=20261015-qa7"; s.onload = function () { res(w.AIVAULTBookQA || null); }; s.onerror = function () { res(null); }; d.head.appendChild(s); });
  }
  async function passages(q) {
    try { var Q = await bookQA(); if (!Q || !q) return []; var list = await Promise.race([Q.build(), new Promise(function (r) { setTimeout(function () { r(null); }, 15000); })]); return list ? Q.search(q, list).slice(0, 4) : []; } catch (e) { return []; }
  }

  // ---- 朗讀 ----
  var player = null;
  async function speak(text) {
    var T = tools(); text = String(text || "").replace(/[#*_>`]/g, "").slice(0, 2000); if (!text) return;
    try {
      if (T && T.holdLive) T.holdLive(true);
      var r = await fetch(BASE + "/functions/v1/aivault-tts", { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
        body: JSON.stringify({ action: "tts", provider: "gemini", text: text, voice_id: localStorage.getItem("darkStarVoice") || "Kore", language: "zh-TW", save: false }) });
      var j = await r.json().catch(function () { return {}; }), x = j.result;
      if (!r.ok || !x || !x.audio_base64) throw new Error(j.message || j.error || ("HTTP " + r.status));
      var bytes = Uint8Array.from(atob(x.audio_base64), function (c) { return c.charCodeAt(0); });
      var url = URL.createObjectURL(new Blob([bytes], { type: x.mime || "audio/wav" }));
      player = player || new Audio(); player.src = url; player.playsInline = true;
      await player.play();
      await new Promise(function (res) { player.onended = player.onerror = player.onpause = res; });
      URL.revokeObjectURL(url);
    } catch (e) { console.warn("[PhotoAsk] tts", e); }
    finally { if (T && T.holdLive) T.holdLive(false); }
  }

  // 讓後端只用使用者原句當搜尋關鍵詞（附上的書架段落不參與搜尋）
  function terms(q) { var out = []; (String(q).match(/[A-Za-z][A-Za-z0-9_-]{2,}|[\u3400-\u9fff]{2,}/g) || []).forEach(function (x) { if (x.length <= 10) out.push(x); else for (var i = 0; i < x.length - 1; i += 2) out.push(x.slice(i, i + 2)); }); return out.slice(0, 24); }
  // ---- 主流程 ----
  async function ask() {
    if (busy) return; busy = true;
    try {
      var img = await photo();
      var T = tools(), q = (T && T.lastUserText && T.lastUserText()) || "";
      if (!q) q = (w.prompt("要問這張照片什麼？（留空＝辨識照片中的題目並解答）", "") || "").trim();
      var u = d.createElement("div"); var im = d.createElement("img"); im.src = img; im.alt = "照片"; im.style.cssText = "display:block;max-width:180px;max-height:180px;border-radius:10px;margin:4px 0";
      u.appendChild(im); if (q) u.appendChild(textNode(q)); bubble(u, "user");
      var wait = bubble(textNode("📸 暗星正在看照片並查書架…"), "ai");
      var hits = await passages(q), question = q;
      if (hits.length) question += "\n\n【書架資料】\n" + hits.map(function (h, i) { return (i + 1) + ". 《" + h.title + "》p." + h.page + "：" + h.text; }).join("\n");
      var r = await fetch(BASE + "/functions/v1/dark-star-ebook-ingest?feature=photo-solve", { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + token() },
        body: JSON.stringify(hits.length ? { action: "solve", image: img, question: question, terms: terms(q) } : { action: "solve", image: img, question: question }), signal: AbortSignal.timeout ? AbortSignal.timeout(240000) : undefined });
      var data = await r.json().catch(function () { return {}; });
      if (wait) wait.remove();
      if (!r.ok || !data.ok) throw new Error(data.error || ("HTTP " + r.status));
      var ans = String(data.answer || "");
      if (data.status === "JURISDICTION_REQUIRED") ans = "⚠️ 需要先確認法域（台灣或大陸法）。請在提問時說明，例如「依台灣法…」，再拍一次。\n" + ans;
      else if (data.status === "LAW_REQUIRED") ans = "⚠️ 需要指明是哪一部法律（例如「民法第184條」），請補充後再拍一次。\n" + ans;
      else if (!ans) ans = "暗星沒有得到答案，請再試一次。";
      var box = d.createElement("div"); box.appendChild(textNode(ans));
      var src = (data.sources || []).slice(0, 5);
      if (src.length || hits.length) {
        var det = d.createElement("details"); det.style.cssText = "font-size:12px;opacity:.85;margin-top:6px";
        var s = d.createElement("summary"); s.textContent = "依據 " + (src.length + hits.length) + " 筆"; det.appendChild(s);
        src.forEach(function (x) { det.appendChild(textNode("[" + x.ref + "] " + (x.book_title || x.title || x.url || "") + (x.page_number ? " p." + x.page_number : ""))); });
        hits.forEach(function (h) { det.appendChild(textNode("《" + h.title + "》p." + h.page)); });
        box.appendChild(det);
      }
      bubble(box, "ai");
      if (!/REQUIRED/.test(data.status || "")) await speak(ans);
    } catch (e) {
      var m = String(e && e.message || e);
      if (!/沒有選照片/.test(m)) bubble(textNode("⚠️ 拍照問問題失敗：" + (e && e.name === "TimeoutError" ? "處理逾時，請稍後再試" : m)), "ai");
    } finally { busy = false; }
  }
  w.AIVAULTPhotoAsk = { ask: ask, speak: speak };
})(window, document);

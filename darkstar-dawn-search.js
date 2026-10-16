/* 曙光查資料：開創者問曙光問題時，先找書架電子書片段（借用暗星的 AIVAULTBookQA 索引），找不到或需要即時資訊時再上網搜尋
   （dark-star-ebook-ingest?feature=web-search，Bing RSS／DuckDuckGo，不用付費 AI），以【參考資料】文字訊息送給曙光即時。
   遵守點名：同時開著暗星即時且沒叫曙光時不送（交給暗星的書架問答）。停用：localStorage.dsDawnSearchOff = "1"。 */
(function (w, d) {
  "use strict";
  if (w.AIVAULTDawnSearch) return;
  try { if (localStorage.getItem("dsDawnSearchOff") === "1") { w.AIVAULTDawnSearch = { off: true }; return; } } catch (e) {}
  var BASE = "https://clcddygkaaqqtsbswgdf.supabase.co";
  var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE";
  var WEBWORD = /今天|今日|現在|最新|新聞|天氣|股價|匯率|比分|上網|搜尋|查一下|google|谷歌|百度|網路上|最近|幾點|哪一天|202\d/i;
  var NAME_DAWN = /曙光|暑光|署光|書光|數光|樹光|dawn/i;
  var cache = {};
  function tok() { try { var j = JSON.parse(localStorage.getItem("sb-clcddygkaaqqtsbswgdf-auth-token") || "null"); return j && String(j.access_token || (j.currentSession && j.currentSession.access_token) || ""); } catch (e) { return ""; } }
  async function web(q) {
    q = String(q || "").replace(/曙光|暗星|你覺得呢|請問|幫我|上網|搜尋|查一下|google|百度/gi, " ").replace(/\s+/g, " ").trim();
    if (q.length < 2) return [];
    var r = await fetch(BASE + "/functions/v1/dark-star-ebook-ingest?feature=web-search", { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + (tok() || ANON) }, body: JSON.stringify({ q: q, n: 5 }) });
    var j = await r.json().catch(function () { return {}; });
    return (j && j.results) || [];
  }
  async function books(q) {
    var B = w.AIVAULTBookQA; if (!B || !B.build || !B.search) return [];
    try { var list = await B.build(); return B.search(q, list) || []; } catch (e) { return []; }
  }
  // 回傳要給曙光的【參考資料】文字（沒有就回空字串）
  async function refFor(q) {
    q = String(q || "").trim(); if (q.length < 4) return "";
    if (cache[q]) return cache[q];
    var p = (async function () {
      var hits = await books(q), parts = [];
      if (hits.length) parts.push("書架電子書：\n" + hits.slice(0, 4).map(function (h, i) { return (i + 1) + ". 《" + h.title + "》p." + h.page + "：" + String(h.text).slice(0, 500); }).join("\n"));
      if (!hits.length || WEBWORD.test(q)) {
        try { var rs = await web(q); if (rs.length) parts.push("網路搜尋：\n" + rs.map(function (x, i) { return (i + 1) + ". " + x.title + "（" + x.url + "）" + (x.snippet ? "：" + x.snippet : ""); }).join("\n")); } catch (e) { console.warn("[DawnSearch] web", e); }
      }
      if (!parts.length) return "";
      return "【參考資料】開創者剛才問：「" + q + "」\n" + parts.join("\n") + "\n請根據以上參考資料回答（書要說書名與頁碼；網路資料要說來源網站），資料不足就老實說。若你剛才已開始回答，請以參考資料修正或補充。";
    })();
    cache[q] = p; return p;
  }
  // ---- 曙光即時：收集開創者這一句，說完 0.9 秒後查資料並送出 ----
  var inBuf = "", timer = 0, hooked = false;
  function darkLive() { try { return !!(w.AIVAULTDarkStarLive && w.AIVAULTDarkStarLive.isConnected()); } catch (e) { return false; } }
  function forDawn(q) { return !darkLive() || NAME_DAWN.test(q); }
  async function handle(q) {
    var B = w.AIVAULTBookQA, isQ = B && B.isQuestion ? B.isQuestion(q) : q.length >= 4;
    if (!isQ || !forDawn(q)) return;
    var A = w.DawnLightLiveVoice; if (!A || !A.isOpen || !A.isOpen()) return;
    var msg = await refFor(q); if (!msg) return;
    A.sendRaw(JSON.stringify({ type: "text", text: msg }));
  }
  function onIn(t) { if (!t || String(t).indexOf("留言板") >= 0) return; inBuf += t; clearTimeout(timer); timer = setTimeout(function () { var q = inBuf.trim(); inBuf = ""; handle(q); }, 900); }
  function hook() {
    var A = w.DawnLightLiveVoice, s = A && A.session; if (!s || hooked) return !!hooked;
    hooked = true; var prev = s.onMessage;
    s.onMessage = function (raw) {
      try { if (typeof raw === "string" && raw.indexOf("nputTranscription") >= 0) { var m = JSON.parse(raw), c = m.serverContent || {}; onIn((c.inputTranscription && c.inputTranscription.text) || (m.type === "inputTranscription" ? m.text : "")); } } catch (e) {}
      return prev.apply(this, arguments);
    };
    // 打字送給曙光（dawn-light-speech-to-text 走 sendText）
    var st = A.sendText; A.sendText = function (text, speaker) { var r = st.apply(this, arguments); if (r && speaker === "user") handle(String(text || "")); return r; };
    return true;
  }
  var n = 0, t = setInterval(function () { if (hook() || ++n > 200) clearInterval(t); }, 300);
  w.AIVAULTDawnSearch = { refFor: refFor, web: web, handle: handle };
})(window, document);

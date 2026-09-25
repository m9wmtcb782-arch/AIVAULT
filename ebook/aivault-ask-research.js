(function () {
  "use strict";

  function toast(msg) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 2200);
  }

  function keywordsFrom(text) {
    var raw = String(text || "").replace(/\s+/g, " ").trim();
    if (!raw) return [];
    var hits = raw.match(/[一-鿿]{2,12}/g) || [];
    var stop = /^(這個|這一|目前|電子|教材|原文|請問|什麼|如何|為什麼|因為|所以|以及|或者|不是|可以|應該|國家|體系)$/;
    var seen = {};
    var out = [];
    hits.forEach(function (w) {
      if (stop.test(w) || seen[w]) return;
      seen[w] = 1;
      out.push(w);
    });
    return out.slice(0, 6);
  }

  function extractBookBlock(userMessage) {
    var s = String(userMessage || "");
    var i = s.indexOf("【電子書內容】");
    if (i < 0) i = s.indexOf("【電子書內容】".replace("內容", "內容"));
    return i >= 0 ? s.slice(i, i + 1800) : s.slice(0, 1200);
  }

  async function wikiSearch(q) {
    if (!q) return "";
    var api = "https://zh.wikipedia.org/w/api.php?action=query&list=search&srlimit=3&format=json&origin=*&srsearch=" + encodeURIComponent(q);
    var data = await fetch(api).then(function (r) { return r.json(); }).catch(function () { return null; });
    var items = data && data.query && data.query.search ? data.query.search : [];
    if (!items.length) return "";
    var parts = [];
    var i;
    for (i = 0; i < items.length && i < 3; i++) {
      var title = items[i].title;
      var sumUrl = "https://zh.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title);
      var sum = await fetch(sumUrl).then(function (r) { return r.json(); }).catch(function () { return null; });
      if (!sum || !sum.extract) continue;
      var link = (sum.content_urls && sum.content_urls.desktop && sum.content_urls.desktop.page) || ("https://zh.wikipedia.org/wiki/" + encodeURIComponent(title));
      parts.push("《" + title + "》 " + sum.extract + "\n來源：" + link);
    }
    return parts.join("\n\n");
  }

  async function gatherWeb(userMessage) {
    var qMatch = String(userMessage || "").match(/【學生問題】([^\n]+)/);
    var question = qMatch ? qMatch[1].trim() : "";
    var book = extractBookBlock(userMessage);
    var keys = keywordsFrom((question + " " + book).slice(0, 400));
    var queries = [];
    if (question) queries.push(question.slice(0, 40));
    if (keys.length) queries.push(keys.slice(0, 3).join(" "));
    var seen = {};
    var chunks = [];
    var i;
    for (i = 0; i < queries.length; i++) {
      var q = queries[i];
      if (!q || seen[q]) continue;
      seen[q] = 1;
      var piece = await wikiSearch(q);
      if (piece) chunks.push(piece);
    }
    return chunks.join("\n\n").slice(0, 3500);
  }

  function researchSystem() {
    return [
      "你是 Technical Dark Star，電子書研究助理。",
      "必須按這個順序作答：",
      "1. 先精讀讀者指定的【電子書內容】或【讀者指定文字】，整理要點、概念與條文結構。",
      "2. 再使用【網上相關資料】補充沿革、實務、相關制度或公開資料；沒有抓到的部分可依公開法律知識補充，但必須標明「非教材原文」。",
      "3. 回覆結構固定為：【教材原文要點】【網上相關資料】【綜合分析】【來源】。",
      "4. 絕對不要把網上資料寫成教材原文。不要編造未出現的條次號。用繁體中文。"
    ].join("");
  }

  function attachSelection(userMessage) {
    try {
      var sel = window.AIVAULTPreciseSelect && window.AIVAULTPreciseSelect.getSelectedText && window.AIVAULTPreciseSelect.getSelectedText();
      if (sel && String(sel).trim()) {
        return "【讀者指定文字】\n" + String(sel).trim() + "\n\n" + userMessage;
      }
    } catch (e) {}
    return userMessage;
  }

  function wrap() {
    var E = window.AIVAULTEbook;
    if (!E || typeof E.askGateway !== "function" || E._researchWrapped) return;
    var orig = E.askGateway.bind(E);
    E._researchWrapped = true;
    E.askGateway = async function (system, userMessage) {
      toast("暗星正在讀本頁內容並上網收集相關資料…");
      var user = attachSelection(userMessage);
      var web = "";
      try { web = await gatherWeb(user); } catch (e) { web = ""; }
      if (!web) web = "（此次未能即時抓取網頁。請依公開法律與制度知識補充，並標明非教材原文。）";
      return orig(researchSystem(), user + "\n\n【網上相關資料】\n" + web);
    };
  }

  function hint() {
    var body = document.getElementById("drawerBody");
    if (!body) return;
    var muted = body.querySelector(".muted");
    if (muted && muted.textContent.indexOf("book_id") >= 0) {
      muted.textContent = "暗星會先讀你指定的書內文字，再上網收集相關資料，最後分成「教材要點」「網上資料」「綜合分析」給你。";
    }
  }

  function boot() {
    wrap();
    hint();
    var drawer = document.getElementById("drawer");
    if (drawer && window.MutationObserver && !drawer._researchHint) {
      drawer._researchHint = true;
      new MutationObserver(hint).observe(drawer, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  setTimeout(wrap, 300);
})();

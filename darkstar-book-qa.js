/* 暗星即時語音 × 書架問答：使用者語音提問後，搜尋電子書書架，把相關段落以文字送給暗星。 */
(function (w, d) {
  "use strict";
  var SUPA = "https://clcddygkaaqqtsbswgdf.supabase.co";
  var INGEST = SUPA + "/functions/v1/dark-star-ebook-ingest";
  var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE";
  var CACHE = "aivault_bookqa_cache_v1", MAXC = 1500;
  var chunks = null, building = null;

  function norm(t) { return String(t || "").replace(/\s+/g, "").toLowerCase(); }
  function grams(t) { t = norm(t).replace(/[，。、！？；：「」『』（）()《》〈〉,.!?;:"'\-—…]/g, ""); var g = {}; for (var i = 0; i < t.length - 1; i++) g[t.substr(i, 2)] = 1; return g; }

  function idbAll() {
    return new Promise(function (res) {
      if (!w.indexedDB) return res({ books: [], pages: [] });
      var r; try { r = indexedDB.open("aivault_flipbook_v1", 1); } catch (e) { return res({ books: [], pages: [] }); }
      r.onupgradeneeded = function () { try { r.transaction.abort(); } catch (e) {} }; // 不建立任何 store
      r.onerror = r.onblocked = function () { res({ books: [], pages: [] }); };
      r.onsuccess = function () {
        var db = r.result, out = { books: [], pages: [] };
        try {
          if (!db.objectStoreNames.contains("books") || !db.objectStoreNames.contains("pages")) { db.close(); return res(out); }
          var tx = db.transaction(["books", "pages"], "readonly");
          tx.objectStore("books").getAll().onsuccess = function (e) { out.books = e.target.result || []; };
          tx.objectStore("pages").getAll().onsuccess = function (e) { out.pages = e.target.result || []; };
          tx.oncomplete = function () { db.close(); res(out); };
          tx.onerror = function () { db.close(); res(out); };
        } catch (e) { res(out); }
      };
    });
  }
  function ingest(body) {
    return fetch(INGEST, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON }, body: JSON.stringify(body) })
      .then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
  }
  function loadCache() { try { return JSON.parse(localStorage.getItem(CACHE) || "{}"); } catch (e) { return {}; } }
  function saveCache(c) { try { localStorage.setItem(CACHE, JSON.stringify(c)); } catch (e) { /* 空間不足就只留記憶體 */ } }

  async function remoteBooks(skip) {
    var cache = loadCache(), out = [];
    var list = await ingest({ action: "list", limit: 80 });
    var books = (list && (list.books || list.items)) || [];
    for (var i = 0; i < books.length; i++) {
      var b = books[i], id = String(b.id || b.ebook_id || ""), total = Number(b.total_pages || b.page_count || 0);
      if (!id || skip[id]) continue;
      var key = id + ":" + total;
      if (!cache[key]) {
        var pages = [];
        for (var p = 11; total && p - 10 <= total; p += 21) {
          var r = await ingest({ action: "context", ebook_id: id, page_number: p, radius: 10 });
          (r.pages || []).forEach(function (x) { pages.push([Number(x.page_number || 0), String(x.content || "")]); });
        }
        cache[key] = { t: b.title || "未命名", p: pages };
        saveCache(cache);
      }
      out.push({ id: id, title: cache[key].t, pages: cache[key].p });
    }
    return out;
  }
  function addChunks(list, title, pageNo, text) {
    text = String(text || "").replace(/\s+/g, " ").trim();
    for (var i = 0; i < text.length; i += 250) {
      var s = text.substr(Math.max(0, i - 50), 350);
      list.push({ title: title, page: pageNo, text: s, g: grams(s) });
    }
  }
  function build() {
    if (chunks) return Promise.resolve(chunks);
    if (building) return building;
    building = (async function () {
      var list = [], skip = {};
      var L = await idbAll(), titles = {};
      L.books.forEach(function (b) { titles[b.id] = b.title || "未命名"; if (b.ebook_id) skip[b.ebook_id] = 1; skip[b.id] = 1; });
      L.pages.forEach(function (p) { addChunks(list, titles[p.book_id] || "未命名", p.page_number, p.content || p.text); });
      try { (await remoteBooks(skip)).forEach(function (b) { b.pages.forEach(function (p) { addChunks(list, b.title, p[0], p[1]); }); }); } catch (e) { console.warn("[BookQA] remote", e); }
      chunks = list; building = null; return list;
    })();
    return building;
  }
  function search(q, list) {
    var qg = grams(q), keys = Object.keys(qg); if (keys.length < 2) return [];
    var scored = list.map(function (c) { var s = 0; for (var i = 0; i < keys.length; i++) if (c.g[keys[i]]) s++; return { c: c, s: s / Math.sqrt(keys.length) }; })
      .filter(function (x) { return x.s >= 1; }).sort(function (a, b) { return b.s - a.s; });
    var out = [], used = 0;
    for (var i = 0; i < scored.length && out.length < 5; i++) {
      var c = scored[i].c;
      if (out.some(function (o) { return o.title === c.title && Math.abs(o.page - c.page) < 1 && o.text.substr(0, 40) === c.text.substr(0, 40); })) continue;
      if (used + c.text.length > MAXC && out.length >= 3) break;
      out.push(c); used += c.text.length;
    }
    return out;
  }
  var TRIVIAL = /^(你好|哈囉|嗨|hi|hello|嗯+|喂|好|好的|ok|謝謝|掰掰|再見|對|是|不是|沒有|可以)[啊呀喔哦嗎呢！!。.\s]*$/i;
  function isQuestion(t) { t = String(t || "").trim(); return t.length >= 4 && !TRIVIAL.test(t); }

  function bubble(hits) {
    var inner = d.getElementById("messagesInner"); if (!inner) return;
    var row = d.createElement("div"); row.className = "message"; row.setAttribute("data-ds-bookqa", "1");
    var av = d.createElement("div"); av.className = "message-avatar"; av.textContent = "📚";
    var body = d.createElement("div"); body.className = "message-body";
    var det = d.createElement("details"); det.style.cssText = "font-size:12px;opacity:.85";
    var sum = d.createElement("summary"); sum.textContent = "書架資料 " + hits.length + " 段（點開查看）"; det.appendChild(sum);
    hits.forEach(function (h) { var p = d.createElement("div"); p.style.cssText = "margin:6px 0;white-space:pre-wrap"; p.textContent = "《" + h.title + "》p." + h.page + "：" + h.text; det.appendChild(p); });
    body.appendChild(det); row.appendChild(av); row.appendChild(body); inner.appendChild(row);
    try { var m = d.getElementById("messages"); if (m) m.scrollTop = m.scrollHeight; } catch (e) {}
  }
  function compose(q, hits) {
    return "【書架資料】使用者剛才的題目：「" + q + "」\n" + hits.map(function (h, i) { return (i + 1) + ". 《" + h.title + "》p." + h.page + "：" + h.text; }).join("\n") +
      "\n請根據以上書架資料回答題目，並說出書名與頁碼；若資料中找不到答案，請直接說書架上找不到。若你剛才已開始回答，請以書架資料修正或補充剛才的回答。";
  }
  async function onTurn(ev) {
    var q = ev && ev.detail && ev.detail.text;
    var L = w.AIVAULTDarkStarLive;
    if (!isQuestion(q) || !L || !L.isConnected || !L.isConnected() || !L.sendRawText) return;
    var hits = search(q, await build());
    var msg = hits.length ? compose(q, hits) : "【書架資料】使用者題目：「" + q + "」在書架上沒有搜尋到相關段落；如果這是考題，請說明書架上找不到依據。";
    if (L.sendRawText(msg) && hits.length) bubble(hits);
  }
  w.addEventListener("darkstar-live-user-turn", onTurn);
  w.AIVAULTBookQA = { build: build, search: search, isQuestion: isQuestion, compose: compose, reset: function () { chunks = null; } };
  setTimeout(function () { build().catch(function () {}); }, 4000); // 預先建索引
})(window, document);

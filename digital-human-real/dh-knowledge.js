/* 數字人知識：先查 AIVAULT 電子書書架（沿用 darkstar-book-qa.js 的索引與搜尋），書上沒有才用網路搜尋（dark-star-ebook-ingest?feature=web-search）。 */
(function (w) {
  'use strict';
  var cfg = { url: '', anon: '' };
  function withTimeout(p, ms) { return Promise.race([p, new Promise(function (r) { setTimeout(function () { r(null); }, ms); })]); }
  function isQuestion(t) { var Q = w.AIVAULTBookQA; return Q ? Q.isQuestion(t) : String(t || '').trim().length >= 4; }
  async function books(q) {
    var Q = w.AIVAULTBookQA; if (!Q) return null;
    var list = await withTimeout(Q.build(), 8000); if (!list || !list.length) return null;
    var sv = null; try { sv = await withTimeout(Q.structural(q, list), 4000); } catch (e) {}
    var hits = sv ? sv.sources : Q.search(q, list);
    if (!hits || !hits.length) return null;
    var titles = []; hits.forEach(function (h) { if (titles.indexOf(h.title) < 0) titles.push(h.title); });
    var text = sv ? sv.text : hits.map(function (h, i) { return (i + 1) + '. 《' + h.title + '》p.' + h.page + '：' + h.text; }).join('\n');
    return { kind: 'book', titles: titles, hits: hits, text: text };
  }
  var QW = /(請問|请问|可以|幫我|帮我|告訴我|告诉我|查一下|查查|搜尋|搜索|一下|現在|现在|今天|最近|是什麼|是什么|什麼是|什么是|什麼|什么|怎麼樣|怎么样|怎麼|怎么|如何|為什麼|为什么|哪些|哪裡|哪里|多少|嗎|吗|呢|吧|啊|呀|的|了|你知道|知道)/g;
  function kw(q) { return String(q || '').replace(QW, ' ').replace(/[，。！？、,.!?；;：:「」\s]+/g, ' ').trim(); }
  async function web(q) {
    var r1 = await web1(kw(q) || q); if (r1) return r1;
    var k = kw(q).replace(/\s+/g, ''); return k.length >= 4 ? web1(k.slice(0, 6)) : null;
  }
  async function web1(q) {
    if (!cfg.url || String(q).length < 2) return null;
    try {
      var anon = cfg.anon || w.__dhAnon || ''; var r = await withTimeout(fetch(cfg.url + '/functions/v1/dark-star-ebook-ingest?feature=web-search', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: 'Bearer ' + anon }, body: JSON.stringify({ q: String(q).slice(0, 200) }) }), 10000);
      if (!r || !r.ok) return null;
      var j = await r.json(), rows = (j && j.results) || [];
      if (!rows.length) return null;
      rows = rows.slice(0, 5);
      return { kind: 'web', rows: rows, text: rows.map(function (x, i) { return (i + 1) + '. ' + (x.title || '') + '：' + String(x.snippet || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220) + (x.url ? '（' + x.url + '）' : ''); }).join('\n') };
    } catch (e) { return null; }
  }
  // 回傳 { kind:'book'|'web'|'', prompt, chip }
  async function lookup(q) {
    if (!isQuestion(q)) return { kind: '', prompt: '', chip: '' };
    var b = null; try { b = await books(q); } catch (e) {}
    if (b) return { kind: 'book', chip: '📚 ' + b.titles.slice(0, 2).map(function (t) { return t.slice(0, 18); }).join('、'),
      prompt: '【書架資料】（AIVAULT 電子書書架，優先依據）\n' + b.text + '\n請優先根據以上書架資料回答，並口頭說出書名（可附頁碼）。書架資料只是片段；若不足以回答，再用一般知識補充並說明那部分不是出自書上。' };
    var wb = await web(q);
    if (wb) return { kind: 'web', chip: '🌐 網路',
      prompt: '【網路搜尋結果】（書架上沒有找到相關內容）\n' + wb.text + '\n書架上沒有相關內容，請根據以上網路搜尋結果回答，並先說明「這是網路上查到的」。' };
    return { kind: '', prompt: '', chip: '' };
  }
  w.DHKnow = { init: function (o) { cfg.url = o.url || ''; cfg.anon = o.anon || ''; }, lookup: lookup, isQuestion: isQuestion, warm: function () { try { w.AIVAULTBookQA && w.AIVAULTBookQA.build(); } catch (e) {} } };
})(window);

/* 🤖 暗星多機器人工作區（technical-dark-star.html）
   每個分頁＝一個機器人：自己的名字、角色、表情小球（黑球家族，各有不同光暈與配件）、聊天紀錄。
   角色：書籍問答／出題老師／筆記整理／一般助理／AIVAULT App 管家（只產生提案；擁有者核准後由 Supabase edge function 開 PR，永不自動合併）。
   儲存：Supabase dark_star_bots（RLS，每人自己的）＋ localStorage 備援。AI：ai-gateway（與拍照問問題相同的登入 token／自動續期）。
   不碰即時視訊、抽屜或其他既有功能：只新增一顆按鈕與一個全螢幕面板。 */
(function (w, d) {
  "use strict";
  if (w.AIVAULTBots) return;
  var BASE = "https://clcddygkaaqqtsbswgdf.supabase.co";
  var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE";
  var AUTH_KEY = "sb-clcddygkaaqqtsbswgdf-auth-token", PUB = "sb_publishable_1D05YGthBrNGg-5L92TLCw_GiLnInBu";
  var LS = "aivault_ds_bots_v1", MAXH = 120;
  var ROLES = {
    book:   { label: "書籍問答", icon: "📚", glow: "#5fb3ff", name: "書蟲", hello: "我會從你書架上的書找原文段落回答，並註明書名與頁碼。直接問我問題吧！" },
    quiz:   { label: "出題老師", icon: "🎯", glow: "#ff7a7a", name: "考官", hello: "按「出一題」我就從書架上的書出題；你作答後我會評分並附上頁碼依據。" },
    notes:  { label: "筆記整理", icon: "📝", glow: "#ffd166", name: "筆記君", hello: "告訴我要整理哪一章或哪個主題（例如「整理 行政處分 的重點」），整理好可以一鍵存進電子書筆記。" },
    general:{ label: "一般助理", icon: "💬", glow: "#8b7cff", name: "小暗", hello: "嗨！有什麼想聊或想問的都可以。" },
    appmgr: { label: "App 管家", icon: "🛠️", glow: "#4ade80", name: "管家", hello: "告訴我你想新增或修改 AIVAULT 的哪個 App。我只會產生「修改提案」（檔案＋差異＋說明）；只有擁有者按「核准」後才會開 GitHub PR，而且不會自動合併。" }
  };
  var ORDER = ["book", "quiz", "notes", "general", "appmgr"];

  // ---------- 登入 token（同 darkstar-study-books.js：過期前用 refresh_token 續期並寫回） ----------
  function session() { try { var j = JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); return j && typeof j === "object" ? j : null; } catch (e) { return null; } }
  var refreshing = null;
  async function token(force) {
    var j = session(); if (!j) return "";
    var cs = j.currentSession || {}, t = String(j.access_token || cs.access_token || "").trim();
    var rt = String(j.refresh_token || cs.refresh_token || "").trim(), exp = Number(j.expires_at || cs.expires_at || 0);
    if (!rt || !(force || !t || (exp > 0 && exp * 1000 - Date.now() < 60000))) return t;
    if (!refreshing) refreshing = (async function () {
      try {
        var r = await fetch(BASE + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { "Content-Type": "application/json", apikey: PUB }, body: JSON.stringify({ refresh_token: rt }) });
        if (!r.ok) return t; var f = await r.json(); if (!f || !f.access_token) return t;
        try { localStorage.setItem(AUTH_KEY, JSON.stringify(Object.assign({}, j, f, { refresh_token: f.refresh_token || rt }))); } catch (e) {}
        return String(f.access_token);
      } catch (e) { return t; } finally { setTimeout(function () { refreshing = null; }, 0); }
    })();
    return refreshing;
  }
  function userId() { var j = session(); var u = j && (j.user || (j.currentSession && j.currentSession.user)); return u && u.id || ""; }
  function uuid() { return crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }); }

  // ---------- 儲存：Supabase（RLS）＋ localStorage ----------
  var bots = [], activeId = null, remoteOk = false, saveTimers = {};
  function saveLocal() { try { localStorage.setItem(LS, JSON.stringify({ bots: bots, active: activeId })); } catch (e) {} }
  function loadLocal() { try { var j = JSON.parse(localStorage.getItem(LS) || "null"); if (j && Array.isArray(j.bots)) { bots = j.bots; activeId = j.active; } } catch (e) {} }
  async function rest(path, opt) {
    var t = await token(); if (!t || !userId()) throw new Error("NO_SESSION");
    opt = opt || {}; var h = Object.assign({ apikey: ANON, Authorization: "Bearer " + t, "Content-Type": "application/json" }, opt.headers || {});
    var r = await fetch(BASE + "/rest/v1/" + path, Object.assign({}, opt, { headers: h }));
    if (r.status === 401) { t = await token(true); h.Authorization = "Bearer " + t; r = await fetch(BASE + "/rest/v1/" + path, Object.assign({}, opt, { headers: h })); }
    if (!r.ok) throw new Error("REST " + r.status);
    return r.status === 204 ? null : r.json().catch(function () { return null; });
  }
  function row(b, i) { return { id: b.id, user_id: userId(), name: b.name, role: b.role, avatar: b.avatar || {}, history: (b.history || []).slice(-MAXH), sort: i, updated_at: new Date().toISOString() }; }
  async function loadRemote() {
    try {
      var rows = await rest("dark_star_bots?select=*&order=sort.asc,created_at.asc");
      remoteOk = true;
      if (rows && rows.length) {
        var loc = {}; bots.forEach(function (b) { loc[b.id] = b; });
        bots = rows.map(function (r) { var l = loc[r.id]; var rh = r.history || [], lh = (l && l.history) || []; return { id: r.id, name: r.name, role: r.role, avatar: r.avatar || {}, history: lh.length > rh.length ? lh : rh, state: (l && l.state) || {} }; });
        if (!bots.some(function (b) { return b.id === activeId; })) activeId = bots[0].id;
      } else if (bots.length) { await rest("dark_star_bots", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(bots.map(row)) }); }
      saveLocal();
    } catch (e) { remoteOk = false; }
    setSync();
  }
  function persist(b) {
    saveLocal();
    if (!userId()) { setSync(); return; }
    clearTimeout(saveTimers[b.id]);
    saveTimers[b.id] = setTimeout(function () {
      if (b.deleted || bots.indexOf(b) < 0) return;
      rest("dark_star_bots?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([row(b, bots.indexOf(b))]) })
        .then(function () { remoteOk = true; setSync(); }, function () { remoteOk = false; setSync(); });
    }, 600);
  }
  async function removeRemote(id) { if (!userId()) return; try { await rest("dark_star_bots?id=eq." + encodeURIComponent(id), { method: "DELETE" }); } catch (e) {} }

  // ---------- AI Gateway ----------
  async function ai(system, user) {
    var t = (await token()) || ANON;
    var X = w.AIVAULTPersona; if (X) system = X.short("dark") + "\n" + system;
    var body = JSON.stringify({ provider: "gemini", model: "gemini-3.6-flash", system: system, userMessage: user, source: "darkstar-bots" });
    var go = function (tk) { return fetch(BASE + "/functions/v1/ai-gateway", { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + tk }, body: body, signal: AbortSignal.timeout ? AbortSignal.timeout(120000) : undefined }); };
    var r = await go(t);
    if (r.status === 401 && t !== ANON) r = await go((await token(true)) || ANON);
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || j.message || ("HTTP " + r.status));
    var out = j.content || j.reply || j.text || j.message || j.output || j.analysis;
    if (!out || typeof out !== "string") throw new Error("AI 沒有回應內容");
    return out;
  }
  function historyText(b, n) {
    var h = (b.history || []).slice(0, -1); return h.slice(-(n || 10)).map(function (m) { return (m.who === "user" ? "使用者：" : "你：") + String(m.text || "").slice(0, 1200); }).join("\n");
  }

  // ---------- 書架（darkstar-book-qa.js） ----------
  function bookQA() {
    if (w.AIVAULTBookQA) return Promise.resolve(w.AIVAULTBookQA);
    return new Promise(function (res) { var s = d.createElement("script"); s.src = "darkstar-book-qa.js?v=20261015-qa10"; s.onload = function () { res(w.AIVAULTBookQA || null); }; s.onerror = function () { res(null); }; d.head.appendChild(s); });
  }
  function ebookLib() {
    if (w.AIVAULTEbook) return Promise.resolve(w.AIVAULTEbook);
    return new Promise(function (res) { var s = d.createElement("script"); s.src = "ebook/aivault-ebook-lib.js?v=20261016-bots1"; s.onload = function () { res(w.AIVAULTEbook || null); }; s.onerror = function () { res(null); }; d.head.appendChild(s); });
  }
  async function shelf() { var Q = await bookQA(); if (!Q) return { Q: null, list: [] }; var list = await Promise.race([Q.build(), new Promise(function (r) { setTimeout(function () { r([]); }, 20000); })]); return { Q: Q, list: list || [] }; }
  function cite(hits) { return hits.map(function (h) { return { title: h.title, page: h.page, bid: h.bid }; }); }

  // ---------- 各角色 ----------
  var SYS_BASE = "你是 AIVAULT 暗星工作區裡的機器人（外型是會做表情的黑色小球暗星），請一律用繁體中文（台灣用語）回答，語氣親切、精簡。" + ((w.DarkStarOrb && w.DarkStarOrb.TAG_HINT) || "");
  var EXPR_TXT = { angry: "😡 哼！我生氣了！", huffy: "😤 氣呼呼～", happy: "😃 好開心！", sad: "😢 嗚嗚…有點難過", surprised: "😮 哇！嚇我一跳！", thinking: "🤔 嗯…讓我想想", love: "😍 好喜歡你～", sleepy: "😴 呼…好想睡", laughing: "😆 哈哈哈哈！" };
  function exprReply(x) { return EXPR_TXT[x] || "🙂"; }
  var handlers = {
    general: async function (b, q) {
      return { text: await ai(SYS_BASE + "你的名字是「" + b.name + "」，角色是一般助理。", (historyText(b) ? "【先前對話】\n" + historyText(b) + "\n\n" : "") + "使用者：" + q) };
    },
    book: async function (b, q) {
      var s = await shelf(), hits = s.Q ? s.Q.search(q, s.list) : [], sv = null;
      if (s.Q && s.Q.structural) { try { sv = await s.Q.structural(q, s.list); } catch (e) {} }
      var ctx = sv ? "【書架資料】" + sv.text : hits.length ? s.Q.compose(q, hits) : "";
      if (!ctx) return { text: "這次的關鍵詞沒有比對到書架上的段落（書還是完整的）。請說得更具體一點，例如書名、哪一章、或關鍵詞。" };
      var ans = await ai(SYS_BASE + "你的名字是「" + b.name + "」，角色是書籍問答：只根據提供的書架資料回答，註明書名與頁碼；不得虛構法條或內容；資料不足時請使用者指定章節或關鍵詞，不要說書裡沒有。",
        (historyText(b, 6) ? "【先前對話】\n" + historyText(b, 6) + "\n\n" : "") + ctx);
      return { text: ans, cites: sv ? (sv.sources ? cite(sv.sources) : []) : cite(hits) };
    },
    quiz: async function (b, q) {
      b.state = b.state || {};
      var wantNew = /^(出一題|出題|再一題|下一題|換一題|quiz)/i.test(q.trim()) || !b.state.pending;
      var s = await shelf();
      if (wantNew) {
        if (!s.list.length) return { text: "書架目前讀不到書（請確認已登入且有勾選 ⭐ 暗星學習的書）。" };
        var topic = q.replace(/^(出一題|出題|再一題|下一題|換一題)/, "").trim(), pool = topic && s.Q ? s.Q.search(topic, s.list) : [];
        var c = pool.length ? pool[Math.floor(Math.random() * pool.length)] : (function () { var L = s.list.filter(function (x) { return (x.text || "").length > 120; }); if (!L.length) L = s.list; return L[Math.floor(Math.random() * L.length)]; })();
        var qs = await ai(SYS_BASE + "你是出題老師「" + b.name + "」。根據段落出一題（申論、選擇或簡答皆可），題目要能從段落找到答案。只輸出題目本身，不要附答案。",
          "【段落】《" + c.title + "》p." + c.page + "：" + c.text);
        b.state.pending = { question: qs, title: c.title, page: c.page, bid: c.bid, text: String(c.text).slice(0, 2500) };
        return { text: "📝 題目（出自《" + c.title + "》）：\n" + qs + "\n\n請直接輸入你的答案。", cites: [{ title: c.title, page: c.page, bid: c.bid }] };
      }
      var p = b.state.pending; b.state.pending = null;
      var g = await ai(SYS_BASE + "你是出題老師「" + b.name + "」。依據段落為使用者的答案評分（0–10分），指出答對與遺漏的要點，給出參考答案，並註明《書名》頁碼。不得虛構段落沒有的內容。",
        "【題目】" + p.question + "\n【段落】《" + p.title + "》p." + p.page + "：" + p.text + "\n【使用者答案】" + q);
      return { text: g + "\n\n（想繼續就按「出一題」）", cites: [{ title: p.title, page: p.page, bid: p.bid }] };
    },
    notes: async function (b, q) {
      var s = await shelf(), topic = q.replace(/^(整理|摘要|總結|重點)\s*/, ""), hits = [], sv = null;
      if (s.Q && s.Q.structural) { try { sv = await s.Q.structural(q, s.list); } catch (e) {} }
      if (!sv && s.Q) hits = s.Q.search(topic || q, s.list);
      var src = sv ? (sv.sources || []) : hits;
      var ctx = sv ? sv.text : hits.map(function (h, i) { return (i + 1) + ". 《" + h.title + "》p." + h.page + "：" + h.text; }).join("\n");
      if (!ctx) return { text: "找不到相關段落。請告訴我書名＋章節或關鍵詞，例如「整理 行政訴訟的受案範圍」。" };
      var ans = await ai(SYS_BASE + "你是筆記整理機器人「" + b.name + "」。把書架資料整理成條列重點筆記：標題、3–8 個要點（每點註明頁碼）、一句總結。只根據資料，不得虛構。", "【主題】" + q + "\n【書架資料】\n" + ctx);
      var first = src[0] || null;
      return { text: ans, cites: cite(src), note: first ? { bid: first.bid, page: first.page, title: first.title } : null };
    },
    appmgr: async function (b, q) {
      var files = await repoFiles();
      var sys = SYS_BASE + "你是 AIVAULT App 管家「" + b.name + "」。AIVAULT 是 GitHub Pages 靜態網站（repo m9wmtcb782-arch/AIVAULT，main 分支），頁面是 HTML/JS。" +
        "使用者想新增或修改 App 時，先簡短說明你的計畫，然後輸出一個 ```json 區塊，格式：{\"title\":\"簡短標題\",\"description\":\"改了什麼、為什麼、如何測試\",\"files\":[{\"path\":\"新檔.html\",\"content\":\"完整內容\"},{\"path\":\"既有檔.html\",\"edits\":[{\"find\":\"原文中剛好出現一次的片段\",\"replace\":\"新片段\"}]}]}。" +
        "修改既有大檔請用 edits（find 必須逐字存在且唯一），新檔用 content。不得修改 .github/、密鑰或 supabase 設定；不要放任何 token。若需求不清楚，先提問，不要輸出 json。";
      var ans = await ai(sys, "【repo 根目錄檔案】" + files + "\n\n" + (historyText(b, 8) ? "【先前對話】\n" + historyText(b, 8) + "\n\n" : "") + "使用者：" + q);
      var prop = parseProposal(ans);
      return { text: ans.replace(/```json[\s\S]*?```/, "").trim() || "（提案如下）", proposal: prop };
    }
  };
  var filesCache = null;
  async function repoFiles() {
    if (filesCache) return filesCache;
    try { var r = await fetch("https://api.github.com/repos/m9wmtcb782-arch/AIVAULT/contents/?ref=main"); var j = await r.json(); filesCache = Array.isArray(j) ? j.map(function (x) { return x.name + (x.type === "dir" ? "/" : ""); }).join(", ") : ""; } catch (e) { filesCache = ""; }
    return filesCache;
  }
  function parseProposal(t) {
    var m = String(t).match(/```json\s*([\s\S]*?)```/); if (!m) return null;
    try { var p = JSON.parse(m[1]); if (!p || !Array.isArray(p.files) || !p.files.length) return null;
      p.files = p.files.filter(function (f) { return f && f.path && (typeof f.content === "string" || Array.isArray(f.edits)); });
      return p.files.length ? { title: String(p.title || "AIVAULT 修改提案"), description: String(p.description || ""), files: p.files, status: "proposed" } : null;
    } catch (e) { return null; }
  }

  // ---------- 提案：差異、匯出、核准 ----------
  async function currentFile(path) { try { var r = await fetch("https://raw.githubusercontent.com/m9wmtcb782-arch/AIVAULT/main/" + path.split("/").map(encodeURIComponent).join("/"), { cache: "no-store" }); return r.ok ? await r.text() : null; } catch (e) { return null; } }
  function lineDiff(a, b, path) {
    var A = a == null ? [] : a.split("\n"), B = b.split("\n"), i = 0, j = 0;
    while (i < A.length && i < B.length && A[i] === B[i]) i++;
    var ea = A.length - 1, eb = B.length - 1;
    while (ea >= i && eb >= i && A[ea] === B[eb]) { ea--; eb--; }
    var out = ["--- " + (a == null ? "/dev/null" : "a/" + path), "+++ b/" + path, "@@ -" + (i + 1) + "," + (ea - i + 1) + " +" + (i + 1) + "," + (eb - i + 1) + " @@"];
    for (var k = Math.max(0, i - 3); k < i; k++) out.push(" " + A[k]);
    for (k = i; k <= ea; k++) out.push("-" + A[k]);
    for (k = i; k <= eb; k++) out.push("+" + B[k]);
    for (k = ea + 1; k < Math.min(A.length, ea + 4); k++) out.push(" " + A[k]);
    return out.join("\n");
  }
  async function buildDiff(p) {
    var parts = [], errs = [];
    for (var f of p.files) {
      var cur = await currentFile(f.path), next;
      if (typeof f.content === "string") next = f.content;
      else { if (cur == null) { errs.push(f.path + "：找不到原檔"); continue; } next = cur; for (var e of f.edits) { var n = next.split(e.find).length - 1; if (!e.find || n !== 1) { errs.push(f.path + "：取代片段出現 " + n + " 次（需剛好 1 次）"); continue; } next = next.replace(e.find, function () { return e.replace; }); } }
      parts.push(lineDiff(cur, next, f.path));
    }
    return { diff: parts.join("\n\n"), errors: errs };
  }
  var prStatus = null;
  async function bridgeStatus(force) {
    if (prStatus && !force) return prStatus;
    try { var t = await token(); var r = await fetch(BASE + "/functions/v1/dark-star-ebook-ingest?feature=bot-pr", { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + (t || ANON) }, body: JSON.stringify({ action: "status" }) }); prStatus = await r.json().catch(function () { return {}; }); }
    catch (e) { prStatus = { ok: false, error: String(e.message || e) }; }
    return prStatus;
  }
  async function approve(b, msg) {
    var t = await token(); if (!t) throw new Error("請先登入 AIVAULT");
    var r = await fetch(BASE + "/functions/v1/dark-star-ebook-ingest?feature=bot-pr", { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + t }, body: JSON.stringify({ action: "approve", proposal: Object.assign({ bot_id: b.id }, msg.proposal) }) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || !j.ok) {
      var M = { NOT_OWNER: "只有 AIVAULT 擁有者帳號可以核准。", OWNER_NOT_CONFIGURED: "伺服器尚未設定擁有者（AIVAULT_OWNER_USER_ID）。你的使用者 ID：" + (j.user_id || userId()), TOKEN_NOT_CONFIGURED: "伺服器尚未設定 GitHub token（AIVAULT_PR_GITHUB_TOKEN）。", NOT_LOGGED_IN: "請先登入 AIVAULT。" };
      throw new Error(M[j.error] || j.error || ("HTTP " + r.status));
    }
    return j;
  }
  function download(name, text, type) { var a = d.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: type || "text/plain" })); a.download = name; d.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

  // ---------- UI ----------
  var root, tabsEl, msgsEl, inputEl, heroOrb = null, heroEl, syncEl, quickEl, busy = {};
  function el(tag, cls, txt) { var e = d.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function css() {
    if (d.getElementById("dsb-css")) return;
    var s = el("style"); s.id = "dsb-css";
    s.textContent = [
      "#dsb-launch{display:inline-flex;align-items:center;gap:4px;flex:none;height:34px;padding:0 10px 0 5px;margin:0 4px;border:1px solid #e3e1ea;background:#fff;color:#222;border-radius:12px;font:600 13px system-ui,-apple-system,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.08);white-space:nowrap;-webkit-tap-highlight-color:transparent}#dsb-launch .ds-orb{pointer-events:none}@media(max-width:430px){#dsb-launch{padding:0 4px;margin:0 2px}#dsb-launch .lbl{display:none}}#dsb-launch.float{position:fixed;left:10px;top:calc(env(safe-area-inset-top,0px) + 62px);z-index:90}",
      "#dsb-root{position:fixed;inset:0;z-index:2147483000;background:#07070c;color:#eee;display:none;flex-direction:column;font:15px/1.5 system-ui,-apple-system,'PingFang TC',sans-serif;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}",
      "#dsb-root.open{display:flex}",
      "#dsb-root .dsb-top{display:flex;align-items:center;gap:6px;padding:8px 8px 0;border-bottom:1px solid #1d1d2a}",
      "#dsb-root .dsb-close{flex:none;background:none;border:0;color:#bbb;font-size:22px;width:36px;height:36px}",
      "#dsb-root .dsb-tabs{flex:1;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}#dsb-root .dsb-tabs::-webkit-scrollbar{display:none}",
      "#dsb-root .dsb-tab{flex:none;display:flex;align-items:center;gap:6px;padding:6px 10px 8px;border:0;border-bottom:2px solid transparent;background:none;color:#aaa;font:inherit;font-size:13px;max-width:140px}",
      "#dsb-root .dsb-tab .mini{width:22px;height:22px;flex:none}#dsb-root .dsb-tab span.n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "#dsb-root .dsb-tab.on{color:#fff;border-bottom-color:var(--g,#8b7cff)}",
      "#dsb-root .dsb-add{flex:none;width:34px;height:34px;border-radius:50%;border:1px dashed #555;background:none;color:#ccc;font-size:18px}",
      "#dsb-root .dsb-hero{display:flex;align-items:center;gap:12px;padding:10px 14px}",
      "#dsb-root .dsb-av{position:relative;width:76px;height:76px;flex:none;filter:drop-shadow(0 0 10px var(--g,#8b7cff))}",
      "#dsb-root .dsb-av .acc{position:absolute;right:-4px;bottom:-2px;font-size:20px}",
      "#dsb-root .dsb-av.thinking{animation:dsbThink 1.1s ease-in-out infinite}#dsb-root .dsb-av.talking{animation:dsbTalk .35s ease-in-out infinite alternate}#dsb-root .dsb-av.happy{animation:dsbHop .5s ease 2}",
      "@keyframes dsbThink{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg) translateY(-2px)}}@keyframes dsbTalk{from{transform:scale(1)}to{transform:scale(1.05)}}@keyframes dsbHop{0%,100%{transform:translateY(0)}40%{transform:translateY(-10px)}}",
      "#dsb-root .dsb-av .dots{position:absolute;left:50%;top:-10px;transform:translateX(-50%);font-size:14px;letter-spacing:2px;color:var(--g);display:none}#dsb-root .dsb-av.thinking .dots{display:block}",
      "#dsb-root .dsb-meta{flex:1;min-width:0}#dsb-root .dsb-meta b{display:block;font-size:17px}#dsb-root .dsb-meta small{color:#999}",
      "#dsb-root .dsb-menu{background:#15151f;border:1px solid #2a2a3a;color:#ddd;border-radius:10px;padding:6px 10px;font:inherit;font-size:13px}",
      "#dsb-root .dsb-sync{font-size:11px;color:#777;padding:0 14px}",
      "#dsb-root .dsb-msgs{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px 12px 12px;display:flex;flex-direction:column;gap:10px}",
      "#dsb-root .dsb-m{max-width:88%;padding:9px 12px;border-radius:14px;white-space:pre-wrap;word-break:break-word}",
      "#dsb-root .dsb-m.user{align-self:flex-end;background:#2b2a4a;border-bottom-right-radius:4px}#dsb-root .dsb-m.bot{align-self:flex-start;background:#14141d;border:1px solid #23232f;border-bottom-left-radius:4px}",
      "#dsb-root .dsb-m.err{border-color:#7a2a2a;color:#ffb3b3}",
      "#dsb-root .dsb-cite{margin-top:6px;font-size:12px;color:#9aa}",
      "#dsb-root .dsb-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}#dsb-root .dsb-acts button,#dsb-root .dsb-quick button{background:#1c1c2a;border:1px solid #33334a;color:#ddd;border-radius:999px;padding:5px 11px;font:inherit;font-size:13px}",
      "#dsb-root .dsb-acts button.ok{background:#14532d;border-color:#22c55e;color:#fff}#dsb-root .dsb-acts button:disabled{opacity:.45}",
      "#dsb-root .dsb-prop{margin-top:8px;border:1px solid #2f4f3a;border-radius:10px;padding:8px;background:#0c140f}#dsb-root .dsb-prop pre{max-height:240px;overflow:auto;font-size:11px;line-height:1.35;background:#05070a;padding:6px;border-radius:6px;white-space:pre}",
      "#dsb-root .dsb-prop pre .a{color:#7ee787}#dsb-root .dsb-prop pre .r{color:#ff7b72}",
      "#dsb-root .dsb-quick{display:flex;gap:6px;overflow-x:auto;padding:0 12px 6px}",
      "#dsb-root .dsb-in{display:flex;gap:8px;padding:8px 10px;border-top:1px solid #1d1d2a;background:#0a0a12}",
      "#dsb-root .dsb-in textarea{flex:1;resize:none;min-height:40px;max-height:120px;border-radius:12px;border:1px solid #2a2a3a;background:#12121b;color:#fff;padding:9px 11px;font:inherit;font-size:16px}",
      "#dsb-root .dsb-in button{flex:none;width:52px;border-radius:12px;border:0;background:var(--g,#8b7cff);color:#000;font-weight:700;font-size:15px}"
    ,
      "#dsb-root .dsb-tab,#dsb-root .dsb-close{background:transparent!important;color:#aaa!important;border-radius:0!important;border-top:0!important;border-left:0!important;border-right:0!important}#dsb-root .dsb-tab{border-bottom:2px solid transparent!important}#dsb-root .dsb-tab.on{color:#fff!important;border-bottom-color:var(--g,#8b7cff)!important}#dsb-root .dsb-close{border:0!important;color:#bbb!important}#dsb-root .dsb-add{background:transparent!important;color:#ccc!important;border:1px dashed #555!important;border-radius:50%!important}#dsb-root .dsb-acts button,#dsb-root .dsb-quick button{background:#1c1c2a!important;color:#ddd!important;border:1px solid #33334a!important;border-radius:999px!important}#dsb-root .dsb-acts button.ok{background:#14532d!important;border-color:#22c55e!important;color:#fff!important}#dsb-root .dsb-in button{background:var(--g,#8b7cff)!important;color:#000!important;border:0!important;border-radius:12px!important}#dsb-launch{background:#fff!important;color:#222!important}#dsb-root .dsb-tab .zz{display:none}#dsb-root button{-webkit-appearance:none;appearance:none;box-shadow:none;min-height:0;cursor:pointer}#dsb-root .dsb-tab{background:transparent}"
    ].join("\n");
    d.head.appendChild(s);
  }
  // 每個 bot 有自己的光暈顏色＋配件（黑球家族）
  function orbInto(host, b, size) {
    host.innerHTML = ""; var span = el("span"); host.appendChild(span);
    var api = null;
    if (w.DarkStarOrb) { api = w.DarkStarOrb.mount(span, { size: size }); span.style.setProperty("--g", glow(b)); try { span.querySelectorAll("radialGradient[id$='o'] stop").forEach(function (s) { s.setAttribute("stop-color", glow(b)); }); } catch (e) {} }
    else { span.style.cssText = "display:inline-block;width:" + size + "px;height:" + size + "px;border-radius:50%;background:radial-gradient(circle at 36% 30%,#4a4a58,#000)"; }
    return api;
  }
  function glow(b) { return (b.avatar && b.avatar.glow) || (ROLES[b.role] || ROLES.general).glow; }
  function setMood(mood) {
    var av = heroEl && heroEl.querySelector(".dsb-av"); if (!av) return;
    av.classList.remove("thinking", "talking", "happy"); if (mood && mood !== "idle") { void av.offsetWidth; av.classList.add(mood); }
    if (!heroOrb) return;
    if (mood === "thinking") heroOrb.setExpression("thinking", 60000);
    else if (mood === "happy") { heroOrb.setTalking(0); heroOrb.setExpression("happy", 2200); }
    else if (mood === "idle") { heroOrb.setTalking(0); heroOrb.setExpression("neutral", 0); }
  }
  function talk(ms) {
    if (!heroOrb) return Promise.resolve(); setMood("talking");
    return new Promise(function (res) { var t0 = Date.now(); (function f() { var k = Date.now() - t0; if (k > ms) { heroOrb.setTalking(0); return res(); } heroOrb.setTalking(.25 + .6 * Math.abs(Math.sin(k / 90))); requestAnimationFrame(f); })(); });
  }
  // 表情指令（使用者打「做一個生氣的表情」「開心」「氣呼呼」或 😤）與回覆中的 [表情:xx] 標籤
  function showExpr(x, ms) {
    if (!x || !heroOrb) return; ms = ms || 4500; holdExprUntil = Date.now() + ms;
    var av = heroEl && heroEl.querySelector(".dsb-av"); if (av) av.classList.remove("thinking", "talking", "happy");
    heroOrb.setExpression(x, ms);
    var t = tabsEl && tabsEl.querySelector(".dsb-tab.on .ds-orb"); if (t && t.__dsOrb) t.__dsOrb.setExpression(x, ms);
  }
  var holdExprUntil = 0;
  function active() { return bots.find(function (b) { return b.id === activeId; }) || bots[0]; }
  function setSync() { if (!syncEl) return; syncEl.textContent = userId() ? (remoteOk ? "☁️ 已同步到你的 AIVAULT 帳號" : "⚠️ 暫時只存在這台裝置（雲端同步失敗，稍後自動重試）") : "📱 未登入：機器人與對話只存在這台裝置"; }

  function newBot(role, name) { var R = ROLES[role] || ROLES.general; return { id: uuid(), name: name || R.name, role: role, avatar: { glow: R.glow, icon: R.icon }, history: [{ who: "bot", text: R.hello, t: Date.now() }], state: {} }; }
  function ensureDefaults() { if (!bots.length) { bots = ORDER.map(function (r) { return newBot(r); }); activeId = bots[0].id; bots.forEach(persist); } }

  function renderTabs() {
    tabsEl.innerHTML = "";
    bots.forEach(function (b) {
      var t = el("button", "dsb-tab" + (b.id === activeId ? " on" : "")); t.style.setProperty("--g", glow(b)); t.setAttribute("data-bot", b.id);
      var mini = el("span", "mini"); t.appendChild(mini); orbInto(mini, b, 22);
      t.appendChild(el("span", "n", (b.avatar && b.avatar.icon || "") + " " + b.name));
      t.onclick = function () { activeId = b.id; saveLocal(); render(); };
      tabsEl.appendChild(t);
    });
    var add = el("button", "dsb-add", "＋"); add.title = "新增機器人"; add.setAttribute("aria-label", "新增機器人"); add.onclick = addBot; tabsEl.appendChild(add);
    var on = tabsEl.querySelector(".on"); if (on && on.scrollIntoView) try { on.scrollIntoView({ inline: "nearest", block: "nearest" }); } catch (e) {}
  }
  function renderHero() {
    var b = active(), R = ROLES[b.role] || ROLES.general; heroEl.innerHTML = ""; root.style.setProperty("--g", glow(b));
    var av = el("div", "dsb-av"); av.style.setProperty("--g", glow(b)); var host = el("span"); av.appendChild(host); av.appendChild(el("span", "dots", "•••")); av.appendChild(el("span", "acc", (b.avatar && b.avatar.icon) || R.icon));
    heroEl.appendChild(av); heroOrb = orbInto(host, b, 76);
    var meta = el("div", "dsb-meta"); meta.appendChild(el("b", null, b.name)); meta.appendChild(el("small", null, R.icon + " " + R.label)); heroEl.appendChild(meta);
    var sel = el("select", "dsb-menu"); sel.setAttribute("aria-label", "機器人設定");
    [["", "⋯ 設定"], ["rename", "✏️ 改名"], ["role", "🔁 換角色"], ["clear", "🧹 清除對話"], ["delete", "🗑️ 刪除機器人"]].forEach(function (o) { var op = el("option", null, o[1]); op.value = o[0]; sel.appendChild(op); });
    sel.onchange = function () { var v = sel.value; sel.value = ""; menu(b, v); }; heroEl.appendChild(sel);
    if (busy[b.id]) setMood("thinking");
  }
  function quick(b) {
    quickEl.innerHTML = "";
    var Q = { quiz: ["出一題", "出一題 行政處分", "出一題 憲法"], notes: ["整理 第一章 重點", "整理 行政訴訟 重點"], book: ["這本書第一章講什麼？"], appmgr: ["幫我做一個新的番茄鐘 App 頁面", "列出你能修改的範圍"], general: [] }[b.role] || [];
    Q.forEach(function (q) { var x = el("button", null, q); x.onclick = function () { send(q); }; quickEl.appendChild(x); });
    quickEl.style.display = Q.length ? "flex" : "none";
  }
  function msgNode(b, m, idx) {
    var n = el("div", "dsb-m " + (m.who === "user" ? "user" : "bot") + (m.err ? " err" : "")); n.appendChild(d.createTextNode(m.text || ""));
    if (m.cites && m.cites.length) n.appendChild(el("div", "dsb-cite", "依據：" + m.cites.slice(0, 5).map(function (c) { return "《" + c.title + "》p." + c.page; }).join("、")));
    var acts = el("div", "dsb-acts");
    if (m.who === "bot" && m.note && b.role === "notes") {
      var sv = el("button", null, m.noteSaved ? "✅ 已存成筆記" : "💾 存成電子書筆記"); sv.disabled = !!m.noteSaved;
      sv.onclick = async function () { sv.disabled = true; try { var E = await ebookLib(); if (!E || !E.addNote) throw new Error("讀不到電子書筆記庫"); await E.addNote(m.note.bid, m.note.page, "【" + b.name + "整理】" + m.text); m.noteSaved = true; persist(b); sv.textContent = "✅ 已存到《" + m.note.title + "》p." + m.note.page; } catch (e) { sv.disabled = false; alert("儲存失敗：" + (e.message || e)); } };
      acts.appendChild(sv);
    }
    if (m.who === "bot" && m.proposal) n.appendChild(proposalNode(b, m));
    if (acts.childNodes.length) n.appendChild(acts);
    return n;
  }
  function proposalNode(b, m) {
    var p = m.proposal, box = el("div", "dsb-prop");
    box.appendChild(el("b", null, "🛠️ 修改提案：" + p.title)); box.appendChild(el("div", null, p.description));
    box.appendChild(el("div", "dsb-cite", "檔案：" + p.files.map(function (f) { return f.path + (f.content != null ? "（新增／覆寫）" : "（" + f.edits.length + " 處修改）"); }).join("、")));
    var pre = el("pre", null, "（產生差異中…）"); box.appendChild(pre);
    var st = el("div", "dsb-cite"); box.appendChild(st);
    var acts = el("div", "dsb-acts"); box.appendChild(acts);
    var diffText = "";
    buildDiff(p).then(function (r) {
      diffText = r.diff; pre.innerHTML = "";
      r.diff.split("\n").slice(0, 400).forEach(function (line) { var s = el("span", line[0] === "+" && line[1] !== "+" ? "a" : line[0] === "-" && line[1] !== "-" ? "r" : null, line + "\n"); pre.appendChild(s); });
      if (r.errors.length) { st.textContent = "⚠️ " + r.errors.join("；"); p.invalid = true; }
    });
    var cp = el("button", null, "📋 複製提案"); cp.onclick = function () { var t = JSON.stringify(p, null, 2); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { cp.textContent = "✅ 已複製"; }, function () { download("aivault-proposal.json", t, "application/json"); }); };
    var ex = el("button", null, "⬇️ 匯出 diff"); ex.onclick = function () { download("aivault-proposal.patch", "# " + p.title + "\n# " + p.description.replace(/\n/g, "\n# ") + "\n\n" + diffText); };
    var ap = el("button", "ok", p.pr_url ? "✅ 已開 PR" : "✅ 核准並開 PR"); ap.disabled = true;
    acts.appendChild(cp); acts.appendChild(ex); acts.appendChild(ap);
    if (p.pr_url) { var a = el("a", null, "查看 PR ↗"); a.href = p.pr_url; a.target = "_blank"; a.rel = "noopener"; a.style.color = "#7ee787"; st.appendChild(a); return box; }
    bridgeStatus().then(function (s) {
      if (s && s.is_owner && s.token_configured) { ap.disabled = false; st.textContent = "只有你（擁有者）能核准；核准後會開 PR，不會自動合併。"; }
      else if (s && s.is_owner) st.textContent = "伺服器還沒設定 GitHub token（AIVAULT_PR_GITHUB_TOKEN），目前只能複製／匯出提案。";
      else if (s && s.logged_in && !s.owner_configured) st.textContent = "伺服器還沒設定擁有者，只能複製／匯出。你的使用者 ID：" + s.user_id;
      else st.textContent = s && s.logged_in ? "只有 AIVAULT 擁有者帳號能核准；你可以複製／匯出提案。" : "登入擁有者帳號後才能核准；目前可複製／匯出。";
    });
    ap.onclick = async function () {
      if (p.invalid) { alert("提案有無法套用的修改，請請管家修正後再核准。"); return; }
      if (!confirm("確定要核准「" + p.title + "」並在 GitHub 開一個 Pull Request？\n（不會自動合併，你仍需在 GitHub 審閱後手動合併）")) return;
      ap.disabled = true; ap.textContent = "⏳ 開 PR 中…";
      try { var r = await approve(b, m); p.pr_url = r.pr_url; p.status = "pr_opened"; persist(b); ap.textContent = "✅ 已開 PR"; st.textContent = ""; var a = el("a", null, "PR #" + r.pr_number + " ↗"); a.href = r.pr_url; a.target = "_blank"; a.rel = "noopener"; a.style.color = "#7ee787"; st.appendChild(a); }
      catch (e) { ap.disabled = false; ap.textContent = "✅ 核准並開 PR"; st.textContent = "⚠️ " + (e.message || e); }
    };
    return box;
  }
  function renderMsgs() { var b = active(); msgsEl.innerHTML = ""; (b.history || []).forEach(function (m, i) { msgsEl.appendChild(msgNode(b, m, i)); }); msgsEl.scrollTop = msgsEl.scrollHeight; }
  function render() { renderTabs(); renderHero(); quick(active()); renderMsgs(); setSync(); inputEl.placeholder = "傳訊息給 " + active().name + "…"; }

  function pickRole(cur) {
    var s = ORDER.map(function (r, i) { return (i + 1) + ". " + ROLES[r].icon + " " + ROLES[r].label; }).join("\n");
    var v = prompt("選擇角色（輸入數字）：\n" + s, String(ORDER.indexOf(cur || "general") + 1)); if (v == null) return null;
    var r = ORDER[Number(v) - 1]; if (!r) { alert("請輸入 1–5"); return null; } return r;
  }
  function addBot() {
    var role = pickRole("general"); if (!role) return;
    var name = (prompt("機器人名字：", ROLES[role].name) || "").trim(); if (!name) return;
    var b = newBot(role, name.slice(0, 20)); bots.push(b); activeId = b.id; persist(b); render();
  }
  function menu(b, v) {
    if (v === "rename") { var n = (prompt("新名字：", b.name) || "").trim(); if (n) { b.name = n.slice(0, 20); persist(b); render(); } }
    else if (v === "role") { var r = pickRole(b.role); if (r && r !== b.role) { b.role = r; b.avatar = { glow: ROLES[r].glow, icon: ROLES[r].icon }; b.state = {}; b.history.push({ who: "bot", text: ROLES[r].hello, t: Date.now() }); persist(b); render(); } }
    else if (v === "clear") { if (confirm("清除「" + b.name + "」的所有對話？")) { b.history = [{ who: "bot", text: (ROLES[b.role] || ROLES.general).hello, t: Date.now() }]; b.state = {}; persist(b); render(); } }
    else if (v === "delete") {
      if (!confirm("刪除機器人「" + b.name + "」和它的對話？")) return;
      clearTimeout(saveTimers[b.id]); b.deleted = true; bots = bots.filter(function (x) { return x !== b; }); removeRemote(b.id); if (!bots.length) ensureDefaults(); activeId = bots[0].id; saveLocal(); render();
    }
  }
  async function send(text) {
    var b = active(); text = String(text || "").trim(); if (!text || busy[b.id]) return;
    b.history.push({ who: "user", text: text, t: Date.now() }); persist(b); renderMsgs();
    var O = w.DarkStarOrb, cmd = O && O.detectCommand ? O.detectCommand(text) : null;
    if (cmd) { showExpr(cmd, 5000); if (text.replace(/[\s，。！？!?]/g, "").length <= 4 || /表情|臉|脸/.test(text)) { b.history.push({ who: "bot", text: exprReply(cmd), t: Date.now(), expr: cmd }); persist(b); renderMsgs(); return; } }
    busy[b.id] = true; setMood("thinking");
    var thinking = el("div", "dsb-m bot", "💭 " + b.name + " 思考中…"); msgsEl.appendChild(thinking); msgsEl.scrollTop = msgsEl.scrollHeight;
    var res;
    function cleanRes(r) { if (r && r.text && w.DarkStarOrb && w.DarkStarOrb.exprFromTag) { var tx = w.DarkStarOrb.exprFromTag(r.text); if (tx) r.expr = tx; r.text = w.DarkStarOrb.stripTags(r.text); } return r; }
    try { res = cleanRes(await (handlers[b.role] || handlers.general)(b, text)); }
    catch (e) { var m = String(e && e.message || e); res = { text: "⚠️ " + (/Failed to fetch|NetworkError|Load failed/.test(m) ? "網路連線失敗，請稍後再試。" : /TimeoutError|timed? ?out/i.test(m) ? "AI 回應逾時，請再試一次。" : "AI 暫時無法回應（" + m.slice(0, 120) + "）"), err: true }; }
    busy[b.id] = false;
    var msg = { who: "bot", text: res.text, t: Date.now() }; if (res.cites && res.cites.length) msg.cites = res.cites; if (res.note) msg.note = res.note; if (res.proposal) msg.proposal = res.proposal; if (res.err) msg.err = true; if (res.expr) msg.expr = res.expr;
    b.history.push(msg); if (b.history.length > MAXH) b.history = b.history.slice(-MAXH); persist(b);
    if (b.id !== activeId) return;
    thinking.remove(); renderMsgs();
    if (res.err) { setMood("idle"); if (heroOrb) heroOrb.setExpression("sad", 2500); return; }
    await talk(Math.min(2400, 500 + res.text.length * 12));
    if (!res.expr && w.DarkStarOrb && w.DarkStarOrb.moodOf) res.expr = w.DarkStarOrb.moodOf(res.text);
    if (res.expr) { showExpr(res.expr, 4500); return; }
    setMood("happy"); setTimeout(function () { if (!busy[b.id] && Date.now() > holdExprUntil) setMood("idle"); }, 1100);
  }

  function build() {
    css();
    root = el("div"); root.id = "dsb-root"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "暗星機器人工作區");
    var top = el("div", "dsb-top"); var x = el("button", "dsb-close", "✕"); x.setAttribute("aria-label", "關閉"); x.onclick = close; top.appendChild(x);
    tabsEl = el("div", "dsb-tabs"); top.appendChild(tabsEl); root.appendChild(top);
    heroEl = el("div", "dsb-hero"); root.appendChild(heroEl);
    syncEl = el("div", "dsb-sync"); root.appendChild(syncEl);
    msgsEl = el("div", "dsb-msgs"); root.appendChild(msgsEl);
    quickEl = el("div", "dsb-quick"); root.appendChild(quickEl);
    var inp = el("div", "dsb-in"); inputEl = el("textarea"); inputEl.rows = 1; var go = el("button", null, "送出");
    go.onclick = function () { var v = inputEl.value; inputEl.value = ""; send(v); };
    inputEl.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); go.click(); } });
    inp.appendChild(inputEl); inp.appendChild(go); root.appendChild(inp);
    d.body.appendChild(root);
  }
  var built = false;
  function open() {
    if (!built) { build(); built = true; loadLocal(); ensureDefaults(); render(); loadRemote().then(function () { ensureDefaults(); render(); }); }
    root.classList.add("open"); d.documentElement.style.overflow = "hidden";
  }
  function close() { if (root) root.classList.remove("open"); d.documentElement.style.overflow = ""; }
  // 白色按鈕＋會眨眼、做表情的暗星小臉；放在頁首（與「我的聲音／返回 Home」同列），不會蓋住聊天訊息
  var launchBtn = null, launchOrb = null;
  function placeLauncher() {
    var b = launchBtn; if (!b) return;
    var bar = d.querySelector("header.topbar"), mv = d.getElementById("darkStarMyVoiceButton");
    if (mv && mv.parentNode) { if (b.nextSibling !== mv) mv.parentNode.insertBefore(b, mv); b.classList.remove("float"); }
    else if (bar) { if (b.parentNode !== bar) bar.appendChild(b); b.classList.remove("float"); }
    else { if (b.parentNode !== d.body) d.body.appendChild(b); b.classList.add("float"); }
  }
  function launcher() {
    if (d.getElementById("dsb-launch")) return; css();
    if (d.querySelector(".composer-row")) return; // 有聊天輸入列的頁面：入口改在輸入列的白色「笑臉＋」按鈕（darkstar-chat-orbs.js）
    var b = el("button"); b.id = "dsb-launch"; b.type = "button"; b.setAttribute("aria-label", "開啟暗星機器人工作區");
    var face = el("span"); b.appendChild(face); b.appendChild(el("span", "lbl", "機器人")); b.title = "暗星機器人";
    b.onclick = open; launchBtn = b; placeLauncher();
    if (w.DarkStarOrb) { launchOrb = w.DarkStarOrb.mount(face, { size: 24 }); w.__dsLaunchOrb = launchOrb; }
    d.addEventListener("darkstar:expr", function (e) { if (launchOrb && e.detail) launchOrb.setExpression(e.detail.expr, e.detail.ms); });
    var n = 0, t = setInterval(function () { placeLauncher(); if (++n > 20) clearInterval(t); }, 500); // 「我的聲音」按鈕較晚才插入
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", launcher); else launcher();
  w.AIVAULTBots = { open: open, close: close, send: send, bots: function () { return bots; }, active: active, select: function (id) { activeId = id; render(); }, parseProposal: parseProposal, lineDiff: lineDiff, _status: bridgeStatus };
})(window, document);

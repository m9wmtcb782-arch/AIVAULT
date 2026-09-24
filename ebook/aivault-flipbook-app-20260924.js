(function () {
  "use strict";
  const E = window.AIVAULTEbook;
  const $ = function (id) { return document.getElementById(id); };
  const state = {
    view: "shelf",
    tab: "mine",
    category: "",
    bookId: null,
    remoteId: null,
    source: "remote",
    book: null,
    pages: [],
    toc: [],
    pageNumber: 1,
    totalPages: 1,
    mode: "auto",
    scale: 1,
    fit: "page",
    flipping: false,
    cache: new Map(),
    context: null
  };

  function unwrapIngest(result) {
    if (!result) return {};
    const body = result.data || {};
    if (body && body.data && typeof body.data === "object") return body.data;
    return body;
  }

  function isWide() { return innerWidth > 820 && state.mode !== "single"; }
  function useSpread() {
    if (state.mode === "single") return false;
    if (state.mode === "double") return true;
    return isWide();
  }
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 2200);
  }
  function qs() { return new URLSearchParams(location.search); }
  function setQS(bookId, page, view) {
    const u = new URL(location.href);
    if (bookId) u.searchParams.set("ebook_id", bookId);
    else u.searchParams.delete("ebook_id");
    if (page) u.searchParams.set("page", String(page));
    if (view) u.searchParams.set("view", view);
    history.replaceState(null, "", u);
  }

  function showShelf() {
    state.view = "shelf";
    $("shelfView").hidden = false;
    $("readerView").hidden = true;
    closeDrawer();
    setQS(state.bookId, state.pageNumber, "shelf");
    renderShelf();
  }
  function showReader() {
    state.view = "read";
    $("shelfView").hidden = true;
    $("readerView").hidden = false;
    applyModeClass();
  }

  function applyModeClass() {
    $("flipBook").classList.toggle("single", !useSpread());
  }

  function cardHtml(b) {
    const id = b.id || b.ebook_id;
    const title = b.title || "未命名";
    const author = b.author || "—";
    const pages = b.page_count || b.total_pages || 0;
    const prog = b.progress || 0;
    const last = b.last_read_at ? new Date(b.last_read_at).toLocaleString() : "尚未閱讀";
    const coverSrc = b.cover_url || (E.makeCover ? E.makeCover(title, author) : "");
    const cover = coverSrc
      ? '<img class="cover" alt="" src="' + E.esc(coverSrc) + '">'
      : '<div class="cover-ph">' + E.esc(title) + "</div>";
    return (
      '<article class="card" data-open="' + E.esc(id) + '" data-url="' + E.esc(b.special_url || "") + '" data-src="' + E.esc(b.source || (b.remote_id ? "remote" : "local")) + '">' +
      cover +
      '<div class="cinfo"><h3>' + E.esc(title) + "</h3>" +
      "<p>作者：" + E.esc(author) + "</p>" +
      "<p>" + (pages ? (pages + " 頁") : "頁數未定") + "</p>" +
      '<div class="prog"><i style="width:' + Math.round((prog || 0) * 100) + '%"></i></div>' +
      "<p>閱讀進度 " + Math.round((prog || 0) * 100) + "%</p>" +
      "<p>" + E.esc(last) + "</p>" +
      "<p>" + (E.isFav(id) ? "⭐ 已收藏" : "") + "</p></div></article>"
    );
  }

  async function collectBooks() {
    const local = await E.allLocalBooks();
    let remoteRows = E.catalog();
    try {
      const live = await E.fetchRemoteCatalog(80);
      const liveData = unwrapIngest(live);
      const ebooks = Array.isArray(liveData.ebooks) ? liveData.ebooks
        : (Array.isArray(liveData.items) ? liveData.items : []);
      if (live && live.ok && ebooks.length) {
        remoteRows = ebooks.map(function (r) {
          return {
            ebook_id: r.id || r.ebook_id,
            title: r.title,
            author: r.author,
            page_count: r.total_pages || r.page_count || 0,
            cover_url: r.cover_url || "",
            edition: r.edition || "",
            source: "remote",
            saved_at: r.updated_at || r.created_at
          };
        }).filter(function (r) {
          return r.ebook_id && Number(r.page_count || 0) > 0 &&
            String(r.title || "").indexOf("AIVAULT FlipBook Probe") < 0 &&
            String(r.title || "").indexOf("「當行政遇上科學") !== 0;
        });
        E.catalog().forEach(function (r) {
          if (remoteRows.some(function (x) { return x.ebook_id === r.ebook_id; })) return;
          if (r.ebook_id === "1d8ce1b4-6f6b-4075-8e99-f5da89c680cd") return;
          remoteRows.push(r);
        });
      }
    } catch (e) {
      console.warn("[AIVAULT FlipBook] live catalog failed; using local catalog", e);
    }

    const map = new Map();
    local.forEach(function (b) { map.set(b.id, Object.assign({ source: "local" }, b)); });
    remoteRows.forEach(function (r) {
      if (!r.ebook_id) return;
      map.set(r.ebook_id, {
        id: r.ebook_id,
        ebook_id: r.ebook_id,
        title: r.title || "未命名",
        author: r.author || "—",
        page_count: r.page_count || r.total_pages || 0,
        total_pages: r.total_pages || r.page_count || 0,
        cover_url: r.cover_url || "",
        edition: r.edition || "",
        source: "remote",
        category: r.category || "法律",
        created_at: r.saved_at || r.created_at || "",
        remote_id: r.ebook_id
      });
    });

    if (!map.has(E.DEFAULT_REMOTE)) {
      map.set(E.DEFAULT_REMOTE, {
        id: E.DEFAULT_REMOTE,
        ebook_id: E.DEFAULT_REMOTE,
        title: "AIVAULT 電子法律教材使用說明",
        author: "AIVAULT",
        page_count: 0,
        source: "guide",
        special_url: "aivault-user-guide.html",
        created_at: "2026-09-23T07:04:00+08:00"
      });
    }

    const constitutionId = "8ea77ade-e709-468d-bbea-95e0df53e823";
    // 憲法已建立為真正的遠端電子書資料列；離線/列表失敗時只保留這個
    // 真實 UUID 的 fallback，避免舊的虛構 ID 導致「有書名、沒內容」。
    if (!map.has(constitutionId)) {
      map.set(constitutionId, {
        id: constitutionId,
        ebook_id: constitutionId,
        title: "中華人民共和國憲法｜2018年修正本｜繁體電子書",
        author: "AIVAULT 法律教材",
        page_count: 143,
        total_pages: 143,
        source: "remote",
        remote_id: constitutionId,
        category: "法律",
        created_at: "2026-09-24T00:00:00+08:00"
      });
    }

    const progressRows = {};
    try {
      const allP = await E.openDb().then(function (db) {
        return new Promise(function (resolve, reject) {
          const req = db.transaction("progress").objectStore("progress").getAll();
          req.onsuccess = function () { resolve(req.result || []); };
          req.onerror = function () { reject(req.error); };
        });
      });
      allP.forEach(function (p) { progressRows[p.book_id] = p; });
    } catch (e) {}

    const out = [];
    map.forEach(function (b) {
      const p = progressRows[b.id];
      if (p) {
        b.progress = p.progress;
        b.last_read_at = p.last_read_at;
        b.current_page = p.current_page;
      }
      out.push(b);
    });

    // 固定保護：憲法是既有正式遠端電子書，無論 live catalog 短暫失敗或舊快取，
    // 書架都必須保留同一個真實 UUID，不得因列表異常而消失。
    const constitution = map.get(constitutionId);
    if (constitution) {
      const idx = out.findIndex(function (b) { return b.id === constitutionId; });
      if (idx >= 0) out.splice(idx, 1);
      out.unshift(constitution);
    }
    return out;
  }

  async function renderShelf() {
    const q = ($("shelfQ").value || "").trim().toLowerCase();
    let books = await collectBooks();
    const tab = state.tab;
    if (tab === "fav") books = books.filter(function (b) { return E.isFav(b.id); });
    if (tab === "recent") {
      books = books.filter(function (b) { return b.last_read_at; })
        .sort(function (a, b) { return String(b.last_read_at).localeCompare(String(a.last_read_at)); });
    }
    if (tab === "new") {
      books = books.slice().sort(function (a, b) { return String(b.created_at || "").localeCompare(String(a.created_at || "")); });
    }
    if (tab === "cats") {
      $("catBar").hidden = false;
      const cats = E.categories();
      $("catBar").innerHTML = cats.map(function (c) {
        return '<button data-cat="' + E.esc(c) + '" class="' + (state.category === c ? "on" : "") + '">' + E.esc(c) + "</button>";
      }).join("");
      $("catBar").querySelectorAll("[data-cat]").forEach(function (btn) {
        btn.onclick = function () {
          state.category = btn.getAttribute("data-cat");
          renderShelf();
        };
      });
      if (state.category) books = books.filter(function (b) { return (b.category || "未分類") === state.category; });
    } else {
      $("catBar").hidden = true;
    }
    if (q) {
      books = books.filter(function (b) {
        return (b.title || "").toLowerCase().indexOf(q) >= 0 || (b.author || "").toLowerCase().indexOf(q) >= 0;
      });
    }
    if (!books.length) {
      $("shelfGrid").innerHTML = '<p class="muted">書架尚無符合條件的書。請匯入 PDF / Word / PPT / Excel / 圖片 / TXT，或開啟既有遠端教材。</p>';
      return;
    }
    $("shelfGrid").innerHTML = books.map(cardHtml).join("");
    $("shelfGrid").querySelectorAll("[data-open]").forEach(function (el) {
      el.onclick = function () {
        const url = el.getAttribute("data-url");
        if (url) { location.href = url; return; }
        openBook(el.getAttribute("data-open"));
      };
    });
  }

  function paintPaper(el, page, n) {
    if (!page) {
      el.innerHTML = "<h3>【教材原文】</h3><p>此頁無內容。</p>";
      return;
    }
    const bits = [page.chapter, page.section, page.title].filter(Boolean).join("　");
    let body = "";
    if (page.image) {
      body += '<img alt="第' + n + '頁" src="' + page.image + '">';
      if (page.content) body += '<p style="font-size:13px;color:#5c5143;margin-top:10px">' + E.esc(page.content).replace(/\n/g, "<br>") + "</p>";
    } else if (page.html) {
      body += page.html;
    } else {
      body += "<div>" + E.esc(page.content || "").replace(/\n/g, "<br>") + "</div>";
    }
    el.innerHTML = "<h3>【教材原文】" + (bits ? ("　" + E.esc(bits)) : "") + "</h3>" + body;
  }

  function currentPair() {
    if (!useSpread()) return [state.pageNumber, null];
    const left = state.pageNumber % 2 === 0 ? state.pageNumber - 1 : state.pageNumber;
    return [Math.max(1, left), left + 1];
  }

  function renderSpread() {
    applyModeClass();
    const pair = currentPair();
    const a = pair[0], b = pair[1];
    const pa = state.cache.get(a);
    const pb = b ? state.cache.get(b) : null;
    paintPaper($("paperLeft"), pa, a);
    $("noLeft").textContent = a;
    if (useSpread()) {
      paintPaper($("paperRight"), pb, b);
      $("noRight").textContent = b && b <= state.totalPages ? b : "";
      if (!b || b > state.totalPages) $("paperRight").innerHTML = "";
    } else {
      paintPaper($("paperRight"), pa, a);
      $("noRight").textContent = a;
    }
    $("pageLabel").textContent = "第 " + state.pageNumber + " / " + state.totalPages + " 頁";
    $("jumpRange").max = String(state.totalPages || 1);
    $("jumpRange").value = String(state.pageNumber);
    $("readerTitle").textContent = (state.book && (state.book.title || state.book.book_title)) || "電子書";
    $("readerAuthor").textContent = "作者：" + ((state.book && state.book.author) || "—");
  }

  async function getPage(n) {
    if (!n || n < 1) return null;
    if (state.cache.has(n)) return state.cache.get(n);
    if (state.source === "local") {
      const found = state.pages.find(function (p) { return p.page_number === n; });
      if (found) { state.cache.set(n, found); return found; }
      return null;
    }
    const ebookId = state.remoteId || state.bookId;
    let result;
    try {
      result = await E.fetchRemoteBook(ebookId, n);
    } catch (e) {
      console.error("[AIVAULT FlipBook] fetch page failed", e);
      return null;
    }
    if (!result || !result.ok) return null;
    const resultData = unwrapIngest(result);
    const ebook = resultData.ebook || resultData.book;
    const page = resultData.page || (resultData.pages && resultData.pages[0]);
    if (ebook) {
      state.book = Object.assign({}, state.book || {}, ebook);
      const t = Number(E.pick(ebook, ["total_pages", "page_count", "pages"]) || 0);
      if (t) state.totalPages = t;
    }
    if (page) {
      const num = Number(E.pick(page, ["page_number", "page", "n"]) || n);
      const norm = {
        page_number: num,
        content: E.pageContent(page),
        chapter: page.chapter || "",
        section: page.section || "",
        title: page.title || "",
        kind: "text"
      };
      state.cache.set(num, norm);
      return norm;
    }
    return null;
  }

  async function loadAllRemotePages() {
    const max = Math.min(state.totalPages || 1, 200);
    const out = [];
    for (let n = 1; n <= max; n++) {
      const p = await getPage(n);
      if (p) out.push(p);
    }
    state.pages = out;
    if (!state.toc.length) state.toc = E.inferTocFromText(out);
    return out;
  }

  async function persistProgress() {
    const id = state.bookId;
    await E.saveLocalProgress(id, state.pageNumber, state.totalPages);
    if (state.source === "remote" || state.remoteId) {
      try { await E.saveRemoteProgress(state.remoteId || id, state.pageNumber, state.totalPages); } catch (e) {}
    }
    if (state.book) {
      state.book.last_read_at = new Date().toISOString();
      if (state.source === "local") {
        try { await E.saveBook(Object.assign({}, state.book, { last_read_at: state.book.last_read_at })); } catch (e) {}
      }
    }
  }

  async function goPage(n, animate, dir) {
    if (!state.bookId || state.flipping) return;
    n = Math.max(1, Math.min(state.totalPages || 1, Number(n) || 1));
    if (n === state.pageNumber && !animate) {
      renderSpread();
      return;
    }
    const nextTargets = [n - 1, n, n + 1, n + 2].filter(function (x) { return x > 0; });
    await Promise.all(nextTargets.map(getPage));
    if (animate && dir) {
      await runFlip(dir, n);
    } else {
      state.pageNumber = n;
      renderSpread();
    }
    setQS(state.bookId, state.pageNumber, "read");
    persistProgress();
    if (state.source === "remote" || state.remoteId) {
      E.fetchRemoteContext(state.remoteId || state.bookId, state.pageNumber, 1).then(function (r) {
        if (r.ok) state.context = r.data;
      });
    }
  }

  function snapshotLeaf(fromId) {
    const src = $(fromId);
    const wrap = document.createElement("div");
    wrap.className = "paper";
    wrap.innerHTML = src.innerHTML;
    wrap.style.height = "100%";
    wrap.style.overflow = "hidden";
    wrap.style.padding = "18px 20px";
    wrap.style.background = "#f4efe6";
    wrap.style.color = "#1b1612";
    return wrap;
  }

  function runFlip(dir, targetPage) {
    return new Promise(function (resolve) {
      const flipper = $("flipper");
      const front = $("flipFront");
      const back = $("flipBack");
      front.innerHTML = "";
      back.innerHTML = "";
      if (dir === "next") {
        front.appendChild(snapshotLeaf(useSpread() ? "paperRight" : "paperRight"));
      } else {
        front.appendChild(snapshotLeaf("paperRight"));
      }
      state.pageNumber = targetPage;
      renderSpread();
      back.appendChild(snapshotLeaf(useSpread() ? "paperLeft" : "paperRight"));
      flipper.hidden = false;
      flipper.classList.remove("turning-next", "turning-prev");
      void flipper.offsetWidth;
      state.flipping = true;
      flipper.classList.add(dir === "next" ? "turning-next" : "turning-prev");
      const done = function () {
        flipper.hidden = true;
        flipper.classList.remove("turning-next", "turning-prev");
        state.flipping = false;
        resolve();
      };
      flipper.addEventListener("animationend", done, { once: true });
      setTimeout(done, 650);
    });
  }

  async function openBook(id) {
    if (!id) {
      toast("缺少電子書 ID");
      return;
    }
    state.bookId = id;
    state.cache.clear();
    state.pages = [];
    state.toc = [];
    state.context = null;
    // 先切入閱讀模式，再載入資料；避免遠端請求失敗時整個閱讀器永遠不出現。
    showReader();
    setQS(id, Number(qs().get("page") || 1), "read");
    try {
      const local = await E.getBook(id);
      if (local) {
        const localPages = await E.pagesOf(id);
        // 遠端教材若只有書籍殼、沒有實際頁面，不能把它當成完整 local 書；
        // 否則會跳過 Supabase 遠端內容，造成「有書名、沒內容」。
        if (localPages && localPages.length > 0) {
          state.source = "local";
          state.book = local;
          state.remoteId = local.remote_id || null;
          state.pages = localPages;
          state.totalPages = local.page_count || state.pages.length || 1;
          state.pages.forEach(function (p) { state.cache.set(p.page_number, p); });
          state.toc = E.inferTocFromText(state.pages);
        } else {
          state.source = "remote";
          state.remoteId = local.remote_id || id;
          const first = await E.fetchRemoteBook(state.remoteId, 1);
          const data = unwrapIngest(first);
          const ebook = data.ebook || data.book || {};
          state.book = Object.assign({}, local || {}, ebook);
          state.totalPages = Number(ebook.total_pages || ebook.page_count || local.page_count || 1);
          if (first && first.ok) {
            await getPage(1);
            try { state.toc = await E.fetchRemoteToc(state.remoteId); } catch (e) { state.toc = []; }
          } else {
            toast("遠端教材資料載入失敗（HTTP " + ((first && first.status) || "network") + "）");
          }
        }
      } else {
        state.source = "remote";
        state.remoteId = id;
        const first = await E.fetchRemoteBook(id, 1);
        const data = unwrapIngest(first);
        const ebook = data.ebook || data.book || {};
        if (ebook && typeof ebook === "object") {
          state.book = Object.assign({}, state.book || {}, ebook);
          state.totalPages = Number(ebook.total_pages || ebook.page_count || ebook.pages || state.totalPages || 1);
        }
        if (!first || !first.ok) {
          toast("遠端教材資料載入失敗，先保留閱讀器畫面（HTTP " + ((first && first.status) || "network") + "）");
        } else {
          await getPage(1);
          try { state.toc = await E.fetchRemoteToc(id); } catch (e) { state.toc = []; }
          E.rememberRemote({
            ebook_id: id,
            title: state.book && state.book.title,
            author: state.book && state.book.author,
            page_count: state.totalPages,
            cover_url: state.book && state.book.cover_url
          });
        }
      }
    } catch (e) {
      console.error("[AIVAULT FlipBook] openBook failed", e);
      toast("電子書載入失敗：" + (e && e.message ? e.message : "network error"));
      renderSpread();
      return;
    }
    let start = Number(qs().get("page") || 0);
    if (!start) {
      const lp = await E.loadLocalProgress(id);
      if (lp && lp.current_page) start = lp.current_page;
      else if (state.source === "remote") {
        try {
          const rp = await E.loadRemoteProgress(id);
          const n = Number((rp && (rp.page_number || rp.page)) || 0);
          if (n) start = n;
        } catch (e) {}
      }
    }
    if (!start) start = 1;
    showReader();
    await goPage(start, false);
    if (start > 1) toast("繼續閱讀第 " + start + " 頁");

    // 遠端電子書若沒有後端 TOC，背景建立完整章節目錄；
    // 不阻塞閱讀器首次開啟，也不改動既有閱讀頁面。
    if (state.source === "remote" && !state.toc.length) {
      loadAllRemotePages().then(function (pages) {
        const inferred = E.inferTocFromText(pages || []);
        if (inferred.length) {
          state.toc = inferred;
          if (state.view === "read") toast("已建立完整章節目錄");
        }
      }).catch(function (e) {
        console.warn("[AIVAULT FlipBook] TOC build failed", e);
      });
    }
  }

  function closeDrawer() {
    $("drawer").classList.remove("open", "right");
    $("mask").hidden = true;
  }
  function openDrawer(title, html, side) {
    $("drawerTitle").textContent = title;
    $("drawerBody").innerHTML = html;
    $("drawer").classList.add("open");
    $("drawer").classList.toggle("right", side === "right");
    $("mask").hidden = false;
  }

  function renderTocPanel() {
    const list = state.toc || [];
    const html = list.length
      ? list.map(function (item) {
          const title = E.pick(item, ["title", "label", "name", "heading", "text"]) || "未命名";
          const page = E.pick(item, ["page_number", "page", "target_page"]);
          return '<button class="tocbtn" data-page="' + E.esc(page || "") + '">' + E.esc(title) + (page ? (" · p." + page) : "") + "</button>";
        }).join("")
      : "<p class='muted'>尚無目錄。開啟後會依章節標題自動建立。</p>";
    openDrawer("☰ 目錄", html);
    $("drawerBody").querySelectorAll("[data-page]").forEach(function (btn) {
      btn.onclick = function () {
        const n = Number(btn.getAttribute("data-page"));
        if (n) goPage(n, true, n > state.pageNumber ? "next" : "prev");
        closeDrawer();
      };
    });
  }

  async function renderBookmarkPanel() {
    const rows = await E.bookmarksOf(state.bookId);
    const html =
      '<button class="ib" id="addBm">🔖 加入書籤（第 ' + state.pageNumber + " 頁）</button>" +
      (rows.length ? rows.map(function (r) {
        return '<button class="tocbtn" data-page="' + r.page_number + '" data-id="' + r.id + '">' + E.esc(r.title) + "</button>";
      }).join("") : "<p class='muted'>尚無書籤</p>");
    openDrawer("🔖 書籤", html);
    $("addBm").onclick = async function () {
      const page = state.cache.get(state.pageNumber);
      const title = "第 " + state.pageNumber + " 頁" + (page && page.title ? "　" + page.title : "");
      await E.addBookmark(state.bookId, state.pageNumber, title);
      toast("已加入書籤");
      renderBookmarkPanel();
    };
    $("drawerBody").querySelectorAll("[data-page]").forEach(function (btn) {
      btn.onclick = function () {
        goPage(Number(btn.getAttribute("data-page")));
        closeDrawer();
      };
    });
  }

  async function renderNotePanel() {
    const rows = await E.notesOf(state.bookId);
    const mine = rows.filter(function (r) { return r.page_number === state.pageNumber; });
    const html =
      '<form class="noteform" id="noteForm"><textarea id="noteText" placeholder="這一頁的筆記"></textarea><button class="ib" type="submit">📝 新增筆記</button></form>' +
      "<h4>本頁筆記</h4>" +
      (mine.length ? mine.map(function (r) { return '<div class="note">' + E.esc(r.note) + "<br><small>" + E.esc(r.created_at) + "</small></div>"; }).join("") : "<p class='muted'>本頁尚無筆記</p>") +
      "<h4>全部筆記</h4>" +
      (rows.length ? rows.map(function (r) {
        return '<button class="tocbtn" data-page="' + r.page_number + '">第 ' + r.page_number + " 頁　" + E.esc(r.note).slice(0, 48) + "</button>";
      }).join("") : "");
    openDrawer("📝 筆記", html);
    $("noteForm").onsubmit = async function (ev) {
      ev.preventDefault();
      const text = $("noteText").value.trim();
      if (!text) return;
      await E.addNote(state.bookId, state.pageNumber, text);
      toast("已儲存筆記");
      renderNotePanel();
    };
    $("drawerBody").querySelectorAll("[data-page]").forEach(function (btn) {
      btn.onclick = function () { goPage(Number(btn.getAttribute("data-page"))); closeDrawer(); };
    });
  }

  async function renderSearchPanel() {
    const html = '<input type="text" id="bookQ" placeholder="搜尋本書，例如：遠距醫療"><div id="hits"></div>';
    openDrawer("🔍 搜尋本書", html);
    $("bookQ").onkeydown = async function (ev) {
      if (ev.key !== "Enter") return;
      const q = $("bookQ").value.trim();
      if (!q) return;
      if (state.source === "remote" && state.pages.length < state.totalPages) {
        $("hits").innerHTML = "<p class='muted'>正在建立全書索引…</p>";
        await loadAllRemotePages();
      }
      const hits = E.searchPages(state.pages.length ? state.pages : Array.from(state.cache.values()), q);
      if (!hits.length) {
        $("hits").innerHTML = "<p class='muted'>沒有命中。索引來自全書頁面內容，不是目前畫面 HTML。</p>";
        return;
      }
      $("hits").innerHTML = hits.map(function (h) {
        return '<button class="hit" data-page="' + h.page_number + '">第 ' + h.page_number + " 頁<br><small>" + E.esc(h.snippet) + "</small></button>";
      }).join("");
      $("hits").querySelectorAll("[data-page]").forEach(function (btn) {
        btn.onclick = function () { goPage(Number(btn.getAttribute("data-page"))); closeDrawer(); };
      });
    };
  }

  function chapterPages() {
    if (!state.toc.length) return { from: 1, to: state.totalPages, title: "全書" };
    const cur = state.pageNumber;
    let from = 1, title = "本章";
    let to = state.totalPages;
    const items = state.toc.slice().sort(function (a, b) { return (a.page_number || 0) - (b.page_number || 0); });
    for (let i = 0; i < items.length; i++) {
      const p = Number(items[i].page_number || 1);
      if (p <= cur) { from = p; title = items[i].title || title; }
      if (p > cur) { to = p - 1; break; }
    }
    return { from: from, to: Math.max(from, to), title: title };
  }

  let speakQueue = [];
  let speaking = false;
  let voicesReady = null;

  function stopSpeak() {
    speaking = false;
    speakQueue = [];
    try { speechSynthesis.cancel(); } catch (e) {}
  }

  function pickChineseVoice() {
    if (!("speechSynthesis" in window)) return null;
    const voices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
    if (!voices.length) return null;
    const preferred = voices.filter(function (v) {
      const name = String(v.name || "");
      const lang = String(v.lang || "").toLowerCase();
      return lang === "zh-tw" || /Tingting|Meijia/i.test(name);
    });
    return preferred[0] || voices.find(function (v) {
      return String(v.lang || "").toLowerCase().indexOf("zh") === 0;
    }) || null;
  }

  function waitForVoices() {
    if (!("speechSynthesis" in window)) return Promise.resolve([]);
    const voices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
    if (voices.length) return Promise.resolve(voices);
    if (voicesReady) return voicesReady;
    voicesReady = new Promise(function (resolve) {
      const done = function () {
        try { speechSynthesis.removeEventListener("voiceschanged", done); } catch (e) {}
        voicesReady = null;
        resolve(speechSynthesis.getVoices ? speechSynthesis.getVoices() : []);
      };
      try { speechSynthesis.addEventListener("voiceschanged", done, { once: true }); } catch (e) {
        setTimeout(function () {
          try { speechSynthesis.removeEventListener("voiceschanged", done); } catch (x) {}
          voicesReady = null;
          resolve(speechSynthesis.getVoices ? speechSynthesis.getVoices() : []);
        }, 1000);
      }
      setTimeout(function () {
        try { speechSynthesis.removeEventListener("voiceschanged", done); } catch (x) {}
        if (voicesReady) {
          voicesReady = null;
          resolve(speechSynthesis.getVoices ? speechSynthesis.getVoices() : []);
        }
      }, 1500);
    });
    return voicesReady;
  }

  function speakText(text, onend) {
    const raw = String(text || "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
    if (!raw) {
      toast("這一頁沒有可朗讀文字");
      if (onend) onend();
      return;
    }
    if (!("speechSynthesis" in window)) {
      toast("此裝置不支援語音朗讀");
      if (onend) onend();
      return;
    }

    const chunks = [];
    for (let i = 0; i < raw.length; i += 300) chunks.push(raw.slice(i, i + 300));

    const speakChunk = function (index) {
      if (!speaking || index >= chunks.length) {
        if (onend) onend();
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[index]);
      u.lang = "zh-TW";
      const voice = pickChineseVoice();
      if (voice) u.voice = voice;
      u.onend = function () { speakChunk(index + 1); };
      u.onerror = function (ev) {
        toast("朗讀失敗" + (ev && ev.error ? "：" + ev.error : ""));
        speaking = false;
        speakQueue = [];
      };
      speechSynthesis.speak(u);
    };

    // 沒有正在播放時，不在 tap 後額外 await，讓 iPhone 的使用者手勢直接觸發 speak()。
    // 若先前有語音，才 cancel；cancel 後等待約 60ms 再開始下一段。
    const wasSpeaking = !!speechSynthesis.speaking || !!speechSynthesis.pending;
    if (wasSpeaking) {
      try { speechSynthesis.cancel(); } catch (e) {}
      setTimeout(function () { speakChunk(0); }, 60);
    } else {
      speakChunk(0);
    }
  }

  async function speakRange(from, to) {
    from = Math.max(1, from);
    to = Math.min(state.totalPages, to);
    speaking = true;

    // 已在 cache：點擊當下直接 speak()，不讓 await 打斷 iPhone 手勢。
    const current = from === to ? state.cache.get(from) : null;
    if (current) {
      const text = current.content || "";
      toast("朗讀第 " + from + " 頁");
      speakText(text, function () { speaking = false; });
      return;
    }

    // 未在 cache：同一個 tap 先用短句解鎖語音，再等待頁面資料。
    // 短句本身不等待網路／getPage，讓 iPhone 保留此次手勢授權。
    if (("speechSynthesis" in window)) {
      const unlock = new SpeechSynthesisUtterance("開始朗讀");
      unlock.lang = "zh-TW";
      const voice = pickChineseVoice();
      if (voice) unlock.voice = voice;
      unlock.onerror = function (ev) {
        toast("朗讀啟動失敗" + (ev && ev.error ? "：" + ev.error : ""));
      };
      try { speechSynthesis.speak(unlock); } catch (e) { toast("朗讀啟動失敗"); }
    }

    for (let n = from; n <= to; n++) await getPage(n);

    speakQueue = [];
    for (let n = from; n <= to; n++) {
      const p = state.cache.get(n);
      speakQueue.push({ n: n, text: p ? (p.content || "") : "" });
    }

    toast("朗讀第 " + from + "–" + to + " 頁");
    const next = function () {
      if (!speaking || !speakQueue.length) { speaking = false; return; }
      const item = speakQueue.shift();
      goPage(item.n);
      if (!item.text) {
        toast("這一頁沒有可朗讀文字");
        next();
        return;
      }
      speakText(item.text, next);
    };
    // unlock utterance 已先進入 speech queue；正文會在它結束後接續。
    await waitForVoices();
    next();
  }

  function renderSpeakPanel() {
    const ch = chapterPages();
    const html =
      '<div class="setform">' +
      '<button class="ib" id="spPage">朗讀目前頁</button>' +
      '<button class="ib" id="spChap">朗讀目前章（' + E.esc(ch.title) + " · " + ch.from + "–" + ch.to + "）</button>" +
      '<label>起始頁 <input id="speakFrom" type="number" min="1" value="' + state.pageNumber + '"></label>' +
      '<label>結束頁 <input id="speakTo" type="number" min="1" value="' + Math.min(state.totalPages, state.pageNumber + 5) + '"></label>' +
      '<button class="ib" id="spRange">依頁碼朗讀</button>' +
      '<div style="display:flex;gap:8px"><button class="ib" id="spPause">⏸ 暫停</button><button class="ib" id="spResume">▶ 繼續</button><button class="ib" id="spStop">⏹ 停止</button></div>' +
      "</div>";
    openDrawer("🔊 朗讀", html);
    $("spPage").onclick = function () { speakRange(state.pageNumber, state.pageNumber); };
    $("spChap").onclick = function () { speakRange(ch.from, ch.to); };
    $("spRange").onclick = function () { speakRange(Number($("speakFrom").value), Number($("speakTo").value)); };
    $("spPause").onclick = function () { try { speechSynthesis.pause(); } catch (e) {} };
    $("spResume").onclick = function () { try { speechSynthesis.resume(); } catch (e) {} };
    $("spStop").onclick = stopSpeak;
  }

  function currentChapterTitle() {
    const ch = chapterPages();
    return ch.title;
  }
  function sourceLine() {
    const title = (state.book && state.book.title) || "本書";
    return [title, "第" + state.pageNumber + "頁", currentChapterTitle()].filter(Boolean).join("、");
  }
  async function askDarkStar(question) {
    const q = String(question || "").trim();
    if (!q) return;
    const log = $("askLog");
    const me = document.createElement("div");
    me.className = "bubble me";
    me.textContent = q;
    log.appendChild(me);
    const compare = E.parseComparePages(q);
    const need = compare || [state.pageNumber];
    if (/這一章|本章/.test(q)) {
      const ch = chapterPages();
      for (let n = ch.from; n <= ch.to; n++) need.push(n);
    }
    const uniq = Array.from(new Set(need)).filter(function (n) { return n > 0 && n <= state.totalPages; });
    await Promise.all(uniq.map(getPage));
    const ctxPages = uniq.map(function (n) {
      const p = state.cache.get(n);
      return "【第" + n + "頁】\n" + ((p && p.content) || "");
    }).join("\n\n");
    const system = "你是 Technical Dark Star。只根據目前電子書上下文解說，必須區分【教材原文】【暗星解說】【來源】。不要編造未提供的條文。來源：" + sourceLine() + "。book_id=" + state.bookId + " page_number=" + state.pageNumber;
    const user = "【學生問題】" + q + "\n【目前書】" + ((state.book && state.book.title) || "") + "\n【目前頁】" + state.pageNumber + "\n【目前章節】" + currentChapterTitle() + "\n【電子書內容】\n" + ctxPages;
    try {
      const answer = await E.askGateway(system, user);
      const ai = document.createElement("div");
      ai.className = "bubble ai";
      ai.innerHTML = "<div>【暗星解說】</div><div>" + E.esc(answer).replace(/\n/g, "<br>") + "</div><div>【來源】" + E.esc(sourceLine()) + "</div>";
      log.appendChild(ai);
    } catch (e) {
      const ai = document.createElement("div");
      ai.className = "bubble ai";
      ai.textContent = "無法取得解說";
      log.appendChild(ai);
    }
  }
  function renderAskPanel() {
    const html =
      '<div id="askLog"></div>' +
      '<form class="askform" id="askForm"><textarea id="askInput" placeholder="針對目前這一頁提問，例如：解釋這一頁／這一章的法律爭點／比較第 25 頁和第 63 頁"></textarea><button class="ib" type="submit">送出給暗星</button></form>' +
      "<p class='muted'>暗星會帶上 book_id、目前頁碼、本頁原文與章節。</p>";
    openDrawer("🤖 問暗星", html, "right");
    $("askForm").onsubmit = function (ev) {
      ev.preventDefault();
      const q = $("askInput").value;
      $("askInput").value = "";
      askDarkStar(q);
    };
  }

  function renderSettings() {
    const html =
      '<div class="setform">' +
      '<button class="ib" id="mAuto">自動（手機單頁／桌面雙頁）</button>' +
      '<button class="ib" id="mSingle">單頁模式</button>' +
      '<button class="ib" id="mDouble">雙頁模式</button>' +
      '<button class="ib" id="zOut">縮小</button>' +
      '<button class="ib" id="zIn">放大</button>' +
      '<button class="ib" id="fitPage">適合頁面</button>' +
      '<button class="ib" id="fitWidth">適合寬度</button>' +
      '<button class="ib" id="favBtn">' + (E.isFav(state.bookId) ? "取消收藏" : "⭐ 加入收藏") + "</button>" +
      '<label>分類 <input id="catName" type="text" value="' + E.esc((state.book && state.book.category) || "未分類") + '"></label>' +
      '<button class="ib" id="saveCat">儲存分類</button>' +
      "</div>";
    openDrawer("⚙ 閱讀設定", html);
    $("mAuto").onclick = function () { state.mode = "auto"; renderSpread(); };
    $("mSingle").onclick = function () { state.mode = "single"; renderSpread(); };
    $("mDouble").onclick = function () { state.mode = "double"; renderSpread(); };
    $("zOut").onclick = function () { state.scale = Math.max(0.6, state.scale - 0.1); applyScale(); };
    $("zIn").onclick = function () { state.scale = Math.min(2.2, state.scale + 0.1); applyScale(); };
    $("fitPage").onclick = function () { state.fit = "page"; state.scale = 1; applyScale(); };
    $("fitWidth").onclick = function () { state.fit = "width"; state.scale = 1.15; applyScale(); };
    $("favBtn").onclick = function () { E.setFavorite(state.bookId, !E.isFav(state.bookId)); renderSettings(); };
    $("saveCat").onclick = async function () {
      if (state.book && state.source === "local") {
        state.book.category = $("catName").value.trim() || "未分類";
        await E.saveBook(state.book);
        toast("已儲存分類");
      } else toast("遠端書分類存在本機收藏資料");
    };
  }
  function applyScale() {
    $("flipBook").style.transform = "scale(" + state.scale + ")";
  }
  function renderMore() {
    const deleteLabel = state.source === "local" ? "🗑 刪除本機書籍" : "🗑 從我的書架移除";
    const html =
      '<div class="setform">' +
      '<button class="ib" id="moreSet">⚙ 閱讀設定</button>' +
      '<button class="ib" id="moreFav">' + (E.isFav(state.bookId) ? "取消收藏" : "⭐ 收藏") + "</button>" +
      '<button class="ib" id="deleteBook">' + deleteLabel + "</button>" +
      '<a class="ib" href="dark-star-ebook-classic.html?ebook_id=' + encodeURIComponent(state.remoteId || state.bookId) + '">原閱讀器</a>' +
      "</div>";
    openDrawer("更多", html);
    $("moreSet").onclick = renderSettings;
    $("moreFav").onclick = function () { E.setFavorite(state.bookId, !E.isFav(state.bookId)); toast("已更新收藏"); };
    $("deleteBook").onclick = async function () {
      const label = state.source === "local"
        ? "刪除這本本機電子書？書頁、書籤、筆記與閱讀進度也會一併刪除。"
        : "把這本遠端電子書從本機我的書架移除？（不刪除伺服器上的原書）";
      if (!confirm(label)) return;
      try {
        await E.deleteLocalBook(state.bookId);
        closeDrawer();
        state.bookId = null;
        state.remoteId = null;
        state.book = null;
        state.pages = [];
        state.cache.clear();
        showShelf();
        toast("已完成");
      } catch (e) {
        toast("刪除失敗：" + (e && e.message ? e.message : "unknown error"));
      }
    };
  }

  function bindNav() {
    $("prevBtn").onclick = function () {
      if (useSpread()) goPage(Math.max(1, currentPair()[0] - 2), true, "prev");
      else goPage(state.pageNumber - 1, true, "prev");
    };
    $("nextBtn").onclick = function () {
      if (useSpread()) goPage(currentPair()[0] + 2, true, "next");
      else goPage(state.pageNumber + 1, true, "next");
    };
    $("jumpRange").onchange = function () { goPage($("jumpRange").value); };
    $("btnBackShelf").onclick = showShelf;
    $("btnToc").onclick = renderTocPanel;
    $("btnMark").onclick = renderBookmarkPanel;
    $("btnSearch").onclick = renderSearchPanel;
    $("btnNote").onclick = renderNotePanel;
    $("btnSpeak").onclick = renderSpeakPanel;
    $("btnAsk").onclick = renderAskPanel;
    $("btnSettings").onclick = renderSettings;
    $("btnMore").onclick = renderMore;
    $("btnFull").onclick = function () {
      const el = document.documentElement;
      if (!document.fullscreenElement) el.requestFullscreen && el.requestFullscreen();
      else document.exitFullscreen && document.exitFullscreen();
    };
    $("btnCloseDrawer").onclick = closeDrawer;
    $("mask").onclick = closeDrawer;
    $("btnClassic").onclick = function () {
      location.href = "dark-star-ebook-classic.html?ebook_id=" + encodeURIComponent(state.remoteId || state.bookId || "") + "&page=" + state.pageNumber;
    };
    document.addEventListener("keydown", function (e) {
      if (state.view !== "read") return;
      if (["INPUT", "TEXTAREA"].indexOf(e.target.tagName) >= 0) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") goPage(state.pageNumber + 1, true, "next");
      if (e.key === "ArrowLeft" || e.key === "PageUp") goPage(state.pageNumber - 1, true, "prev");
    });

    let sx = 0, sy = 0, tracking = false, axis = null;
    const stage = $("stage");
    stage.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      tracking = true;
      axis = null;
    }, { passive: true });
    stage.addEventListener("touchmove", function (e) {
      if (!tracking || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - sx;
      const dy = e.touches[0].clientY - sy;
      if (!axis && Math.abs(dx) + Math.abs(dy) > 12) axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axis === "x") e.preventDefault();
    }, { passive: false });
    stage.addEventListener("touchend", function (e) {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goPage(state.pageNumber + 1, true, "next");
        else goPage(state.pageNumber - 1, true, "prev");
      }
    });
    let startDist = 0, startScale = 1;
    stage.addEventListener("touchstart", function (e) {
      if (e.touches.length === 2) {
        const a = e.touches[0], b = e.touches[1];
        startDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        startScale = state.scale;
      }
    }, { passive: true });
    stage.addEventListener("touchmove", function (e) {
      if (e.touches.length === 2) {
        const a = e.touches[0], b = e.touches[1];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (startDist) {
          state.scale = Math.max(0.6, Math.min(2.4, startScale * (d / startDist)));
          applyScale();
        }
        e.preventDefault();
      }
    }, { passive: false });

    let down = false, dsx = 0;
    stage.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      down = true; dsx = e.clientX;
    });
    window.addEventListener("mouseup", function (e) {
      if (!down) return;
      down = false;
      const dx = e.clientX - dsx;
      if (Math.abs(dx) > 50) {
        if (dx < 0) goPage(state.pageNumber + 1, true, "next");
        else goPage(state.pageNumber - 1, true, "prev");
      }
    });
  }

  function bindShelf() {
    $("shelfTabs").querySelectorAll("[data-tab]").forEach(function (btn) {
      btn.onclick = function () {
        state.tab = btn.getAttribute("data-tab");
        $("shelfTabs").querySelectorAll("[data-tab]").forEach(function (b) { b.classList.toggle("on", b === btn); });
        renderShelf();
      };
    });
    $("shelfQ").oninput = function () { renderShelf(); };
    $("shelfFile").onchange = async function () {
      const f = $("shelfFile").files[0];
      if (!f) return;
      $("importStatus").textContent = "正在解析 " + f.name + " …";
      try {
        const result = await E.importFile(f, {});
        const text = result.pages.map(function (p) { return p.content || ""; }).join("\n\n").trim();

        // 通用匯入規則：本機解析完成後，必須同步建立遠端電子書；
        // 不再用 400,000 字元上限把大型教材靜默留在本機。
        // pushTextToIngest 內部會自動以 20,000 字元分塊，因此 50 萬字、
        // 100 萬字甚至更大的純文字教材都不會因單次 request 過大而被截斷。
        if (text) {
          $("importStatus").textContent = "正在同步《" + result.book.title + "》到電子書資料庫…";
          const r = await E.pushTextToIngest(
            result.book.title,
            result.book.author || "",
            text,
            "AIVAULT FlipBook 通用匯入：" + f.name
          );
          if (!r || !r.ok) {
            throw new Error("遠端電子書建立失敗（HTTP " + ((r && r.status) || "network") + "）");
          }
          const rid = r.data && (r.data.ebook_id || (r.data.ebook && r.data.ebook.id) || r.data.book_id);
          if (!rid) throw new Error("遠端電子書建立成功但未返回 ebook_id");
          result.book.remote_id = rid;
          await E.saveBook(result.book);
          E.rememberRemote({
            ebook_id: rid,
            title: result.book.title,
            author: result.book.author || "",
            page_count: result.book.page_count,
            cover_url: result.book.cover_url
          });
          $("importStatus").textContent =
            "已完成《" + result.book.title + "》：本機 " + result.book.page_count + " 頁／遠端內容已建立";
        } else {
          // 掃描型 PDF／純圖片教材可能沒有文字層；保留本機影像頁，
          // 不把空文字誤判成「成功建立電子書」。
          $("importStatus").textContent =
            "已匯入《" + result.book.title + "》共 " + result.book.page_count +
            " 頁；此檔案沒有可擷取文字層，保留本機頁面。";
        }
        renderShelf();
      } catch (err) {
        $("importStatus").textContent = "匯入失敗：" + (err.message || err);
        console.error("[AIVAULT FlipBook] generic import failed", err);
      }
      $("shelfFile").value = "";
    };
  }

  window.addEventListener("resize", function () {
    if (state.view === "read") renderSpread();
  });

  bindShelf();
  bindNav();
  const startId = qs().get("ebook_id");
  const view = qs().get("view");
  if (startId && view !== "shelf") openBook(startId);
  else showShelf();
})();
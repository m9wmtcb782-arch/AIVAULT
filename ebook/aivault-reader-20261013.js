(function () {
  "use strict";
  window.AIVAULTQQReader = true;
  window.AIVAULTQQSelectionEnabled = false;
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
    shelfBooks: [],
    pages: [],
    toc: [],
    pageNumber: 1,
    totalPages: 1,
    mode: "single",
    subPage: 0,
    subPages: 1,
    scale: 1,
    fit: "page",
    flipping: false,
    cache: new Map(),
    context: null
  };

  var FIT_FONT_IDS = {"840b333d-4329-4d47-80e2-a1b9d92aec03": 1, "97a31aa4-8f72-4794-adf7-ee336411c804": 1, "9f20615b-fe5d-4abe-93f3-86c7025a866f": 1};
  function applyFitFont(book) {
    var on = false;
    try {
      var id = String((book && (book.id || book.ebook_id || book.remote_id)) || state.bookId || state.remoteId || "");
      var meta = (book && book.metadata) || {};
      on = !!(meta.fit_font || book && book.fit_font || FIT_FONT_IDS[id]);
    } catch (e) {}
    try { document.documentElement.toggleAttribute("data-fit-font", !!on); } catch (e) {}
  }


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
    try { document.documentElement.removeAttribute("data-fit-font"); } catch (e) {}
    if(window.AIVAULTAudiobook)window.AIVAULTAudiobook.stop();
    $("listenView").hidden=true;
    state.view = "shelf";
    $("shelfView").hidden = false;
    $("readerView").hidden = true;
    closeDrawer();
    $("readerView").classList.remove("controls-open");
    setQS(state.bookId, state.pageNumber, "shelf");
    renderShelf();
  }
  function showReader() {
    $("listenView").hidden=true;
    state.view = "read";
    $("shelfView").hidden = true;
    $("readerView").hidden = false;
    $("readerView").classList.remove("controls-open");
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
    const coverSrc = b.custom_cover || (E.makeCover ? E.makeCover(title, author) : b.cover_url || "");
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
      "<p>" + (E.isFav(id) ? "⭐ 已收藏" : "") + "</p>" +
      '<button type="button" class="ib" data-cover-book="' + E.esc(id) + '" style="margin-top:8px;position:relative;z-index:2" aria-label="更換封面：' + E.esc(title) + '">🖼 更換封面</button>' +
      '<button type="button" class="ib shelf-delete" data-delete-book="' + E.esc(id) + '" style="margin-top:8px;position:relative;z-index:2;color:#a52727" aria-label="刪除書籍：' + E.esc(title) + '">🗑 刪除書籍</button></div></article>'
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
            metadata: r.metadata || {},
            fit_font: !!(r.metadata && r.metadata.fit_font),
            source: "remote",
            saved_at: r.updated_at || r.created_at
          };
        }).filter(function (r) {
          return r.ebook_id && Number(r.page_count || 0) > 0 &&
            String(r.title || "").indexOf("AIVAULT FlipBook Probe") < 0 &&
            String(r.title || "").indexOf("「當行政遇上科學") !== 0;
        });
        // 直播成功：catalog 改成只含伺服器書單（丟掉已刪的幽靈 id，如林昱梅原版 9a3a2a12…）
        try { if (E.saveCatalog) E.saveCatalog(remoteRows); } catch (e) {}
      }
    } catch (e) {
      console.warn("[AIVAULT FlipBook] live catalog failed; using local catalog", e);
    }

    const map = new Map();
    local.forEach(function (b) { map.set(b.id, Object.assign({ source: "local" }, b)); });
    remoteRows.forEach(function (r) {
      if (!r.ebook_id || E.isShelfRemoved(r.ebook_id)) return;
      map.set(r.ebook_id, {
        id: r.ebook_id,
        ebook_id: r.ebook_id,
        title: r.title || "未命名",
        author: r.author || "—",
        page_count: r.page_count || r.total_pages || 0,
        total_pages: r.total_pages || r.page_count || 0,
        cover_url: r.cover_url || "",
        edition: r.edition || "",
        metadata: r.metadata || {},
        fit_font: !!(r.fit_font || (r.metadata && r.metadata.fit_font)),
        source: "remote",
        category: r.category || (r.metadata && r.metadata.category) || "法律",
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
    if (!E.isShelfRemoved(constitutionId) && !map.has(constitutionId)) {
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
      if (E.isShelfRemoved(b.id || b.ebook_id)) return;
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
    await Promise.all(books.map(async function (b) { b.custom_cover = await E.customCover(b.id || b.ebook_id); }));
    state.shelfBooks = books.slice();
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
    $("shelfGrid").querySelectorAll("[data-cover-book]").forEach(function (btn) {
      btn.onclick = function (event) {
        event.stopPropagation();
        const id = btn.getAttribute("data-cover-book");
        const picker = document.createElement("input");
        picker.type = "file";
        picker.accept = "image/png,image/jpeg,image/webp";
        picker.onchange = async function () {
          const file = picker.files && picker.files[0];
          if (!file) return;
          if (file.size > 12 * 1024 * 1024) { toast("圖片請小於 12 MB"); return; }
          btn.disabled = true;
          try {
            const data = await new Promise(function (resolve, reject) {
              const reader = new FileReader();
              reader.onload = function () { resolve(reader.result); };
              reader.onerror = function () { reject(new Error("無法讀取圖片")); };
              reader.readAsDataURL(file);
            });
            const img = new Image();
            await new Promise(function (resolve, reject) {
              img.onload = resolve;
              img.onerror = function () { reject(new Error("圖片格式不支援")); };
              img.src = data;
            });
            const canvas = document.createElement("canvas");
            const scale = Math.min(1, 600 / img.naturalWidth, 900 / img.naturalHeight);
            canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            await E.setCustomCover(id, canvas.toDataURL("image/jpeg", 0.8));
            toast("封面已更換");
            await renderShelf();
          } catch (err) {
            toast("封面儲存失敗：" + (err.message || err));
            btn.disabled = false;
          }
        };
        picker.click();
      };
    });
    $("shelfGrid").querySelectorAll("[data-delete-book]").forEach(function (btn) {
      btn.onclick = async function (event) {
        event.stopPropagation();
        const id = btn.getAttribute("data-delete-book");
        const book = state.shelfBooks.find(function (b) { return String(b.id || b.ebook_id) === id; });
        if (!book) return;
        const remote = book.source === "remote";
        const warning = remote
          ? "確定永久刪除《" + book.title + "》？這會刪除伺服器上的電子書，其他裝置也將無法閱讀。此操作無法復原。"
          : "確定刪除本機《" + book.title + "》？書頁、書籤、筆記和閱讀進度也會刪除。此操作無法復原。";
        if (!confirm(warning)) return;
        btn.disabled = true;
        try {
          // deleteLocalBook：有伺服器列就永久刪；404/BOOK_NOT_FOUND 則只清本機（幽靈書卡／已刪 id）
          await E.deleteLocalBook(id);
          toast("已刪除《" + book.title + "》");
          await renderShelf();
        } catch (error) {
          console.error("[AIVAULT] shelf delete", id, error);
          var em = String((error && error.message) || error || "");
          var friendly = /BOOK_NOT_FOUND|not found/i.test(em)
            ? "這本書在伺服器上已不存在，已嘗試從本機書架移除。請重新整理後再看一次。"
            : /Unauthorized|401|登入/i.test(em)
            ? "刪除伺服器書籍需要有效登入，請重新登入後再試。"
            : ("刪除失敗：" + (em.slice(0, 80) || "未知錯誤"));
          toast(friendly);
          btn.disabled = false;
        }
      };
    });
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
      // [[img:N]] 標記 → 書籍專屬圖檔（只影響含標記的頁面）
      const imgBase = "ebooks/" + encodeURIComponent(String(state.remoteId || state.bookId || "")) + "/img/";
      body += "<div>" + E.esc(page.content || "").replace(/\[\[img:([A-Za-z0-9_-]+)\]\]/g, function (_, k) { return '<img decoding="async" alt="" src="' + imgBase + k + '.jpg" style="display:block;max-width:100%;height:auto;margin:10px auto">'; }).replace(/\n/g, "<br>") + "</div>";
    }
    const videos=Array.isArray(page.metadata&&page.metadata.videos)?page.metadata.videos:[];
    videos.forEach(function(v){
      const provider=String(v.provider||"").toLowerCase(), url=String(v.url||""), id=String(v.video_id||"");
      const title=String(v.title||"本頁影音");
      if(provider==="youtube"&&id) body+='<div style="margin-top:16px"><h3>🎬 本頁影音</h3><div style="position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden"><iframe src="https://www.youtube.com/embed/'+encodeURIComponent(id)+'" title="'+E.esc(title)+'" style="width:100%;height:100%;border:0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><div style="font-size:13px;margin-top:6px">'+E.esc(title)+'</div></div>';
      else if(provider==="vimeo"&&id) body+='<div style="margin-top:16px"><h3>🎬 本頁影音</h3><div style="position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden"><iframe src="https://player.vimeo.com/video/'+encodeURIComponent(id)+'" title="'+E.esc(title)+'" style="width:100%;height:100%;border:0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div><div style="font-size:13px;margin-top:6px">'+E.esc(title)+'</div></div>';
      else if(provider==="direct"&&url) body+='<div style="margin-top:16px"><h3>🎬 本頁影音</h3><video controls playsinline preload="metadata" src="'+E.esc(url)+'" style="width:100%;max-height:520px;background:#000;border-radius:10px"></video><div style="font-size:13px;margin-top:6px">'+E.esc(title)+'</div></div>';
    });
    el.innerHTML = (bits ? "<h3>" + E.esc(bits) + "</h3>" : "") + body;
    if(window.AIVAULTAudiobook)window.AIVAULTAudiobook.preparePaper(el);
  }

  function paginatePaper(el) {
    if (useSpread()) return;
    const viewport = document.createElement("div"); viewport.className = "qq-page-viewport";
    const flow = document.createElement("div"); flow.className = "qq-page-flow";
    while(el.firstChild) flow.appendChild(el.firstChild);
    viewport.appendChild(flow); el.appendChild(viewport);
    const width = viewport.clientWidth, height = viewport.clientHeight;
    if(!width || !height) return;
    flow.style.width = width + "px"; flow.style.columnWidth = width + "px";
    flow.style.setProperty("--page-content-height", height + "px");
    state.subPages = Math.max(1, Math.ceil((flow.scrollWidth + 40) / (width + 40)));
    state.subPage = Math.max(0, Math.min(state.subPages - 1, state.subPage));
    flow.style.transform = "translateX(" + (-state.subPage * (width + 40)) + "px)";
  }
  function updateReadingLabel() {
    $("pageLabel").textContent = state.pageNumber + " / " + state.totalPages + (state.subPages > 1 ? " · " + (state.subPage + 1) + "/" + state.subPages + " 屏" : "");
    $("prevBtn").disabled = state.pageNumber === 1 && state.subPage === 0;
    $("nextBtn").disabled = state.pageNumber === state.totalPages && state.subPage === state.subPages - 1;
  }
  function currentPairFor(pageNumber) {
    if (!useSpread()) return [pageNumber];
    const left = pageNumber % 2 === 0 ? pageNumber - 1 : pageNumber;
    const right = left + 1;
    return [Math.max(1, left), right <= state.totalPages ? right : null].filter(Boolean);
  }

  function currentPair() {
    if (!useSpread()) return [state.pageNumber, null];
    const left = state.pageNumber % 2 === 0 ? state.pageNumber - 1 : state.pageNumber;
    return [Math.max(1, left), left + 1];
  }

  function renderSpread() {
    applyFitFont(state.book);
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
    if(!useSpread()) paginatePaper($("paperRight"));
    else { state.subPages = 1; state.subPage = 0; }
    updateReadingLabel();
    $("jumpRange").max = String(state.totalPages || 1);
    $("jumpRange").value = String(state.pageNumber);
    $("readerTitle").textContent = (state.book && (state.book.title || state.book.book_title)) || ((state.shelfBooks.find(function(b){return (b.ebook_id || b.id) === state.bookId;}) || {}).title) || ((E.catalog().find(function(b){return (b.ebook_id || b.id) === state.bookId;}) || {}).title) || "電子書";
    $("readerAuthor").textContent = "作者：" + ((state.book && state.book.author) || "—");
    if(window.AIVAULTAudiobook)window.AIVAULTAudiobook.syncReader();
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
        metadata: page.metadata || {},
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

  // 連點翻頁佇列：動畫進行中的點擊不丟棄，依方向累加；動畫可被打斷以保持跟手
  var turnQueue = []; // {dir:"next"|"prev"} 或 {n:number, animate, dir, narration}
  function enqueueTurn(item) {
    if (!item) return;
    // 合併連續同向點擊為多次 delta，避免用當下 pageNumber 算死頁碼
    if (item.dir && (item.delta === 1 || item.delta === -1)) {
      turnQueue.push({ dir: item.dir, delta: item.delta });
      if (turnQueue.length > 12) turnQueue.shift();
      return;
    }
    turnQueue.push(item);
    if (turnQueue.length > 12) turnQueue.shift();
  }
  function drainTurnQueue() {
    if (state.flipping || !turnQueue.length) return;
    var item = turnQueue.shift();
    if (item.delta) {
      var step = useSpread() ? 2 : 1;
      var target = state.pageNumber + (item.delta > 0 ? step : -step);
      goPage(target, true, item.dir);
    } else {
      goPage(item.n, item.animate, item.dir, item.narrationNavigation);
    }
  }
  function requestTurn(dir) {
    if (!state.bookId) return;
    var delta = dir === "next" ? 1 : -1;
    if (useSpread()) {
      // 雙頁：一次跳兩個整頁
      if (state.flipping) { enqueueTurn({ dir: dir, delta: delta }); return; }
      if (dir === "next") goPage(currentPair()[0] + 2, true, "next");
      else goPage(Math.max(1, currentPair()[0] - 2), true, "prev");
      return;
    }
    if (state.flipping) { enqueueTurn({ dir: dir, delta: delta }); return; }
    goPage(state.pageNumber + delta, true, dir);
  }
  async function goPage(n, animate, dir, narrationNavigation) {
    if (!state.bookId) return;
    // 動畫中：有方向的翻頁請求進佇列；無動畫跳頁仍等待目前翻頁結束再執行
    if (state.flipping) {
      if (dir === "next" || dir === "prev") enqueueTurn({ dir: dir, delta: dir === "next" ? 1 : -1 });
      else enqueueTurn({ n: n, animate: !!animate, dir: dir, narrationNavigation: narrationNavigation });
      // 打斷當前捲頁，讓佇列盡快跟上連點
      try { if (window.AIVAULTPageCurl && window.AIVAULTPageCurl.cancel) window.AIVAULTPageCurl.cancel(); } catch (e) {}
      return;
    }
    const oldPage=state.pageNumber, oldSub=state.subPage;
    n = Math.max(1, Math.min(state.totalPages || 1, Number(n) || 1));
    let nextSub=0;
    if(!useSpread() && animate && dir) {
      if(dir === "next" && oldSub + 1 < state.subPages) {n=oldPage;nextSub=oldSub+1;}
      else if(dir === "prev" && oldSub > 0) {n=oldPage;nextSub=oldSub-1;}
      else if(n===oldPage) {toast(dir==="next"?"已到最後一頁":"已是第一頁");drainTurnQueue();return;}
      else if(dir==="prev") nextSub=Number.MAX_SAFE_INTEGER;
    }
    if(n!==oldPage&&!narrationNavigation&&window.AIVAULTAudiobook)window.AIVAULTAudiobook.stop();
    state.flipping=true;$("stage").setAttribute("aria-busy","true");
    try {
      const targets=useSpread()?currentPairFor(n):[n];
      await Promise.all(targets.filter(function(x){return x>0&&x<=state.totalPages;}).map(getPage));
      if(!state.cache.get(n)){toast("這一頁暫時無法載入，請再試一次");return;}
      const before=snapshotLeaf("paperRight");
      state.pageNumber=n;state.subPage=nextSub;renderSpread();
      // 佇列中還有同向連點時：縮短／略過動畫以保持 1 點 = 1 頁跟手
      var queuedAhead = turnQueue.length;
      if(animate&&dir) {
        if (queuedAhead > 0) {
          // 有待處理點擊：極短捲頁或不播，立刻讓出
          try { await runCurl(before, snapshotLeaf("paperRight"), dir, 90); } catch (e) {}
        } else {
          await runCurl(before,snapshotLeaf("paperRight"),dir);
        }
      }
      setQS(state.bookId,state.pageNumber,state.view==="listen"?"listen":"read");
      try { localStorage.setItem("aivault_reader_screen_"+state.bookId,JSON.stringify({page:state.pageNumber,screen:state.subPage})); } catch(e){}
      [n-1,n+1,n+2].filter(function(x){return x>0&&x<=state.totalPages;}).forEach(function(x){getPage(x).catch(function(){});});
      persistProgress().catch(function(){});
      if(state.source==="remote"||state.remoteId) E.fetchRemoteContext(state.remoteId||state.bookId,state.pageNumber,1).then(function(r){if(r.ok)state.context=r.data;}).catch(function(){});
    } finally {
      state.flipping=false;$("stage").setAttribute("aria-busy","false");
      drainTurnQueue();
    }
  }
  function snapshotLeaf(id) {
    const wrap=$(id).cloneNode(true);wrap.removeAttribute("id");
    wrap.classList.add("qq-curl-paper");
    wrap.querySelectorAll("[id]").forEach(function(x){x.removeAttribute("id");});
    return wrap;
  }
  function runCurl(before,after,dir,durationMs) {
    const hint=state.curlHint||{};state.curlHint=null;
    if(window.AIVAULTPageCurl&&!useSpread()&&!matchMedia("(prefers-reduced-motion: reduce)").matches){
      try{return window.AIVAULTPageCurl.run($("flipBook"),before,after,dir,{corner:hint.corner||"bottom",slope:hint.slope,duration:durationMs!=null?durationMs:300,hold:window.__AIVAULT_CURL_HOLD});}catch(e){console.warn("[AIVAULT reader] real curl fallback",e);}
    }
    if(!window.St||!St.PageFlip||useSpread()||matchMedia("(prefers-reduced-motion: reduce)").matches)return Promise.resolve();
    return new Promise(function(resolve){
      const book=$("flipBook"),host=document.createElement("div");host.className="qq-curl-host";host.setAttribute("aria-hidden","true");
      const w=book.clientWidth,h=book.clientHeight;
      if(w<1||h<1){resolve();return;}
      const first=document.createElement("div"),second=document.createElement("div");first.className=second.className="qq-curl-page";
      first.appendChild(dir==="next"?before:after);second.appendChild(dir==="next"?after:before);
      host.append(first,second);book.appendChild(host);
      let engine,finished=false,timer;
      function done(){if(finished)return;finished=true;clearTimeout(timer);if(engine)engine.destroy();else host.remove();resolve();}
      try {
        engine=new St.PageFlip(host,{width:w,height:h,size:"fixed",usePortrait:true,showCover:true,startPage:dir==="next"?0:1,flippingTime:680,maxShadowOpacity:.38,drawShadow:true,useMouseEvents:false,showPageCorners:false,mobileScrollSupport:false});
        engine.loadFromHTML([first,second]);
        engine.on("flip",function(ev){if(ev.data===(dir==="next"?1:0))setTimeout(done,45);});
        timer=setTimeout(done,2000);
        requestAnimationFrame(function(){if(dir==="next")engine.flipNext("top");else engine.flipPrev("top");});
      }catch(e){console.warn("[AIVAULT reader] curl fallback",e);done();}
    });
  }

  async function openBook(id) {
    if (!id) {
      toast("缺少電子書 ID");
      return;
    }
    state.bookId = id;
    state.subPage = 0; state.subPages = 1;
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
        if (local.source === "local" && localPages && localPages.length > 0) {
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
    let savedScreen=null;try {savedScreen=JSON.parse(localStorage.getItem("aivault_reader_screen_"+id)||"null");}catch(e){}
    await goPage(start, false);
    if(savedScreen&&savedScreen.page===state.pageNumber){state.subPage=Number(savedScreen.screen)||0;renderSpread();try {localStorage.setItem("aivault_reader_screen_"+id,JSON.stringify({page:state.pageNumber,screen:state.subPage}));}catch(e){}}
    if (!state.shelfBooks.some(function(b){return b.id===id;})) collectBooks().then(function(books){state.shelfBooks=books;if(state.bookId===id&&(state.view==="read"||state.view==="listen"))renderSpread();}).catch(function(){});
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
        if (n) goPage(n, false); // 目錄直接跳到該頁（帶方向時單頁模式只會前進一屏）
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
    const items = state.toc.filter(function(x){return Number(E.pick(x,["page_number","page","target_page"]))>0;}).sort(function(a,b){return Number(E.pick(a,["page_number","page","target_page"]))-Number(E.pick(b,["page_number","page","target_page"]));});
    for (let i = 0; i < items.length; i++) {
      const p = Number(E.pick(items[i],["page_number","page","target_page"]));
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
      const text = (current.content || "").replace(/\[\[img:[A-Za-z0-9_-]+\]\]/g, "");
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
      speakQueue.push({ n: n, text: p ? (p.content || "").replace(/\[\[img:[A-Za-z0-9_-]+\]\]/g, "") : "" });
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

  function narrationChapterTitle(){
    const p=state.cache.get(state.pageNumber)||{};if(p.chapter||p.section)return p.chapter||p.section;
    const chapters=state.toc.filter(function(t){return /^(第[一二三四五六七八九十百千0-9]+[編章节節章]|[壹貳參肆伍陸柒捌玖拾]、)/.test(String(t.title||""))&&Number(E.pick(t,["page_number","page","target_page"]))<=state.pageNumber;}).sort(function(a,b){return Number(E.pick(a,["page_number","page","target_page"]))-Number(E.pick(b,["page_number","page","target_page"]));});
    return chapters.length?chapters[chapters.length-1].title:"第 "+state.pageNumber+" 頁";
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
      '<label>字級 <input id="qqFont" type="range" min="16" max="30" value="'+(Number(localStorage.getItem("aivault_reader_font"))||21)+'"></label>' +
      '<div class="qq-themes"><button type="button" class="ib" data-theme="light">白紙</button><button type="button" class="ib" data-theme="sepia">護眼</button><button type="button" class="ib" data-theme="night">夜間</button></div>' +
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
    $("qqFont").oninput=function(){document.documentElement.style.setProperty("--qq-font",this.value+"px");localStorage.setItem("aivault_reader_font",this.value);renderSpread();};
    $("drawerBody").querySelectorAll("[data-theme]").forEach(function(b){b.onclick=function(){document.documentElement.dataset.readerTheme=b.dataset.theme;localStorage.setItem("aivault_reader_theme",b.dataset.theme);};});
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
        // deleteLocalBook now also persists a remote-shelf tombstone, so a
        // subsequent live catalog refresh cannot immediately resurrect the book.
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
    $("prevBtn").onclick = function () { requestTurn("prev"); };
    $("nextBtn").onclick = function () { requestTurn("next"); };
    $("jumpRange").onchange = function () { goPage($("jumpRange").value); };
    $("btnBackShelf").onclick = showShelf;
    $("btnToc").onclick = renderTocPanel;
    $("btnMark").onclick = renderBookmarkPanel;
    $("btnSearch").onclick = renderSearchPanel;
    $("btnNote").onclick = renderNotePanel;
    $("btnSpeak").onclick = function(){window.AIVAULTAudiobook.open();};
    $("qqListenShortcut").onclick=function(){window.AIVAULTAudiobook.open();};
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
      if (e.key === "ArrowRight" || e.key === "PageDown") requestTurn("next");
      if (e.key === "ArrowLeft" || e.key === "PageUp") requestTurn("prev");
    });

    const stage=$("stage");let start=null,suppress=0;
    stage.addEventListener("pointerdown",function(e){
      // 允許動畫中開始下一次手勢／點擊（由 requestTurn 佇列），不再因 flipping 丟掉 pointerdown
      if(window.AIVAULTQQSelectionEnabled||e.button!==0||e.target.closest("a,button,input,video,iframe,.precise-selecting"))return;
      start={x:e.clientX,y:e.clientY,id:e.pointerId,t:Date.now()};
    });
    stage.addEventListener("pointerup",function(e){
      if(!start||start.id!==e.pointerId)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;
      if(Math.abs(dx)>36&&Math.abs(dx)>Math.abs(dy)*0.85){
        suppress=Date.now()+280;
        state.curlHint={corner:dy<0?"bottom":"top",slope:Math.abs(dy)/Math.max(1,Math.abs(dx))};
        requestTurn(dx<0?"next":"prev");
      }
    });
    stage.addEventListener("pointercancel",function(){start=null;});
    stage.addEventListener("click",function(e){
      // 不因 flipping 丟點：連點進佇列。僅略過剛發生的滑動翻頁，避免 click+swipe 雙計
      if(window.AIVAULTQQSelectionEnabled||Date.now()<suppress||e.target.closest("a,button,input,video,iframe,.precise-selecting")||String(getSelection()||'').trim())return;
      const r=stage.getBoundingClientRect(),x=(e.clientX-r.left)/r.width;
      if(x<.28)requestTurn("prev");
      else if(x>.72)requestTurn("next");
      else $("readerView").classList.toggle("controls-open");
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

  document.documentElement.style.setProperty("--qq-font",(Number(localStorage.getItem("aivault_reader_font"))||21)+"px");
  document.documentElement.dataset.readerTheme=localStorage.getItem("aivault_reader_theme")||"light";
  function updateClock(){const el=$("qqClock");if(el)el.textContent=new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",hour12:false});}
  updateClock();setInterval(updateClock,30000);
  bindShelf();
  bindNav();
  window.AIVAULTReaderBridge = {
    requestTurn:requestTurn,
    goPage:goPage,
    get flipping(){return state.flipping;},
    get page(){return state.pageNumber;},
    get queueLen(){return turnQueue.length;},
    info:function(){const known=state.shelfBooks.find(function(b){return b.id===state.bookId;})||{};return {id:state.bookId,page:state.pageNumber,total:state.totalPages,title:$("readerTitle").textContent,chapter:narrationChapterTitle(),cover:(state.book&&state.book.cover_url)||known.cover_url||"",view:state.view};},
    paper:function(){return $("paperRight");},
    visibleSegment:function(){const paper=$("paperRight"),clip=paper.querySelector('.qq-page-viewport')||paper,r=clip.getBoundingClientRect();const mark=Array.from(paper.querySelectorAll('[data-narration]')).find(function(el){return Array.from(el.getClientRects()).some(function(m){return m.right>r.left&&m.left<r.right&&m.bottom>r.top&&m.top<r.bottom;});});return mark?Number(mark.dataset.narration):0;},
    peek:async function(n){try{const p=await getPage(n);if(!p)return [];const el=document.createElement("div");paintPaper(el,p,n);return el._narrationSegments||[];}catch(e){return [];}},
    loadPage:async function(n){try{await goPage(n,false,null,true);return state.pageNumber===n;}catch(e){return false;}},
    listen:function(){closeDrawer();state.view="listen";$("shelfView").hidden=true;$("readerView").hidden=true;$("listenView").hidden=false;setQS(state.bookId,state.pageNumber,"listen");},
    read:function(){closeDrawer();showReader();setQS(state.bookId,state.pageNumber,"read");renderSpread();},
    follow:function(index,charIndex){
      const paper=$("paperRight"), marks=Array.from(paper.querySelectorAll('[data-narration="'+index+'"]'));
      paper.querySelectorAll('.narration-active').forEach(function(el){el.classList.remove('narration-active');});
      marks.forEach(function(el){el.classList.add('narration-active');});
      if(state.view!=="read"||!marks.length||useSpread())return;
      const flow=paper.querySelector('.qq-page-flow'), viewport=paper.querySelector('.qq-page-viewport');if(!flow||!viewport||!viewport.clientWidth)return;
      let anchor=marks[0],remaining=Number(charIndex)||0;for(const mark of marks){anchor=mark;if(remaining<mark.textContent.length)break;remaining-=mark.textContent.length;}
      const x=anchor.getBoundingClientRect().left-flow.getBoundingClientRect().left;
      state.subPage=Math.max(0,Math.min(state.subPages-1,Math.floor(Math.max(0,x)/(viewport.clientWidth+40))));
      flow.style.transform='translateX('+(-state.subPage*(viewport.clientWidth+40))+'px)';updateReadingLabel();
    }
  };
  const startId = qs().get("ebook_id");
  const view = qs().get("view");
  if (startId && view !== "shelf") openBook(startId).then(function(){if(view==="listen"&&window.AIVAULTAudiobook)window.AIVAULTAudiobook.open(true);});
  else showShelf();
})();

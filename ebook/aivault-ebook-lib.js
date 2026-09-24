/* AIVAULT FlipBook core — ADD layer over dark-star-ebook-ingest. No DROP / no core replace. */
(function (global) {
  "use strict";

  const SUPABASE_URL = "https://clcddygkaaqqtsbswgdf.supabase.co";
  const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE";
  const INGEST = SUPABASE_URL + "/functions/v1/dark-star-ebook-ingest";
  const GATEWAY = SUPABASE_URL + "/functions/v1/ai-gateway";
  const CATALOG_KEY = "aivault_ebook_catalog";
  const READER_KEY = "aivault_ebook_reader_id";
  const FAV_KEY = "aivault_ebook_favorites";
  const CAT_KEY = "aivault_ebook_categories";
  const DB_NAME = "aivault_flipbook_v1";
  const DB_VER = 1;
  const DEFAULT_REMOTE = "3c203a20-258d-42b1-910f-5f10c8186033";

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }
  function now() { return new Date().toISOString(); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch];
    });
  }
  function pick(obj, keys) {
    if (!obj || typeof obj !== "object") return null;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (obj[k] != null && obj[k] !== "") return obj[k];
    }
    return null;
  }
  function readerId() {
    let id = localStorage.getItem(READER_KEY);
    if (!id) { id = uuid(); localStorage.setItem(READER_KEY, id); }
    return id;
  }
  function lsGet(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (e) { return fallback; }
  }
  function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  function catalog() { return lsGet(CATALOG_KEY, []); }
  function saveCatalog(rows) { lsSet(CATALOG_KEY, rows); }
  function rememberRemote(meta) {
    if (!meta || !meta.ebook_id) return;
    const rows = catalog().filter(function (r) { return r.ebook_id !== meta.ebook_id; });
    rows.unshift({
      ebook_id: meta.ebook_id,
      title: meta.title || "",
      author: meta.author || "",
      page_count: meta.page_count || meta.total_pages || 0,
      cover_url: meta.cover_url || "",
      saved_at: now(),
      source: "remote"
    });
    saveCatalog(rows.slice(0, 80));
  }

  async function ingest(payload) {
    const res = await fetch(INGEST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: "Bearer " + ANON_KEY
      },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }
    return { ok: res.ok, status: res.status, data: data, request: payload };
  }

  async function askGateway(system, userMessage) {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: "Bearer " + ANON_KEY
      },
      body: JSON.stringify({
        provider: "gemini",
        model: "gemini-2.5-flash",
        system: system,
        userMessage: userMessage
      })
    });
    const data = await res.json().catch(function () { return {}; });
    return data.reply || data.text || data.content || data.message || data.output || JSON.stringify(data);
  }

  let _db = null;
  function openDb() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains("books")) db.createObjectStore("books", { keyPath: "id" });
        if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "id" });
        if (!db.objectStoreNames.contains("pages")) {
          const ps = db.createObjectStore("pages", { keyPath: "id" });
          ps.createIndex("by_book", "book_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("bookmarks")) {
          const bs = db.createObjectStore("bookmarks", { keyPath: "id" });
          bs.createIndex("by_book", "book_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("notes")) {
          const ns = db.createObjectStore("notes", { keyPath: "id" });
          ns.createIndex("by_book", "book_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("progress")) db.createObjectStore("progress", { keyPath: "book_id" });
      };
      req.onsuccess = function () { _db = req.result; resolve(_db); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function txStore(store, mode) {
    return openDb().then(function (db) {
      return db.transaction(store, mode || "readonly").objectStore(store);
    });
  }
  function idbReq(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  async function idbPut(store, value) {
    const db = await openDb();
    return idbReq(db.transaction(store, "readwrite").objectStore(store).put(value));
  }
  async function idbGet(store, key) {
    const db = await openDb();
    return idbReq(db.transaction(store).objectStore(store).get(key));
  }
  async function idbAll(store) {
    const db = await openDb();
    return idbReq(db.transaction(store).objectStore(store).getAll());
  }
  async function idbIndex(store, index, key) {
    const db = await openDb();
    return idbReq(db.transaction(store).objectStore(store).index(index).getAll(key));
  }
  async function idbDel(store, key) {
    const db = await openDb();
    return idbReq(db.transaction(store, "readwrite").objectStore(store).delete(key));
  }

  function favorites() { return lsGet(FAV_KEY, []); }
  function setFavorite(bookId, on) {
    let rows = favorites();
    if (on) {
      if (rows.indexOf(bookId) < 0) rows.unshift(bookId);
    } else rows = rows.filter(function (id) { return id !== bookId; });
    lsSet(FAV_KEY, rows.slice(0, 200));
    return rows;
  }
  function isFav(bookId) { return favorites().indexOf(bookId) >= 0; }
  function categories() { return lsGet(CAT_KEY, ["未分類", "法律", "教材", "工作", "個人"]); }
  function saveCategories(rows) { lsSet(CAT_KEY, rows); }

  function pageContent(page) {
    if (!page) return "";
    return String(pick(page, ["content", "page_content", "text", "body", "html"]) || "");
  }

  async function fetchRemoteCatalog(limit) {
    return ingest({ action: "list", limit: limit || 80 });
  }
  async function fetchRemoteBook(ebookId, pageNumber) {
    const result = await ingest({ action: "book", ebook_id: ebookId, page_number: pageNumber || 1 });
    return result;
  }
  async function fetchRemoteToc(ebookId) {
    const result = await ingest({ action: "toc", ebook_id: ebookId });
    const data = result.data || {};
    return Array.isArray(data.toc) ? data.toc : (data.items || data.entries || []);
  }
  async function fetchRemoteContext(ebookId, pageNumber, radius) {
    return ingest({ action: "context", ebook_id: ebookId, page_number: pageNumber, radius: radius == null ? 1 : radius });
  }
  async function saveRemoteProgress(ebookId, pageNumber, total) {
    return ingest({
      action: "progress",
      ebook_id: ebookId,
      reader_id: readerId(),
      save: true,
      page_number: pageNumber,
      progress: total ? Number((pageNumber / total).toFixed(4)) : 0
    });
  }
  async function loadRemoteProgress(ebookId) {
    const result = await ingest({ action: "progress", ebook_id: ebookId, reader_id: readerId() });
    const p = result.data && result.data.progress;
    return p || result.data || null;
  }

  async function saveLocalProgress(bookId, currentPage, totalPages) {
    const row = {
      book_id: bookId,
      user_id: readerId(),
      current_page: currentPage,
      total_pages: totalPages,
      progress: totalPages ? currentPage / totalPages : 0,
      last_read_at: now()
    };
    await idbPut("progress", row);
    return row;
  }
  async function loadLocalProgress(bookId) {
    return idbGet("progress", bookId);
  }

  function inferTocFromText(pages) {
    const toc = [];
    const seen = {};
    const re = /^(第[一二三四五六七八九十百千0-9]+[編章節條](?:\\s*.*)?|第\\s*\\d+\\s*[章節編條](?:\\s*.*)?|Chapter\\s+\\d+(?:\\s+.*)?|CHAPTER\\s+\\d+(?:\\s+.*)?)/;
    function add(title, page, level) {
      const t = String(title || "").replace(/^[\\s\\-—–]+|[\\s\\-—–]+$/g, "").trim();
      const p = Number(page || 0);
      if (!t || !p || t.length > 120) return;
      const key = t + "|" + p;
      if (seen[key]) return;
      seen[key] = true;
      toc.push({ title: t, page_number: p, level: level || "section" });
    }
    pages.forEach(function (p) {
      const lines = String(p.content || "").split(/\\n+/);
      lines.forEach(function (line) {
        const t = line.trim().replace(/\\s{2,}/g, " ");
        if (t.length >= 2 && t.length < 120 && re.test(t)) {
          add(t, p.page_number, /編/.test(t) ? "part" : /章|Chapter/i.test(t) ? "chapter" : /節/.test(t) ? "section" : "article");
        }
      });
    });

    const allText = pages.map(function (p) { return String(p.content || ""); }).join("\\n");
    if (/中華人民共和國憲法|中华人民共和国宪法/.test(allText)) {
      const canonical = [
        ["序言", "preamble"],
        ["第一章　總綱", "chapter"],
        ["第二章　公民的基本權利和義務", "chapter"],
        ["第三章　國家機構", "chapter"],
        ["第四章　國旗、國歌、國徽、首都", "chapter"]
      ];
      canonical.forEach(function (entry) {
        let page = 0;
        for (let i = 0; i < pages.length; i++) {
          const txt = String(pages[i].content || "");
          const traditional = entry[0].replace(/　/g, " ");
          const simplified = traditional
            .replace(/總綱/g, "总纲")
            .replace(/公民的基本權利和義務/g, "公民的基本权利和义务")
            .replace(/國家機構/g, "国家机构")
            .replace(/國旗、國歌、國徽、首都/g, "国旗、国歌、国徽、首都");
          if (txt.indexOf(entry[0]) >= 0 || txt.indexOf(traditional) >= 0 || txt.indexOf(simplified) >= 0) {
            page = Number(pages[i].page_number || 0);
            break;
          }
        }
        if (page) add(entry[0], page, entry[1]);
      });
      const sections = [
        ["第一節　全國人民代表大會", "第一节 全国人民代表大会"],
        ["第二節　中華人民共和國主席", "第二节 中华人民共和国主席"],
        ["第三節　國務院", "第三节 国务院"],
        ["第四節　中央軍事委員會", "第四节 中央军事委员会"],
        ["第五節　地方各級人民代表大會和地方各級人民政府", "第五节 地方各级人民代表大会和地方各级人民政府"],
        ["第六節　民族自治地方的自治機關", "第六节 民族自治地方的自治机关"],
        ["第七節　監察委員會", "第七节 监察委员会"],
        ["第八節　人民法院和人民檢察院", "第八节 人民法院和人民检察院"]
      ];
      sections.forEach(function (entry) {
        for (let i = 0; i < pages.length; i++) {
          const txt = String(pages[i].content || "");
          if (txt.indexOf(entry[0]) >= 0 || txt.indexOf(entry[1]) >= 0) {
            add(entry[0], Number(pages[i].page_number || 0), "section");
            break;
          }
        }
      });
    }
    return toc.sort(function (a, b) {
      return Number(a.page_number || 0) - Number(b.page_number || 0);
    });
  }

  function searchPages(pages, query) {
    const q = String(query || "").trim();
    if (!q) return [];
    const hits = [];
    pages.forEach(function (p) {
      const text = String(p.content || "");
      let from = 0;
      const lower = text.toLowerCase();
      const needle = q.toLowerCase();
      let idx = lower.indexOf(needle, from);
      if (idx < 0) return;
      const start = Math.max(0, idx - 36);
      const end = Math.min(text.length, idx + q.length + 36);
      hits.push({
        page_number: p.page_number,
        snippet: (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "")
      });
    });
    return hits;
  }

  function parseComparePages(question) {
    const m = String(question || "").match(/第\s*(\d+)\s*頁[\s\S]{0,12}第\s*(\d+)\s*頁/);
    if (!m) return null;
    return [Number(m[1]), Number(m[2])];
  }

  async function saveBook(book) { await idbPut("books", book); return book; }
  async function getBook(id) { return idbGet("books", id); }
  async function allLocalBooks() { return idbAll("books"); }
  async function savePages(pages) {
    for (let i = 0; i < pages.length; i++) await idbPut("pages", pages[i]);
  }
  async function pagesOf(bookId) {
    const rows = await idbIndex("pages", "by_book", bookId);
    return (rows || []).sort(function (a, b) { return a.page_number - b.page_number; });
  }
  async function addBookmark(bookId, pageNumber, title) {
    const row = { id: uuid(), book_id: bookId, page_number: pageNumber, title: title || ("第 " + pageNumber + " 頁"), created_at: now(), user_id: readerId() };
    await idbPut("bookmarks", row);
    return row;
  }
  async function bookmarksOf(bookId) {
    const rows = await idbIndex("bookmarks", "by_book", bookId);
    return (rows || []).sort(function (a, b) { return a.page_number - b.page_number; });
  }
  async function removeBookmark(id) { return idbDel("bookmarks", id); }
  async function addNote(bookId, pageNumber, note) {
    const row = { id: uuid(), book_id: bookId, page_number: pageNumber, note: note, created_at: now(), user_id: readerId() };
    await idbPut("notes", row);
    return row;
  }
  async function notesOf(bookId) {
    const rows = await idbIndex("notes", "by_book", bookId);
    return (rows || []).sort(function (a, b) { return (b.created_at || "").localeCompare(a.created_at || ""); });
  }
  async function removeNote(id) { return idbDel("notes", id); }

  async function deleteLocalBook(bookId) {
    if (!bookId) throw new Error("missing book id");
    const db = await openDb();
    const stores = ["books", "files", "progress"];
    for (let i = 0; i < stores.length; i++) {
      try { await idbDel(stores[i], bookId); } catch (e) {}
    }
    const childStores = ["pages", "bookmarks", "notes"];
    for (let i = 0; i < childStores.length; i++) {
      const rows = await idbIndex(childStores[i], "by_book", bookId);
      for (let j = 0; j < rows.length; j++) await idbDel(childStores[i], rows[j].id);
    }
    let rows = catalog().filter(function (r) { return r.ebook_id !== bookId; });
    saveCatalog(rows);
    setFavorite(bookId, false);
    return true;
  }

  function splitTextPages(text, size) {
    const chunk = size || 900;
    const raw = String(text || "").replace(/\r\n/g, "\n");
    const pages = [];
    if (!raw.trim()) return pages;
    let buf = "";
    const paras = raw.split(/\n{2,}/);
    function push() {
      if (!buf.trim()) return;
      pages.push(buf.trim());
      buf = "";
    }
    paras.forEach(function (p) {
      const block = p.trim();
      if (!block) return;
      if ((buf + "\n\n" + block).length > chunk && buf) push();
      if (block.length > chunk) {
        for (let i = 0; i < block.length; i += chunk) {
          if (buf) push();
          buf = block.slice(i, i + chunk);
          if (buf.length >= chunk) push();
        }
      } else {
        buf = buf ? (buf + "\n\n" + block) : block;
      }
    });
    push();
    return pages;
  }

  function makeCover(title, author) {
    const c = document.createElement("canvas");
    c.width = 360; c.height = 500;
    const g = c.getContext("2d");
    g.fillStyle = "#1b1612";
    g.fillRect(0, 0, 360, 500);
    const grd = g.createLinearGradient(0, 0, 360, 500);
    grd.addColorStop(0, "#3b2a1a");
    grd.addColorStop(1, "#121014");
    g.fillStyle = grd;
    g.fillRect(0, 0, 360, 500);
    g.fillStyle = "#c4a36a";
    g.fillRect(24, 24, 312, 6);
    g.fillRect(24, 470, 312, 6);
    g.fillStyle = "#f4ead6";
    g.font = "bold 28px 'Noto Sans TC', sans-serif";
    wrapText(g, title || "未命名", 40, 180, 280, 36);
    g.fillStyle = "#d8cbb4";
    g.font = "16px 'Noto Sans TC', sans-serif";
    g.fillText(author || "", 40, 430);
    g.fillStyle = "#8a7655";
    g.font = "12px sans-serif";
    g.fillText("AIVAULT FlipBook", 40, 454);
    return c.toDataURL("image/jpeg", 0.82);
  }
  function wrapText(g, text, x, y, maxW, lh) {
    const chars = String(text || "").split("");
    let line = "";
    let yy = y;
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i];
      if (g.measureText(test).width > maxW && line) {
        g.fillText(line, x, yy);
        line = chars[i];
        yy += lh;
        if (yy > 360) break;
      } else line = test;
    }
    if (line) g.fillText(line, x, yy);
  }

  async function ensurePdfJs() {
    if (global.pdfjsLib) return global.pdfjsLib;
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    global.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    return global.pdfjsLib;
  }
  async function ensureMammoth() {
    if (global.mammoth) return global.mammoth;
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js");
    return global.mammoth;
  }
  async function ensureXlsx() {
    if (global.XLSX) return global.XLSX;
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
    return global.XLSX;
  }
  async function ensureJszip() {
    if (global.JSZip) return global.JSZip;
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
    return global.JSZip;
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("load " + src)); };
      document.head.appendChild(s);
    });
  }

  async function importFile(file, meta) {
    const name = file.name || "未命名";
    const title = (meta && meta.title) || name.replace(/\.[^.]+$/, "");
    const author = (meta && meta.author) || "";
    const ext = (name.split(".").pop() || "").toLowerCase();
    const mime = file.type || "";
    let pages = [];
    let kind = ext;

    if (ext === "pdf" || mime === "application/pdf") {
      kind = "pdf";
      pages = await importPdf(file);
    } else if (ext === "docx" || /wordprocessingml/.test(mime)) {
      kind = "docx";
      pages = await importDocx(file);
    } else if (ext === "pptx" || /presentationml/.test(mime)) {
      kind = "pptx";
      pages = await importPptx(file);
    } else if (ext === "xlsx" || ext === "xls" || /spreadsheet|excel/.test(mime)) {
      kind = "xlsx";
      pages = await importXlsx(file);
    } else if (/^(jpg|jpeg|png|webp|gif)$/.test(ext) || /^image\//.test(mime)) {
      kind = "image";
      pages = await importImage(file);
    } else {
      kind = "txt";
      const text = await file.text();
      pages = splitTextPages(text, 900).map(function (t, i) {
        return { page_number: i + 1, content: t, kind: "text", chapter: "", title: "" };
      });
    }

    const id = uuid();
    const cover = (pages[0] && pages[0].image) ? pages[0].image : makeCover(title, author);
    const tocSrc = inferTocFromText(pages);
    const book = {
      id: id,
      title: title,
      author: author,
      source: "local",
      kind: kind,
      file_name: name,
      page_count: pages.length,
      cover_url: cover,
      category: (meta && meta.category) || "未分類",
      created_at: now(),
      last_read_at: null,
      remote_id: null
    };
    const storedPages = pages.map(function (p) {
      return {
        id: id + ":" + p.page_number,
        book_id: id,
        page_number: p.page_number,
        content: p.content || "",
        image: p.image || "",
        html: p.html || "",
        kind: p.kind || "text",
        chapter: p.chapter || "",
        title: p.title || ""
      };
    });
    await saveBook(book);
    await savePages(storedPages);
    await idbPut("files", { id: id, name: name, type: mime, blob: file });
    rememberRemote({
      ebook_id: id,
      title: title,
      author: author,
      page_count: pages.length,
      cover_url: cover
    });
    return { book: book, pages: storedPages, toc: tocSrc };
  }

  async function importPdf(file) {
    const pdfjs = await ensurePdfJs();
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const pages = [];
    const maxPages = Math.min(doc.numPages, 250);
    for (let n = 1; n <= maxPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1.25 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;
      let text = "";
      try {
        const tc = await page.getTextContent();
        text = (tc.items || []).map(function (it) { return it.str; }).join(" ").replace(/\s+/g, " ").trim();
      } catch (e) { text = ""; }
      pages.push({
        page_number: n,
        content: text,
        image: canvas.toDataURL("image/jpeg", 0.72),
        kind: "pdf",
        title: ""
      });
    }
    return pages;
  }

  async function importDocx(file) {
    const mammoth = await ensureMammoth();
    const buf = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: buf });
    const html = result.value || "";
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const text = tmp.innerText || tmp.textContent || "";
    return splitTextPages(text, 1000).map(function (t, i) {
      return { page_number: i + 1, content: t, html: "", kind: "docx", title: "" };
    });
  }

  async function importPptx(file) {
    const JSZip = await ensureJszip();
    const zip = await JSZip.loadAsync(file);
    const names = Object.keys(zip.files).filter(function (n) {
      return /^ppt\/slides\/slide\d+\.xml$/.test(n);
    }).sort(function (a, b) {
      const na = Number((a.match(/slide(\d+)/) || [])[1] || 0);
      const nb = Number((b.match(/slide(\d+)/) || [])[1] || 0);
      return na - nb;
    });
    const pages = [];
    for (let i = 0; i < names.length; i++) {
      const xml = await zip.files[names[i]].async("string");
      const texts = [];
      xml.replace(/<a:t[^>]*>([^<]*)<\/a:t>/g, function (_, t) { texts.push(t); return _; });
      pages.push({
        page_number: i + 1,
        content: texts.join("\n"),
        kind: "pptx",
        title: "投影片 " + (i + 1)
      });
    }
    if (!pages.length) {
      pages.push({ page_number: 1, content: "（此 PPT 無法解析文字層）", kind: "pptx", title: "" });
    }
    return pages;
  }

  async function importXlsx(file) {
    const XLSX = await ensureXlsx();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const pages = [];
    wb.SheetNames.forEach(function (name, i) {
      const sheet = wb.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      pages.push({
        page_number: i + 1,
        content: "工作表：" + name + "\n\n" + csv,
        kind: "xlsx",
        title: name,
        chapter: name
      });
    });
    return pages;
  }

  async function importImage(file) {
    const url = await new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    return [{ page_number: 1, content: file.name, image: url, kind: "image", title: file.name }];
  }

  async function pushTextToIngest(title, author, text, description) {
    const created = await ingest({
      action: "create",
      title: title,
      author: author || "",
      version: "",
      description: description || ""
    });
    if (!created.ok) return created;
    const job_id = created.data.job_id || (created.data.job && created.data.job.id) || created.data.id;
    const ebook_id = created.data.ebook_id || (created.data.ebook && created.data.ebook.id) || created.data.book_id;
    const CHUNK = 20000;
    for (let i = 0, n = 0; i < text.length; i += CHUNK, n++) {
      const sent = await ingest({
        action: "append",
        job_id: job_id,
        ebook_id: ebook_id,
        sequence_no: n,
        content: text.slice(i, i + CHUNK),
        chunk_size: CHUNK
      });
      if (!sent.ok) return sent;
    }
    const fin = await ingest({ action: "finalize", job_id: job_id, ebook_id: ebook_id });
    if (fin.ok) rememberRemote({
      ebook_id: fin.data.ebook_id || ebook_id,
      title: title,
      author: author,
      page_count: 0
    });
    return fin.ok ? fin : created;
  }

  global.AIVAULTEbook = {
    SUPABASE_URL: SUPABASE_URL,
    ANON_KEY: ANON_KEY,
    INGEST: INGEST,
    GATEWAY: GATEWAY,
    DEFAULT_REMOTE: DEFAULT_REMOTE,
    uuid: uuid,
    esc: esc,
    pick: pick,
    readerId: readerId,
    catalog: catalog,
    rememberRemote: rememberRemote,
    ingest: ingest,
    askGateway: askGateway,
    favorites: favorites,
    setFavorite: setFavorite,
    isFav: isFav,
    categories: categories,
    saveCategories: saveCategories,
    pageContent: pageContent,
    fetchRemoteBook: fetchRemoteBook,
    fetchRemoteToc: fetchRemoteToc,
    fetchRemoteContext: fetchRemoteContext,
    saveRemoteProgress: saveRemoteProgress,
    loadRemoteProgress: loadRemoteProgress,
    saveLocalProgress: saveLocalProgress,
    loadLocalProgress: loadLocalProgress,
    inferTocFromText: inferTocFromText,
    searchPages: searchPages,
    parseComparePages: parseComparePages,
    saveBook: saveBook,
    getBook: getBook,
    allLocalBooks: allLocalBooks,
    savePages: savePages,
    pagesOf: pagesOf,
    addBookmark: addBookmark,
    bookmarksOf: bookmarksOf,
    removeBookmark: removeBookmark,
    addNote: addNote,
    notesOf: notesOf,
    removeNote: removeNote,
    deleteLocalBook: deleteLocalBook,
    splitTextPages: splitTextPages,
    makeCover: makeCover,
    importFile: importFile,
    pushTextToIngest: pushTextToIngest,
    openDb: openDb
  };
})(window);

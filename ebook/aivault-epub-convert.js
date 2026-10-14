/* AIVAULT ⚙️ 轉成 EPUB 並匯入（純前端；ADD-only，不修改既有匯入流程）
   docx → mammoth.js；pptx → JSZip 解析投影片文字與圖片；pdf → pdf.js 逐頁文字。
   產生 EPUB 3（JSZip），提供下載，並以既有方式匯入書架（本機頁面 + 遠端 ingest）。 */
(function (global) {
  "use strict";
  var E = global.AIVAULTEbook;
  if (!E) return;
  var TOC_KEY = "aivault_epub_toc:";
  var MAMMOTH = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js";
  var JSZIP = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
  var PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";

  // 本工具匯入的書：閱讀器目錄改用轉檔時的章節（其他書不受影響）
  var origInfer = E.inferTocFromText;
  E.inferTocFromText = function (pages) {
    try {
      var id = pages && pages[0] && pages[0].book_id;
      var saved = id && localStorage.getItem(TOC_KEY + id);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return origInfer.apply(this, arguments);
  };

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = src; s.onload = res;
      s.onerror = function () { rej(new Error("無法載入元件：" + src)); };
      document.head.appendChild(s);
    });
  }
  async function need(name, src) { if (!global[name]) await loadScript(src); return global[name]; }
  function esc(s) { return E.esc(s); }
  function textOf(html) { var d = document.createElement("div"); d.innerHTML = html; return (d.innerText || d.textContent || "").trim(); }

  // ---------- 各格式 → chapters [{title, html}] ----------
  async function fromDocx(file) {
    var mammoth = await need("mammoth", MAMMOTH);
    var r = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    var root = document.createElement("div"); root.innerHTML = r.value || "";
    var level = root.querySelector("h1") ? "H1" : root.querySelector("h2") ? "H2" : null;
    var chapters = [], cur = null;
    Array.prototype.slice.call(root.childNodes).forEach(function (node) {
      if (level && node.nodeName === level) {
        cur = { title: (node.textContent || "").trim() || ("第 " + (chapters.length + 1) + " 章"), html: node.outerHTML };
        chapters.push(cur); return;
      }
      if (!cur) { cur = { title: "前言", html: "" }; chapters.push(cur); }
      cur.html += node.outerHTML || esc(node.textContent || "");
    });
    chapters = chapters.filter(function (c) { return textOf(c.html) || /<img/i.test(c.html); });
    if (!level && chapters.length === 1) chapters[0].title = file.name.replace(/\.[^.]+$/, "");
    return chapters;
  }

  async function fromPptx(file) {
    var JSZip = await need("JSZip", JSZIP);
    var zip = await JSZip.loadAsync(file);
    var names = Object.keys(zip.files).filter(function (n) { return /^ppt\/slides\/slide\d+\.xml$/.test(n); })
      .sort(function (a, b) { return Number(a.match(/(\d+)\.xml/)[1]) - Number(b.match(/(\d+)\.xml/)[1]); });
    var dp = new DOMParser(), chapters = [];
    for (var i = 0; i < names.length; i++) {
      var xml = dp.parseFromString(await zip.files[names[i]].async("string"), "application/xml");
      var title = "", paras = [];
      Array.prototype.forEach.call(xml.getElementsByTagName("p:sp"), function (sp) {
        var ph = sp.getElementsByTagName("p:ph")[0], type = ph ? ph.getAttribute("type") : "";
        Array.prototype.forEach.call(sp.getElementsByTagName("a:p"), function (p) {
          var t = Array.prototype.map.call(p.getElementsByTagName("a:t"), function (x) { return x.textContent; }).join("").trim();
          if (!t) return;
          if (!title && (type === "title" || type === "ctrTitle")) title = t; else paras.push(t);
        });
      });
      if (!title) title = paras.shift() || ("投影片 " + (i + 1));
      var html = "<h2>" + esc(title) + "</h2>" + paras.map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("");
      var relName = names[i].replace("slides/", "slides/_rels/") + ".rels";
      if (zip.files[relName]) {
        var rels = dp.parseFromString(await zip.files[relName].async("string"), "application/xml");
        var blips = Array.prototype.map.call(xml.getElementsByTagName("a:blip"), function (b) { return b.getAttribute("r:embed"); });
        for (var j = 0; j < blips.length; j++) {
          var rel = Array.prototype.filter.call(rels.getElementsByTagName("Relationship"), function (r) { return r.getAttribute("Id") === blips[j]; })[0];
          if (!rel) continue;
          var path = "ppt/" + rel.getAttribute("Target").replace(/^\.\.\//, "");
          var ext = (path.split(".").pop() || "").toLowerCase();
          var mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" }[ext];
          if (!mime || !zip.files[path]) continue;
          html += '<p><img alt="" src="data:' + mime + ";base64," + (await zip.files[path].async("base64")) + '"></p>';
        }
      }
      chapters.push({ title: title, html: html });
    }
    if (!chapters.length) throw new Error("這個 PPTX 找不到投影片內容");
    return chapters;
  }

  var HEAD_RE = /^(第[一二三四五六七八九十百千0-9０-９]+[編章節篇]|[壹貳參肆伍陸柒捌玖拾]+、|Chapter\s+\d+|CHAPTER\s+\d+)/;
  async function fromPdf(file) {
    var pdfjs = await need("pdfjsLib", PDFJS + "pdf.min.js");
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
    var doc = await pdfjs.getDocument({ data: await file.arrayBuffer(), cMapUrl: PDFJS + "cmaps/", cMapPacked: true, standardFontDataUrl: PDFJS + "standard_fonts/" }).promise;
    var chapters = [], cur = null;
    for (var n = 1; n <= doc.numPages; n++) {
      var page = await doc.getPage(n), tc = await page.getTextContent(), lines = [], line = "";
      tc.items.forEach(function (it) { line += it.str; if (it.hasEOL) { lines.push(line.trim()); line = ""; } });
      if (line.trim()) lines.push(line.trim());
      lines = lines.filter(Boolean);
      var heads = lines.filter(function (l) { return l.length < 40 && HEAD_RE.test(l); });
      var isTocPage = heads.length > 5 || lines.some(function (l) { return /^目\s*[次錄录]$/.test(l); });
      lines.forEach(function (l) {
        if (!isTocPage && l.length < 40 && HEAD_RE.test(l)) {
          cur = { title: l, html: "<h2>" + esc(l) + "</h2>" }; chapters.push(cur); return;
        }
        if (!cur) { cur = { title: "封面與目次", html: "" }; chapters.push(cur); }
        cur.html += "<p>" + esc(l) + "</p>";
      });
      try { page.cleanup(); } catch (e) {}
    }
    try { doc.destroy(); } catch (e) {}
    chapters = chapters.filter(function (c) { return textOf(c.html); });
    if (!chapters.length) throw new Error("這個 PDF 沒有可擷取的文字層（可能是掃描檔）");
    return chapters;
  }

  // ---------- 產生 EPUB ----------
  function toXhtmlBody(html, images) {
    var doc = document.implementation.createHTMLDocument("x");
    doc.body.innerHTML = html;
    Array.prototype.forEach.call(doc.querySelectorAll("img"), function (img) {
      var src = img.getAttribute("src") || "", m = src.match(/^data:(image\/[a-z+]+);base64,(.*)$/);
      if (m) {
        var name = "img" + (images.length + 1) + "." + ({ "image/jpeg": "jpg", "image/svg+xml": "svg" }[m[1]] || m[1].split("/")[1]);
        images.push({ name: name, mime: m[1], data: m[2] });
        img.setAttribute("src", "images/" + name);
      }
      if (!img.getAttribute("alt")) img.setAttribute("alt", "");
    });
    var s = new XMLSerializer();
    return Array.prototype.map.call(doc.body.childNodes, function (n) { return s.serializeToString(n); }).join("")
      .replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, "");
  }
  async function buildEpub(title, chapters) {
    var JSZip = await need("JSZip", JSZIP);
    var zip = new JSZip(), id = "urn:uuid:" + E.uuid(), images = [];
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file("META-INF/container.xml", '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
    var css = "body{font-family:serif;line-height:1.7}h1,h2,h3{line-height:1.4}img{max-width:100%}";
    zip.file("OEBPS/style.css", css);
    chapters.forEach(function (c, i) {
      var body = toXhtmlBody(c.html, images);
      zip.file("OEBPS/ch" + (i + 1) + ".xhtml", '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-Hant"><head><meta charset="UTF-8"/><title>' + esc(c.title) + '</title><link rel="stylesheet" href="style.css"/></head><body>' + body + "</body></html>");
    });
    images.forEach(function (im) { zip.file("OEBPS/images/" + im.name, im.data, { base64: true }); });
    var nav = chapters.map(function (c, i) { return '<li><a href="ch' + (i + 1) + '.xhtml">' + esc(c.title) + "</a></li>"; }).join("");
    zip.file("OEBPS/nav.xhtml", '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-Hant"><head><meta charset="UTF-8"/><title>目錄</title></head><body><nav epub:type="toc" id="toc"><h1>目錄</h1><ol>' + nav + "</ol></nav></body></html>");
    zip.file("OEBPS/toc.ncx", '<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="' + id + '"/></head><docTitle><text>' + esc(title) + "</text></docTitle><navMap>" +
      chapters.map(function (c, i) { return '<navPoint id="n' + (i + 1) + '" playOrder="' + (i + 1) + '"><navLabel><text>' + esc(c.title) + '</text></navLabel><content src="ch' + (i + 1) + '.xhtml"/></navPoint>'; }).join("") + "</navMap></ncx>");
    var manifest = '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="css" href="style.css" media-type="text/css"/>' +
      chapters.map(function (c, i) { return '<item id="ch' + (i + 1) + '" href="ch' + (i + 1) + '.xhtml" media-type="application/xhtml+xml"/>'; }).join("") +
      images.map(function (im, i) { return '<item id="im' + (i + 1) + '" href="images/' + im.name + '" media-type="' + im.mime + '"/>'; }).join("");
    var spine = chapters.map(function (c, i) { return '<itemref idref="ch' + (i + 1) + '"/>'; }).join("");
    zip.file("OEBPS/content.opf", '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">' + id + "</dc:identifier><dc:title>" + esc(title) + '</dc:title><dc:language>zh-Hant</dc:language><meta property="dcterms:modified">' + new Date().toISOString().replace(/\.\d+Z$/, "Z") + "</meta></metadata><manifest>" + manifest + '</manifest><spine toc="ncx">' + spine + "</spine></package>");
    return zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
  }

  // ---------- 匯入書架（沿用既有：本機頁面 + 遠端 ingest） ----------
  async function importChapters(title, fileName, chapters, status) {
    var id = E.uuid(), cover = E.makeCover(title, "");
    var book = { id: id, title: title, author: "", source: "local", kind: "epub", file_name: fileName, page_count: chapters.length, cover_url: cover, category: "未分類", created_at: new Date().toISOString(), last_read_at: null, remote_id: null };
    var pages = chapters.map(function (c, i) {
      return { id: id + ":" + (i + 1), book_id: id, page_number: i + 1, content: textOf(c.html), image: "", html: c.html, kind: "epub", chapter: "", title: "" };
    });
    var toc = chapters.map(function (c, i) { return { title: c.title, page_number: i + 1, level: "chapter" }; });
    localStorage.setItem(TOC_KEY + id, JSON.stringify(toc));
    await E.saveBook(book);
    await E.savePages(pages);
    E.rememberRemote({ ebook_id: id, title: title, author: "", page_count: pages.length, cover_url: cover });
    status("正在同步《" + title + "》到電子書資料庫…");
    var text = chapters.map(function (c) { var t = textOf(c.html); return t.indexOf(c.title) === 0 ? t : c.title + "\n\n" + t; }).join("\n\n");
    var r = await E.pushTextToIngest(title, "", text, "AIVAULT 轉成 EPUB 並匯入：" + fileName);
    if (!r || !r.ok) throw new Error("本機已匯入，但遠端電子書建立失敗（HTTP " + ((r && r.status) || "network") + "）");
    var rid = r.data && (r.data.ebook_id || (r.data.ebook && r.data.ebook.id) || r.data.book_id);
    if (rid) {
      book.remote_id = rid; await E.saveBook(book);
      E.rememberRemote({ ebook_id: rid, title: title, author: "", page_count: book.page_count, cover_url: cover });
    }
    return book;
  }

  // ---------- 介面 ----------
  function ui() {
    var top = document.querySelector("#shelfView .shelf-top");
    if (!top || document.getElementById("btnEpubGear")) return;
    var st = document.createElement("style");
    st.textContent = ".epub-panel{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center}" +
      ".epub-panel[hidden]{display:none}.epub-card{background:#fff;color:#222;width:100%;max-width:520px;border-radius:16px 16px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -6px 24px rgba(0,0,0,.18)}" +
      "@media(min-width:700px){.epub-panel{align-items:center}.epub-card{border-radius:16px}}" +
      ".epub-card h3{margin:0 0 6px;font-size:18px}.epub-card p{margin:6px 0;font-size:14px;color:#555;line-height:1.6}" +
      ".epub-btn{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:46px;border:0;border-radius:12px;background:#2f6fe4;color:#fff;font-size:16px;font-weight:700;margin:10px 0;cursor:pointer;overflow:hidden}" +
      ".epub-btn input{position:absolute;inset:0;opacity:0;font-size:100px;cursor:pointer}.epub-status{min-height:22px;font-size:14px;color:#333;word-break:break-all}.epub-status a{color:#2f6fe4;font-weight:700}" +
      ".epub-close{float:right;border:0;background:#eee;border-radius:8px;height:30px;padding:0 10px}";
    document.head.appendChild(st);
    var gear = document.createElement("button");
    gear.className = "ib"; gear.id = "btnEpubGear"; gear.type = "button"; gear.setAttribute("aria-label", "設定"); gear.title = "設定"; gear.textContent = "⚙️";
    top.appendChild(gear);
    var panel = document.createElement("div");
    panel.className = "epub-panel"; panel.id = "epubPanel"; panel.hidden = true;
    panel.innerHTML = '<div class="epub-card" role="dialog" aria-label="設定"><button class="epub-close" id="epubClose" type="button">關閉</button><h3>⚙️ 設定</h3>' +
      '<label class="epub-btn">轉成 EPUB 並匯入<input id="epubFile" type="file" accept=".docx,.pdf,.pptx,.doc,.ppt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"></label>' +
      '<p>支援 Word（.docx）、PDF、PowerPoint（.pptx）。全部在你的裝置上轉換，完成後會下載 EPUB，並自動加入書架。</p><div class="epub-status" id="epubStatus" aria-live="polite"></div></div>';
    document.body.appendChild(panel);
    gear.onclick = function () { panel.hidden = false; };
    document.getElementById("epubClose").onclick = function () { panel.hidden = true; };
    panel.onclick = function (e) { if (e.target === panel) panel.hidden = true; };
    var statusEl = document.getElementById("epubStatus");
    function status(t) { statusEl.textContent = t; }
    var input = document.getElementById("epubFile"), busy = false;
    input.onchange = async function () {
      var f = input.files && input.files[0]; input.value = "";
      if (!f || busy) return;
      var ext = (f.name.split(".").pop() || "").toLowerCase();
      if (ext === "doc" || ext === "ppt") { status("舊版 ." + ext + " 格式無法在瀏覽器轉換，請先用 Word / PowerPoint「另存新檔」成 ." + ext + "x 再上傳。"); return; }
      if (["docx", "pdf", "pptx"].indexOf(ext) < 0) { status("只支援 .docx、.pdf、.pptx 檔案。"); return; }
      busy = true;
      var title = f.name.replace(/\.[^.]+$/, "");
      try {
        status("正在轉換 " + f.name + " …");
        var chapters = ext === "docx" ? await fromDocx(f) : ext === "pptx" ? await fromPptx(f) : await fromPdf(f);
        status("正在產生 EPUB（" + chapters.length + " 章）…");
        var blob = await buildEpub(title, chapters);
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a"); a.href = url; a.download = title + ".epub"; document.body.appendChild(a);
        try { a.click(); } catch (e) {} a.remove();
        status("正在匯入書架…");
        await importChapters(title, f.name, chapters, status);
        try { var on = document.querySelector("#shelfTabs .on"); if (on) on.click(); } catch (e) {}
        statusEl.innerHTML = "已完成《" + esc(title) + "》：" + chapters.length + " 章，已加入書架。<br>若沒有自動下載，請點 <a href=\"" + url + "\" download=\"" + esc(title) + ".epub\">下載 EPUB</a>";
      } catch (err) {
        console.error("[AIVAULT EPUB]", err);
        status("轉換失敗：" + (err && err.message || err));
      } finally { busy = false; }
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ui); else ui();
  global.AIVAULTEpub = { fromDocx: fromDocx, fromPptx: fromPptx, fromPdf: fromPdf, buildEpub: buildEpub, importChapters: importChapters };
})(window);

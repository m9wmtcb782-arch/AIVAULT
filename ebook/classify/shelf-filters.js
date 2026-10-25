/* Additive dual filters for dark-star-ebook shelf. Progressive; ?dualClassify=0 disables.
   Does not move files. Combines format + subject filters. Preserves year/semester/course/filename search via shelfQ enhancement. */
(function () {
  "use strict";
  if (typeof window === "undefined") return;
  var qs = location.search || "";
  var disabled = /[?&]dualClassify=0\b/.test(qs);
  // Default ON (progressive). dualClassify=1 forces on; dualClassify=0 off.
  var enabled = !disabled;

  var state = { format: "all", subject: "all" };
  var TAX = null;

  function $(id) { return document.getElementById(id); }

  function ensureBars() {
    if ($("dualFilterBar")) return $("dualFilterBar");
    var cat = $("catBar");
    var bar = document.createElement("div");
    bar.id = "dualFilterBar";
    bar.className = "dual-filter-bar";
    bar.hidden = !enabled;
    bar.innerHTML =
      '<div class="dual-row" id="dualFormatRow"></div>' +
      '<div class="dual-row" id="dualSubjectRow"></div>';
    if (cat && cat.parentNode) cat.parentNode.insertBefore(bar, cat.nextSibling);
    else {
      var tools = document.querySelector(".shelf-tools");
      if (tools && tools.parentNode) tools.parentNode.insertBefore(bar, tools.nextSibling);
    }
    if (!document.getElementById("dualClassifyCss")) {
      var st = document.createElement("style");
      st.id = "dualClassifyCss";
      st.textContent =
        ".dual-filter-bar{padding:8px 10px 0;display:flex;flex-direction:column;gap:6px}" +
        ".dual-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}" +
        ".dual-row button{height:30px;padding:0 10px;border-radius:8px;border:1px solid #333;background:#161a20;color:#ddd;cursor:pointer;font-size:12px}" +
        ".dual-row button.on{border-color:#6af;background:#1a2a3a;color:#fff}" +
        ".dual-row .dual-label{font-size:12px;color:#889;margin-right:4px}";
      document.head.appendChild(st);
    }
    return bar;
  }

  function paint() {
    if (!enabled) return;
    var bar = ensureBars();
    bar.hidden = false;
    var formats = [
      { id: "all", label: "全部" },
      { id: "pdf", label: "PDF" },
      { id: "powerpoint", label: "PowerPoint" },
      { id: "word", label: "Word" },
      { id: "other", label: "其他" }
    ];
    var subjects = (TAX && TAX.ui_subject_filters) || [
      { id: "all", label: "全部學科" },
      { id: "法律學", label: "法律學" },
      { id: "資訊工程", label: "資訊工程" },
      { id: "經濟與管理", label: "經濟與管理" },
      { id: "醫學與公共衛生", label: "醫學與公共衛生" },
      { id: "其他學科", label: "其他學科" },
      { id: "待確認", label: "待確認" }
    ];
    $("dualFormatRow").innerHTML =
      '<span class="dual-label">格式</span>' +
      formats.map(function (f) {
        return '<button type="button" data-dual-fmt="' + f.id + '" class="' + (state.format === f.id ? "on" : "") + '">' + f.label + "</button>";
      }).join("");
    $("dualSubjectRow").innerHTML =
      '<span class="dual-label">學科</span>' +
      subjects.map(function (s) {
        return '<button type="button" data-dual-subj="' + s.id + '" class="' + (state.subject === s.id ? "on" : "") + '">' + s.label + "</button>";
      }).join("");
    bar.querySelectorAll("[data-dual-fmt]").forEach(function (btn) {
      btn.onclick = function () {
        state.format = btn.getAttribute("data-dual-fmt");
        paint();
        if (window.__aivaultRenderShelf) window.__aivaultRenderShelf();
        else applyDomFilter();
      };
    });
    bar.querySelectorAll("[data-dual-subj]").forEach(function (btn) {
      btn.onclick = function () {
        state.subject = btn.getAttribute("data-dual-subj");
        paint();
        if (window.__aivaultRenderShelf) window.__aivaultRenderShelf();
        else applyDomFilter();
      };
    });
  }

  function metaFor(book) {
    var id = String(book.id || book.ebook_id || "");
    var c = (window.AivaultClassifyOverride && window.AivaultClassifyOverride.get(id)) || book.classify || {};
    // Seed bootstrap from title if no stored classify yet
    if (!c.primary_subject && !c.pending && window.AivaultSubjectClassify) {
      var auto = window.AivaultSubjectClassify.classifySubject({
        title: book.title || "",
        chapters: book.category || "",
        body: ""
      });
      c = {
        format_bucket: c.format_bucket || book.format_bucket || "pdf",
        primary_subject: auto.primary,
        secondary_tags: auto.secondary,
        group_ids: auto.group_ids,
        pending: auto.pending,
        confidence: auto.confidence,
        tags: auto.tags,
        rationale: auto.rationale
      };
      if (window.AivaultClassifyOverride) window.AivaultClassifyOverride.applyAuto(id, c, false);
    }
    return c;
  }

  function subjectMatches(c, filterId) {
    if (!filterId || filterId === "all") return true;
    if (filterId === "待確認") return !!(c.pending || !c.primary_subject);
    var filters = (TAX && TAX.ui_subject_filters) || [];
    var spec = null;
    for (var i = 0; i < filters.length; i++) if (filters[i].id === filterId) spec = filters[i];
    if (spec && spec.pending_only) return !!(c.pending || !c.primary_subject);
    var gids = c.group_ids || [];
    if (spec && spec.group_ids && spec.group_ids.length) {
      for (var j = 0; j < spec.group_ids.length; j++) {
        if (gids.indexOf(spec.group_ids[j]) >= 0) return true;
      }
      // also match primary subject belonging to group via taxonomy walk
      if (TAX && TAX.subject_groups) {
        for (var k = 0; k < spec.group_ids.length; k++) {
          var g = TAX.subject_groups[spec.group_ids[k]];
          if (!g) continue;
          var subs = (g.subjects || []).map(function (s) { return s.id; });
          if (c.primary_subject && subs.indexOf(c.primary_subject) >= 0) return true;
          var secs = c.secondary_tags || [];
          for (var n = 0; n < secs.length; n++) if (subs.indexOf(secs[n]) >= 0) return true;
        }
      }
      return false;
    }
    // fallback string equality on primary
    return c.primary_subject === filterId || (c.tags || []).indexOf(filterId) >= 0;
  }

  function filterBooks(books) {
    if (!enabled) return books;
    return (books || []).filter(function (b) {
      var c = metaFor(b);
      var fb = c.format_bucket || b.format_bucket || "other";
      if (state.format !== "all" && fb !== state.format) return false;
      if (!subjectMatches(c, state.subject)) return false;
      // Enhanced search: year / semester / course / filename via source_meta
      var qEl = $("shelfQ");
      var q = (qEl && qEl.value || "").trim().toLowerCase();
      if (!q) return true;
      var sm = b.source_meta || c.source_meta || {};
      var hay = [
        b.title, b.author, b.category,
        sm.academic_year, sm.semester, sm.course_code, sm.course_name, sm.file_name,
        c.primary_subject, (c.secondary_tags || []).join(" ")
      ].join(" ").toLowerCase();
      // If core reader already filtered by title/author, still allow through;
      // additional fields help when query targets course/year.
      return hay.indexOf(q) >= 0 || (b.title || "").toLowerCase().indexOf(q) >= 0;
    });
  }

  function applyDomFilter() {
    var grid = $("shelfGrid");
    if (!grid) return;
    var cards = grid.querySelectorAll("[data-open], .card, .book-card");
    // Fallback: if cards lack classify attrs, leave as-is (reader path uses filterBooks)
    void cards;
  }

  function loadTaxonomy() {
    return fetch("ebook/classify/taxonomy.json?v=dual1")
      .then(function (r) { return r.json(); })
      .then(function (t) {
        TAX = t;
        if (window.AivaultSubjectClassify) window.AivaultSubjectClassify.setTaxonomy(t);
        paint();
      })
      .catch(function () { paint(); });
  }

  window.AivaultDualClassify = {
    enabled: function () { return enabled; },
    filterBooks: filterBooks,
    metaFor: metaFor,
    state: state,
    renderBars: function () { paint(); },
    setTaxonomy: function (t) { TAX = t; }
  };

  function boot() {
    if (!enabled) return;
    ensureBars();
    loadTaxonomy();
    var q = $("shelfQ");
    if (q && !q.getAttribute("data-dual-ph")) {
      q.setAttribute("data-dual-ph", "1");
      q.placeholder = "搜尋書名、作者、學年、學期、課程、檔名";
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

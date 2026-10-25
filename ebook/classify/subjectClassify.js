/* Rule+keyword subject classifier. No paid APIs. */
(function (root) {
  "use strict";
  var TAX = null;

  function loadTaxonomySync() {
    if (TAX) return TAX;
    // Embedded minimal fallback if fetch not yet done
    TAX = root.AivaultTaxonomy || null;
    return TAX;
  }

  function scoreText(text, keywords) {
    var score = 0, hits = [];
    text = text || "";
    (keywords || []).forEach(function (kw) {
      if (kw && text.indexOf(kw) >= 0) {
        hits.push(kw);
        score += Math.max(1, Math.floor(kw.length / 2));
      }
    });
    return { score: score, hits: hits };
  }

  function classifySubject(opts) {
    opts = opts || {};
    var tax = opts.taxonomy || loadTaxonomySync();
    if (!tax) {
      return { primary: null, secondary: [], group_ids: [], confidence: 0, rationale: ["taxonomy_not_loaded"], pending: true, tags: [], model_hook: "rules_keywords_v1" };
    }
    var title = opts.title || "";
    var toc = opts.toc || "";
    var chapters = opts.chapters || "";
    var body = (opts.body || "").slice(0, 12000);
    var parts = [
      ["title", title, 3],
      ["toc", toc, 2],
      ["chapters", chapters, 1.5],
      ["body", body, 1]
    ];
    var best = [];
    var rationale = [];
    var groups = tax.subject_groups || {};
    Object.keys(groups).forEach(function (gid) {
      (groups[gid].subjects || []).forEach(function (sub) {
        var total = 0, allHits = [], wheres = [];
        parts.forEach(function (p) {
          var r = scoreText(p[1], sub.keywords || []);
          if (r.score) {
            total += r.score * p[2];
            allHits = allHits.concat(r.hits);
            wheres.push(p[0]);
          }
        });
        if (total > 0) best.push({ total: total, id: sub.id, gid: gid, hits: allHits, wheres: wheres });
      });
    });
    best.sort(function (a, b) { return b.total - a.total || (a.id < b.id ? -1 : 1); });
    var minAccept = ((tax.confidence || {}).min_accept) || 0.45;
    var secondaryTags = [];
    var blob = [title, toc, chapters, body].join("\n");
    (tax.secondary_tag_lexicon || []).forEach(function (lex) {
      var r = scoreText(blob, lex.keywords || []);
      if (r.score) {
        secondaryTags.push(lex.tag);
        rationale.push("secondary:" + lex.tag);
      }
    });
    if (!best.length) {
      return { primary: null, secondary: secondaryTags, group_ids: [], confidence: 0, rationale: ["no keyword hits → 待確認"].concat(rationale), pending: true, tags: secondaryTags, model_hook: "rules_keywords_v1" };
    }
    var top = best[0];
    var conf = Math.min(0.99, top.total / (top.total + 8));
    if (top.wheres.indexOf("title") >= 0) {
      conf = Math.min(0.99, conf + 0.12);
      rationale.push("title_keyword_boost");
    }
    rationale.push("primary:" + top.id + " score=" + top.total);
    var secondaries = [];
    var groupIds = [top.gid];
    best.slice(1, 6).forEach(function (b) {
      var titleHit = b.wheres.indexOf("title") >= 0 && b.total >= 3;
      var strong = b.total >= Math.max(3, top.total * 0.25);
      if (strong || titleHit) {
        secondaries.push(b.id);
        if (groupIds.indexOf(b.gid) < 0) groupIds.push(b.gid);
      }
    });
    secondaryTags.forEach(function (t) {
      if (secondaries.indexOf(t) < 0 && t !== top.id) secondaries.push(t);
    });
    if (conf < minAccept) {
      rationale.push("confidence low → 待確認");
      return { primary: null, secondary: secondaries, group_ids: groupIds, confidence: conf, rationale: rationale, pending: true, tags: secondaries, model_hook: "rules_keywords_v1" };
    }
    return { primary: top.id, secondary: secondaries, group_ids: groupIds, confidence: conf, rationale: rationale, pending: false, tags: [top.id].concat(secondaries.filter(function (s) { return s !== top.id; })), model_hook: "rules_keywords_v1" };
  }

  root.AivaultSubjectClassify = { classifySubject: classifySubject, setTaxonomy: function (t) { TAX = t; root.AivaultTaxonomy = t; } };
})(typeof window !== "undefined" ? window : globalThis);

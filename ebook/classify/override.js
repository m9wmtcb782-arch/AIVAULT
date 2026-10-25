(function (root) {
  "use strict";
  var KEY = "aivault_ebook_classify_tags";

  function all() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; }
  }
  function save(map) {
    localStorage.setItem(KEY, JSON.stringify(map));
  }
  function get(ebookId) {
    return all()[String(ebookId)] || null;
  }
  function setManual(ebookId, patch) {
    var map = all();
    var cur = Object.assign({}, map[String(ebookId)] || {});
    Object.keys(patch || {}).forEach(function (k) { cur[k] = patch[k]; });
    cur.manual_locked = true;
    cur.user_override = true;
    cur.override_at = new Date().toISOString();
    map[String(ebookId)] = cur;
    save(map);
    return cur;
  }
  function applyAuto(ebookId, classify, force) {
    var map = all();
    var cur = Object.assign({}, map[String(ebookId)] || {});
    if ((cur.manual_locked || cur.user_override) && !force) {
      cur.skipped_auto_subject = true;
      if (!cur.format_bucket && classify && classify.format_bucket) cur.format_bucket = classify.format_bucket;
      map[String(ebookId)] = cur;
      save(map);
      return cur;
    }
    map[String(ebookId)] = Object.assign({}, classify, { manual_locked: false, user_override: false, skipped_auto_subject: false, classified_at: new Date().toISOString() });
    save(map);
    return map[String(ebookId)];
  }

  root.AivaultClassifyOverride = { KEY: KEY, all: all, get: get, setManual: setManual, applyAuto: applyAuto };
})(typeof window !== "undefined" ? window : globalThis);

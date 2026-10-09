(() => {
  if (window.__AIVAULT_RENAME_DARK_STAR_LIVE__) return;
  window.__AIVAULT_RENAME_DARK_STAR_LIVE__ = true;
  function rename(el) {
    if (!el) return;
    var text = String(el.textContent || "");
    if (text.indexOf("即時語音") < 0) return;
    el.textContent = text.replace(/即時語音/g, "暗星即時");
  }
  function scan() {
    rename(document.getElementById("darkStarLiveButton"));
    document.querySelectorAll("button, a").forEach(rename);
  }
  scan();
  setInterval(scan, 400);
  document.addEventListener("DOMContentLoaded", scan);
})();

/* AIVAULT 協作池小說成果顯示修正：只修復可見換行標記，不改寫原文內容或資料庫。 */
(function () {
  'use strict';
  var SELECTOR = '.res, .novel-text, .novel-content, .subtitle, [data-novel-text]';
  function normalize(value) {
    return String(value == null ? '' : value)
      .replace(/\r\n?/g, '\n')
      .replace(/(?:\\n|\/n){2,}/gi, '\n\n')
      .replace(/(?:\\n|\/n)/gi, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  }
  function fixElement(el) {
    if (!el || !el.matches || !el.matches(SELECTOR)) return;
    el.style.whiteSpace = 'pre-wrap';
    el.style.overflowWrap = 'anywhere';
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      var next = normalize(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
  }
  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches(SELECTOR)) fixElement(root);
    if (root.querySelectorAll) root.querySelectorAll(SELECTOR).forEach(fixElement);
  }
  function start() {
    scan(document.body);
    var observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        if (record.type === 'characterData') {
          var host = record.target.parentElement && record.target.parentElement.closest(SELECTOR);
          if (host) fixElement(host);
        } else {
          record.addedNodes.forEach(function (node) { if (node.nodeType === 1) scan(node); });
        }
      });
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
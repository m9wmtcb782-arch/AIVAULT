(function () {
  "use strict";
  var startCaret = null;
  var endCaret = null;
  var selectedText = "";
  var selectedLen = 0;
  var liveRange = null;
  var pointerStart = null;
  var rebuildTimer = 0;
  function $(id) { return document.getElementById(id); }
  function toast(msg) {
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 2200);
  }
  function papers() { return [$("paperLeft"), $("paperRight")].filter(Boolean); }
  function isPaperTextTarget(node) {
    if (!node) return false;
    var el = node.nodeType === 3 ? node.parentElement : node;
    if (!el || !el.closest) return false;
    if (el.closest("#preciseSelectBar, #drawer, .toolbar, .pagerow, .reader-top, .pageno")) return false;
    var paper = el.closest("#paperLeft, #paperRight");
    if (!paper) return false;
    if (el.closest("h3, button, a, input, textarea, select, img")) return false;
    return true;
  }
  function clampOffset(node, offset) {
    if (!node || node.nodeType !== 3) return 0;
    var max = node.nodeValue ? node.nodeValue.length : 0;
    if (offset < 0) return 0;
    if (offset > max) return max;
    return offset;
  }
  function caretFromPoint(x, y) {
    var range = null;
    try {
      if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(x, y);
      else if (document.caretPositionFromPoint) {
        var pos = document.caretPositionFromPoint(x, y);
        if (pos && pos.offsetNode) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.collapse(true);
        }
      }
    } catch (e) { range = null; }
    if (!range) return null;
    var node = range.startContainer;
    var offset = range.startOffset;
    if (node && node.nodeType !== 3) {
      node = nearestTextNode(node, offset);
      offset = 0;
    }
    if (!node || node.nodeType !== 3) return null;
    if (!isPaperTextTarget(node)) return null;
    offset = clampOffset(node, offset);
    if (!node.isConnected) return null;
    return { node: node, offset: offset };
  }
  function nearestTextNode(root, index) {
    if (!root) return null;
    if (root.nodeType === 3) return root;
    var kids = root.childNodes || [];
    var start = Math.min(index || 0, kids.length);
    var i, found;
    for (i = start; i < kids.length; i++) { found = firstTextNode(kids[i]); if (found) return found; }
    for (i = start - 1; i >= 0; i--) { found = firstTextNode(kids[i]); if (found) return found; }
    return firstTextNode(root);
  }
  function firstTextNode(root) {
    if (!root) return null;
    if (root.nodeType === 3 && root.nodeValue && root.nodeValue.length) return root;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.length) return NodeFilter.FILTER_REJECT;
        if (!isPaperTextTarget(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    return w.nextNode();
  }
  function caretAlive(c) { return !!(c && c.node && c.node.nodeType === 3 && c.node.isConnected); }
  function compareCarets(a, b) {
    if (!a || !b) return 0;
    if (a.node === b.node) return a.offset - b.offset;
    try {
      var pos = a.node.compareDocumentPosition(b.node);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    } catch (e) {}
    return 0;
  }
  function buildRange(a, b) {
    if (!caretAlive(a) || !caretAlive(b)) return null;
    var first = a, last = b;
    if (compareCarets(a, b) > 0) { first = b; last = a; }
    try {
      var range = document.createRange();
      range.setStart(first.node, clampOffset(first.node, first.offset));
      range.setEnd(last.node, clampOffset(last.node, last.offset));
      return range;
    } catch (e) { return null; }
  }
  function rangePlainText(range) {
    if (!range) return "";
    var raw = "";
    try { raw = range.toString(); } catch (e) { raw = ""; }
    return String(raw || "").replace(/【教材原文】/g, " ").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").trim();
  }
  function countChars(text) {
    return String(text || "").replace(/\s+/g, "").length || String(text || "").trim().length;
  }
  function clearVisual() {
    liveRange = null;
    try { if (window.CSS && CSS.highlights) CSS.highlights.delete("aivault-precise"); } catch (e) {}
    document.querySelectorAll(".precise-sel-mark, .precise-sel-caret").forEach(function (n) {
      try { n.parentNode && n.parentNode.removeChild(n); } catch (e) {}
    });
  }
  function paintOverlays(range) {
    if (!range) return;
    var rects;
    try { rects = range.getClientRects(); } catch (e) { return; }
    var i;
    for (i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (!r.width || !r.height) continue;
      var hit = document.elementFromPoint(r.left + Math.min(4, r.width / 2), r.top + Math.min(4, r.height / 2));
      var paper = hit && hit.closest ? hit.closest("#paperLeft, #paperRight") : null;
      if (!paper) {
        papers().some(function (p) {
          var b = p.getBoundingClientRect();
          if (r.left >= b.left - 2 && r.right <= b.right + 2 && r.top >= b.top - 2 && r.bottom <= b.bottom + 2) { paper = p; return true; }
          return false;
        });
      }
      if (!paper) continue;
      var pb = paper.getBoundingClientRect();
      var mark = document.createElement("div");
      mark.className = "precise-sel-mark";
      mark.style.left = (r.left - pb.left + paper.scrollLeft) + "px";
      mark.style.top = (r.top - pb.top + paper.scrollTop) + "px";
      mark.style.width = Math.max(2, r.width) + "px";
      mark.style.height = Math.max(2, r.height) + "px";
      if (getComputedStyle(paper).position === "static") paper.style.position = "relative";
      paper.appendChild(mark);
    }
  }
  function paintCaret(c) {
    if (!caretAlive(c)) return;
    try {
      var r = document.createRange();
      var off = clampOffset(c.node, c.offset);
      if (off < (c.node.nodeValue || "").length) { r.setStart(c.node, off); r.setEnd(c.node, off + 1); }
      else if (off > 0) { r.setStart(c.node, off - 1); r.setEnd(c.node, off); }
      else return;
      var rect = r.getBoundingClientRect();
      var paper = (c.node.parentElement && c.node.parentElement.closest("#paperLeft, #paperRight"));
      if (!paper || !rect) return;
      var pb = paper.getBoundingClientRect();
      var caret = document.createElement("div");
      caret.className = "precise-sel-caret";
      caret.style.left = (rect.left - pb.left + paper.scrollLeft) + "px";
      caret.style.top = (rect.top - pb.top + paper.scrollTop) + "px";
      caret.style.height = Math.max(14, rect.height) + "px";
      if (getComputedStyle(paper).position === "static") paper.style.position = "relative";
      paper.appendChild(caret);
    } catch (e) {}
  }
  function applyVisual() {
    clearVisual();
    if (caretAlive(startCaret) && caretAlive(endCaret)) {
      var range = buildRange(startCaret, endCaret);
      liveRange = range;
      if (!range) return;
      var usedHighlight = false;
      try {
        if (window.CSS && CSS.highlights && window.Highlight) {
          CSS.highlights.set("aivault-precise", new Highlight(range));
          usedHighlight = true;
        }
      } catch (e) { usedHighlight = false; }
      if (!usedHighlight) paintOverlays(range);
    } else if (caretAlive(startCaret)) paintCaret(startCaret);
  }
  function setStatus() {
    var text = "尚未選取";
    if (selectedText) text = "已選取 " + selectedLen + " 字";
    else if (startCaret && !endCaret) text = "已設定朗讀開始位置";
    document.querySelectorAll(".ps-status").forEach(function (el) { el.textContent = text; });
  }
  function clearSelection(keepToast) {
    startCaret = null; endCaret = null; selectedText = ""; selectedLen = 0;
    clearVisual(); setStatus();
    if (!keepToast) toast("已清除選取");
  }
  function commitRange() {
    var range = buildRange(startCaret, endCaret);
    if (!range) { selectedText = ""; selectedLen = 0; setStatus(); toast("選取失敗，請再點一次文字"); return; }
    var text = rangePlainText(range);
    if (!text) { selectedText = ""; selectedLen = 0; setStatus(); toast("選取內容是空白，請改點正文"); return; }
    selectedText = text;
    selectedLen = countChars(text);
    applyVisual(); setStatus();
    toast("已選取 " + selectedLen + " 字");
  }
  function handleTap(x, y) {
    var caret = caretFromPoint(x, y);
    if (!caret) return false;
    if (!startCaret || (startCaret && endCaret)) {
      startCaret = caret; endCaret = null; selectedText = ""; selectedLen = 0;
      applyVisual(); setStatus(); toast("已設定朗讀開始位置"); return true;
    }
    endCaret = caret;
    if (compareCarets(startCaret, endCaret) === 0) { endCaret = null; toast("結束位置與開始位置相同，請再點一次"); return true; }
    commitRange(); return true;
  }
  function pickChineseVoice() {
    if (!("speechSynthesis" in window)) return null;
    var voices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
    if (!voices.length) return null;
    var preferred = voices.filter(function (v) {
      var name = String(v.name || "");
      var lang = String(v.lang || "").toLowerCase();
      return lang === "zh-tw" || /Tingting|Meijia/i.test(name);
    });
    return preferred[0] || voices.find(function (v) { return String(v.lang || "").toLowerCase().indexOf("zh") === 0; }) || null;
  }
  function speakViaExistingSpeechSynthesis(text) {
    if (!("speechSynthesis" in window)) { toast("此裝置不支援語音朗讀"); return; }
    var raw = String(text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!raw) { toast("請先點擊文字設定開始與結束位置。"); return; }
    var chunks = [];
    for (var i = 0; i < raw.length; i += 300) chunks.push(raw.slice(i, i + 300));
    try { speechSynthesis.cancel(); } catch (e) {}
    function speakChunk(index) {
      if (index >= chunks.length) return;
      var u = new SpeechSynthesisUtterance(chunks[index]);
      u.lang = "zh-TW";
      var voice = pickChineseVoice();
      if (voice) u.voice = voice;
      u.onend = function () { speakChunk(index + 1); };
      u.onerror = function (ev) { toast("朗讀失敗" + (ev && ev.error ? "：" + ev.error : "")); };
      speechSynthesis.speak(u);
    }
    speakChunk(0);
  }
  function speakSelected() {
    var text = selectedText;
    if (!text && liveRange) text = rangePlainText(liveRange);
    text = String(text || "").trim();
    if (!text) { toast("請先點擊文字設定開始與結束位置。"); return; }
    window.__AIVAULT_LAST_TTS_TEXT = text;
    try {
      var fish = window.AIVAULTFishTTS;
      if (fish && typeof fish.useFish === "function" && fish.useFish() && typeof fish.playText === "function") {
        fish.playText(text); return;
      }
    } catch (e) {}
    try {
      var tts = window.AIVAULTReaderTTS;
      if (tts && typeof tts.speakSelectedText === "function") { tts.speakSelectedText(text); return; }
      if (tts && typeof tts.speakText === "function") { tts.speakText(text); return; }
    } catch (e) {}
    speakViaExistingSpeechSynthesis(text);
  }
  function injectBar() {
    var bottom = document.querySelector(".reader-bottom");
    if (!bottom || $("preciseSelectBar")) return;
    var bar = document.createElement("div");
    bar.id = "preciseSelectBar";
    bar.className = "precise-select-bar";
    bar.innerHTML = '<span class="ps-status" id="preciseSelectStatus">尚未選取</span><button class="ib" type="button" id="spSelected">🔊 朗讀選取內容</button><button class="ib" type="button" id="spClearSel">✕ 清除選取</button>';
    var pagerow = bottom.querySelector(".pagerow");
    if (pagerow && pagerow.nextSibling) bottom.insertBefore(bar, pagerow.nextSibling);
    else bottom.insertBefore(bar, bottom.firstChild);
    $("spSelected").addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); speakSelected(); });
    $("spClearSel").addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); clearSelection(); });
  }
  function injectDrawer() {
    var body = $("drawerBody");
    var title = $("drawerTitle");
    if (!body || !title || title.textContent.indexOf("朗讀") < 0) return;
    if (body.querySelector("#preciseDrawerBox")) return;
    var box = document.createElement("div");
    box.id = "preciseDrawerBox";
    box.className = "precise-drawer-box";
    box.innerHTML = '<div class="ps-status">尚未選取</div><p class="muted">閱讀正文時點兩次：第一次開始、第二次結束，只朗讀中間文字。</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="ib" type="button" id="spSelectedDrawer">🔊 朗讀選取內容</button><button class="ib" type="button" id="spClearDrawer">✕ 清除選取</button></div>';
    body.insertBefore(box, body.firstChild);
    var speakBtn = $("spSelectedDrawer");
    var clearBtn = $("spClearDrawer");
    if (speakBtn) speakBtn.onclick = speakSelected;
    if (clearBtn) clearBtn.onclick = function () { clearSelection(); };
    setStatus();
  }
  function onPointerDown(ev) {
    if (!ev || ev.button) return;
    pointerStart = { x: ev.clientX, y: ev.clientY, t: Date.now() };
  }
  function onPointerUp(ev) {
    if (!pointerStart) return;
    var sx = pointerStart.x, sy = pointerStart.y;
    pointerStart = null;
    if (!ev || ev.button) return;
    if (Math.abs(ev.clientX - sx) > 18 || Math.abs(ev.clientY - sy) > 18) return;
    if (!isPaperTextTarget(ev.target)) return;
    try { handleTap(ev.clientX, ev.clientY); } catch (e) {}
  }
  function onPapersRebuilt() {
    if (caretAlive(startCaret) && caretAlive(endCaret)) { applyVisual(); return; }
    startCaret = null; endCaret = null; liveRange = null; clearVisual(); setStatus();
  }
  function watchPapers() {
    papers().forEach(function (p) {
      if (p._preciseObserved) return;
      p._preciseObserved = true;
      var obs = new MutationObserver(function (records) {
        var meaningful = records.some(function (rec) {
          var nodes = [];
          rec.addedNodes && rec.addedNodes.forEach(function (n) { nodes.push(n); });
          rec.removedNodes && rec.removedNodes.forEach(function (n) { nodes.push(n); });
          if (!nodes.length && rec.type === "characterData") return true;
          return nodes.some(function (n) {
            if (!n) return false;
            if (n.nodeType === 1 && n.classList && (n.classList.contains("precise-sel-mark") || n.classList.contains("precise-sel-caret"))) return false;
            return true;
          });
        });
        if (!meaningful) return;
        clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(onPapersRebuilt, 40);
      });
      obs.observe(p, { childList: true, subtree: true, characterData: true });
    });
  }
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointerup", onPointerUp, true);
  document.addEventListener("DOMContentLoaded", function () {
    injectBar(); watchPapers();
    var drawer = $("drawer");
    if (drawer) new MutationObserver(function () { injectDrawer(); setStatus(); }).observe(drawer, { childList: true, subtree: true });
  });
  injectBar(); watchPapers();
  if ($("drawer")) new MutationObserver(function () { injectDrawer(); setStatus(); }).observe($("drawer"), { childList: true, subtree: true });
  window.AIVAULTPreciseSelect = {
    getSelectedText: function () { return selectedText; },
    lastSentText: function () { return window.__AIVAULT_LAST_TTS_TEXT || ""; },
    clear: function () { clearSelection(true); },
    speak: speakSelected
  };
})();

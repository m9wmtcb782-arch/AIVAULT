/* iPhone-safe speaker: toggle current-page read, never open mask/drawer. */
(function () {
  "use strict";

  var speaking = false;
  var gen = 0;
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function $(id) { return document.getElementById(id); }

  function toast(msg) {
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 1800);
  }

  function releaseUI() {
    var drawer = $("drawer");
    var mask = $("mask");
    if (drawer) drawer.classList.remove("open", "right");
    if (mask) mask.hidden = true;
    document.body.style.pointerEvents = "";
    var app = $("app");
    if (app) app.style.pointerEvents = "";
  }

  function stopEverything() {
    speaking = false;
    gen += 1;
    try {
      if (window.AIVAULTFishTTS && typeof window.AIVAULTFishTTS.stop === "function") {
        window.AIVAULTFishTTS.stop();
      }
    } catch (e) {}
    try {
      if (window.AIVAULTPreciseSelect && typeof window.AIVAULTPreciseSelect.stop === "function") {
        window.AIVAULTPreciseSelect.stop();
      }
    } catch (e) {}
    if (!ios) {
      try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    }
    releaseUI();
    var btn = $("btnSpeak");
    if (btn) btn.textContent = "🔊";
  }

  function pageText() {
    var left = $("paperLeft");
    var right = $("paperRight");
    var t = ((left && left.innerText) || "") + "\n" + ((right && right.innerText) || "");
    return String(t).replace(/【教材原文】/g, " ").replace(/\s+/g, " ").trim();
  }

  function speakChunks(text, token) {
    if (!("speechSynthesis" in window)) {
      toast("此裝置不支援語音朗讀");
      speaking = false;
      return;
    }
    var size = ios ? 80 : 220;
    var chunks = [];
    var i;
    for (i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
    function next(index) {
      if (token !== gen || !speaking) return;
      if (index >= chunks.length) {
        speaking = false;
        var btn = $("btnSpeak");
        if (btn) btn.textContent = "🔊";
        return;
      }
      var u = new SpeechSynthesisUtterance(chunks[index]);
      u.lang = "zh-TW";
      u.rate = 1;
      u.onend = function () { next(index + 1); };
      u.onerror = function () {
        if (token !== gen) return;
        speaking = false;
        var btn = $("btnSpeak");
        if (btn) btn.textContent = "🔊";
      };
      try { speechSynthesis.speak(u); } catch (e) {
        speaking = false;
        toast("朗讀無法啟動，請再試一次");
      }
    }
    next(0);
  }

  function startPageSpeak() {
    var text = pageText();
    if (!text) { toast("這一頁沒有可朗讀文字"); return; }
    speaking = true;
    gen += 1;
    var token = gen;
    var btn = $("btnSpeak");
    if (btn) btn.textContent = "⏹️";
    toast("朗讀本頁，再按喇叭可停止");
    try {
      var fish = window.AIVAULTFishTTS;
      if (fish && typeof fish.useFish === "function" && fish.useFish() && typeof fish.playText === "function") {
        fish.playText(text);
        return;
      }
    } catch (e) {}
    speakChunks(text, token);
  }

  function onSpeakTap(ev) {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    releaseUI();
    if (speaking) {
      stopEverything();
      toast("已停止朗讀");
      return;
    }
    startPageSpeak();
  }

  function bindSpeakToggle() {
    var btn = $("btnSpeak");
    if (!btn || btn._iosSpeakBound) return;
    btn._iosSpeakBound = true;
    btn.addEventListener("click", onSpeakTap, true);
    btn.addEventListener("touchend", function (ev) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      onSpeakTap(ev);
    }, true);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") stopEverything();
  });

  document.addEventListener("click", function (ev) {
    var t = ev.target;
    var id = t && t.id;
    if (id === "spStop" || id === "btnCloseDrawer" || id === "btnBackShelf") stopEverything();
    if (t && t.closest && t.closest("#toolbar") && id !== "btnSpeak") releaseUI();
  }, true);

  setInterval(function () {
    releaseUI();
    bindSpeakToggle();
  }, 1200);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindSpeakToggle);
  } else {
    bindSpeakToggle();
  }

  window.AIVAULTSpeakUnfreeze = { stop: stopEverything };
})();

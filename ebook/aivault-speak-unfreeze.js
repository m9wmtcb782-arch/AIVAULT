/* Recover FlipBook when the speaker button leaves the mask/TTS stuck. */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function toast(msg) {
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 1800);
  }

  function stopEverything() {
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
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
    var drawer = $("drawer");
    var mask = $("mask");
    if (drawer) drawer.classList.remove("open", "right");
    if (mask) mask.hidden = true;
    document.body.style.pointerEvents = "";
    var app = $("app");
    if (app) app.style.pointerEvents = "";
  }

  function isSpeaking() {
    try {
      return !!(window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending));
    } catch (e) { return false; }
  }

  function bindSpeakToggle() {
    var btn = $("btnSpeak");
    if (!btn || btn._unfreezeBound) return;
    btn._unfreezeBound = true;
    btn.addEventListener("click", function (ev) {
      var drawer = $("drawer");
      var open = drawer && drawer.classList.contains("open");
      if (isSpeaking() || open) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        stopEverything();
        toast("已停止朗讀");
        btn.textContent = "🔊";
        return;
      }
    }, true);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") stopEverything();
  });

  document.addEventListener("click", function (ev) {
    var id = ev.target && ev.target.id;
    if (id === "spStop" || id === "btnCloseDrawer") {
      setTimeout(stopEverything, 0);
    }
  }, true);

  setInterval(function () {
    var drawer = $("drawer");
    var mask = $("mask");
    if (mask && !mask.hidden && drawer && !drawer.classList.contains("open")) {
      mask.hidden = true;
    }
    bindSpeakToggle();
  }, 800);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindSpeakToggle);
  } else {
    bindSpeakToggle();
  }

  window.AIVAULTSpeakUnfreeze = { stop: stopEverything };
})();

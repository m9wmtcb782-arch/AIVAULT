(function () {
  "use strict";
  if (!("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const origSpeak = synth.speak.bind(synth);
  const origCancel = synth.cancel.bind(synth);
  const origPause = synth.pause.bind(synth);
  const origResume = synth.resume.bind(synth);
  let ctx = null;
  let watch = null;
  let userPaused = false;
  let lastText = "";
  let lastLang = "zh-TW";

  function unlockContext() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!ctx) ctx = new AC();
      if (ctx.state === "suspended") ctx.resume();
    } catch (e) {}
    try { synth.getVoices(); } catch (e) {}
  }

  function speakSaved() {
    if (!lastText) return;
    const u = new SpeechSynthesisUtterance(lastText);
    u.lang = lastLang || "zh-TW";
    u.rate = 1;
    u.volume = 1;
    origSpeak(u);
  }

  function startWatch() {
    if (watch) return;
    watch = setInterval(function () {
      try {
        if (userPaused) return;
        if (synth.speaking && synth.paused) origResume();
      } catch (e) {}
    }, 4000);
  }

  synth.speak = function (utterance) {
    userPaused = false;
    if (utterance && utterance.text) {
      lastText = utterance.text;
      lastLang = utterance.lang || "zh-TW";
    }
    unlockContext();
    startWatch();
    return origSpeak(utterance);
  };

  synth.pause = function () {
    userPaused = true;
    return origPause();
  };

  synth.resume = function () {
    userPaused = false;
    unlockContext();
    const r = origResume();
    setTimeout(function () {
      if (!synth.speaking && lastText) speakSaved();
    }, 80);
    return r;
  };

  synth.cancel = function () {
    userPaused = false;
    try { return origCancel(); } finally {
      if (watch) { clearInterval(watch); watch = null; }
    }
  };

  document.addEventListener("touchstart", unlockContext, { passive: true });
  document.addEventListener("click", function (ev) {
    unlockContext();
    const id = ev.target && ev.target.id;
    if (id === "spResume") {
      userPaused = false;
      setTimeout(function () {
        if (!synth.speaking && lastText) speakSaved();
      }, 80);
    }
  }, { passive: true });
})();

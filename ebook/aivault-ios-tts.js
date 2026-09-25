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

  function unlockContext() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!ctx) ctx = new AC();
      if (ctx.state === "suspended") ctx.resume();
    } catch (e) {}
    try { synth.getVoices(); } catch (e) {}
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

  function stopWatch() {
    if (watch) { clearInterval(watch); watch = null; }
  }

  synth.speak = function (utterance) {
    userPaused = false;
    unlockContext();
    startWatch();
    try {
      return origSpeak(utterance);
    } catch (e) {
      stopWatch();
      throw e;
    }
  };

  synth.pause = function () {
    userPaused = true;
    return origPause();
  };

  synth.resume = function () {
    userPaused = false;
    unlockContext();
    return origResume();
  };

  synth.cancel = function () {
    userPaused = false;
    stopWatch();
    return origCancel();
  };

  document.addEventListener("touchstart", unlockContext, { passive: true });
  document.addEventListener("click", unlockContext, { passive: true });
})();

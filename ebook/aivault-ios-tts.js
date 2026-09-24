(function () {
  "use strict";
  if (!("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const origSpeak = synth.speak.bind(synth);
  const origCancel = synth.cancel.bind(synth);
  let ctx = null;
  let watch = null;

  function unlock() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        if (!ctx) ctx = new AC();
        if (ctx.state === "suspended") ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.0008;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop((ctx.currentTime || 0) + 0.04);
      }
    } catch (e) {}
    try { synth.getVoices(); } catch (e) {}
    try { if (synth.paused) synth.resume(); } catch (e) {}
  }

  function startWatch() {
    if (watch) return;
    watch = setInterval(function () {
      try {
        if (synth.speaking && synth.paused) synth.resume();
      } catch (e) {}
    }, 4000);
  }

  synth.speak = function (utterance) {
    unlock();
    startWatch();
    try { if (synth.paused) synth.resume(); } catch (e) {}
    return origSpeak(utterance);
  };

  synth.cancel = function () {
    try { return origCancel(); } finally {
      if (watch) { clearInterval(watch); watch = null; }
    }
  };

  document.addEventListener("touchstart", unlock, { passive: true, once: false });
  document.addEventListener("click", unlock, { passive: true, once: false });
})();

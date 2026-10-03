(function () {
  if (window.__AIVAULT_DAWN_OWN_AUDIO__) return;
  window.__AIVAULT_DAWN_OWN_AUDIO__ = true;
  var stream = null, proc = null, ctx = null, on = false;
  function payload(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return JSON.stringify({ type: "audio", data: btoa(bin), mimeType: "audio/pcm;rate=16000" });
  }
  function pressed(id) {
    var btn = document.getElementById(id);
    if (!btn) return false;
    if (btn.getAttribute("aria-pressed") === "true") return true;
    if (btn.classList.contains("active")) return true;
    return /\u2713|\u2714/.test(btn.textContent || "");
  }
  function darkOn() { return pressed("darkStarLiveButton") || !!window.__AIVAULT_LIVE_VOICE_WANTED__; }
  function dawnOn() { return pressed("dawnLightLiveButton"); }
  function start() {
    var voice = window.DawnLightLiveVoice;
    if (!voice || on || darkOn() || !dawnOn()) return;
    on = true;
    var opening = voice.isOpen && voice.isOpen() ? Promise.resolve(true) : voice.start();
    Promise.resolve(opening).then(function () {
      return navigator.mediaDevices.getUserMedia({ audio: true });
    }).then(function (media) {
      if (!media || !on || darkOn() || !dawnOn()) {
        on = false;
        if (media) media.getTracks().forEach(function (track) { track.stop(); });
        return;
      }
      stream = media;
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      var src = ctx.createMediaStreamSource(stream);
      proc = ctx.createScriptProcessor(4096, 1, 1);
      var silent = ctx.createGain();
      silent.gain.value = 0;
      proc.onaudioprocess = function (event) {
        var current = window.DawnLightLiveVoice;
        if (!on || darkOn() || !dawnOn() || !current || !current.isOpen || !current.isOpen()) return;
        var input = event.inputBuffer.getChannelData(0);
        var pcm = new Int16Array(input.length);
        for (var j = 0; j < input.length; j++) {
          var v = Math.max(-1, Math.min(1, input[j]));
          pcm[j] = v < 0 ? v * 32768 : v * 32767;
        }
        current.sendRaw(payload(new Uint8Array(pcm.buffer)));
      };
      src.connect(proc);
      proc.connect(silent);
      silent.connect(ctx.destination);
    }).catch(function () { on = false; });
  }
  function stop() {
    on = false;
    if (proc) { try { proc.disconnect(); } catch (e) {} }
    if (ctx) { try { ctx.close(); } catch (e) {} }
    if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
    proc = null; ctx = null; stream = null;
    if (window.DawnLightLiveVoice) window.DawnLightLiveVoice.stop();
  }
  document.addEventListener("click", function (event) {
    var btn = event.target && event.target.closest ? event.target.closest("#dawnLightLiveButton") : null;
    if (!btn) return;
    setTimeout(function () { if (dawnOn() && !darkOn()) start(); if (!dawnOn()) stop(); }, 0);
  }, true);
  setInterval(function () {
    if (dawnOn() && !darkOn() && !on) start();
    if ((!dawnOn() || darkOn()) && on) stop();
  }, 400);
})();

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
    if (btn.classList.contains("active") || btn.classList.contains("live-voice-on")) return true;
    return /\u2713|\u2714/.test(btn.textContent || "");
  }
  function dawnOn() {
    var live = window.AivaultDualAgentLive;
    return pressed("dawnLightLiveButton") || !!(live && live.armed && live.armed().dawn);
  }
  function connect() {
    var voice = window.DawnLightLiveVoice;
    if (!voice) return;
    if (!voice.isOpen || !voice.isOpen()) voice.start();
    if (voice.setGain) voice.setGain(1);
  }
  function startMic() {
    var voice = window.DawnLightLiveVoice;
    if (!voice || on || !dawnOn()) return;
    on = true;
    connect();
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (media) {
      if (!media || !on || !dawnOn()) {
        on = false;
        if (media) media.getTracks().forEach(function (track) { track.stop(); });
        return;
      }
      stream = media;
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      if (ctx.state !== "running") ctx.resume();
      var src = ctx.createMediaStreamSource(stream);
      proc = ctx.createScriptProcessor(4096, 1, 1);
      var silent = ctx.createGain();
      silent.gain.value = 0;
      proc.onaudioprocess = function (event) {
        var current = window.DawnLightLiveVoice;
        if (!on || !dawnOn() || !current || !current.isOpen || !current.isOpen()) return;
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
    setTimeout(function () {
      if (dawnOn()) { connect(); startMic(); }
      else stop();
    }, 0);
  }, true);
  setInterval(function () {
    if (dawnOn()) { connect(); if (!on) startMic(); }
    if (!dawnOn() && on) stop();
  }, 400);
})();

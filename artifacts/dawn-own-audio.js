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
  function darkOn() { return pressed("darkStarLiveButton") || !!window.__AIVAULT_LIVE_VOICE_WANTED__; }
  function dawnOn() {
    var live = window.AivaultDualAgentLive;
    return pressed("dawnLightLiveButton") || !!(live && live.armed && live.armed().dawn);
  }
  function hookPlay() {
    var voice = window.DawnLightLiveVoice;
    if (!voice || !voice.session || voice.session.__blobPlay) return;
    var orig = voice.session.onMessage;
    voice.session.onMessage = function (raw) {
      if (typeof Blob !== "undefined" && raw instanceof Blob) {
        var self = this;
        raw.text().then(function (text) { self.onMessage(text); }).catch(function () {});
        return;
      }
      return orig.call(this, raw);
    };
    voice.session.__blobPlay = true;
    if (voice.setGain) voice.setGain(1);
  }
  function start() {
    var voice = window.DawnLightLiveVoice;
    if (!voice || on || darkOn() || !dawnOn()) return;
    on = true;
    var opening = voice.isOpen && voice.isOpen() ? Promise.resolve(true) : voice.start();
    Promise.resolve(opening).then(function () {
      if (voice.setGain) voice.setGain(1);
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
      if (ctx.state !== "running") ctx.resume();
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
    if (!dawnOn() && window.DawnLightLiveVoice) window.DawnLightLiveVoice.stop();
  }
  setInterval(function () {
    hookPlay();
    if (dawnOn() && !darkOn() && !on) start();
    if ((!dawnOn() || darkOn()) && on) stop();
  }, 400);
})();

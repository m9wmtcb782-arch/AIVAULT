(function () {
  if (window.__AIVAULT_DAWN_OWN_AUDIO__) return;
  window.__AIVAULT_DAWN_OWN_AUDIO__ = true;
  var stream = null;
  var proc = null;
  var ctx = null;
  var on = false;

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
  function dawnOn() { return pressed("dawnLightLiveButton"); }

  window.__AIVAULT_COPY_PCM_TO_DAWN__ = function (data) {
    var voice = window.DawnLightLiveVoice;
    if (!dawnOn() || !voice || !voice.isOpen || !voice.isOpen()) return;
    voice.sendRaw(data);
  };
  if (!WebSocket.prototype.__aivaultCopyDawn) {
    var origSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      var result = origSend.apply(this, arguments);
      var url = String(this.url || "");
      if (url.indexOf("agent_id=technical-dark-star") !== -1 && typeof data === "string" && data.indexOf('"type":"audio"') !== -1) {
        window.__AIVAULT_COPY_PCM_TO_DAWN__(data);
      }
      return result;
    };
    WebSocket.prototype.__aivaultCopyDawn = true;
  }

  function start() {
    var voice = window.DawnLightLiveVoice;
    if (!voice || on || darkOn()) return;
    on = true;
    var opening = voice.isOpen && voice.isOpen() ? Promise.resolve(true) : voice.start();
    Promise.resolve(opening).then(function () {
      return navigator.mediaDevices.getUserMedia({ audio: true });
    }).then(function (media) {
      if (!media || !on || darkOn()) {
        if (media) media.getTracks().forEach(function (track) { track.stop(); });
        on = false;
        return;
      }
      stream = media;
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      var sourceRate = Number(ctx.sampleRate) || 16000;
      var src = ctx.createMediaStreamSource(stream);
      proc = ctx.createScriptProcessor(4096, 1, 1);
      var silent = ctx.createGain();
      silent.gain.value = 0;
      proc.onaudioprocess = function (event) {
        var current = window.DawnLightLiveVoice;
        if (!on || darkOn() || !current || !current.isOpen || !current.isOpen()) return;
        var input = event.inputBuffer.getChannelData(0);
        var samples = input;
        if (sourceRate !== 16000) {
          var outLength = Math.max(1, Math.round(input.length * 16000 / sourceRate));
          var out = new Float32Array(outLength);
          var ratio = sourceRate / 16000;
          for (var i = 0; i < outLength; i++) {
            var pos = i * ratio, idx = Math.floor(pos), frac = pos - idx;
            var x = input[Math.min(idx, input.length - 1)] || 0;
            var y = input[Math.min(idx + 1, input.length - 1)] || x;
            out[i] = x + (y - x) * frac;
          }
          samples = out;
        }
        var pcm = new Int16Array(samples.length);
        for (var j = 0; j < samples.length; j++) {
          var v = Math.max(-1, Math.min(1, samples[j]));
          pcm[j] = v < 0 ? v * 32768 : v * 32767;
        }
        current.sendRaw(payload(new Uint8Array(pcm.buffer)));
      };
      src.connect(proc);
      proc.connect(silent);
      silent.connect(ctx.destination);
    }).catch(function () { on = false; });
  }

  function stopMic() {
    on = false;
    if (proc) { try { proc.disconnect(); } catch (e) {} }
    if (ctx) { try { ctx.close(); } catch (e) {} }
    if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
    proc = null;
    ctx = null;
    stream = null;
  }

  setInterval(function () {
    var voice = window.DawnLightLiveVoice;
    if (dawnOn() && voice && voice.isOpen && !voice.isOpen()) voice.start();
    if (dawnOn() && !darkOn() && !on) start();
    if ((darkOn() || !dawnOn()) && on) stopMic();
    if (!dawnOn() && voice) voice.stop();
  }, 400);
})();

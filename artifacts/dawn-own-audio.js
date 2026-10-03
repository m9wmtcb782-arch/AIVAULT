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

  function start() {
    var voice = window.DawnLightLiveVoice;
    if (!voice || on) return;
    on = true;
    var opening = voice.isOpen && voice.isOpen() ? Promise.resolve(true) : voice.start();
    Promise.resolve(opening).then(function () {
      return navigator.mediaDevices.getUserMedia({ audio: true });
    }).then(function (media) {
      if (!media || !on) return;
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
        if (!on || !current || !current.isOpen || !current.isOpen()) return;
        var input = event.inputBuffer.getChannelData(0);
        var samples = input;
        if (sourceRate !== 16000) {
          var outLength = Math.max(1, Math.round(input.length * 16000 / sourceRate));
          var out = new Float32Array(outLength);
          var ratio = sourceRate / 16000;
          for (var i = 0; i < outLength; i++) {
            var pos = i * ratio;
            var idx = Math.floor(pos);
            var frac = pos - idx;
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

  function stop() {
    on = false;
    if (proc) { try { proc.disconnect(); } catch (e) {} }
    if (ctx) { try { ctx.close(); } catch (e) {} }
    if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
    proc = null;
    ctx = null;
    stream = null;
    if (window.DawnLightLiveVoice) window.DawnLightLiveVoice.stop();
  }

  function dawnOn() {
    var live = window.AivaultDualAgentLive;
    return !!(live && live.armed && live.armed().dawn);
  }

  setInterval(function () {
    if (dawnOn() && !on) start();
    if (!dawnOn() && on) stop();
  }, 400);
})();

(function () {
  if (window.__AIVAULT_DAWN_OWN_AUDIO__) return;
  window.__AIVAULT_DAWN_OWN_AUDIO__ = true;
  var stream = null;
  var proc = null;
  var ctx = null;
  var on = false;
  var dawnEl = null;
  var dawnText = "";

  function armed() {
    var live = window.AivaultDualAgentLive;
    return live && live.armed ? live.armed() : { dark: false, dawn: false };
  }
  function darkOn() { return !!(armed().dark || window.__AIVAULT_LIVE_VOICE_WANTED__); }
  function dawnOn() { return !!armed().dawn; }
  function named(text) {
    var t = String(text || "");
    return { dark: /暗星|dark\s*star/i.test(t), dawn: /曙光|dawn\s*light/i.test(t) };
  }
  function updateWake(text) {
    var both = darkOn() && dawnOn();
    var hit = named(text);
    window.__AIVAULT_SUPPRESS_DARK_AUDIO__ = !!(both && hit.dawn && !hit.dark);
    window.__AIVAULT_SUPPRESS_DAWN_AUDIO__ = !!(both && hit.dark && !hit.dawn);
  }
  function payload(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return JSON.stringify({ type: "audio", data: btoa(bin), mimeType: "audio/pcm;rate=16000" });
  }
  window.__AIVAULT_COPY_PCM_TO_DAWN__ = function (data) {
    var voice = window.DawnLightLiveVoice;
    if (!dawnOn() || window.__AIVAULT_SUPPRESS_DAWN_AUDIO__) return;
    if (!voice || !voice.isOpen || !voice.isOpen()) return;
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
  function renderDawn(text) {
    var inner = document.getElementById("messagesInner");
    if (!inner) return;
    var welcome = document.getElementById("welcome");
    if (welcome) welcome.remove();
    if (!dawnEl) {
      var row = document.createElement("div");
      row.className = "message assistant";
      row.dataset.speaker = "dawn-light";
      var avatar = document.createElement("div");
      avatar.className = "message-avatar";
      avatar.textContent = "曙光";
      var body = document.createElement("div");
      body.className = "message-body";
      dawnEl = document.createElement("div");
      dawnEl.className = "message-text";
      body.appendChild(dawnEl);
      row.append(avatar, body);
      inner.appendChild(row);
    }
    dawnEl.textContent = text;
    var box = document.getElementById("messages");
    if (box) box.scrollTop = box.scrollHeight;
  }
  function startDawnMic() {
    var voice = window.DawnLightLiveVoice;
    if (!voice || on || darkOn()) return;
    on = true;
    var opening = voice.isOpen && voice.isOpen() ? Promise.resolve(true) : voice.start();
    Promise.resolve(opening).then(function () {
      return navigator.mediaDevices.getUserMedia({ audio: true });
    }).then(function (media) {
      if (!media || !on || darkOn()) { if (media) media.getTracks().forEach(function (track) { track.stop(); }); return; }
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
        if (window.__AIVAULT_SUPPRESS_DAWN_AUDIO__) return;
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
  function stopDawnMic() {
    on = false;
    if (proc) { try { proc.disconnect(); } catch (e) {} }
    if (ctx) { try { ctx.close(); } catch (e) {} }
    if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
    proc = null; ctx = null; stream = null;
  }
  function isolateStops() {
    var live = window.AivaultDualAgentLive;
    if (!live || live.__splitStop || typeof live.arm !== "function") return;
    var orig = live.arm;
    live.arm = function (which, next) {
      var result = orig.call(live, which, next);
      if (which === "dark" && !next && typeof window.__AIVAULT_DARK_STAR_STOP__ === "function") window.__AIVAULT_DARK_STAR_STOP__();
      if (which === "dawn" && !next) {
        stopDawnMic();
        if (window.DawnLightLiveVoice) window.DawnLightLiveVoice.stop();
      }
      return result;
    };
    live.__splitStop = true;
  }
  function isolateDawnPlayback() {
    var voice = window.DawnLightLiveVoice;
    if (!voice || !voice.session || voice.session.__splitPlay) return;
    var orig = voice.session.playPcm;
    voice.session.playPcm = function (bytes) {
      if (window.__AIVAULT_SUPPRESS_DAWN_AUDIO__) return;
      return orig.call(this, bytes);
    };
    voice.session.__splitPlay = true;
  }
  window.addEventListener("aivault-conversation-event", function (event) {
    var detail = event.detail || {};
    if (detail.speaker === "user") updateWake(detail.text);
    if (detail.speaker !== "dawn-light") return;
    dawnText = detail.partial ? (dawnText + detail.text) : String(detail.text || dawnText);
    if (!detail.partial) dawnText = String(detail.text || "");
    renderDawn(dawnText);
    if (!detail.partial) dawnEl = null;
  });
  setInterval(function () {
    isolateStops();
    isolateDawnPlayback();
    if (dawnOn() && !darkOn() && !on) startDawnMic();
    if ((!dawnOn() || darkOn()) && on) stopDawnMic();
    if (dawnOn() && window.DawnLightLiveVoice && window.DawnLightLiveVoice.isOpen && !window.DawnLightLiveVoice.isOpen()) window.DawnLightLiveVoice.start();
  }, 400);
})();

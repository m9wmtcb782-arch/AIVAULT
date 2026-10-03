(function () {
  if (window.__AIVAULT_DAWN_OWN_AUDIO__) return;
  window.__AIVAULT_DAWN_OWN_AUDIO__ = true;
  var stream = null, proc = null, ctx = null, on = false, userEl = null, dawnEl = null, userText = "", dawnText = "";
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
  function bubble(label) {
    var inner = document.getElementById("messagesInner");
    if (!inner) return null;
    var welcome = document.getElementById("welcome");
    if (welcome) welcome.remove();
    var row = document.createElement("div");
    row.className = "message " + (label === "\u4f60" ? "user" : "assistant");
    var avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = label;
    var body = document.createElement("div");
    body.className = "message-body";
    var text = document.createElement("div");
    text.className = "message-text";
    body.appendChild(text);
    row.append(avatar, body);
    inner.appendChild(row);
    var box = document.getElementById("messages");
    if (box) box.scrollTop = box.scrollHeight;
    return text;
  }
  function show(kind, text) {
    if (!text) return;
    if (kind === "user") {
      if (!userEl) userEl = bubble("\u4f60");
      if (userEl) userEl.textContent = text;
    } else {
      if (!dawnEl) dawnEl = bubble("\u66d9\u5149");
      if (dawnEl) dawnEl.textContent = text;
    }
  }
  function hook() {
    var voice = window.DawnLightLiveVoice;
    if (!voice || !voice.session || voice.session.__dawnText) return;
    var orig = voice.session.onMessage;
    voice.session.onMessage = function (raw) {
      if (typeof Blob !== "undefined" && raw instanceof Blob) {
        var self = this;
        raw.text().then(function (text) { self.onMessage(text); }).catch(function () {});
        return;
      }
      var result = orig.call(this, raw);
      if (typeof raw !== "string") return result;
      var msg; try { msg = JSON.parse(raw); } catch (e) { return result; }
      var content = msg.serverContent || {};
      var inn = (content.inputTranscription && content.inputTranscription.text) || (msg.type === "inputTranscription" ? msg.text : "");
      var out = (content.outputTranscription && content.outputTranscription.text) || (msg.type === "outputTranscription" ? msg.text : "");
      if (inn) { userText += inn; show("user", userText); }
      if (out) { dawnText += out; show("dawn", dawnText); }
      if (content.turnComplete || msg.turnComplete || msg.type === "turnComplete") { userEl = null; dawnEl = null; userText = ""; dawnText = ""; }
      return result;
    };
    voice.session.__dawnText = true;
    if (voice.setGain) voice.setGain(1);
  }
  function connect() {
    var voice = window.DawnLightLiveVoice;
    if (!voice) return;
    if (!voice.isOpen || !voice.isOpen()) voice.start();
    if (voice.setGain) voice.setGain(1);
    hook();
  }
  function startMic() {
    var voice = window.DawnLightLiveVoice;
    if (!voice || on || !dawnOn()) return;
    on = true;
    connect();
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (media) {
      if (!media || !on || !dawnOn()) { on = false; if (media) media.getTracks().forEach(function (track) { track.stop(); }); return; }
      stream = media;
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      if (ctx.state !== "running") ctx.resume();
      var rate = Number(ctx.sampleRate) || 16000;
      var src = ctx.createMediaStreamSource(stream);
      proc = ctx.createScriptProcessor(4096, 1, 1);
      var silent = ctx.createGain(); silent.gain.value = 0;
      proc.onaudioprocess = function (event) {
        var current = window.DawnLightLiveVoice;
        if (!on || !dawnOn() || !current || !current.isOpen || !current.isOpen()) return;
        var input = event.inputBuffer.getChannelData(0);
        var samples = input;
        if (rate !== 16000) {
          var n = Math.max(1, Math.round(input.length * 16000 / rate));
          var out = new Float32Array(n), ratio = rate / 16000;
          for (var i = 0; i < n; i++) { var pos = i * ratio, idx = Math.floor(pos), frac = pos - idx; var x = input[Math.min(idx, input.length - 1)] || 0; var y = input[Math.min(idx + 1, input.length - 1)] || x; out[i] = x + (y - x) * frac; }
          samples = out;
        }
        var pcm = new Int16Array(samples.length);
        for (var j = 0; j < samples.length; j++) { var v = Math.max(-1, Math.min(1, samples[j])); pcm[j] = v < 0 ? v * 32768 : v * 32767; }
        current.sendRaw(payload(new Uint8Array(pcm.buffer)));
      };
      src.connect(proc); proc.connect(silent); silent.connect(ctx.destination);
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
  setInterval(function () {
    hook();
    if (dawnOn()) { connect(); if (!on) startMic(); }
    if (!dawnOn() && on) stop();
  }, 400);
})();

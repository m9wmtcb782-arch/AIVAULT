(function () {
  if (window.__AIVAULT_DAWN_OWN_AUDIO__) return;
  window.__AIVAULT_DAWN_OWN_AUDIO__ = true;
  var stream = null;
  var proc = null;
  var ctx = null;
  var on = false;
  var dawnEl = null;
  var dawnText = "";

  var AC = window.AudioContext || window.webkitAudioContext;
  if (AC && AC.prototype.__aivaultMixer && AC.prototype.__aivaultOrigCreateBufferSource) {
    AC.prototype.createBufferSource = AC.prototype.__aivaultOrigCreateBufferSource;
  }
  window.__AIVAULT_SUPPRESS_DARK_AUDIO__ = false;
  window.__AIVAULT_SUPPRESS_DAWN_AUDIO__ = false;

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
  function renderDawn(text) {
    var inner = document.getElementById("messagesInner");
    if (!inner || !text) return;
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
  function unmute() {
    window.__AIVAULT_SUPPRESS_DARK_AUDIO__ = false;
    window.__AIVAULT_SUPPRESS_DAWN_AUDIO__ = false;
    var mixer = window.AivaultAudioMixer;
    if (!mixer) return;
    mixer.values["dark-star"] = 1;
    mixer.values["dawn-light"] = 1;
    if (mixer.apply) mixer.apply();
  }

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
      if (url.indexOf("agent_id=technical-dark-star") !== -1 && typeof data === "string" && data.indexOf('"type":"audio"') !== -1) window.__AIVAULT_COPY_PCM_TO_DAWN__(data);
      return result;
    };
    WebSocket.prototype.__aivaultCopyDawn = true;
  }
  function hookText() {
    var voice = window.DawnLightLiveVoice;
    if (!voice || !voice.session || voice.session.__textHook) return;
    var orig = voice.session.onMessage;
    voice.session.onMessage = function (raw) {
      if (typeof Blob !== "undefined" && raw instanceof Blob) {
        var self = this;
        raw.text().then(function (text) { self.onMessage(text); }).catch(function () {});
        return;
      }
      return orig.call(this, raw);
    };
    voice.session.__textHook = true;
  }
  window.addEventListener("aivault-conversation-event", function (event) {
    var detail = event.detail || {};
    if (detail.speaker !== "dawn-light") return;
    var piece = String(detail.text || "");
    if (!piece) return;
    if (detail.partial) dawnText += piece; else dawnText = piece;
    renderDawn(dawnText);
    if (!detail.partial) { dawnText = ""; dawnEl = null; }
  });

  function start() {
    var voice = window.DawnLightLiveVoice;
    if (!dawnOn() || darkOn() || !voice || on) return;
    on = true;
    var opening = voice.isOpen && voice.isOpen() ? Promise.resolve(true) : voice.start();
    Promise.resolve(opening).then(function () {
      return navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    }).then(function (media) {
      if (!media || !on || !dawnOn() || darkOn()) { on = false; if (media) media.getTracks().forEach(function (track) { track.stop(); }); return; }
      stream = media;
      ctx = new AC();
      var sourceRate = Number(ctx.sampleRate) || 16000;
      var src = ctx.createMediaStreamSource(stream);
      proc = ctx.createScriptProcessor(4096, 1, 1);
      var silent = ctx.createGain(); silent.gain.value = 0;
      proc.onaudioprocess = function (event) {
        var current = window.DawnLightLiveVoice;
        if (!on || !dawnOn() || darkOn() || !current || !current.isOpen || !current.isOpen()) return;
        var input = event.inputBuffer.getChannelData(0);
        var pcm = new Int16Array(input.length);
        for (var j = 0; j < input.length; j++) {
          var v = Math.max(-1, Math.min(1, input[j]));
          pcm[j] = v < 0 ? v * 32768 : v * 32767;
        }
        current.sendRaw(payload(new Uint8Array(pcm.buffer)));
      };
      src.connect(proc); proc.connect(silent); silent.connect(ctx.destination);
    }).catch(function () { on = false; });
  }
  function stopMic() {
    on = false;
    if (proc) { try { proc.disconnect(); } catch (e) {} }
    if (ctx) { try { ctx.close(); } catch (e) {} }
    if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
    proc = null; ctx = null; stream = null;
  }
  setInterval(function () {
    hookText();
    unmute();
    var voice = window.DawnLightLiveVoice;
    if (dawnOn() && voice && voice.isOpen && !voice.isOpen()) voice.start();
    if (dawnOn() && !darkOn() && !on) start();
    if (darkOn() && on) stopMic();
    if (!dawnOn() && on) stopMic();
    if (!dawnOn() && voice) voice.stop();
  }, 400);
})();

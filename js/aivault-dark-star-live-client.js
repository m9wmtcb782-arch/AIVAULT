/**
 * Technical Dark Star realtime voice client.
 * Reuses the existing live-voice WebSocket. This is not a second AI brain.
 *
 * Input:  16 kHz PCM16 little-endian, base64 JSON {type:'audio',...}
 * Output: 24 kHz PCM16 (binary or base64)
 * Also: inputTranscription, outputTranscription, turnComplete, interrupted
 */
(function (root) {
  "use strict";
  if (root.AIVAULTDarkStarLiveClient) return;

  var DEFAULT_WSS = "wss://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-live-voice";
  var AUTH_LS = "sb-clcddygkaaqqtsbswgdf-auth-token";
  var VOICES = [
    ["Kore", "穩重"],
    ["Puck", "活潔"],
    ["Charon", "資訊型"],
    ["Zephyr", "明亮"],
    ["Leda", "年輕"],
    ["Aoede", "輕快"],
    ["Orus", "穩重"],
    ["Fenrir", "興奮"],
    ["Gacrux", "成熟"],
    ["Achird", "友善"]
  ];

  function accessToken() {
    try {
      var raw = localStorage.getItem(AUTH_LS);
      if (!raw) return "";
      var j = JSON.parse(raw);
      return String(j.access_token || (j.currentSession && j.currentSession.access_token) || "").trim();
    } catch (e) {
      return "";
    }
  }

  function rms(arr) {
    var s = 0;
    var n = arr.length || 1;
    for (var i = 0; i < arr.length; i++) s += arr[i] * arr[i];
    return Math.sqrt(s / n);
  }

  function floatTo16(samples) {
    var pcm = new Int16Array(samples.length);
    for (var i = 0; i < samples.length; i++) {
      var v = Math.max(-1, Math.min(1, samples[i]));
      pcm[i] = v < 0 ? v * 32768 : v * 32767;
    }
    return pcm;
  }

  function resample(input, fromRate, toRate) {
    if (fromRate === toRate) return input;
    var ratio = fromRate / toRate;
    var n = Math.max(1, Math.round(input.length / ratio));
    var out = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var pos = i * ratio;
      var L = Math.floor(pos);
      var f = pos - L;
      var a = input[L] || 0;
      var b = input[Math.min(L + 1, input.length - 1)] || a;
      out[i] = a + (b - a) * f;
    }
    return out;
  }

  function b64FromBytes(u8) {
    var s = "";
    for (var i = 0; i < u8.length; i += 32768) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
    }
    return btoa(s);
  }

  function bytesFromB64(b64) {
    var bin = atob(b64);
    var u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  function Client(opts) {
    opts = opts || {};
    this.wss = opts.wss || DEFAULT_WSS;
    this.voice = opts.voice || localStorage.getItem("darkStarVoice") || "Kore";
    this.agentId = opts.agentId || "technical-dark-star";
    this.bargeThreshold = opts.bargeThreshold || 0.02;
    this.listeners = {};
    this.ws = null;
    this.wanted = false;
    this.stream = null;
    this.inputCtx = null;
    this.playCtx = null;
    this.processor = null;
    this.source = null;
    this.nextPlay = 0;
    this.playSources = [];
    this.userTalkingUntil = 0;
    this.speaking = false;
    this.inBuf = "";
    this.outBuf = "";
    this.audioPacketsIn = 0;
    this.audioPacketsOut = 0;
    this.sessionId = "";
    this.lastEnergy = 0;
  }

  Client.VOICES = VOICES;
  Client.DEFAULT_WSS = DEFAULT_WSS;

  Client.prototype.on = function (ev, fn) {
    (this.listeners[ev] || (this.listeners[ev] = [])).push(fn);
    return this;
  };

  Client.prototype.emit = function (ev, data) {
    var list = this.listeners[ev] || [];
    for (var i = 0; i < list.length; i++) {
      try { list[i](data); } catch (e) {}
    }
  };

  Client.prototype.isOpen = function () {
    return !!(this.ws && this.ws.readyState === 1);
  };

  Client.prototype.interrupt = function (reason) {
    for (var i = 0; i < this.playSources.length; i++) {
      try { this.playSources[i].stop(); } catch (e) {}
    }
    this.playSources = [];
    this.nextPlay = 0;
    this.speaking = false;
    this.lastEnergy = 0;
    this.userTalkingUntil = Date.now() + 700;
    this.emit("interrupted", { reason: reason || "barge-in", sessionKept: true });
    this.emit("speaking", { speaking: false, energy: 0 });
  };

  Client.prototype._query = function () {
    var q = new URLSearchParams();
    q.set("voice", this.voice);
    q.set("agent_id", this.agentId);
    q.set("client", "aivault-dark-star-digital-human");
    var topicId = localStorage.getItem("technical-dark-star-topic-id") || "";
    var conversationId = localStorage.getItem("technical_dark_star_conversation_id") || "";
    var tok = accessToken();
    if (topicId) q.set("topic_id", topicId);
    if (conversationId) q.set("conversation_id", conversationId);
    if (tok) q.set("access_token", tok);
    return q.toString();
  };

  Client.prototype.connect = function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (self.isOpen()) return resolve();
      var url = self.wss + "?" + self._query();
      self.emit("log", { level: "info", message: "connect " + self.wss });
      var ws;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        reject(e);
        return;
      }
      self.ws = ws;
      ws.binaryType = "arraybuffer";
      var to = setTimeout(function () {
        try { ws.close(); } catch (e) {}
        reject(new Error("連線逾時"));
      }, 10000);
      ws.onopen = function () {
        clearTimeout(to);
        self.sessionId = self.sessionId || ("ds-" + Date.now().toString(36));
        self.emit("open", { sessionId: self.sessionId, voice: self.voice, brain: "technical-dark-star" });
        resolve();
      };
      ws.onerror = function () {
        clearTimeout(to);
        self.emit("error", { message: "WebSocket error" });
        reject(new Error("WebSocket error"));
      };
      ws.onclose = function (ev) {
        clearTimeout(to);
        self.ws = null;
        self.emit("close", { code: ev.code, reason: ev.reason || "", wasClean: ev.wasClean });
      };
      ws.onmessage = function (ev) {
        self._onMessage(ev.data);
      };
    });
  };

  Client.prototype._onMessage = function (raw) {
    if (raw instanceof ArrayBuffer) {
      this._playPcm(raw);
      return;
    }
    if (typeof Blob !== "undefined" && raw instanceof Blob) {
      var self = this;
      raw.arrayBuffer().then(function (buf) { self._playPcm(buf); }).catch(function () {});
      return;
    }
    var d;
    try { d = JSON.parse(raw); } catch (e) { return; }
    var sc = d.serverContent || d;
    if (d.type === "interrupted" || sc.interrupted) this.interrupt("server");
    this._takeAudio(d);
    if (d.type === "live_open" || d.setupComplete) {
      this.emit("live_open", { model: d.model || "", raw: d });
    }
    if (sc.inputTranscription && sc.inputTranscription.text) {
      this.inBuf += sc.inputTranscription.text;
      this.emit("inputTranscription", { text: sc.inputTranscription.text, buffer: this.inBuf, final: false });
    }
    if (sc.outputTranscription && sc.outputTranscription.text) {
      this.outBuf += sc.outputTranscription.text;
      this.emit("outputTranscription", { text: sc.outputTranscription.text, buffer: this.outBuf, final: false });
    }
    if (d.type === "inputTranscription" && d.text) {
      this.inBuf += d.text;
      this.emit("inputTranscription", { text: d.text, buffer: this.inBuf, final: false });
    }
    if (d.type === "outputTranscription" && d.text) {
      this.outBuf += d.text;
      this.emit("outputTranscription", { text: d.text, buffer: this.outBuf, final: false });
    }
    if (sc.turnComplete || d.turnComplete || d.type === "turnComplete") {
      var turn = { input: this.inBuf, output: this.outBuf };
      this.inBuf = "";
      this.outBuf = "";
      this.emit("turnComplete", turn);
    }
    if (d.type === "error" || d.error) {
      var m = d.message || (d.error && d.error.message) || JSON.stringify(d.error || d);
      this.emit("error", { message: m });
    }
  };

  Client.prototype._takeAudio = function (d) {
    if (!d || typeof d !== "object") return;
    if (d.audio && d.audio.data) this._playB64(d.audio.data);
    if (d.data && d.mimeType && String(d.mimeType).indexOf("audio") === 0) this._playB64(d.data);
    var parts = (d.serverContent && d.serverContent.modelTurn && d.serverContent.modelTurn.parts) ||
      (d.modelTurn && d.modelTurn.parts) || [];
    for (var i = 0; i < parts.length; i++) {
      var id = parts[i] && parts[i].inlineData;
      if (id && id.data && String(id.mimeType || "").indexOf("audio") === 0) this._playB64(id.data);
    }
  };

  Client.prototype._playB64 = function (b64) {
    try { this._playPcm(bytesFromB64(b64).buffer); } catch (e) {}
  };

  Client.prototype._playPcm = function (buf) {
    if (!this.playCtx) return;
    if (Date.now() < this.userTalkingUntil) return;
    var bytes = new Uint8Array(buf);
    var pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    if (!pcm.length) return;
    this.audioPacketsOut++;
    var energy = 0;
    for (var i = 0; i < pcm.length; i++) energy += (pcm[i] / 32768) * (pcm[i] / 32768);
    energy = Math.sqrt(energy / pcm.length);
    this.lastEnergy = energy;
    this.speaking = true;
    if (this.playCtx.state !== "running") this.playCtx.resume().catch(function () {});
    var audio = this.playCtx.createBuffer(1, pcm.length, 24000);
    var data = audio.getChannelData(0);
    for (var j = 0; j < pcm.length; j++) data[j] = pcm[j] / 32768;
    var src = this.playCtx.createBufferSource();
    src.buffer = audio;
    src.connect(this.playCtx.destination);
    var now = this.playCtx.currentTime;
    if (this.nextPlay < now + 0.03) this.nextPlay = now + 0.03;
    src.start(this.nextPlay);
    this.nextPlay += audio.duration;
    this.playSources.push(src);
    var self = this;
    src.onended = function () {
      var ix = self.playSources.indexOf(src);
      if (ix >= 0) self.playSources.splice(ix, 1);
      if (!self.playSources.length) {
        self.speaking = false;
        self.lastEnergy = 0;
        self.emit("speaking", { speaking: false, energy: 0 });
      }
    };
    this.emit("audioOut", { packets: this.audioPacketsOut, energy: energy, samples: pcm.length });
    this.emit("speaking", { speaking: true, energy: energy });
  };

  Client.prototype._startMic = function () {
    if (!this.stream || !this.inputCtx || this.processor) return;
    var self = this;
    this.source = this.inputCtx.createMediaStreamSource(this.stream);
    this.processor = this.inputCtx.createScriptProcessor(2048, 1, 1);
    var silent = this.inputCtx.createGain();
    silent.gain.value = 0;
    this.processor.onaudioprocess = function (e) {
      if (!self.isOpen()) return;
      var a = e.inputBuffer.getChannelData(0);
      var level = rms(a);
      if (level > self.bargeThreshold && self.speaking) self.interrupt("user-mic");
      var fromRate = self.inputCtx.sampleRate || 16000;
      var samples = resample(a, fromRate, 16000);
      var pcm = floatTo16(samples);
      var u8 = new Uint8Array(pcm.buffer);
      self.audioPacketsIn++;
      try {
        self.ws.send(JSON.stringify({
          type: "audio",
          data: b64FromBytes(u8),
          mimeType: "audio/pcm;rate=16000"
        }));
      } catch (err) {}
    };
    this.source.connect(this.processor);
    this.processor.connect(silent);
    silent.connect(this.inputCtx.destination);
  };

  Client.prototype.start = async function () {
    this.wanted = true;
    this.audioPacketsIn = 0;
    this.audioPacketsOut = 0;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!this.playCtx) this.playCtx = new AC();
    if (this.playCtx.state !== "running") await this.playCtx.resume();
    if (!this.inputCtx) this.inputCtx = new AC({ sampleRate: 16000 });
    if (this.inputCtx.state !== "running") await this.inputCtx.resume();
    if (!this.stream) {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
        video: false
      });
    }
    await this.connect();
    this._startMic();
    this.emit("started", {
      brain: "technical-dark-star",
      inputRate: 16000,
      outputRate: 24000,
      sessionId: this.sessionId
    });
  };

  Client.prototype.sendText = function (text) {
    text = String(text || "").trim();
    if (!text) return false;
    if (!this.isOpen()) {
      this.emit("error", { message: "尚未連上暗星即時語音" });
      return false;
    }
    try {
      this.ws.send(JSON.stringify({ type: "text", text: text }));
      this.emit("textSent", { text: text });
      return true;
    } catch (e) {
      this.emit("error", { message: e.message || String(e) });
      return false;
    }
  };

  Client.prototype.setVoice = function (voice) {
    this.voice = voice || this.voice;
    try { localStorage.setItem("darkStarVoice", this.voice); } catch (e) {}
  };

  Client.prototype.stop = async function () {
    this.wanted = false;
    this.interrupt("stop");
    if (this.processor) try { this.processor.disconnect(); } catch (e) {}
    if (this.source) try { this.source.disconnect(); } catch (e) {}
    this.processor = null;
    this.source = null;
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(function (t) { t.stop(); });
      this.stream = null;
    }
    if (this.inputCtx) { try { await this.inputCtx.close(); } catch (e) {} this.inputCtx = null; }
    if (this.playCtx) { try { await this.playCtx.close(); } catch (e) {} this.playCtx = null; }
    this.emit("stopped", { sessionKept: false });
  };

  root.AIVAULTDarkStarLiveClient = Client;
})(window);

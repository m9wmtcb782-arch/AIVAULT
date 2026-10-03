(function (root) {
  "use strict";
  if (root.DawnLightLiveVoice) return;

  var RELAY = "wss://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/technical-dark-star-live-voice-v2";
  var VOICE_KEY = "dawnLightVoice";
  var TOPIC_KEY = "dawn-light-topic-id";
  var CONVERSATION_KEY = "dawn_light_conversation_id";
  var VIDEO_ENABLED = false;
  var LIPSYNC_ENABLED = false;
  // 曙光固定使用載入時取得的原生 WebSocket；不攔截、不接管暗星 WebSocket。
  var NativeWebSocket = root.WebSocket;

  function voiceName() {
    try { return localStorage.getItem(VOICE_KEY) || "Aoede"; } catch (e) { return "Aoede"; }
  }

  function topicId() {
    try {
      var existing = localStorage.getItem(TOPIC_KEY);
      if (existing) return existing;
      var id = "dawn-light-" + Date.now();
      localStorage.setItem(TOPIC_KEY, id);
      return id;
    } catch (e) {
      return "dawn-light-" + Date.now();
    }
  }

  function conversationId() {
    try { return localStorage.getItem(CONVERSATION_KEY) || ""; } catch (e) { return ""; }
  }

  function token() {
    try {
      var raw = localStorage.getItem("sb-clcddygkaaqqtsbswgdf-auth-token");
      if (!raw) return "";
      var j = JSON.parse(raw);
      return String(j.access_token || (j.currentSession && j.currentSession.access_token) || "").trim();
    } catch (e) {
      return "";
    }
  }

  function Session() {
    this.ws = null;
    this.open = false;
    this.playCtx = null;
    this.nextPlay = 0;
    this.sources = [];
    this.gain = null;
    this.outBuf = "";
    this.videoEnabled = VIDEO_ENABLED;
    this.lipSyncEnabled = LIPSYNC_ENABLED;
  }

  Session.prototype.url = function () {
    var q = new URLSearchParams();
    q.set("voice", voiceName());
    q.set("agent_id", "dawn-light");
    q.set("client", "dawn-light-live-voice");
    q.set("video", "0");
    q.set("lip_sync", "0");
    q.set("topic_id", topicId());
    var conv = conversationId();
    if (conv) q.set("conversation_id", conv);
    var tok = token();
    if (tok) q.set("access_token", tok);
    return RELAY + "?" + q.toString();
  };

  Session.prototype.ensureAudio = function () {
    if (this.playCtx) return this.playCtx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    this.playCtx = new AC();
    this.gain = this.playCtx.createGain();
    this.gain.gain.value = 1;
    this.gain.connect(this.playCtx.destination);
    return this.playCtx;
  };

  Session.prototype.playPcm = function (bytes) {
    var ctx = this.ensureAudio();
    if (!ctx || !bytes || bytes.byteLength < 2) return;
    if (ctx.state === "suspended") ctx.resume().catch(function () {});
    var pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    if (!pcm.length) return;
    var audio = ctx.createBuffer(1, pcm.length, 24000);
    var data = audio.getChannelData(0);
    for (var i = 0; i < pcm.length; i++) data[i] = pcm[i] / 32768;
    var src = ctx.createBufferSource();
    src.buffer = audio;
    src.connect(this.gain || ctx.destination);
    var now = ctx.currentTime;
    if (this.nextPlay < now + 0.03) this.nextPlay = now + 0.03;
    src.start(this.nextPlay);
    this.nextPlay += audio.duration;
    this.sources.push(src);
    var self = this;
    src.onended = function () {
      var idx = self.sources.indexOf(src);
      if (idx >= 0) self.sources.splice(idx, 1);
    };
    if (root.AivaultAudioMixer) root.AivaultAudioMixer.noteSpeaking("dawn-light");
  };

  Session.prototype.interrupt = function (reason) {
    for (var i = 0; i < this.sources.length; i++) {
      try { this.sources[i].stop(); } catch (e) {}
    }
    this.sources = [];
    this.nextPlay = 0;
    if (this.ws && this.ws.readyState === 1) {
      try { this.ws.send(JSON.stringify({ type: "interrupt", speaker: "user", reason: reason || "interrupt" })); } catch (e) {}
    }
  };

  Session.prototype.setGain = function (value) {
    if (this.gain) this.gain.gain.value = value;
  };

  Session.prototype.sendRaw = function (data) {
    if (!this.ws || this.ws.readyState !== 1) return false;
    try { this.ws.send(data); return true; } catch (e) { return false; }
  };

  Session.prototype.sendText = function (text, speaker, agentId) {
    if (!this.ws || this.ws.readyState !== 1) return false;
    var body = {
      type: "text",
      speaker: speaker,
      agent_id: agentId || null,
      text: text
    };
    try { this.ws.send(JSON.stringify(body)); return true; } catch (e) { return false; }
  };

  Session.prototype.start = function () {
    var self = this;
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return Promise.resolve(false);
    this.ensureAudio();
    return new Promise(function (resolve) {
      var ws;
      try { ws = new NativeWebSocket(self.url()); } catch (e) { resolve(false); return; }
      ws.__aivaultAgent = "dawn-light";
      ws.__aivaultVideo = false;
      self.ws = ws;
      ws.onopen = function () {
        self.open = true;
        resolve(true);
      };
      ws.onerror = function () { resolve(false); };
      ws.onclose = function () { self.open = false; self.ws = null; };
      ws.onmessage = function (ev) { self.onMessage(ev.data); };
    });
  };

  Session.prototype.stop = function () {
    this.interrupt("stop");
    this.open = false;
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
  };

  Session.prototype.onMessage = function (raw) {
    if (raw instanceof ArrayBuffer) {
      this.playPcm(new Uint8Array(raw));
      return;
    }
    var msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    var content = msg.serverContent || {};
    var parts = (content.modelTurn && content.modelTurn.parts) || [];
    for (var i = 0; i < parts.length; i++) {
      var inline = parts[i] && parts[i].inlineData;
      if (inline && inline.data && String(inline.mimeType || "").indexOf("audio") === 0) {
        this.playPcm(bytesFromB64(inline.data));
      }
    }
    var inn = (content.inputTranscription && content.inputTranscription.text) || (msg.type === "inputTranscription" ? msg.text : "");
    if (inn && root.AivaultConversationBus && !(root.AivaultDualAgentLive && root.AivaultDualAgentLive.armed && root.AivaultDualAgentLive.armed().dark)) {
      root.AivaultConversationBus.publish({speaker:"user",agent_id:null,text:inn,partial:true});
    }
    var out = "";
    if (content.outputTranscription && content.outputTranscription.text) out = content.outputTranscription.text;
    if (msg.type === "outputTranscription" && msg.text) out = msg.text;
    if (out && root.AivaultConversationBus) {
      this.outBuf += out;
      root.AivaultConversationBus.publish({
        speaker: "dawn-light",
        agent_id: "dawn-light",
        text: out,
        partial: true
      });
    }
    if (content.interrupted) this.interrupt("server");
    if (content.turnComplete || msg.turnComplete || msg.type === "turnComplete") {
      if (this.outBuf && root.AivaultConversationBus) {
        root.AivaultConversationBus.publish({
          speaker: "dawn-light",
          agent_id: "dawn-light",
          text: this.outBuf,
          partial: false
        });
      }
      this.outBuf = "";
    }
  };

  function bytesFromB64(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  var session = new Session();
  root.DawnLightLiveVoice = {
    endpointName: "dawn-light-live-voice",
    relay: RELAY,
    relayNote: "repo 沒有 dawn-light-live-voice edge function，session 用既有 live-voice relay，query agent_id=dawn-light、video=0。",
    videoEnabled: false,
    lipSyncEnabled: false,
    voice: voiceName,
    start: function () { return session.start(); },
    stop: function () { session.stop(); },
    sendRaw: function (data) { return session.sendRaw(data); },
    sendText: function (text, speaker, agentId) { return session.sendText(text, speaker, agentId); },
    interrupt: function (reason) { session.interrupt(reason); },
    setGain: function (value) { session.setGain(value); },
    isOpen: function () { return !!(session.ws && session.ws.readyState === 1); },
    session: session
  };
})(typeof window !== "undefined" ? window : globalThis);

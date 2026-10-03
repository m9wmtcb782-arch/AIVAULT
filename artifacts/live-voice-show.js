(() => {
  "use strict";
  if (window.__AIVAULT_LIVE_VOICE_SHOW__) return;
  window.__AIVAULT_LIVE_VOICE_SHOW__ = true;

  function inner() {
    return document.getElementById("messagesInner") || document.getElementById("messages");
  }

  function bubble(role, text) {
    const box = inner();
    if (!box) return null;
    const welcome = document.getElementById("welcome");
    if (welcome) welcome.remove();
    const row = document.createElement("div");
    row.className = "message " + role;
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "你" : "✦";
    const body = document.createElement("div");
    body.className = "message-body";
    const node = document.createElement("div");
    node.className = "message-text";
    node.textContent = text;
    body.appendChild(node);
    row.appendChild(avatar);
    row.appendChild(body);
    box.appendChild(row);
    const scroller = document.getElementById("messages");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    return node;
  }

  const shown = { user: "", assistant: "", userEl: null, assistantEl: null };
  function write(role, text) {
    text = String(text || "");
    if (!text || text === shown[role]) return;
    shown[role] = text;
    const key = role === "user" ? "userEl" : "assistantEl";
    if (!shown[key]) shown[key] = bubble(role, text);
    else shown[key].textContent = text;
    const input = document.getElementById("composerInput");
    if (role === "user" && input) input.value = text;
  }

  let playCtx = null;
  let next = 0;
  function playPcm(buf) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!playCtx) playCtx = new AC();
    if (playCtx.state === "suspended") playCtx.resume();
    const bytes = new Uint8Array(buf);
    const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    if (!pcm.length) return;
    const audio = playCtx.createBuffer(1, pcm.length, 24000);
    const data = audio.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) data[i] = pcm[i] / 32768;
    const src = playCtx.createBufferSource();
    src.buffer = audio;
    src.connect(playCtx.destination);
    const now = playCtx.currentTime;
    if (next < now + 0.02) next = now + 0.02;
    src.start(next);
    next += audio.duration;
    if (window.AivaultAudioMixer && window.AivaultDualAgentLive) {
      const armed = window.AivaultDualAgentLive.armed ? window.AivaultDualAgentLive.armed() : null;
      if (!armed || armed.dark !== armed.dawn) window.AivaultAudioMixer.restore("dark-star");
    }
  }

  function b64ToBuf(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  function take(msg) {
    if (!msg || typeof msg !== "object") return;
    const sc = msg.serverContent || msg.content || {};
    const inn = (sc.inputTranscription && sc.inputTranscription.text) || (msg.inputTranscription && msg.inputTranscription.text) || (msg.type === "inputTranscription" ? msg.text : "");
    const out = (sc.outputTranscription && sc.outputTranscription.text) || (msg.outputTranscription && msg.outputTranscription.text) || (msg.type === "outputTranscription" ? msg.text : "");
    if (inn) write("user", shown.user + inn);
    if (out) write("assistant", shown.assistant + out);
    if (sc.turnComplete || msg.turnComplete || msg.type === "turnComplete") {
      shown.user = "";
      shown.assistant = "";
      shown.userEl = null;
      shown.assistantEl = null;
    }
    const parts = (sc.modelTurn && sc.modelTurn.parts) || (msg.modelTurn && msg.modelTurn.parts) || [];
    parts.forEach(function (part) {
      const inline = part && part.inlineData;
      if (inline && inline.data && String(inline.mimeType || "").indexOf("audio") === 0) playPcm(b64ToBuf(inline.data));
    });
    if (msg.audio && msg.audio.data) playPcm(b64ToBuf(msg.audio.data));
    if (msg.data && msg.mimeType && String(msg.mimeType).indexOf("audio") === 0) playPcm(b64ToBuf(msg.data));
  }

  const Base = window.WebSocket;
  function ShownSocket(url, protocols) {
    const ws = protocols ? new Base(url, protocols) : new Base(url);
    try { ws.binaryType = "arraybuffer"; } catch (e) {}
    if (String(url || "").indexOf("technical-dark-star-live-voice") !== -1) {
      ws.addEventListener("message", function (ev) {
        if (ev.data instanceof ArrayBuffer) { playPcm(ev.data); return; }
        if (typeof Blob !== "undefined" && ev.data instanceof Blob) {
          ev.data.arrayBuffer().then(playPcm).catch(function () {});
          return;
        }
        try { take(JSON.parse(ev.data)); } catch (e) {}
      });
    }
    return ws;
  }
  ShownSocket.prototype = Base.prototype;
  window.WebSocket = ShownSocket;

  // Keep 「即時語音」 checked unless the user explicitly toggles it off.
  var liveWanted = false;
  var userToggle = false;
  function liveButtons() {
    return [document.getElementById("darkStarLiveButton"), document.getElementById("micButton")].filter(Boolean);
  }
  function paintChecked(on) {
    liveButtons().forEach(function (el) {
      el.setAttribute("aria-pressed", on ? "true" : "false");
      el.classList.toggle("recording", on);
      el.classList.toggle("live-voice-on", on);
      if ("checked" in el) el.checked = on;
    });
    document.querySelectorAll("input[data-live-voice], #liveVoiceToggle, #instantVoiceToggle").forEach(function (el) {
      el.checked = on;
    });
    window.__AIVAULT_LIVE_VOICE_WANTED__ = on;
  }
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest && e.target.closest("#darkStarLiveButton");
    if (!t) return;
    userToggle = true;
    liveWanted = !liveWanted;
    paintChecked(liveWanted);
    setTimeout(function () { userToggle = false; if (liveWanted) paintChecked(true); }, 0);
  }, true);
  var origSet = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (!userToggle && liveWanted && name === "aria-pressed" && value === "false" && (this.id === "micButton" || this.id === "darkStarLiveButton")) {
      return origSet.call(this, name, "true");
    }
    return origSet.call(this, name, value);
  };
  var origToggle = DOMTokenList.prototype.toggle;
  DOMTokenList.prototype.toggle = function (token, force) {
    if (!userToggle && liveWanted && force === false && (token === "recording" || token === "live-voice-on") && this.ownerElement && (this.ownerElement.id === "micButton" || this.ownerElement.id === "darkStarLiveButton")) {
      return origToggle.call(this, token, true);
    }
    return origToggle.apply(this, arguments);
  };
  var origRemove = DOMTokenList.prototype.remove;
  DOMTokenList.prototype.remove = function () {
    if (!userToggle && liveWanted && this.ownerElement && (this.ownerElement.id === "micButton" || this.ownerElement.id === "darkStarLiveButton")) {
      var args = Array.prototype.filter.call(arguments, function (c) { return c !== "recording" && c !== "live-voice-on"; });
      if (!args.length) return;
      return origRemove.apply(this, args);
    }
    return origRemove.apply(this, arguments);
  };
  var origChecked = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked");
  if (origChecked && origChecked.set) {
    Object.defineProperty(HTMLInputElement.prototype, "checked", {
      configurable: true,
      enumerable: origChecked.enumerable,
      get: origChecked.get,
      set: function (v) {
        if (!userToggle && liveWanted && (this.id === "liveVoiceToggle" || this.id === "instantVoiceToggle" || this.getAttribute("data-live-voice") != null) && !v) {
          return origChecked.set.call(this, true);
        }
        return origChecked.set.call(this, v);
      }
    });
  }

})();

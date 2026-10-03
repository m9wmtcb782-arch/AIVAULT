(function (root) {
  "use strict";
  if (root.AivaultDualAgentLive) return;

  var DARK = "technical-dark-star";
  var DAWN = "dawn-light";
  var SPEAKER_DARK = "dark-star";
  var SPEAKER_DAWN = "dawn-light";
  var SPEAKER_USER = "user";
  var currentWake = [];
  var currentTranscript = "";
  var darkSocket = null;
  var darkOpen = false;
  var armed = { dark: false, dawn: false };
  var floor = null;
  var waiting = null;
  var darkHoldUntil = 0;
  var darkHoldQueue = [];
  var dawnHoldUntil = 0;
  var dawnHoldQueue = [];
  var userBuf = "";
  var agentSpeaking = false;
  var interruptedThisUtterance = false;
  var loading = null;

  function router() { return root.AivaultAgentRouter || null; }

  function publish(event) {
    var item = {
      speaker: event.speaker,
      agent_id: event.agent_id || null,
      text: String(event.text || ""),
      partial: !!event.partial,
      turn_transcript: currentTranscript,
      at: Date.now()
    };
    var list = root.__AIVAULT_CONVERSATION_EVENTS__ || (root.__AIVAULT_CONVERSATION_EVENTS__ = []);
    list.push(item);
    if (list.length > 200) list.shift();
    try { root.dispatchEvent(new CustomEvent("aivault-conversation-event", { detail: item })); } catch (e) {}
    return item;
  }

  root.AivaultConversationBus = {
    publish: publish,
    events: function () { return (root.__AIVAULT_CONVERSATION_EVENTS__ || []).slice(); },
    clear: function () { root.__AIVAULT_CONVERSATION_EVENTS__ = []; }
  };

  function Mixer() {
    this.gains = {};
    this.values = {};
    this.values[SPEAKER_DARK] = 1;
    this.values[SPEAKER_DAWN] = 0;
    this.foreground = null;
    this.speaking = {};
  }

  Mixer.prototype.gain = function (speaker, ctx) {
    if (!this.gains[speaker] && ctx) {
      var node = ctx.createGain();
      node.gain.value = this.values[speaker] == null ? 1 : this.values[speaker];
      node.connect(ctx.destination);
      this.gains[speaker] = node;
    }
    return this.gains[speaker];
  };

  Mixer.prototype.apply = function () {
    var self = this;
    Object.keys(this.gains).forEach(function (key) {
      try { self.gains[key].gain.value = self.values[key]; } catch (e) {}
    });
    if (root.DawnLightLiveVoice) root.DawnLightLiveVoice.setGain(this.values[SPEAKER_DAWN]);
  };

  Mixer.prototype.solo = function (speaker) {
    this.foreground = speaker;
    this.values[SPEAKER_DARK] = speaker === SPEAKER_DARK ? 1 : 0;
    this.values[SPEAKER_DAWN] = speaker === SPEAKER_DAWN ? 1 : 0;
    this.apply();
  };

  Mixer.prototype.duck = function (foreground) {
    var other = foreground === SPEAKER_DARK ? SPEAKER_DAWN : SPEAKER_DARK;
    this.foreground = foreground;
    this.values[foreground] = 1;
    this.values[other] = 0.35;
    this.apply();
  };

  Mixer.prototype.restore = function (speaker) {
    this.values[speaker] = 1;
    this.apply();
  };

  Mixer.prototype.noteSpeaking = function (speaker) {
    this.speaking[speaker] = Date.now();
    var other = speaker === SPEAKER_DARK ? SPEAKER_DAWN : SPEAKER_DARK;
    if (this.speaking[other] && Date.now() - this.speaking[other] < 1600) this.duck(speaker);
  };

  Mixer.prototype.userInterrupt = function () {
    this.values[SPEAKER_DARK] = 0;
    this.values[SPEAKER_DAWN] = 0;
    this.apply();
    userInterruptUntil = Date.now() + 700;
    if (root.DawnLightLiveVoice) root.DawnLightLiveVoice.interrupt("user");
    var self = this;
    setTimeout(function () {
      var both = currentWake.indexOf(DARK) !== -1 && currentWake.indexOf(DAWN) !== -1;
      self.values[SPEAKER_DARK] = currentWake.indexOf(DARK) !== -1 ? 1 : 0;
      self.values[SPEAKER_DAWN] = both ? 0 : (currentWake.indexOf(DAWN) !== -1 ? 1 : 0);
      self.apply();
    }, 250);
  };

  root.AivaultAudioMixer = new Mixer();

  function setWakeFromTranscript(transcript) {
    var decision = router() ? router().decide(transcript) : { agents: [], deliver: false, transcript: transcript };
    currentWake = (decision.agents || []).slice();
    currentTranscript = String(transcript || "");
    decision.this_turn_only = true;
    decision.bound_before = null;
    return decision;
  }

  function wakeAllows(agentId, payload) {
    if (payload && isAgentContext(payload)) return true;
    if (agentId === DARK && !armed.dark) return false;
    if (agentId === DAWN && !armed.dawn) return false;
    if (floor === SPEAKER_DARK && agentId === DAWN && Date.now() < dawnHoldUntil) return false;
    if (floor === SPEAKER_DAWN && agentId === DARK && Date.now() < darkHoldUntil) return false;
    // Same as working live video: an armed agent must receive mic audio.
    // Name rule only applies when both are armed.
    if (armed.dark !== armed.dawn) return true;
    return currentWake.indexOf(agentId) !== -1;
  }

  function namedFirst(text) {
    var t = String(text || "");
    if (/暗星先說|暗星先/.test(t)) return SPEAKER_DARK;
    if (/曙光先說|曙光先/.test(t)) return SPEAKER_DAWN;
    var darkAt = t.search(/暗星|dark\s*star/i);
    var dawnAt = t.search(/曙光|dawn\s*light/i);
    if (darkAt >= 0 && (dawnAt < 0 || darkAt <= dawnAt)) return SPEAKER_DARK;
    if (dawnAt >= 0) return SPEAKER_DAWN;
    return null;
  }

  function releaseNext(finished) {
    if (floor !== finished || !waiting) return;
    var next = waiting;
    waiting = finished;
    floor = next;
    if (next === SPEAKER_DAWN) {
      dawnHoldUntil = 0;
      flushDawnHold();
    } else {
      darkHoldUntil = 0;
      flushDarkHold();
    }
    root.AivaultAudioMixer.solo(next);
  }

  function flushDarkHold() {
    if (Date.now() < darkHoldUntil) return;
    var queued = darkHoldQueue.splice(0);
    queued.forEach(function (data) {
      if (darkSocket && darkSocket.readyState === 1) {
        try { darkSocket.send(data); } catch (e) {}
      }
    });
  }

  function isAgentContext(payload) {
    if (!payload) return false;
    if (typeof payload === "string") {
      return payload.indexOf("[speaker=DARK_STAR") === 0 || payload.indexOf("[speaker=DAWN_LIGHT") === 0 || payload.indexOf("\"speaker\":\"dark-star\"") !== -1 || payload.indexOf("\"speaker\":\"dawn-light\"") !== -1;
    }
    try {
      var msg = typeof payload === "string" ? JSON.parse(payload) : payload;
      if (msg && (msg.speaker === SPEAKER_DARK || msg.speaker === SPEAKER_DAWN)) return true;
      if (msg && msg.type === "text" && typeof msg.text === "string" && (msg.text.indexOf("[speaker=DARK_STAR") === 0 || msg.text.indexOf("[speaker=DAWN_LIGHT") === 0)) return true;
    } catch (e) {}
    return false;
  }

  function audioPayload(data) {
    if (typeof data !== "string") return false;
    return data.indexOf("\"type\":\"audio\"") !== -1 || data.indexOf("'type':'audio'") !== -1;
  }

  function forwardToDawn(data) {
    if (!root.DawnLightLiveVoice || !wakeAllows(DAWN)) return;
    if (Date.now() < dawnHoldUntil) {
      dawnHoldQueue.push(data);
      return;
    }
    root.DawnLightLiveVoice.sendRaw(data);
  }

  function flushDawnHold() {
    if (Date.now() < dawnHoldUntil) return;
    var queued = dawnHoldQueue.splice(0);
    queued.forEach(function (data) {
      if (root.DawnLightLiveVoice) root.DawnLightLiveVoice.sendRaw(data);
    });
  }

  function deliverAgentText(fromSpeaker, text) {
    var agentId = fromSpeaker === SPEAKER_DARK ? DARK : DAWN;
    var label = fromSpeaker === SPEAKER_DARK ? "DARK_STAR" : "DAWN_LIGHT";
    var packed = "[speaker=" + label + " agent_id=" + agentId + "] " + text;
    publish({ speaker: fromSpeaker, agent_id: agentId, text: text, partial: false });
    if (fromSpeaker === SPEAKER_DARK && root.DawnLightLiveVoice) {
      root.DawnLightLiveVoice.sendText(packed, SPEAKER_DARK, DARK);
    }
    if (fromSpeaker === SPEAKER_DAWN && darkSocket && darkSocket.readyState === 1) {
      try {
        darkSocket.send(JSON.stringify({ type: "text", speaker: SPEAKER_DAWN, agent_id: DAWN, text: packed }));
      } catch (e) {}
    }
  }

  function noteUserTranscript(text) {
    userBuf += String(text || "");
    if (agentSpeaking && !interruptedThisUtterance) {
      interruptedThisUtterance = true;
      root.AivaultAudioMixer.userInterrupt();
    }
    var decision = setWakeFromTranscript(userBuf);
    publish({ speaker: SPEAKER_USER, agent_id: null, text: userBuf, partial: true });
    return decision;
  }

  function finishUserUtterance() {
    var decision = setWakeFromTranscript(userBuf);
    userBuf = "";
    interruptedThisUtterance = false;
    agentSpeaking = false;
    return decision;
  }

  function stopCountdown() {
    if (loading && typeof loading.remove === "function") loading.remove();
    loading = null;
  }

  function startCountdown() {
    stopCountdown();
    if (typeof root.createLoadingMessage === "function") loading = root.createLoadingMessage();
  }

  function handleRoute(decision) {
    if (!decision) return Promise.resolve();
    var fresh = setWakeFromTranscript(decision.transcript || currentTranscript);
    userBuf = "";
    interruptedThisUtterance = false;
    stopCountdown();
    dawnHoldQueue = [];
    if (!fresh.deliver) {
      root.AivaultAudioMixer.solo(null);
      root.AivaultAudioMixer.values[SPEAKER_DARK] = 0;
      root.AivaultAudioMixer.values[SPEAKER_DAWN] = 0;
      root.AivaultAudioMixer.apply();
      if (root.DawnLightLiveVoice) root.DawnLightLiveVoice.interrupt("not-woken");
      return Promise.resolve(fresh);
    }
    var both = fresh.agents.indexOf(DARK) !== -1 && fresh.agents.indexOf(DAWN) !== -1 && armed.dark && armed.dawn;
    if (both) {
      var first = namedFirst(fresh.transcript) || SPEAKER_DARK;
      var second = first === SPEAKER_DARK ? SPEAKER_DAWN : SPEAKER_DARK;
      floor = first;
      waiting = second;
      root.AivaultAudioMixer.solo(first);
      if (first === SPEAKER_DARK) dawnHoldUntil = Date.now() + 120000;
      else darkHoldUntil = Date.now() + 120000;
    } else if (fresh.agents.indexOf(DAWN) !== -1 && armed.dawn) {
      root.AivaultAudioMixer.solo(SPEAKER_DAWN);
      dawnHoldUntil = 0;
      startCountdown();
    } else {
      root.AivaultAudioMixer.solo(SPEAKER_DARK);
      dawnHoldUntil = 0;
    }
    publish({ speaker: SPEAKER_USER, agent_id: null, text: fresh.transcript, partial: false });
    return Promise.resolve(fresh);
  }

  function videoGate() {
    return {
      "technical-dark-star": { voice: true, video: true, lipSync: true, owner: "existing-dark-star-live-video" },
      "dawn-light": { voice: true, video: false, lipSync: false, owner: "dawn-light-live-voice" }
    };
  }

  function installVoiceSelectors() {
    var panel = document.getElementById("darkStarSettingsPanel");
    var darkSelect = document.getElementById("darkStarVoiceSelect");
    if (!panel || !darkSelect) return false;
    if (!document.getElementById("darkStarVoiceLabel")) {
      var darkLabel = document.createElement("div");
      darkLabel.id = "darkStarVoiceLabel";
      darkLabel.textContent = "暗星聲音";
      darkLabel.style.cssText = "font-size:12px;color:#555;margin:6px 0 2px";
      darkSelect.parentNode.insertBefore(darkLabel, darkSelect);
    }
    var dawnSelect = document.getElementById("dawnLightVoiceSelect");
    if (!dawnSelect) {
      var dawnLabel = document.createElement("div");
      dawnLabel.id = "dawnLightVoiceLabel";
      dawnLabel.textContent = "曙光聲音";
      dawnLabel.style.cssText = "font-size:12px;color:#555;margin:8px 0 2px";
      dawnSelect = document.createElement("select");
      dawnSelect.id = "dawnLightVoiceSelect";
      dawnSelect.className = darkSelect.className || "drawer-voice-select";
      dawnSelect.style.cssText = darkSelect.style.cssText;
      Array.prototype.forEach.call(darkSelect.options, function (opt) {
        var o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.textContent;
        dawnSelect.appendChild(o);
      });
      darkSelect.insertAdjacentElement("afterend", dawnSelect);
      dawnSelect.parentNode.insertBefore(dawnLabel, dawnSelect);
    }
    darkSelect.value = localStorage.getItem("darkStarVoice") || darkSelect.value || "Kore";
    dawnSelect.value = localStorage.getItem("dawnLightVoice") || "Aoede";
    if (!darkSelect.dataset.independentVoice) {
      darkSelect.dataset.independentVoice = "1";
      darkSelect.addEventListener("change", function () {
        localStorage.setItem("darkStarVoice", darkSelect.value);
      });
    }
    if (!dawnSelect.dataset.independentVoice) {
      dawnSelect.dataset.independentVoice = "1";
      dawnSelect.addEventListener("change", function () {
        localStorage.setItem("dawnLightVoice", dawnSelect.value);
        if (root.DawnLightLiveVoice && root.DawnLightLiveVoice.isOpen()) {
          root.DawnLightLiveVoice.stop();
          if (darkOpen) root.DawnLightLiveVoice.start();
        }
      });
    }
    return true;
  }

  function hookSocket(ws) {
    if (!ws || ws.__aivaultHooked) return;
    ws.__aivaultHooked = true;
    var agent = ws.__aivaultAgent || "";
    if (agent === DARK || (String(ws.url || "").indexOf("agent_id=dawn-light") === -1 && String(ws.url || "").indexOf("technical-dark-star-live-voice") !== -1)) {
      ws.__aivaultAgent = DARK;
      darkSocket = ws;
      ws.addEventListener("open", function () { darkOpen = true; if (armed.dawn && root.DawnLightLiveVoice) root.DawnLightLiveVoice.start(); });
      ws.addEventListener("close", function () { darkOpen = false; if (root.DawnLightLiveVoice) root.DawnLightLiveVoice.stop(); });
      ws.addEventListener("message", function (ev) { observeDark(ev.data); });
    }
  }

  function observeDark(raw) {
    if (typeof raw !== "string") return;
    var msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    var content = msg.serverContent || {};
    var inn = (content.inputTranscription && content.inputTranscription.text) || (msg.type === "inputTranscription" ? msg.text : "");
    var out = (content.outputTranscription && content.outputTranscription.text) || (msg.type === "outputTranscription" ? msg.text : "");
    if (inn && inn.indexOf("[speaker=") !== 0) noteUserTranscript(inn);
    if (out) {
      agentSpeaking = true;
      publish({ speaker: SPEAKER_DARK, agent_id: DARK, text: out, partial: true });
      if (root.DawnLightLiveVoice) root.DawnLightLiveVoice.sendText("[speaker=DARK_STAR agent_id=technical-dark-star] " + out, SPEAKER_DARK, DARK);
      root.AivaultAudioMixer.noteSpeaking(SPEAKER_DARK);
      if (currentWake.indexOf(DAWN) !== -1) {
        dawnHoldUntil = Math.min(dawnHoldUntil || Date.now() + 400, Date.now() + 400);
        setTimeout(flushDawnHold, 400);
      }
    }
    if (content.turnComplete || msg.turnComplete || msg.type === "turnComplete") {
      finishUserUtterance();
      releaseNext(SPEAKER_DARK);
    }
  }

  function installWebSocketTag() {
    if (root.__AIVAULT_DUAL_WS__) return;
    root.__AIVAULT_DUAL_WS__ = true;
    var Base = root.WebSocket;
    function Tagged(url, protocols) {
      var next = String(url || "");
      try {
        if (next.indexOf("technical-dark-star-live-voice") !== -1 && next.indexOf("agent_id=dawn-light") === -1) {
          var u = new URL(next);
          u.searchParams.set("voice", localStorage.getItem("darkStarVoice") || u.searchParams.get("voice") || "Kore");
          u.searchParams.set("agent_id", DARK);
          next = u.toString();
        }
      } catch (e) {}
      var ws = protocols === undefined ? new Base(next) : new Base(next, protocols);
      if (next.indexOf("agent_id=dawn-light") !== -1) ws.__aivaultAgent = DAWN;
      else if (next.indexOf("technical-dark-star-live-voice") !== -1) ws.__aivaultAgent = DARK;
      hookSocket(ws);
      var origSend = ws.send.bind(ws);
      ws.send = function (data) {
        if (ws.__aivaultAgent === DARK && audioPayload(data)) {
          // 已選取的 Agent 必須先收到使用者麥克風，才能取得 inputTranscription；
          // 喚醒詞只決定本回合誰回答，不應阻止「聽見」使用者。
          if (armed.dawn) forwardToDawn(data);
          if (armed.dark) return origSend(data);
          return;
        }
        if (ws.__aivaultAgent === DAWN && audioPayload(data)) {
          if (armed.dawn) return origSend(data);
          return;
        }
        return origSend(data);
      };
      return ws;
    }
    Tagged.prototype = Base.prototype;
    root.WebSocket = Tagged;
  }

  function installPlaybackRoute() {
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC || AC.prototype.__aivaultMixer) return;
    AC.prototype.__aivaultMixer = true;
    var orig = AC.prototype.createBufferSource;
    AC.prototype.createBufferSource = function () {
      var src = orig.call(this);
      var origConnect = src.connect;
      var ctx = this;
      src.connect = function (dest) {
        if (dest === ctx.destination && root.AivaultAudioMixer) {
          var node = root.AivaultAudioMixer.gain(SPEAKER_DARK, ctx);
          if (node) return origConnect.call(this, node);
        }
        return origConnect.apply(this, arguments);
      };
      return src;
    };
  }

  function boot() {
    installWebSocketTag();
    installPlaybackRoute();
    var n = 0;
    var timer = setInterval(function () {
      if (installVoiceSelectors() || ++n > 40) clearInterval(timer);
    }, 250);
    var video = document.getElementById("darkStarLiveVideoButton");
    if (video) {
      video.dataset.videoAgent = DARK;
      video.dataset.videoEnabled = "1";
    }
    root.addEventListener("aivault-conversation-event", function (e) {
      var detail = e.detail || {};
      if (detail.speaker !== SPEAKER_DAWN) return;
      stopCountdown();
      agentSpeaking = true;
      if (!detail.partial && darkSocket && darkSocket.readyState === 1) {
        try {
          darkSocket.send(JSON.stringify({
            type: "text",
            speaker: SPEAKER_DAWN,
            agent_id: DAWN,
            text: "[speaker=DAWN_LIGHT agent_id=dawn-light] " + detail.text
          }));
        } catch (err) {}
      }
      if (!detail.partial) releaseNext(SPEAKER_DAWN);
    });
  }

  function paintArms() {
    var darkBtn = document.getElementById("darkStarLiveButton");
    var dawnBtn = document.getElementById("dawnLightLiveButton");
    if (darkBtn) {
      darkBtn.textContent = armed.dark ? "暗星即時 ✓" : "暗星即時";
      darkBtn.classList.toggle("active", armed.dark);
    }
    if (dawnBtn) {
      dawnBtn.textContent = armed.dawn ? "曙光即時 ✓" : "曙光即時";
      dawnBtn.classList.toggle("active", armed.dawn);
    }
  }

  root.AivaultDualAgentLive = {
    setWakeFromTranscript: setWakeFromTranscript,
    wakeAllows: wakeAllows,
    handleRoute: handleRoute,
    onUserText: noteUserTranscript,
    finishUserUtterance: finishUserUtterance,
    deliverAgentText: deliverAgentText,
    videoGate: videoGate,
    namedFirst: namedFirst,
    arm: function (which, on) {
      if (which === "dark") armed.dark = !!on;
      if (which === "dawn") armed.dawn = !!on;
      paintArms();
      if (armed.dawn && root.DawnLightLiveVoice) root.DawnLightLiveVoice.start();
      if (!armed.dawn && root.DawnLightLiveVoice) root.DawnLightLiveVoice.stop();
      var toggle = root.__AIVAULT_DARK_STAR_TOGGLE_LIVE_VOICE__;
      var needMic = armed.dark || armed.dawn;
      if (typeof toggle === "function" && needMic !== darkOpen) return toggle();
    },
    toggleArm: function (which) {
      var on = which === "dark" ? !armed.dark : !armed.dawn;
      return root.AivaultDualAgentLive.arm(which, on);
    },
    armed: function () { return { dark: armed.dark, dawn: armed.dawn, floor: floor, waiting: waiting }; },
    currentWake: function () { return currentWake.slice(); },
    speakDawn: function () { return Promise.resolve(); }
  };

  if (root.document) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);

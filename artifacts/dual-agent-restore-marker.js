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
    var item = { speaker: event.speaker, agent_id: event.agent_id || null, text: String(event.text || ""), partial: !!event.partial, turn_transcript: currentTranscript, at: Date.now() };
    var list = root.__AIVAULT_CONVERSATION_EVENTS__ || (root.__AIVAULT_CONVERSATION_EVENTS__ = []);
    list.push(item); if (list.length > 200) list.shift();
    try { root.dispatchEvent(new CustomEvent("aivault-conversation-event", { detail: item })); } catch (e) {}
    return item;
  }
  root.AivaultConversationBus = { publish: publish, events: function () { return (root.__AIVAULT_CONVERSATION_EVENTS__ || []).slice(); }, clear: function () { root.__AIVAULT_CONVERSATION_EVENTS__ = []; } };
  function Mixer() { this.gains = {}; this.values = {}; this.values[SPEAKER_DARK] = 1; this.values[SPEAKER_DAWN] = 1; this.foreground = null; this.speaking = {}; }
  Mixer.prototype.gain = function (speaker, ctx) { if (!this.gains[speaker] && ctx) { var node = ctx.createGain(); node.gain.value = this.values[speaker] == null ? 1 : this.values[speaker]; node.connect(ctx.destination); this.gains[speaker] = node; } return this.gains[speaker]; };
  Mixer.prototype.apply = function () { var self = this; Object.keys(this.gains).forEach(function (key) { try { self.gains[key].gain.value = self.values[key]; } catch (e) {} }); if (root.DawnLightLiveVoice) root.DawnLightLiveVoice.setGain(this.values[SPEAKER_DAWN]); };
  Mixer.prototype.solo = function (speaker) { this.foreground = speaker; if (!speaker) { this.values[SPEAKER_DARK] = 1; this.values[SPEAKER_DAWN] = 1; } else { this.values[SPEAKER_DARK] = speaker === SPEAKER_DARK ? 1 : 0.35; this.values[SPEAKER_DAWN] = speaker === SPEAKER_DAWN ? 1 : 0.35; } this.apply(); };
  Mixer.prototype.duck = function (foreground) { var other = foreground === SPEAKER_DARK ? SPEAKER_DAWN : SPEAKER_DARK; this.foreground = foreground; this.values[foreground] = 1; this.values[other] = 0.35; this.apply(); };
  Mixer.prototype.restore = function (speaker) { this.values[speaker] = 1; this.apply(); };
  Mixer.prototype.noteSpeaking = function (speaker) { this.speaking[speaker] = Date.now(); var other = speaker === SPEAKER_DARK ? SPEAKER_DAWN : SPEAKER_DARK; if (this.speaking[other] && Date.now() - this.speaking[other] < 1600) this.duck(speaker); };
  Mixer.prototype.userInterrupt = function () { this.values[SPEAKER_DARK] = 0; this.values[SPEAKER_DAWN] = 0; this.apply(); userInterruptUntil = Date.now() + 700; if (root.DawnLightLiveVoice) root.DawnLightLiveVoice.interrupt("user"); var self = this; setTimeout(function () { self.values[SPEAKER_DARK] = 1; self.values[SPEAKER_DAWN] = 1; self.apply(); }, 250); };
  root.AivaultAudioMixer = new Mixer();
  root.__AIVAULT_DUAL_AGENT_RESTORED__ = "6346383dd0";
})(typeof window !== "undefined" ? window : globalThis);

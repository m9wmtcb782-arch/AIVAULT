/**
 * AIVAULT engine bus — Dark Star dispatcher interfaces.
 * VOICE / DIGITAL_HUMAN are live. MUSIC / 3D / VIDEO are reserved and must
 * not call generation providers in this build.
 */
(function (root) {
  "use strict";
  if (root.AIVAULTEngineBus) return;

  var PAUSED = Object.freeze({
    MUSIC: "Music generation is reserved. Do not call a provider.",
    "3D": "3D generation is reserved. Do not call a provider.",
    VIDEO: "Video generation is reserved. Do not call a provider."
  });

  function pausedResult(engine, reason) {
    return {
      ok: false,
      engine: engine,
      status: "PAUSED",
      code: "ENGINE_RESERVED",
      verified: "NOT_VERIFIED",
      reason: reason || PAUSED[engine] || "reserved",
      mock: false
    };
  }

  var engines = {
    VOICE: {
      id: "VOICE",
      status: "LIVE",
      brain: "technical-dark-star",
      endpointName: "technical-dark-star-live-voice",
      input: "audio/pcm;rate=16000",
      output: "audio/pcm;rate=24000"
    },
    DIGITAL_HUMAN: {
      id: "DIGITAL_HUMAN",
      status: "LIVE",
      brain: "technical-dark-star",
      role: "body",
      renderer: "canvas-viseme-v1"
    },
    MUSIC: { id: "MUSIC", status: "RESERVED", invokeDisabled: true },
    "3D": { id: "3D", status: "RESERVED", invokeDisabled: true },
    VIDEO: { id: "VIDEO", status: "RESERVED", invokeDisabled: true }
  };

  function dispatch(engine, payload) {
    var key = String(engine || "").toUpperCase();
    if (key === "VOICE" || key === "DIGITAL_HUMAN") {
      return {
        ok: true,
        engine: key,
        status: "LIVE",
        brain: "technical-dark-star",
        action: payload && payload.action ? payload.action : "attach",
        note: "Use AIVAULTDarkStarLiveClient. Do not invent a second brain."
      };
    }
    if (PAUSED[key]) return pausedResult(key);
    return {
      ok: false,
      engine: key || "UNKNOWN",
      status: "UNKNOWN",
      code: "ENGINE_UNKNOWN",
      verified: "NOT_VERIFIED",
      mock: false
    };
  }

  root.AIVAULTEngineBus = {
    version: "2026-09-29-dh1",
    brain: "technical-dark-star",
    engines: engines,
    dispatch: dispatch,
    list: function () {
      return Object.keys(engines).map(function (k) {
        return { id: k, status: engines[k].status };
      });
    }
  };
})(window);

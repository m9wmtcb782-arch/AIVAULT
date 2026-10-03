(() => {
  "use strict";
  if (window.__AIVAULT_WAKE_MIC_ON_LIVE__) return;
  window.__AIVAULT_WAKE_MIC_ON_LIVE__ = true;

  var warmed = null;

  function wake() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error("此瀏覽器不支援麥克風"));
    }
    if (warmed) return warmed;
    var orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    warmed = orig({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }, video: false })
      .then(function (stream) {
        try {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (AC) {
            var ctx = window.__AIVAULT_WAKE_AUDIO_CTX__ || new AC();
            window.__AIVAULT_WAKE_AUDIO_CTX__ = ctx;
            if (ctx.state === "suspended") ctx.resume();
          }
        } catch (e) {}
        return stream;
      })
      .catch(function (err) {
        warmed = null;
        throw err;
      });
    return warmed;
  }

  window.__AIVAULT_WAKE_MIC__ = wake;

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    var origGet = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function (constraints) {
      var audioOnly = constraints && constraints.audio && !constraints.video;
      if (audioOnly && warmed) {
        var pending = warmed;
        warmed = null;
        return pending;
      }
      return origGet(constraints);
    };
  }

  function isLiveButton(el) {
    if (!el) return false;
    if (el.id === "darkStarLiveButton" || el.id === "dawnLightLiveButton") return true;
    var text = String(el.textContent || "").replace(/\s+/g, "");
    return text.indexOf("即時語音") >= 0;
  }

  function bind(el) {
    if (!el || el.dataset.wakeMicBound) return;
    el.dataset.wakeMicBound = "1";
    el.addEventListener("pointerdown", function () { wake().catch(function () {}); }, true);
    el.addEventListener("click", function () { wake().catch(function () {}); }, true);
  }

  function scan() {
    document.querySelectorAll("#darkStarLiveButton, #dawnLightLiveButton, button, a").forEach(function (el) {
      if (isLiveButton(el)) bind(el);
    });
  }

  scan();
  setInterval(scan, 500);
  document.addEventListener("DOMContentLoaded", scan);
})();

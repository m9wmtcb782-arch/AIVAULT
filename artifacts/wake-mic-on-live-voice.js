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
    if (el.id === "dawnLightLiveButton") return false;
    if (el.id === "darkStarLiveButton") return true;
    var text = String(el.textContent || "").replace(/\s+/g, "");
    if (text.indexOf("曙光即時") >= 0) return false;
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

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR && SR.prototype && !SR.prototype.__aivaultDawnMicGuard) {
    var origStart = SR.prototype.start;
    SR.prototype.start = function () {
      if (window.__AIVAULT_DAWN_LIVE_OWNS_MIC__) {
        try { this.stop(); } catch (e) {}
        return;
      }
      return origStart.apply(this, arguments);
    };
    SR.prototype.__aivaultDawnMicGuard = true;
  }
  window.__AIVAULT_STOP_DARK_STAR_SPEECH__ = window.__AIVAULT_STOP_DARK_STAR_SPEECH__ || function () {
    window.__AIVAULT_SPEECH_AUTO_RESTART__ = false;
    var mic = document.getElementById("micButton");
    if (mic && mic.classList.contains("recording")) {
      try { mic.click(); } catch (e) {}
    }
  };

  scan();
  setInterval(scan, 500);
  document.addEventListener("DOMContentLoaded", scan);
})();

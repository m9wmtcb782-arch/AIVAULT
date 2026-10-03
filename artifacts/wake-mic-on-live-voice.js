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

  // 不在即時按鈕的 pointerdown/click 預先呼叫 getUserMedia。
  // 預先請求麥克風會在 iPhone/Safari 上消耗第一次點擊的手勢，
  // 導致第一次只開麥克風、第二次才進入「暗星即時」。
  // 現在由真正的即時語音 start() 在同一次 click 內取得麥克風。
})();

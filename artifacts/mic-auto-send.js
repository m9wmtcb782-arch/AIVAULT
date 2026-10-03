(() => {
  if (window.__AIVAULT_MIC_AUTOSEND__) return;
  window.__AIVAULT_MIC_AUTOSEND__ = true;

  function bind() {
    var mic = document.getElementById("micButton");
    var input = document.getElementById("composerInput");
    var send = document.getElementById("sendButton");
    if (!mic || !input || !send || mic.dataset.autosend === "1") return false;
    var clone = mic.cloneNode(true);
    clone.dataset.autosend = "1";
    mic.parentNode.replaceChild(clone, mic);
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { clone.title = "此瀏覽器不支援語音辨識"; return true; }
    var rec = new SR();
    rec.lang = "zh-TW";
    rec.continuous = false;
    rec.interimResults = true;
    var pending = "";
    var sent = false;
    var recording = false;
    function apply(text) {
      pending = String(text || "").trim();
      input.value = pending;
      try { input.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
      send.disabled = !pending;
    }
    function autosend() {
      var text = String(pending || input.value || "").trim();
      if (!text || sent) return;
      sent = true;
      if (window.AivaultAgentRouter && typeof window.AivaultAgentRouter.decide === "function") {
        window.__AIVAULT_LAST_ROUTE_SOURCE__ = "speech-recognition";
        try { window.AivaultAgentRouter.route(text, { source: "speech-recognition" }); } catch (e) {}
      }
      input.value = text;
      send.disabled = false;
      try { rec.stop(); } catch (e) {}
      if (typeof window.sendMessage === "function") window.sendMessage();
      else send.click();
    }
    rec.onstart = function () { recording = true; clone.classList.add("recording"); };
    rec.onresult = function (event) {
      var full = "";
      var hasFinal = false;
      for (var i = 0; i < event.results.length; i++) {
        full += event.results[i][0].transcript;
        if (event.results[i].isFinal) hasFinal = true;
      }
      apply(full);
      if (hasFinal) autosend();
    };
    rec.onerror = function () { recording = false; clone.classList.remove("recording"); };
    rec.onend = function () {
      recording = false;
      clone.classList.remove("recording");
      autosend();
      pending = "";
      sent = false;
    };
    clone.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (recording) { try { rec.stop(); } catch (e) {} return; }
      pending = "";
      sent = false;
      try { rec.start(); } catch (e) { recording = false; clone.classList.remove("recording"); }
    });
    return true;
  }

  function patchDawnBlob() {
    var voice = window.DawnLightLiveVoice;
    if (!voice || !voice.session || voice.session.__blobSafe) return;
    var orig = voice.session.onMessage.bind(voice.session);
    voice.session.onMessage = function (raw) {
      if (typeof Blob !== "undefined" && raw instanceof Blob) {
        raw.text().then(function (text) { voice.session.onMessage(text); }).catch(function () {});
        return;
      }
      return orig(raw);
    };
    voice.session.__blobSafe = true;
  }

  function patchSocketBlob() {
    if (window.__AIVAULT_BLOB_JSON__ || !window.__AIVAULT_LIVE_VOICE_SHOW__) return;
    window.__AIVAULT_BLOB_JSON__ = true;
    var Base = window.WebSocket;
    function SafeSocket(url, protocols) {
      var ws = protocols === undefined ? new Base(url, protocols) : new Base(url, protocols);
      if (String(url || "").indexOf("technical-dark-star-live-voice") !== -1) {
        ws.addEventListener("message", function (ev) {
          if (typeof Blob === "undefined" || !(ev.data instanceof Blob)) return;
          ev.data.text().then(function (text) {
            try {
              JSON.parse(text);
              ws.dispatchEvent(new MessageEvent("message", { data: text }));
            } catch (e) {}
          }).catch(function () {});
        });
      }
      return ws;
    }
    SafeSocket.prototype = Base.prototype;
    window.WebSocket = SafeSocket;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
  var n = 0;
  var timer = setInterval(function () {
    patchDawnBlob();
    patchSocketBlob();
    if ((bind() && window.__AIVAULT_BLOB_JSON__) || ++n > 40) clearInterval(timer);
  }, 250);
})();

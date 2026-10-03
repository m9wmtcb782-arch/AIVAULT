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
    function clearInput() {
      input.value = "";
      pending = "";
      window.__AIVAULT_LAST_SPEECH_TEXT__ = "";
      send.disabled = true;
      try { input.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
    }
    function apply(text) {
      if (sent) return;
      pending = String(text || "").trim();
      window.__AIVAULT_LAST_SPEECH_TEXT__ = pending;
      input.value = pending;
      send.disabled = !pending;
    }
    function autosend() {
      var text = String(window.__AIVAULT_LAST_SPEECH_TEXT__ || pending || input.value || "").trim();
      if (!text || sent) return;
      sent = true;
      input.value = text;
      send.disabled = false;
      setTimeout(function () {
        input.value = text;
        if (typeof window.sendMessage === "function") window.sendMessage();
        else send.click();
        clearInput();
        setTimeout(clearInput, 300);
      }, 0);
    }
    rec.onstart = function () { recording = true; clone.classList.add("recording"); };
    rec.onresult = function (event) {
      var full = "";
      for (var i = 0; i < event.results.length; i++) full += event.results[i][0].transcript;
      apply(full);
    };
    rec.onerror = function () { recording = false; clone.classList.remove("recording"); };
    rec.onend = function () {
      recording = false;
      clone.classList.remove("recording");
      autosend();
    };
    clone.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (recording) { try { rec.stop(); } catch (e) {} return; }
      pending = "";
      sent = false;
      window.__AIVAULT_LAST_SPEECH_TEXT__ = "";
      try { rec.start(); } catch (e) { recording = false; clone.classList.remove("recording"); }
    });
    return true;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
  var n = 0;
  var timer = setInterval(function () {
    if (bind() || ++n > 40) clearInterval(timer);
  }, 250);
})();

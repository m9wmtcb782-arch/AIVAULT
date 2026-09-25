(function () {
  "use strict";
  var rec = null;
  var recording = false;

  function $(id) { return document.getElementById(id); }

  function toast(msg) {
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 1800);
  }

  function setStatus(text, on) {
    var st = $("askMicStatus");
    var btn = $("askMic");
    if (st) st.textContent = text || "";
    if (btn) btn.classList.toggle("recording", !!on);
  }

  function engine() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function stopRec() {
    recording = false;
    try { if (rec) rec.stop(); } catch (e) {}
    setStatus("", false);
  }

  function startRec() {
    var Ctor = engine();
    var input = $("askInput");
    if (!Ctor) {
      toast("此瀏覽器不支援語音輸入");
      return;
    }
    if (!input) return;
    if (recording) { stopRec(); return; }
    rec = new Ctor();
    rec.lang = "zh-TW";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onstart = function () {
      recording = true;
      setStatus("正在聽聽……", true);
    };
    rec.onresult = function (ev) {
      var text = "";
      var i;
      for (i = ev.resultIndex; i < ev.results.length; i++) {
        text += ev.results[i][0].transcript || "";
      }
      text = String(text || "").trim();
      if (!text) return;
      input.value = text;
      try { input.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
    };
    rec.onerror = function () {
      stopRec();
      toast("語音輸入中斷，請再試");
    };
    rec.onend = function () { stopRec(); };
    try {
      rec.start();
    } catch (e) {
      recording = false;
      toast("無法開麥克風，請允許後再試");
    }
  }

  function inject() {
    var form = $("askForm");
    var input = $("askInput");
    if (!form || !input || $("askMic")) return;
    var row = document.createElement("div");
    row.className = "ask-mic-row";
    row.innerHTML =
      '<button type="button" id="askMic" class="ask-mic" aria-label="語音輸入" title="語音輸入">' +
      '<svg class="ask-mic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="9" y="3" width="6" height="12" rx="3"></rect>' +
      '<path d="M5 11a7 7 0 0 0 14 0"></path>' +
      '<path d="M12 18v3"></path>' +
      '<path d="M9 21h6"></path>' +
      "</svg></button>" +
      '<span id="askMicStatus" class="muted"></span>';
    form.insertBefore(row, input);
    $("askMic").addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      startRec();
    });
  }

  function watch() {
    inject();
    var drawer = $("drawer");
    if (drawer && window.MutationObserver && !drawer._askMicObs) {
      drawer._askMicObs = true;
      new MutationObserver(inject).observe(drawer, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
  else watch();
})();

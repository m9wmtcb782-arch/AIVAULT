(function () {
  "use strict";
  let fishAudio = null;
  let fishMode = false;
  let speaking = false;

  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) { return; }
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 2200);
  }
  function fishKey() {
    try { return (localStorage.getItem("FISH_API_KEY") || "").trim(); } catch (e) { return ""; }
  }
  function fishVoice() {
    try { return (localStorage.getItem("FISH_VOICE_ID") || "").trim(); } catch (e) { return ""; }
  }
  function useFish() { return !!(fishKey() && fishVoice()); }

  function stopFishAudio() {
    if (fishAudio) {
      try { fishAudio.pause(); } catch (e) {}
      try { fishAudio.currentTime = 0; } catch (e) {}
      try { fishAudio.src = ""; } catch (e) {}
      fishAudio = null;
    }
  }

  function pageText() {
    const left = document.getElementById("paperLeft");
    const right = document.getElementById("paperRight");
    const t = ((left && left.innerText) || "") + "\n" + ((right && right.innerText) || "");
    return t.replace(/【教材原文】/g, " ").replace(/\s+/g, " ").trim();
  }

  function playFishText(raw) {
    const text = String(raw || "").trim();
    if (!text) { toast("這一頁沒有可朗讀文字"); return; }
    const chunks = [];
    for (let i = 0; i < text.length; i += 300) chunks.push(text.slice(i, i + 300));
    speaking = true;
    fishMode = true;
    stopFishAudio();
    const play = function (index) {
      if (!speaking || index >= chunks.length) { speaking = false; return; }
      fetch("https://api.fish.audio/v1/tts", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + fishKey(),
          "Content-Type": "application/json",
          "model": "s2.1-pro"
        },
        body: JSON.stringify({
          text: chunks[index],
          reference_id: fishVoice(),
          format: "mp3",
          model: "s2.1-pro"
        })
      }).then(function (res) {
        if (!res.ok) throw new Error("http " + res.status);
        return res.blob();
      }).then(function (blob) {
        if (!speaking) return;
        stopFishAudio();
        const url = URL.createObjectURL(blob);
        fishAudio = new Audio(url);
        fishAudio.onended = function () {
          try { URL.revokeObjectURL(url); } catch (e) {}
          play(index + 1);
        };
        fishAudio.onerror = function () { toast("朗讀失敗"); speaking = false; };
        return fishAudio.play();
      }).catch(function (err) {
        const msg = String((err && err.message) || err || "");
        if (/Failed to fetch|NetworkError|CORS|blocked/i.test(msg)) {
          toast("被瀏覽器擋跨域，要後端代打。");
        } else {
          toast("朗讀失敗");
        }
        speaking = false;
      });
    };
    toast("朗讀目前頁");
    play(0);
  }

  function injectFields() {
    const body = document.getElementById("drawerBody");
    if (!body || body.querySelector("#fishKeyIn")) return;
    const form = body.querySelector(".setform");
    if (!form) return;
    const wrap = document.createElement("div");
    wrap.innerHTML =
      '<label>Fish API Key <input id="fishKeyIn" type="password" autocomplete="off"></label>' +
      '<label>Voice id <input id="fishVoiceIn" type="text" autocomplete="off"></label>' +
      '<button class="ib" id="fishSave" type="button">儲存本機設定</button>';
    form.appendChild(wrap);
    const k = document.getElementById("fishKeyIn");
    const v = document.getElementById("fishVoiceIn");
    if (k) k.value = fishKey();
    if (v) v.value = fishVoice();
    const save = document.getElementById("fishSave");
    if (save) {
      save.onclick = function () {
        try {
          localStorage.setItem("FISH_API_KEY", (k && k.value || "").trim());
          localStorage.setItem("FISH_VOICE_ID", (v && v.value || "").trim());
        } catch (e) {}
        toast("已存本機");
      };
    }
  }

  const obs = new MutationObserver(function () { injectFields(); });
  document.addEventListener("DOMContentLoaded", function () {
    const drawer = document.getElementById("drawer");
    if (drawer) obs.observe(drawer, { childList: true, subtree: true });
  });
  if (document.getElementById("drawer")) {
    obs.observe(document.getElementById("drawer"), { childList: true, subtree: true });
  }

  document.addEventListener("click", function (ev) {
    const id = ev.target && ev.target.id;
    if (id === "spPage" && useFish()) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      playFishText(pageText());
      return;
    }
    if (id === "spPause" && fishMode && fishAudio) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      try { fishAudio.pause(); } catch (e) {}
      return;
    }
    if (id === "spResume" && fishMode && fishAudio) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      try { fishAudio.play(); } catch (e) {}
      return;
    }
    if (id === "spStop" && fishMode) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      speaking = false;
      stopFishAudio();
      fishMode = false;
    }
  }, true);
})();

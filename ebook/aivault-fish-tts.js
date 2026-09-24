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
  function useFish() { return !!fishVoice(); }

  function stopFishAudio() {
    if (fishAudio) {
      try { fishAudio.pause(); } catch (e) {}
      try { fishAudio.currentTime = 0; } catch (e) {}
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
    for (let i = 0; i < text.length; i += 180) chunks.push(text.slice(i, i + 180));
    speaking = true;
    fishMode = true;
    if (!fishAudio) fishAudio = new Audio();
    const play = function (index) {
      if (!speaking || index >= chunks.length) { speaking = false; return; }
      const E = window.AIVAULTEbook || {};
      const fn = "https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/fish-tts";
      const ctrl = new AbortController();
      const timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 50000);
      function requestOnce() {
        return fetch(fn, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": E.ANON_KEY || "",
            "Authorization": "Bearer " + (E.ANON_KEY || "")
          },
          body: JSON.stringify({
            text: chunks[index],
            reference_id: fishVoice(),
            format: "mp3"
          }),
          signal: ctrl.signal
        });
      }
      requestOnce().then(function (res) {
        if ((res.status === 429 || res.status >= 500) && !requestOnce._retried) {
          requestOnce._retried = true;
          return new Promise(function (resolve) { setTimeout(resolve, 800); }).then(requestOnce);
        }
        return res;
      }).then(function (res) {
        const ctype = (res.headers.get("content-type") || "").toLowerCase();
        if (!res.ok) throw new Error("http " + res.status);
        if (ctype.indexOf("json") >= 0) throw new Error("http 200-json");
        return res.blob();
      }).then(function (blob) {
        clearTimeout(timer);
        if (!speaking) return;
        if (!blob || blob.size < 200) throw new Error("empty-audio");
        const url = URL.createObjectURL(blob);
        if (!fishAudio) fishAudio = new Audio();
        fishAudio.onended = function () {
          try { URL.revokeObjectURL(url); } catch (e) {}
          play(index + 1);
        };
        fishAudio.onerror = function () { toast("朗讀中斷，再按一次"); speaking = false; };
        fishAudio.src = url;
        const p = fishAudio.play();
        if (p && p.catch) return p.catch(function () {
          toast("朗讀中斷，再按一次");
          speaking = false;
        });
      }).catch(function (err) {
        clearTimeout(timer);
        const msg = String((err && err.message) || err || "");
        if (/abort/i.test(msg)) toast("朗讀逾時，再按一次");
        else if (/Failed to fetch|NetworkError|CORS|blocked|Load failed/i.test(msg)) toast("連線中斷，再按一次");
        else if (/^http /.test(msg)) toast("朗讀失敗：" + msg);
        else toast("朗讀中斷，再按一次");
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

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
    const cache = [];
    const E = window.AIVAULTEbook || {};
    const fn = "https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/fish-tts";
    let advancing = false;

    function fetchChunk(index) {
      if (cache[index]) return cache[index];
      cache[index] = fetch(fn, {
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
        })
      }).then(function (res) {
        if (!res.ok) throw new Error("http " + res.status);
        const ctype = (res.headers.get("content-type") || "").toLowerCase();
        if (ctype.indexOf("json") >= 0) throw new Error("http 200-json");
        return res.blob();
      }).then(function (blob) {
        if (!blob || blob.size < 200) throw new Error("empty-audio");
        return URL.createObjectURL(blob);
      });
      return cache[index];
    }

    function play(index) {
      if (!speaking || index >= chunks.length) { speaking = false; return; }
      if (advancing) return;
      advancing = true;
      fetchChunk(index).then(function (url) {
        advancing = false;
        if (!speaking) return;
        if (index + 1 < chunks.length) fetchChunk(index + 1);
        let moved = false;
        function next() {
          if (moved) return;
          moved = true;
          play(index + 1);
        }
        fishAudio.onended = next;
        fishAudio.onerror = function () { toast("朗讀中斷，再按一次"); speaking = false; };
        fishAudio.src = url;
        fishAudio.play().then(function () {
          const d = fishAudio.duration;
          if (d && isFinite(d) && d > 0) {
            setTimeout(next, Math.max(0, Math.ceil(d * 1000) + 250));
          }
        }).catch(function () {
          toast("朗讀中斷，再按一次");
          speaking = false;
        });
      }).catch(function (err) {
        advancing = false;
        const msg = String((err && err.message) || err || "");
        if (/^http /.test(msg)) toast("朗讀失敗：" + msg);
        else toast("朗讀中斷，再按一次");
        speaking = false;
      });
    }
    toast("朗讀 · " + chunks.length + " 段");
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

  window.AIVAULTFishTTS = {
    playText: playFishText,
    useFish: useFish,
    stop: function () {
      speaking = false;
      stopFishAudio();
      fishMode = false;
    }
  };

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

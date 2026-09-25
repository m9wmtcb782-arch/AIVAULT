(() => {
  "use strict";
  if (window.__AIVAULT_DARK_STAR_MY_VOICE__) return;
  window.__AIVAULT_DARK_STAR_MY_VOICE__ = true;

  const FN = "https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/fish-tts";
  const KEY = "darkStarUseMyVoice";
  let audio = null;
  let speaking = false;

  function voiceId() {
    try { return (localStorage.getItem("FISH_VOICE_ID") || "").trim(); }
    catch (e) { return ""; }
  }

  function enabled() {
    try { return localStorage.getItem(KEY) === "1"; }
    catch (e) { return false; }
  }

  function setEnabled(on) {
    try { localStorage.setItem(KEY, on ? "1" : "0"); }
    catch (e) {}
    const btn = document.getElementById("darkStarMyVoiceButton");
    if (btn) {
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? "我的聲音 ✓" : "我的聲音";
    }
  }

  function toast(msg) {
    const el = document.getElementById("voiceStatus");
    if (!el) { alert(msg); return; }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function stop() {
    speaking = false;
    if (!audio) return;
    try { audio.pause(); } catch (e) {}
    try { audio.currentTime = 0; } catch (e) {}
  }

  async function speakMine(text) {
    const raw = String(text || "").trim();
    const id = voiceId();
    if (!raw) return;
    if (!id) {
      toast("尚未設定電子書 Voice id");
      return;
    }
    stop();
    speaking = true;
    const chunks = [];
    for (let i = 0; i < raw.length; i += 180) chunks.push(raw.slice(i, i + 180));
    if (!audio) audio = new Audio();
    for (let i = 0; i < chunks.length; i++) {
      if (!speaking) return;
      const res = await fetch(FN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunks[i], reference_id: id, format: "mp3" })
      });
      if (!res.ok) {
        toast("我的聲音合成失敗：" + res.status);
        speaking = false;
        return;
      }
      const blob = await res.blob();
      if (!blob || blob.size < 200) {
        toast("我的聲音沒有音訊");
        speaking = false;
        return;
      }
      const url = URL.createObjectURL(blob);
      await new Promise((resolve) => {
        audio.onended = resolve;
        audio.onerror = resolve;
        audio.src = url;
        audio.play().catch(resolve);
      });
    }
    speaking = false;
  }

  function lastAssistantText() {
    const nodes = document.querySelectorAll(".message.ai .message-text");
    const last = nodes[nodes.length - 1];
    return last ? String(last.innerText || "").trim() : "";
  }

  function addButton() {
    if (document.getElementById("darkStarMyVoiceButton")) return;
    const top = document.querySelector(".topbar");
    if (!top) return;
    const btn = document.createElement("button");
    btn.id = "darkStarMyVoiceButton";
    btn.type = "button";
    btn.textContent = enabled() ? "我的聲音 ✓" : "我的聲音";
    btn.title = "暗星回答時用電子書同一把聲音";
    btn.style.cssText = "margin-left:6px;border:1px solid #ddd;background:#fff;border-radius:9px;padding:7px 10px;font-size:12px;white-space:nowrap";
    btn.onclick = () => {
      const on = !enabled();
      setEnabled(on);
      if (on && !voiceId()) toast("請先在電子書儲存 Voice id");
      if (!on) stop();
    };
    const home = document.getElementById("homeButton") || document.querySelector(".brand-home");
    if (home) home.before(btn);
    else top.appendChild(btn);
    setEnabled(enabled());
  }

  const _speak = window.speakText;
  window.speakText = function (text) {
    if (enabled()) return speakMine(text);
    if (typeof _speak === "function") return _speak(text);
  };

  const obs = new MutationObserver(() => {
    if (!enabled()) return;
    const text = lastAssistantText();
    if (!text || text === addButton._last) return;
    if (/正在思考|正在聆聽/.test(text)) return;
    addButton._last = text;
    speakMine(text);
  });

  function init() {
    addButton();
    const inner = document.getElementById("messagesInner");
    if (inner) obs.observe(inner, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

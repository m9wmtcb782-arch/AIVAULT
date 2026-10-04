/* AIVAULT_LIVE_VOICE_REPAIR_V1: shared mic, transcript import, audible dawn, black dark avatar */
(() => {
  if (window.__AIVAULT_LIVE_VOICE_REPAIR_V1__) return;
  window.__AIVAULT_LIVE_VOICE_REPAIR_V1__ = true;
  function box() { return document.getElementById("messagesInner") || document.getElementById("messages"); }
  function paint(avatar, kind) {
    avatar.className = "message-avatar";
    if (kind === "user") { avatar.textContent = "你"; return; }
    if (kind === "dawn") {
      avatar.textContent = "曙光";
      avatar.style.cssText = "background:#c9a227;color:#1a1a1a;font-size:11px;animation:none;border-radius:10px";
      return;
    }
    avatar.textContent = "✦";
    avatar.style.cssText = "background:#171717;color:#fff;animation:none;border-radius:10px";
  }
  const open = { user: null, dark: null, dawn: null };
  function bubble(kind, text) {
    const host = box();
    if (!host) return null;
    const welcome = document.getElementById("welcome");
    if (welcome && welcome.remove) welcome.remove();
    const row = document.createElement("div");
    row.className = "message " + (kind === "user" ? "user" : "assistant");
    row.dataset.speaker = kind;
    const avatar = document.createElement("div");
    paint(avatar, kind);
    const body = document.createElement("div");
    body.className = "message-body";
    const node = document.createElement("div");
    node.className = "message-text";
    node.textContent = text || "";
    body.appendChild(node);
    row.appendChild(avatar);
    row.appendChild(body);
    host.appendChild(row);
    const scroller = document.getElementById("messages");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    return node;
  }
  function commit(text, kind) {
    text = String(text || "").trim();
    if (!text) return null;
    const key = kind === "dawn" ? "dawn" : (kind === "dark" ? "dark" : "user");
    if (!open[key]) open[key] = bubble(key, text);
    else open[key].textContent = text;
    if (key === "user") {
      const input = document.getElementById("composerInput");
      if (input && input.value !== text) {
        input.value = text;
        try { input.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
      }
      const send = document.getElementById("sendButton");
      if (send) send.disabled = false;
    }
    return open[key];
  }
  window.__AIVAULT_IMPORT_VOICE_TEXT__ = function (text, kind) { return commit(text, kind || "user"); };
  window.__AIVAULT_LIVE_BUBBLE__ = function (role, kind) {
    const key = role === "user" ? "user" : (kind === "dawn" ? "dawn" : "dark");
    if (!open[key]) open[key] = bubble(key, "");
    return open[key];
  };
  window.addEventListener("aivault-conversation-event", function (e) {
    const d = e.detail || {};
    if (!d.text) return;
    if (d.speaker === "user") commit(d.text, "user");
    else if (d.speaker === "dawn-light") commit(d.text, "dawn");
    else if (d.speaker === "dark-star") commit(d.text, "dark");
    if (d.partial === false) open[d.speaker === "dawn-light" ? "dawn" : (d.speaker === "dark-star" ? "dark" : "user")] = null;
  });
  let lastMic = "";
  setInterval(function () {
    const input = document.getElementById("composerInput");
    if (!input) return;
    const v = String(input.value || "").trim();
    if (v && v !== lastMic) {
      lastMic = v;
      commit(v, "user");
    }
    const live = window.AivaultDualAgentLive;
    if (live && !live.__repairArm && live.arm) {
      const orig = live.arm;
      live.arm = function (which, on) {
        const out = orig.call(live, which, on);
        const armed = live.armed ? live.armed() : {};
        if ((armed.dark || armed.dawn) && !live.__micStarted) {
          live.__micStarted = true;
          if (typeof window.__AIVAULT_DARK_STAR_START__ === "function") window.__AIVAULT_DARK_STAR_START__();
          else if (typeof window.__AIVAULT_DARK_STAR_TOGGLE_LIVE_VOICE__ === "function") window.__AIVAULT_DARK_STAR_TOGGLE_LIVE_VOICE__();
        }
        if (!armed.dark && !armed.dawn) live.__micStarted = false;
        if (window.DawnLightLiveVoice && window.DawnLightLiveVoice.setGain) window.DawnLightLiveVoice.setGain(1);
        return out;
      };
      live.__repairArm = true;
    }
  }, 400);
})();

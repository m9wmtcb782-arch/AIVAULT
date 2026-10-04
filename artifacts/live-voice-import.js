(() => {
  "use strict";
  if (window.__AIVAULT_LIVE_VOICE_IMPORT__) return;
  window.__AIVAULT_LIVE_VOICE_IMPORT__ = true;

  function box() {
    return document.getElementById("messagesInner") || document.getElementById("messages");
  }

  function paintAvatar(avatar, kind) {
    avatar.className = "message-avatar";
    if (kind === "user") {
      avatar.textContent = "你";
      return;
    }
    if (kind === "dawn") {
      avatar.textContent = "曙光";
      avatar.style.background = "#c9a227";
      avatar.style.color = "#1a1a1a";
      avatar.style.fontSize = "11px";
      avatar.style.animation = "none";
      avatar.style.borderRadius = "10px";
      return;
    }
    avatar.textContent = "✦";
    avatar.style.background = "#171717";
    avatar.style.color = "#fff";
    avatar.style.animation = "none";
    avatar.style.borderRadius = "10px";
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
    paintAvatar(avatar, kind);
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
    const key = kind === "user" ? "user" : (kind === "dawn" ? "dawn" : "dark");
    if (!open[key]) open[key] = bubble(key, text);
    else open[key].textContent = text;
    if (kind === "user") {
      const input = document.getElementById("composerInput");
      if (input) {
        input.value = text;
        try { input.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
        const send = document.getElementById("sendButton");
        if (send) send.disabled = false;
      }
    }
    return open[key];
  }

  window.__AIVAULT_IMPORT_VOICE_TEXT__ = function (text, kind) {
    return commit(text, kind || "user");
  };
  window.__AIVAULT_LIVE_BUBBLE__ = function (role, kind) {
    const key = role === "user" ? "user" : (kind === "dawn" ? "dawn" : "dark");
    if (!open[key]) open[key] = bubble(key, "");
    return open[key];
  };
  window.__AIVAULT_LIVE_TURN_DONE__ = function () {
    open.user = null;
    open.dark = null;
    open.dawn = null;
  };

  window.addEventListener("aivault-conversation-event", function (e) {
    const d = e.detail || {};
    if (!d.text) return;
    if (d.speaker === "user") commit(d.text, "user");
    else if (d.speaker === "dawn-light") commit(d.text, "dawn");
    else if (d.speaker === "dark-star") commit(d.text, "dark");
    if (d.partial === false) {
      if (d.speaker === "user") open.user = null;
      if (d.speaker === "dawn-light") open.dawn = null;
      if (d.speaker === "dark-star") open.dark = null;
    }
  });
})();

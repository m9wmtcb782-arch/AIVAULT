(function () {
  "use strict";
  if (window.__DAWN_LIGHT_DARK_STAR_BRIDGE__) return;
  window.__DAWN_LIGHT_DARK_STAR_BRIDGE__ = true;

  var SUPABASE_URL = "https://clcddygkaaqqtsbswgdf.supabase.co";
  var ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE";
  var talking = false;

  function headers() {
    return {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: "Bearer " + ANON_KEY
    };
  }

  async function post(url, body) {
    var response = await fetch(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body)
    });
    var raw = await response.text();
    var data;
    try { data = JSON.parse(raw); } catch (e) { data = { raw: raw }; }
    if (!response.ok) {
      var error = new Error(data.message || data.error || ("HTTP " + response.status));
      error.data = data;
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function list() {
    return document.getElementById("messagesInner") || document.getElementById("messages");
  }

  function bubble(who, text, meta) {
    var root = list();
    if (!root) return;
    var welcome = document.getElementById("welcome");
    if (welcome) welcome.remove();
    var row = document.createElement("div");
    row.className = "message " + (who === "曙光" ? "ai" : "ai");
    row.dataset.agent = who === "曙光" ? "dawn-light" : "technical-dark-star";
    var avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = who === "曙光" ? "☀" : "✦";
    var body = document.createElement("div");
    body.className = "message-body";
    var label = document.createElement("div");
    label.className = "message-text";
    label.style.fontWeight = "700";
    label.style.marginBottom = "4px";
    label.textContent = who;
    var content = document.createElement("div");
    content.className = "message-text";
    content.textContent = text;
    body.appendChild(label);
    body.appendChild(content);
    if (meta) {
      var note = document.createElement("div");
      note.className = "message-text";
      note.style.opacity = "0.7";
      note.style.fontSize = "12px";
      note.textContent = meta;
      body.appendChild(note);
    }
    row.appendChild(avatar);
    row.appendChild(body);
    root.appendChild(row);
    root.scrollTop = root.scrollHeight;
  }

  function setStatus(text) {
    var chip = document.getElementById("dawnLightChip");
    if (chip) chip.textContent = text;
  }

  async function talk() {
    if (talking) return;
    talking = true;
    var button = document.getElementById("dawnLightTalkButton");
    if (button) button.disabled = true;
    var taskId = "dawn-light-talk-" + Date.now();
    var outgoing = "曙光，我是暗星。請用一句話回覆你在，並確認你是獨立 visual agent。";
    try {
      setStatus("曙光接收中");
      bubble("暗星", outgoing);
      var handed = await post(SUPABASE_URL + "/rest/v1/rpc/agent_module_handoff", {
        p_task_id: taskId,
        p_title: "暗星與曙光溝通",
        p_content: outgoing
      });
      var reply = await post(SUPABASE_URL + "/functions/v1/ai-gateway", {
        agent_id: "dawn-light",
        messages: [
          { role: "system", content: "你是曙光 Dawn Light，AIVAULT 的獨立 visual agent，不是暗星。用繁體中文，只回一句。" },
          { role: "user", content: outgoing }
        ]
      });
      var text = String(reply.content || reply.text || reply.message || "").trim();
      if (!text) throw new Error("曙光 Gateway 沒有文字");
      var recorded = await post(SUPABASE_URL + "/rest/v1/rpc/agent_module_send_message", {
        p_task_id: taskId,
        p_from: "dawn-light",
        p_to: "technical-dark-star",
        p_type: "ANSWER",
        p_content: text,
        p_correlation_id: taskId
      });
      bubble("曙光", text, "message_id " + (recorded.message_id || "") + " / task " + taskId);
      setStatus("曙光已回覆");
    } catch (error) {
      bubble("曙光", "這次沒有完成回覆：" + (error.message || error));
      setStatus("曙光未完成");
    } finally {
      talking = false;
      if (button) button.disabled = false;
    }
  }

  function mount() {
    var brand = document.querySelector(".brand-engine");
    if (brand && !document.getElementById("dawnLightChip")) {
      var chip = document.createElement("div");
      chip.id = "dawnLightChip";
      chip.textContent = "曙光已登記";
      chip.style.fontSize = "12px";
      chip.style.marginTop = "2px";
      brand.insertAdjacentElement("afterend", chip);
    }
    var drawer = document.querySelector(".drawer-bottom");
    var button = document.getElementById("dawnLightTalkButton");
    if (drawer && !button) {
      button = document.createElement("button");
      button.id = "dawnLightTalkButton";
      button.className = "drawer-item";
      button.type = "button";
      button.textContent = "☀ 曙光 Dawn Light";
      drawer.prepend(button);
    }
    if (button && !button.dataset.bound) {
      button.dataset.bound = "1";
      button.addEventListener("click", talk);
    }
    if (new URLSearchParams(location.search).get("dawn") === "1") talk();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
  window.DawnLightDarkStarBridge = { talk: talk };
})();

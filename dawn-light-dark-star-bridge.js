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
    var host = list();
    if (!host) return;
    var row = document.createElement("div");
    row.className = "message " + (who === "曙光" ? "assistant" : "user");
    row.textContent = who + "：" + text + (meta ? " (" + meta + ")" : "");
    host.appendChild(row);
  }

  function setStatus(text) {
    var chip = document.getElementById("dawnLightChip");
    if (!chip) return;
    chip.title = text;
    chip.setAttribute("aria-label", text);
  }

  function router() {
    return window.AivaultAgentRouter;
  }

  function selected(decision, agentId) {
    return decision && decision.agents && decision.agents.indexOf(agentId) >= 0;
  }

  function installRelayGate() {
    if (window.__AIVAULT_AGENT_ROUTE_WS_GATE__) return;
    window.__AIVAULT_AGENT_ROUTE_WS_GATE__ = true;
    var original = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      var url = "";
      try { url = String(this.url || ""); } catch (e) {}
      var agent = this.__aivaultAgent || "";
      var liveRelay = url.indexOf("technical-dark-star-live-voice") !== -1;
      if (!liveRelay) return original.apply(this, arguments);
      var payload = typeof data === "string" ? data : "";
      var agentContext = payload.indexOf("[speaker=") !== -1 || payload.indexOf("\"speaker\":\"dark-star\"") !== -1 || payload.indexOf("\"speaker\":\"dawn-light\"") !== -1;
      if (agentContext) return original.apply(this, arguments);
      var target = agent === "dawn-light" ? "dawn-light" : "technical-dark-star";
      var allowed = window.AivaultDualAgentLive && window.AivaultDualAgentLive.wakeAllows
        ? window.AivaultDualAgentLive.wakeAllows(target, payload)
        : ((router() ? router().active() : []).indexOf(target) !== -1);
      if (!allowed) return;
      return original.apply(this, arguments);
    };
  }

  function installSendGate() {
    if (window.__AIVAULT_WAKE_SEND_GATE__ || typeof window.sendMessage !== "function") return;
    window.__AIVAULT_WAKE_SEND_GATE__ = true;
    var original = window.sendMessage;
    window.sendMessage = function () {
      if (window.__AIVAULT_LAST_ROUTE_SOURCE__ === "speech-recognition") {
        var allowed = window.AivaultDualAgentLive && window.AivaultDualAgentLive.wakeAllows
          ? window.AivaultDualAgentLive.wakeAllows("technical-dark-star")
          : ((router() ? router().active() : []).indexOf("technical-dark-star") !== -1);
        if (!allowed) return Promise.resolve();
      }
      return original.apply(this, arguments);
    };
  }

  function startReadSeconds() {
    if (typeof window.createLoadingMessage === "function") return window.createLoadingMessage();
    return null;
  }

  function stopReadSeconds(loading) {
    if (loading && typeof loading.remove === "function") loading.remove();
  }

  async function answerDawn(decision) {
    if (!selected(decision, "dawn-light")) return;
    var taskId = "dawn-light-voice-" + Date.now();
    var content = (decision.payloads && decision.payloads["dawn-light"]) || decision.payload || decision.transcript;
    var loading = startReadSeconds();
    setStatus("曙光接收中");
    if (router()) router().setPhase("speak", "dawn-light");
    bubble("你", decision.transcript);
    try {
      var reply = await post(SUPABASE_URL + "/functions/v1/ai-gateway", {
        agent_id: "dawn-light",
        messages: [
          { role: "system", content: "你是曙光 Dawn Light，AIVAULT 的獨立 visual agent，不是暗星。用繁體中文，只回一句。" },
          { role: "user", content: content || "使用者呼叫曙光" }
        ]
      });
      var text = String(reply.content || reply.text || reply.message || "").trim();
      if (!text) throw new Error("曙光 Gateway 沒有文字");
      stopReadSeconds(loading);
      bubble("曙光", text, "task " + taskId);
      setStatus("曙光已回覆");
      await speak(text);
      return text;
    } catch (error) {
      stopReadSeconds(loading);
      throw error;
    }
  }

  function speak(text) {
    if (window.AivaultDualAgentLive) return Promise.resolve();
    return new Promise(function (resolve) {
      if (!window.speechSynthesis || !text) {
        if (router()) router().setPhase("idle", "dawn-light");
        resolve();
        return;
      }
      window.speechSynthesis.cancel();
      var utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-TW";
      utterance.onend = function () {
        if (router()) router().setPhase("idle", "dawn-light");
        resolve();
      };
      utterance.onerror = utterance.onend;
      window.speechSynthesis.speak(utterance);
    });
  }

  function waitForDarkStarTurn() {
    return new Promise(function (resolve) {
      var host = list();
      var seen = false;
      var timer = setTimeout(finish, 20000);
      function finish() {
        clearTimeout(timer);
        if (host) host.removeEventListener("DOMNodeRemoved", check);
        resolve();
      }
      function check() {
        if (!host) return finish();
        if (host.querySelector(".think-timer")) seen = true;
        if (seen && !host.querySelector(".think-timer")) finish();
      }
      if (host) host.addEventListener("DOMNodeRemoved", check);
      setTimeout(check, 300);
    });
  }

  function deliverDarkStar(decision) {
    if (!selected(decision, "technical-dark-star")) return Promise.resolve();
    var input = document.getElementById("composerInput");
    var send = document.getElementById("sendButton");
    if (!input || !send) return Promise.resolve();
    input.value = (decision.payloads && decision.payloads["technical-dark-star"]) || decision.payload || decision.transcript;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    send.click();
    return waitForDarkStarTurn();
  }

  var handled = null;

  function onRoute(decision) {
    if (window.AivaultDualAgentLive && typeof window.AivaultDualAgentLive.handleRoute === "function") {
      return window.AivaultDualAgentLive.handleRoute(decision);
    }
    if (!decision || !decision.deliver) return;
    var key = decision.transcript + "|" + (decision.agents || []).join(",");
    if (handled === key) return;
    handled = key;
    if (talking) return;
    talking = true;
    var job = Promise.resolve();
    if (selected(decision, "technical-dark-star")) job = job.then(function () { return deliverDarkStar(decision); });
    if (selected(decision, "dawn-light")) {
      job = job.then(function () { return answerDawn(decision); }).catch(function (error) {
        bubble("曙光", "這次沒有完成回覆：" + (error.message || error));
        setStatus("曙光未完成");
        if (router()) router().setPhase("idle", "dawn-light");
      });
    }
    return job.finally(function () {
      talking = false;
      window.__AIVAULT_LAST_ROUTE_SOURCE__ = "";
    });
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
      await post(SUPABASE_URL + "/rest/v1/rpc/agent_module_handoff", {
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
      await post(SUPABASE_URL + "/rest/v1/rpc/agent_module_send_message", {
        p_task_id: taskId,
        p_from: "dawn-light",
        p_to: "technical-dark-star",
        p_type: "ANSWER",
        p_content: text,
        p_correlation_id: taskId
      });
      bubble("曙光", text, "task " + taskId);
      setStatus("曙光已回覆");
    } catch (error) {
      bubble("曙光", "這次沒有完成回覆：" + (error.message || error));
      setStatus("曙光未完成");
    } finally {
      talking = false;
      if (button) button.disabled = false;
    }
  }

  function sunMark() {
    var sun = document.createElement("span");
    sun.className = "dawn-sun idle";
    sun.innerHTML = '<i class="core"></i><i class="glow"></i><i class="rays"></i>';
    return sun;
  }

  function syncSun(detail) {
    var sun = document.querySelector(".dawn-sun");
    if (!sun) return;
    var active = detail && detail.agent_id === "dawn-light";
    sun.classList.remove("idle", "listen", "speak");
    sun.classList.add(!active || !detail.phase || detail.phase === "idle" ? "idle" : detail.phase);
  }

  function mount() {
    installRelayGate();
    installSendGate();
    if (router()) {
      router().subscribe("dawn-light", onRoute);
      router().subscribe("technical-dark-star", onRoute);
    }
    window.addEventListener("aivault-agent-phase", function (event) { syncSun(event.detail); });
    var brand = document.querySelector(".brand-engine");
    if (brand && !document.getElementById("dawnLightChip")) {
      var chip = document.createElement("div");
      chip.id = "dawnLightChip";
      chip.title = "曙光";
      chip.setAttribute("aria-label", "曙光");
      chip.style.display = "inline-flex";
      chip.style.alignItems = "center";
      chip.style.marginTop = "2px";
      chip.appendChild(sunMark());
      brand.insertAdjacentElement("afterend", chip);
    }
    var drawer = document.querySelector(".drawer-bottom");
    var button = document.getElementById("dawnLightTalkButton");
    if (drawer && !button) {
      button = document.createElement("button");
      button.id = "dawnLightTalkButton";
      button.className = "drawer-item";
      button.type = "button";
      drawer.prepend(button);
    }
    if (drawer && !document.getElementById("dawnLightSandboxButton")) {
      var sandbox = document.createElement("a");
      sandbox.id = "dawnLightSandboxButton";
      sandbox.className = "drawer-item";
      sandbox.href = "dawn-light-sandbox.html";
      sandbox.textContent = "曙光沙盒 JPG";
      drawer.appendChild(sandbox);
    }
      button.dataset.bound = "1";
      button.textContent = "";
      button.appendChild(sunMark());
      button.appendChild(document.createTextNode(" 曙光 Dawn Light"));
      button.addEventListener("click", talk);
    }
    if (!document.getElementById("dawnSunStyle")) {
      var style = document.createElement("style");
      style.id = "dawnSunStyle";
      style.textContent = ".dawn-sun{position:relative;display:inline-block;width:22px;height:22px;vertical-align:-4px}.dawn-sun .core,.dawn-sun .glow,.dawn-sun .rays{position:absolute;inset:0;border-radius:50%}.dawn-sun .core{background:radial-gradient(circle,#fff7d6 0 38%,#f0b429 70%,rgba(240,180,41,0) 72%);transform:scale(.72)}.dawn-sun .glow{background:radial-gradient(circle,rgba(255,214,120,.55),rgba(255,214,120,0) 68%);animation:dawnBreath 4.8s ease-in-out infinite}.dawn-sun .rays{background:conic-gradient(from 0deg,rgba(255,196,92,.0),rgba(255,196,92,.55),rgba(255,196,92,0) 18%);animation:dawnSpin 18s linear infinite;opacity:.45}.dawn-sun.listen .glow{animation-duration:2.4s}.dawn-sun.speak .core{transform:scale(.84)}.dawn-sun.speak .glow{opacity:.95}@keyframes dawnBreath{0%,100%{transform:scale(.86);opacity:.45}50%{transform:scale(1);opacity:.8}}@keyframes dawnSpin{to{transform:rotate(360deg)}}";
      document.head.appendChild(style);
    }
  }

  function boot() {
    if (window.AivaultAgentRouter) {
      mount();
      return;
    }
    var script = document.createElement("script");
    script.src = "aivault-agent-voice-router.js?v=3";
    script.onload = mount;
    script.onerror = mount;
    document.head.appendChild(script);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  window.DawnLightDarkStarBridge = { talk: talk };
})();

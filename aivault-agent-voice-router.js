(function (root) {
  "use strict";
  if (root.AivaultAgentRouter) return;

  var AGENTS = {
    "technical-dark-star": {
      id: "technical-dark-star",
      label: "暗星",
      aliases: ["暗星", "darkstar", "dark star"]
    },
    "dawn-light": {
      id: "dawn-light",
      label: "曙光",
      aliases: ["曙光", "dawnlight", "dawn light"]
    }
  };

  var boundAgent = null;
  var phase = "idle";
  var listeners = {
    "technical-dark-star": [],
    "dawn-light": []
  };

  function compact(text) {
    return String(text || "").toLowerCase().replace(/[\s,，.。!！?？、]/g, "");
  }

  function findWake(transcript) {
    var raw = String(transcript || "");
    var folded = compact(raw);
    var found = [];
    Object.keys(AGENTS).forEach(function (id) {
      AGENTS[id].aliases.forEach(function (alias) {
        var needle = compact(alias);
        var at = folded.indexOf(needle);
        if (at >= 0) found.push({ id: id, at: at, alias: alias });
      });
    });
    if (!found.length) return null;
    found.sort(function (a, b) { return a.at - b.at; });
    return found[0].id;
  }

  function stripWake(transcript, agentId) {
    var text = String(transcript || "").trim();
    var agent = AGENTS[agentId];
    if (!agent) return text;
    agent.aliases.forEach(function (alias) {
      var pattern = new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
      text = text.replace(pattern, " ");
    });
    return text.replace(/^[\s,，:：]+/, "").replace(/\s+/g, " ").trim();
  }

  function emit(name, detail) {
    try {
      root.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) {}
  }

  function setPhase(next, agentId) {
    phase = next || "idle";
    emit("aivault-agent-phase", {
      agent_id: agentId || boundAgent,
      phase: phase,
      bound: boundAgent
    });
  }

  function decide(transcript) {
    var wake = findWake(transcript);
    var target = wake || boundAgent;
    return {
      transcript: String(transcript || ""),
      wake: wake,
      target: target,
      bound_before: boundAgent,
      deliver: !!target,
      reason: wake ? "wake" : (boundAgent ? "bound-session" : "no-agent")
    };
  }

  function route(transcript, meta) {
    var decision = decide(transcript);
    decision.meta = meta || {};
    if (decision.wake) boundAgent = decision.wake;
    decision.bound_after = boundAgent;
    decision.target = decision.wake || boundAgent;
    decision.deliver = !!decision.target;
    decision.payload = decision.target ? stripWake(transcript, decision.target) : "";
    emit("aivault-agent-route", decision);
    if (!decision.deliver) return decision;
    setPhase("listen", decision.target);
    listeners[decision.target].forEach(function (handler) {
      try { handler(decision); } catch (e) { console.warn("[agent-router]", e); }
    });
    return decision;
  }

  function subscribe(agentId, handler) {
    if (!listeners[agentId] || typeof handler !== "function") return function () {};
    listeners[agentId].push(handler);
    return function () {
      listeners[agentId] = listeners[agentId].filter(function (item) { return item !== handler; });
    };
  }

  function bind(agentId) {
    boundAgent = AGENTS[agentId] ? agentId : null;
    emit("aivault-agent-route", { wake: boundAgent, target: boundAgent, bound_after: boundAgent, deliver: false, reason: "bind" });
    return boundAgent;
  }

  root.AivaultAgentRouter = {
    agents: AGENTS,
    decide: decide,
    route: route,
    subscribe: subscribe,
    bind: bind,
    bound: function () { return boundAgent; },
    phase: function () { return phase; },
    setPhase: setPhase,
    clear: function () { boundAgent = null; setPhase("idle", null); }
  };
})(typeof window !== "undefined" ? window : globalThis);

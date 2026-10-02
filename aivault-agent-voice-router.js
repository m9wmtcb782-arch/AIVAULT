(function (root) {
  "use strict";
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
  var ORDER = ["technical-dark-star", "dawn-light"];
  var activeAgents = [];
  var phase = "idle";
  var listeners = {
    "technical-dark-star": [],
    "dawn-light": []
  };

  function compact(text) {
    return String(text || "").toLowerCase().replace(/[\s,，.。!！?？、]/g, "");
  }

  function hasAlias(folded, agentId) {
    var aliases = AGENTS[agentId].aliases;
    for (var i = 0; i < aliases.length; i++) {
      if (folded.indexOf(compact(aliases[i])) >= 0) return true;
    }
    return false;
  }

  function detectWakeAgents(transcript) {
    var folded = compact(transcript);
    var found = [];
    ORDER.forEach(function (id) {
      if (hasAlias(folded, id)) found.push(id);
    });
    return found;
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
      agent_id: agentId || null,
      phase: phase,
      active: activeAgents.slice()
    });
  }

  function decide(transcript) {
    var agents = detectWakeAgents(transcript);
    return {
      transcript: String(transcript || ""),
      agents: agents,
      wake: agents[0] || null,
      target: agents[0] || null,
      bound_before: null,
      bound_after: null,
      this_turn_only: true,
      deliver: agents.length > 0,
      reason: agents.length ? (agents.length > 1 ? "wake-both" : "wake") : "no-agent"
    };
  }

  function route(transcript, meta) {
    var decision = decide(transcript);
    decision.meta = meta || {};
    activeAgents = decision.agents.slice();
    decision.payloads = {};
    decision.agents.forEach(function (id) {
      decision.payloads[id] = stripWake(transcript, id);
    });
    decision.payload = decision.agents.length === 1 ? decision.payloads[decision.agents[0]] : "";
    emit("aivault-agent-route", decision);
    if (!decision.deliver) {
      setPhase("idle", null);
      return Promise.resolve(decision);
    }
    var chain = Promise.resolve();
    decision.agents.forEach(function (id) {
      chain = chain.then(function () {
        setPhase("listen", id);
        var pending = listeners[id].map(function (handler) {
          try { return handler(decision); } catch (e) { console.warn("[agent-router]", e); }
        });
        return Promise.all(pending);
      });
    });
    return chain.then(function () {
      activeAgents = [];
      setPhase("idle", null);
      return decision;
    });
  }

  function subscribe(agentId, handler) {
    if (!listeners[agentId] || typeof handler !== "function") return function () {};
    listeners[agentId].push(handler);
    return function () {
      listeners[agentId] = listeners[agentId].filter(function (item) { return item !== handler; });
    };
  }

  root.AivaultAgentRouter = {
    agents: AGENTS,
    detectWakeAgents: detectWakeAgents,
    decide: decide,
    route: route,
    subscribe: subscribe,
    bind: function () { return null; },
    bound: function () { return null; },
    active: function () { return activeAgents.slice(); },
    phase: function () { return phase; },
    setPhase: setPhase,
    clear: function () { activeAgents = []; setPhase("idle", null); }
  };
})(typeof window !== "undefined" ? window : globalThis);

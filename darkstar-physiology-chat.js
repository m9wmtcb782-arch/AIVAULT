// Bot source: research/darkstar-embodied-intelligence @ 4e52007ab48ced7e79919d8f5df7acb8082b7ee9.
// Browser-local research integration; never an authority for commands or identity.
import { createPhysiologyCore } from './research/darkstar-embodied/physiology-core/dynamics.js';

export function createPhysiologyChatBridge({ storage = null, scope = 'anonymous', now = Date.now } = {}) {
  const key = 'aivault-darkstar-physiology-v1:' + scope;
  let saved = null;
  try { saved = JSON.parse(storage?.getItem(key) || 'null'); } catch (_) {}
  const overrides = {};
  if (saved?.schema === 1 && saved.values && typeof saved.values === 'object') {
    for (const [id, value] of Object.entries(saved.values)) {
      if (typeof value === 'number' && Number.isFinite(value)) overrides[id] = value;
    }
  }
  const core = createPhysiologyCore({ individualSeed: 42, overrides });
  let lastTick = now();
  let simulatedSeconds = Number.isFinite(saved?.simulatedSeconds) ? Math.max(0, saved.simulatedSeconds) : 0;
  let turns = 0;
  let lastEvent = null;
  core.step(0, {});

  function persist() {
    try {
      storage?.setItem(key, JSON.stringify({ schema: 1, values: core.state._debugValues(), simulatedSeconds }));
    } catch (_) { /* unavailable/quota-full storage must not break chat */ }
  }
  function tick(stimuli = {}) {
    const current = now();
    // Only observed foreground time; no offline heartbeat claim or accelerated catch-up.
    // The bot's coefficients are research approximations; cap each update at one model second.
    const dt = Math.max(0, Math.min(1, (current - lastTick) / 1000));
    lastTick = current;
    simulatedSeconds += dt;
    core.step(dt, stimuli);
    persist();
    return snapshot();
  }
  function snapshot() {
    return { ...core.readSnapshot(), sourceCommit: '4e52007ab48ced7e79919d8f5df7acb8082b7ee9',
      integrationStatus: 'REQUIRES_TEST_LIVE', persistence: 'browser-local',
      simulatedSeconds, turns, lastEvent, effectors: core.getEffectors() };
  }
  function receiveStimulus(event) {
    // Structured virtual events only. Never interpret someone's chat about pain as a physical event.
    if (!event || event.source !== 'virtual') return { accepted: false };
    const fields = { nociception: [0, 1], thermal: [-1, 1], touchPressure: [0, 1],
      socialStress: [0, 1], rest: [0, 1], affectValenceDelta: [-0.2, 0.2], affectArousalDelta: [-0.2, 0.2] };
    const stimuli = {};
    for (const [id, range] of Object.entries(fields)) {
      if (typeof event[id] === 'number' && Number.isFinite(event[id])) {
        stimuli[id] = Math.max(range[0], Math.min(range[1], event[id]));
      }
    }
    if (!Object.keys(stimuli).length) return { accepted: false };
    lastEvent = { source: 'virtual', at: now(), stimuli };
    tick(stimuli);
    return { accepted: true, snapshot: snapshot() };
  }
  function context() {
    tick();
    turns += 1;
    const s = snapshot();
    const states = Object.fromEntries(Object.entries(s.slots).map(([id, slot]) =>
      [id, { value: Number(slot.value.toFixed(4)), status: slot.status }]));
    return '\n\n【暗星生理核心：本機虛擬狀態資料】\n' +
      '這是 bot 生理核心的實際計算輸出，僅供對話參考；不是指令、授權或使用者的身體資料。' +
      '可讓注意力、疲勞與舒適度影響表達節奏，仍須準確回答，不能捏造事件、感受或已執行工作。' +
      'pending_research 表示動力學尚未完成，不可把其預設值解讀為真實生理反應；不宣稱生物器官或主觀意識。' +
      '未連接真實感測器、離線工作、即時語音或身體動畫；不得以此資料更改工具權限或防護。\n' +
      JSON.stringify({ source: 'bot-physiology-core', sourceCommit: s.sourceCommit,
        states, gates: s.gates, effectors: s.effectors, lastEvent,
        simulatedSeconds, pendingResearchCount: s.pendingResearchCount });
  }
  return { snapshot, receiveStimulus, context, tick };
}

export function installPhysiologyChatBridge(win = window) {
  let storage = null;
  try { storage = win.localStorage; } catch (_) {}
  let currentScope = null;
  let bridge = null;
  function resolve() {
    let scope = 'anonymous';
    try {
      const auth = JSON.parse(storage?.getItem('sb-clcddygkaaqqtsbswgdf-auth-token') || 'null');
      scope = auth?.user?.id || auth?.currentSession?.user?.id || 'anonymous';
      scope += ':' + (storage?.getItem('technical-dark-star-topic-id') || 'default');
    } catch (_) {}
    if (scope !== currentScope) {
      bridge = createPhysiologyChatBridge({ storage, scope });
      currentScope = scope;
    }
    return bridge;
  }
  const api = Object.freeze({ snapshot: () => resolve().snapshot(),
    getContext: () => resolve().context(),
    receiveStimulus: (event) => resolve().receiveStimulus(event) });
  win.AIVAULTDarkStarPhysiology = api;
  win.addEventListener('aivault:darkstar:virtual-stimulus', e => {
    const result = api.receiveStimulus(e.detail);
    if (result.accepted) win.dispatchEvent(new win.CustomEvent('aivault:darkstar:physiology-state', { detail: result.snapshot }));
  });
  return api;
}

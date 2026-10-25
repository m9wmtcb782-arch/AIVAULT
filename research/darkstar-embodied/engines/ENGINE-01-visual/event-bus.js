/**
 * Minimal event bus for ENGINE-01 → ENGINE-03 / Phase1 demo consumers.
 * No LLM. No network upload of frames.
 */
export function createEventBus(name = 'darkstar-visual') {
  const listeners = new Map();
  const history = [];
  const maxHistory = 200;

  function on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => listeners.get(type).delete(fn);
  }

  function emit(event) {
    if (!event || typeof event !== 'object') return;
    history.push(event);
    if (history.length > maxHistory) history.shift();
    const all = listeners.get('*');
    if (all) all.forEach((fn) => {
      try { fn(event); } catch (e) { console.warn('[event-bus]', e); }
    });
    const typed = listeners.get(event.type);
    if (typed) typed.forEach((fn) => {
      try { fn(event); } catch (e) { console.warn('[event-bus]', e); }
    });
  }

  return {
    name,
    on,
    emit,
    history: () => history.slice(),
    clearHistory: () => { history.length = 0; }
  };
}

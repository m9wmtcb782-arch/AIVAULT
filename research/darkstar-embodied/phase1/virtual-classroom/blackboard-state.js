/**
 * Virtual blackboard object state (DEV).
 * Mutating this state IS the proof of virtual interaction — not an MP4.
 */
export const BLACKBOARD_VERSION = '0.1.0-dev';

export function createBlackboard(initialText = 'AIVAULT 虛擬教室') {
  let text = String(initialText || '');
  let erasedAt = null;
  const history = [];

  function getState() {
    return {
      id: 'virtual-blackboard-1',
      domain: 'virtual',
      text,
      isBlank: text.length === 0,
      erasedAt,
      version: BLACKBOARD_VERSION,
      history: history.slice(-20)
    };
  }

  function write(t) {
    const prev = text;
    text = String(t || '');
    history.push({ op: 'write', prev, next: text, ts: Date.now() });
    return getState();
  }

  function erase() {
    const prev = text;
    text = '';
    erasedAt = Date.now();
    history.push({ op: 'erase', prev, next: '', ts: erasedAt });
    return getState();
  }

  return { getState, write, erase, version: BLACKBOARD_VERSION };
}

/**
 * Virtual blackboard object state (DEV).
 * Mutating this state IS the proof of virtual interaction — not an MP4.
 */
export const BLACKBOARD_VERSION = '0.2.0-dev';

export function createBlackboard(initialText = 'AIVAULT 虛擬教室') {
  let text = String(initialText || '');
  let dirty = text.length > 0;
  let erasedAt = null;
  const history = [];

  function getState() {
    return {
      id: 'virtual-blackboard-1',
      domain: 'virtual',
      text,
      isBlank: text.length === 0,
      dirty,
      erasedAt,
      version: BLACKBOARD_VERSION,
      history: history.slice(-20)
    };
  }

  function write(t) {
    const prev = { text, dirty };
    text = String(t || '');
    dirty = text.length > 0;
    history.push({ op: 'write', prev, next: { text, dirty }, ts: Date.now() });
    return getState();
  }

  function erase() {
    const prev = { text, dirty, isBlank: text.length === 0 };
    text = '';
    dirty = false;
    erasedAt = Date.now();
    history.push({
      op: 'erase',
      prev,
      next: { text: '', dirty: false, isBlank: true },
      ts: erasedAt,
      stateChanged: prev.text.length > 0 || prev.dirty
    });
    return getState();
  }

  /** Diff helper for acceptance */
  function diff(before, after) {
    return {
      textChanged: (before && before.text) !== (after && after.text),
      dirtyBefore: !!(before && before.dirty),
      dirtyAfter: !!(after && after.dirty),
      cleared: !!(before && before.text && before.text.length) && !!(after && after.isBlank)
    };
  }

  return { getState, write, erase, diff, version: BLACKBOARD_VERSION };
}

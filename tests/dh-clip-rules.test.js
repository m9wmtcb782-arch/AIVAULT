// node tests/dh-clip-rules.test.js — 動作片段鎖定／整頭嘴型顯示規則
const assert = require('assert');
const R = require('../digital-human-real/dh-clip-rules.js');
const now = 1e6, lu = R.lockUntil(now, 5.04);
for (const c of ['open-box','take-cigar','pick-cutter','cut-both-ends','look-dragon','cigar-puff','ash-tap','dragon-sleep','screen','dragonfire-light','dragon-wake'])
  assert.ok(R.holdAction({ clip: c, ended: false, now: now + 3000, lockUntil: lu }), c + ' 說話時要播完');
assert.ok(!R.holdAction({ clip: 'cut-both-ends', ended: true, now, lockUntil: lu }), '播完就放');
assert.ok(!R.holdAction({ clip: 'cut-both-ends', ended: false, now: now + 7000, lockUntil: lu }), '卡住最多 長度+1s');
assert.ok(!R.holdAction({ clip: 'idle', ended: false, now, lockUntil: lu }));
assert.ok(!R.holdAction({ clip: 'transition', ended: false, now, lockUntil: lu }));
const ok = { clip: 'idle', idleOn: true, idlePaused: false, idleReady: 4, otherOn: false };
assert.ok(R.lipAllowed(ok));
assert.ok(!R.lipAllowed({ ...ok, clip: 'cut-both-ends' }), '剪雪茄中不可疊嘴型');
assert.ok(!R.lipAllowed({ ...ok, otherOn: true }), '淡入中不可疊');
assert.ok(!R.lipAllowed({ ...ok, idlePaused: true }));
assert.ok(!R.lipAllowed({ ...ok, idleReady: 1 }), 'idle 尚未解碼（iOS）不可疊');
console.log('dh-clip-rules tests: all passed');

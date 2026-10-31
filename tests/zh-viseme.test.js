// node tests/zh-viseme.test.js — 曙光 字幕→整頭嘴型 單元測試（離線）
const assert = require('assert');
const z = require('../digital-human-real/zh-viseme.js');
const eq = (t, want) => assert.deepStrictEqual(z.textToVisemes(t), want, t);
eq('啊', ['a']); eq('大家', ['a', 'a']); eq('好', ['a']);
eq('我', ['u']); eq('不', ['u']); eq('中', ['u']); eq('都', ['u']);
eq('你', ['ei']); eq('謝謝', ['ei', 'ei']); eq('美', ['ei']); eq('一', ['ei']);
eq('是', ['e']); eq('的', ['e']); eq('呃', ['e']); eq('很', ['e']); eq('知識', ['e', 'e']);
eq('你好，我是曙光。', ['ei', 'a', '', 'u', 'e', 'u', 'a', '']);
eq('OK', ['u']); eq('Hi', ['ei']);
assert.strictEqual(z.charVis('，'), ''); assert.strictEqual(z.charVis('㐀'), 'e');   // 表外字預設 婀
// 時間對齊：20ms 音框；靜音閉嘴、每字 120–240ms、沒字時回 null（退回音量）
const fr = (n, rms, t0 = 0) => Array.from({ length: n }, (_, i) => [t0 + i * 0.02, rms]);
let q = z.textToVisemes('大我'), st = {};
let out = z.alignFrames(fr(10, 0.1), q, st);
assert.strictEqual(out[0][1], 'a'); assert.strictEqual(out[9][1], 'a');
out = z.alignFrames(fr(10, 0.1, 0.2), q, st);
assert.strictEqual(out[0][1], 'u');
out = z.alignFrames(fr(15, 0.1, 0.4), q, st);
assert.strictEqual(out[14][1], null);                       // 字用完 → 交回音量嘴型
q = z.textToVisemes('好。你'); st = {};
out = z.alignFrames([...fr(5, 0.1), ...fr(4, 0.001, 0.1), ...fr(3, 0.1, 0.18)], q, st);
assert.deepStrictEqual(out.slice(5, 9).map(x => x[1]), ['', '', '', '']);   // 停頓＝閉嘴
assert.strictEqual(out[9][1], 'ei');                                        // 標點被停頓吃掉，下一字接上
console.log('zh-viseme tests: all passed');

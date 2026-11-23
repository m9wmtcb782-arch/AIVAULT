// t318：AI 小說頁收藏與電子書架共用 aivaultLibraryFavs（不需 DOM；擷取 helper 原始碼執行）
import fs from 'node:fs'; import assert from 'node:assert/strict';
const src = fs.readFileSync(new URL('../../yinxu-floor-shelf.js', import.meta.url), 'utf8');
const start = src.indexOf("  var FAVK"), end = src.indexOf("if (typeof window !== 'undefined') window.__yfsFav");
const store = {}; const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
const h = new Function('localStorage', src.slice(start, end) + '; return { favs, isFav, toggleFav, FAVK };')(localStorage);
assert.equal(h.FAVK, 'aivaultLibraryFavs');
store.aivaultLibraryFavs = JSON.stringify(['legal-book-1']);                 // 電子書架既有收藏（法律書）保留
assert.equal(h.toggleFav('9d6c6eb2-4be2-4466-a26f-4a499ecceb18'), true);
assert.deepEqual(JSON.parse(store.aivaultLibraryFavs), ['legal-book-1', '9d6c6eb2-4be2-4466-a26f-4a499ecceb18']);
assert.equal(h.isFav('9d6c6eb2-4be2-4466-a26f-4a499ecceb18'), true);
assert.equal(h.toggleFav('9d6c6eb2-4be2-4466-a26f-4a499ecceb18'), false);
assert.deepEqual(JSON.parse(store.aivaultLibraryFavs), ['legal-book-1']);
store.aivaultLibraryFavs = 'not json'; assert.deepEqual(h.favs(), []);   // 壞資料不炸
// royal-library.js：novelsSection 會排除已在館藏中的同 id 小說，並移除「協作池」標題
const rl = fs.readFileSync(new URL('../../royal-library.js', import.meta.url), 'utf8');
assert.match(rl, /list=all\.filter\(n=>!inLib\.has\(String\(n\.id\)\)\)/);
assert.doesNotMatch(rl, /<h3>📚 AI小說（協作池）<\/h3>/);
console.log('fav tests ok');

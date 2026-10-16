/* 因序小說：書架資料（示範書 + localStorage 新時間線） */
window.YinxuStore = (function () {
  var KEY = 'yinxu.timelines.v1';
  function list() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } }
  function save(rec) { var a = list(); a.push(rec); localStorage.setItem(KEY, JSON.stringify(a)); }
  function all() { return (window.YINXU_DEMO_BOOKS || []).concat(list()); }
  function get(id) { return all().filter(function (b) { return b.book_id === id; })[0] || null; }
  function children(id) { return list().filter(function (b) { return b.parent_id === id; }); }
  function remove(id) { localStorage.setItem(KEY, JSON.stringify(list().filter(function (b) { return b.book_id !== id; }))); }
  return { list: list, save: save, all: all, get: get, children: children, remove: remove };
})();

/* 皇家書架：暗星已學與 AI 小說（協作池）的純資料整理函式（無網路、無 DOM，方便單元測試）。 */
(function (root) {
  'use strict';
  const arr = v => Array.isArray(v) ? v : [];
  // 舊書架的學習進度：localStorage aivault_bookqa_progress_v1 = { [ebook_id]: { have, total, pct } }
  function parseProgress(raw) {
    let o = raw;
    if (typeof raw === 'string') { try { o = JSON.parse(raw || '{}'); } catch (e) { o = {}; } }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return [];
    return Object.keys(o).map(id => {
      const p = o[id] || {}, total = Math.max(0, Number(p.total) || 0), have = Math.max(0, Number(p.have) || 0);
      const pct = Math.max(0, Math.min(100, Math.round(Number(p.pct) || (total ? have / total * 100 : 0))));
      return { id: String(id), have, total, pct };
    }).filter(p => p.total > 0).sort((a, b) => b.pct - a.pct);
  }
  function progressLabel(p) { return !p || !p.total ? '學習 0%' : p.pct >= 100 ? '已學習 ✓' : '學習中 ' + p.pct + '%'; }
  // 後端 study_list：只列 enabled，並對照目前館藏；不在館藏的書標記 missing（顯示佔位卡）
  function assignedRows(study, books, progress) {
    const byId = new Map(arr(books).map(b => [String(b.id), b]));
    const prog = new Map(arr(progress).map(p => [p.id, p]));
    const seen = new Set();
    return arr(study).filter(x => x && x.enabled !== false && x.enabled !== 'false' && x.ebook_id).filter(x => { const id = String(x.ebook_id); if (seen.has(id)) return false; seen.add(id); return true; })
      .map(x => { const id = String(x.ebook_id), b = byId.get(id); return { id, title: b ? b.title : '', missing: !b, progress: prog.get(id) || null, updated_at: x.updated_at || '' }; });
  }
  // floor 功能 shelf 動作回傳的已核准小說 → 卡片資料（只用 API 給的欄位，不補內容）
  function novelCards(data) {
    const d = data && data.data && !Array.isArray(data.data) ? data.data : data;
    return arr(d && d.books).filter(b => b && b.id).map(b => ({
      id: String(b.id), title: String(b.title || '未命名'), genre: String(b.genre || ''),
      status: b.status === 'done' ? '完結' : '連載中',
      chapters: Number(b.chapters_done) || 0, target: Number(b.target_chapters) || 0,
      wan: Math.round((Number(b.chars) || 0) / 1000) / 10
    }));
  }
  const api = { parseProgress, progressLabel, assignedRows, novelCards };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AIVAULTLearned = api;
})(typeof window !== 'undefined' ? window : globalThis);

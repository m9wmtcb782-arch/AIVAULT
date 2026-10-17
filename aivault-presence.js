/* AIVAULT 在線心跳（協作城真人人物）。只送「目前所在工坊代號」；名稱由資料庫依帳號產生，不含 email。
   關閉：localStorage.presenceOff='1'。不改動頁面任何行為；失敗一律靜默。 */
(function () {
  try { if (localStorage.getItem('presenceOff') === '1' || window.__avPresence) return; window.__avPresence = 1; } catch (_) { return; }
  var URL_ = 'https://clcddygkaaqqtsbswgdf.supabase.co', KEY = 'sb-clcddygkaaqqtsbswgdf-auth-token';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE';
  var MAP = [[/digital-human|數位人|avatar/i, 'dh'], [/yinxu|因序/i, 'yinxu'], [/ebook|reader|電子書/i, 'ebook'], [/short-video|video/i, 'video'], [/dark-star|darkstar|technical/i, 'tds'], [/paper|research/i, 'paper'], [/proposal|plan/i, 'plan'], [/meeting|seminar|warroom/i, 'meet'], [/teach|classroom|tutor/i, 'teach'], [/mp4|transcri/i, 'mp4'], [/import|txt/i, 'txt']];
  function ws() { var s = location.pathname + ' ' + location.search + ' ' + (document.title || ''); try { if (window.top !== window) s += ' ' + window.top.location.pathname; } catch (_) {} for (var i = 0; i < MAP.length; i++) if (MAP[i][0].test(s)) return MAP[i][1]; return ''; }
  function sess() { try { var j = JSON.parse(localStorage.getItem(KEY) || 'null'); return j && (j.currentSession || j); } catch (_) { return null; } }
  function beat() {
    if (document.hidden) return; var s = sess(); if (!s || !s.access_token || (s.expires_at && s.expires_at * 1000 < Date.now())) return;
    fetch(URL_ + '/rest/v1/aivault_presence?on_conflict=user_id', { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ workshop: ws() }) }).catch(function () {});
  }
  setTimeout(beat, 1500); setInterval(beat, 45000); document.addEventListener('visibilitychange', function () { if (!document.hidden) beat(); });
})();

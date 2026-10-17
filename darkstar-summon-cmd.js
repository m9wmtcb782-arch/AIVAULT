/* sm1：在 technical-dark-star.html 說「暗星去協作池」「曙光去協作池」「（暗星／曙光）回來」（只有擁有者有效，伺服器檢查）。
   寫入和協作城一樣的召集紀錄：先真的呼叫它自己的路徑，成功才算抵達；失敗如實顯示。關閉：localStorage.aiSummonOff='1' */
(function () {
  try { if (localStorage.getItem('aiSummonOff') === '1' || window.__aiSummonCmd) return; window.__aiSummonCmd = 1; } catch (_) { return; }
  var FN = 'https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/dark-star-ebook-ingest?feature=degree', KEY = 'sb-clcddygkaaqqtsbswgdf-auth-token';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE';
  function tok() { try { var j = JSON.parse(localStorage.getItem(KEY) || 'null'); j = j && (j.currentSession || j); if (j && j.access_token && (!j.expires_at || j.expires_at * 1000 > Date.now())) return j.access_token; } catch (_) {} return ''; }
  function parse(t) { t = String(t || '').replace(/\s+/g, ''); var m = t.match(/^(暗星|曙光)(去|到)協作池[。!！]?$/); if (m) return [{ 暗星: 'darkstar', 曙光: 'dawn-light' }[m[1]], 'call', m[1]];
    m = t.match(/^(暗星|曙光)?(請回|回來)[。!！]?$/); if (m) return [m[1] ? { 暗星: 'darkstar', 曙光: 'dawn-light' }[m[1]] : 'both', 'dismiss', m[1] || '暗星和曙光']; return null; }
  function note(host, html) { var d = document.createElement('div'); d.className = 'ds-summon-note'; d.style.cssText = 'margin:8px auto;max-width:92%;padding:8px 12px;border-radius:10px;background:rgba(30,41,59,.85);color:#e2e8f0;font-size:13px;border:1px solid rgba(96,165,250,.4)'; d.innerHTML = html; host.appendChild(d); d.scrollIntoView({ block: 'end' }); return d; }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  async function run(cmd, host) { var t = tok(); if (!t) { note(host, '⚠️ 要先登入擁有者帳號才能召集。'); return; }
    var ids = cmd[0] === 'both' ? ['darkstar', 'dawn-light'] : [cmd[0]];
    for (var i = 0; i < ids.length; i++) { var nm = ids[i] === 'darkstar' ? '暗星' : '曙光'; var n = note(host, (cmd[1] === 'call' ? '📣 正在把 ' + nm + ' 叫去協作池（真的呼叫它的模型）…' : '👋 請 ' + nm + ' 從協作池回來…'));
      try { var r = await fetch(FN, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'summon', id: ids[i], op: cmd[1], via: 'technical-dark-star' }) }); var j = await r.json().catch(function () { return {}; });
        if (!r.ok || !j.ok) { n.innerHTML = '⚠️ ' + nm + ' 沒有去成：' + esc(j.error || ('HTTP ' + r.status)); continue; }
        n.innerHTML = cmd[1] === 'call' ? '🏰 ' + nm + ' 到協作池了：「' + esc(j.reply) + '」<br><span style="opacity:.7">任務：' + esc(j.task) + '，待到 ' + new Date(j.until).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) + '｜' + esc(j.model) + '</span>' : '🏠 ' + nm + ' 回來了（協作池裡會飛出城門）。';
      } catch (e) { n.innerHTML = '⚠️ ' + nm + ' 呼叫失敗：' + esc(e && e.message || e); } } }
  function scan(n) { if (!n || n.nodeType !== 1) return; var els = []; if (n.matches && n.matches('.message.user')) els.push(n); if (n.querySelectorAll) Array.prototype.push.apply(els, n.querySelectorAll('.message.user'));
    els.forEach(function (el) { if (el.__smSeen) return; el.__smSeen = 1; var b = el.querySelector('.message-body') || el; var c = parse(b.textContent); if (c) run(c, el.parentNode || document.body); }); }
  function start() { var host = document.getElementById('messagesInner') || document.getElementById('messages') || document.body;
    document.querySelectorAll('.message.user').forEach(function (el) { el.__smSeen = 1; });
    new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(scan); }); }).observe(host, { childList: true, subtree: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

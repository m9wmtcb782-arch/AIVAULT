/* ai1：真正的暗星／曙光在協作池的活動回報。只在暗星或曙光「真的」出現新回覆、說話（播放語音）或生成圖片時，回報「誰＋做什麼」（聊天／語音／做圖），不送任何對話內容。
   需要登入（未登入不回報）。關閉：localStorage.aiOrbPresenceOff='1'。不改動頁面任何既有行為；失敗一律靜默。 */
(function () {
  try { if (localStorage.getItem('aiOrbPresenceOff') === '1' || window.__aiOrbPresence) return; window.__aiOrbPresence = 1; } catch (_) { return; }
  var FN = 'https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/dark-star-ebook-ingest?feature=degree', KEY = 'sb-clcddygkaaqqtsbswgdf-auth-token';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE';
  function tok() { try { var j = JSON.parse(localStorage.getItem(KEY) || 'null'); j = j && (j.currentSession || j); if (j && j.access_token && (!j.expires_at || j.expires_at * 1000 > Date.now())) return j.access_token; } catch (_) {} return ''; }
  var last = {};
  function beat(id, act) { var t = tok(); if (!t) return; var k = id + act; if (last[k] && Date.now() - last[k] < 20000) return; last[k] = Date.now();
    fetch(FN, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ai_beat', id: id, activity: act }) }).catch(function () {}); }
  function who(el) { var tx = (el.textContent || '').slice(0, 8); return /^\s*曙光/.test(tx) || (el.closest && el.closest('[class*="dawn"],[id*="dawn"]')) ? 'dawn-light' : 'darkstar'; }
  function scan(n) { if (!n || n.nodeType !== 1) return; var els = [];
    if (n.matches && n.matches('.message.assistant, .message.ai, .assistant-message')) els.push(n);
    if (n.querySelectorAll) Array.prototype.push.apply(els, n.querySelectorAll('.message.assistant, .message.ai, .assistant-message'));
    els.forEach(function (el) { if (el.__aiSeen) return; el.__aiSeen = 1; beat(who(el), el.querySelector('img') ? '做圖' : '聊天'); }); }
  function start() { var host = document.getElementById('messagesInner') || document.getElementById('messages') || document.body;
    document.querySelectorAll('.message.assistant, .message.ai, .assistant-message').forEach(function (el) { el.__aiSeen = 1; }); /* 既有歷史訊息不算 */
    new MutationObserver(function (ms) { ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, scan); }); }).observe(host, { childList: true, subtree: true });
    /* 說話：頁面播放語音（暗星或曙光的即時語音／TTS）。依目前畫面上的說話者標籤判斷是誰，判斷不了就算暗星 */
    document.addEventListener('play', function (e) { var t = e.target; if (!t || t.tagName !== 'AUDIO') return;
      var dawn = /曙光/.test((document.querySelector('[class*="speaking"],[data-speaker]') || {}).textContent || '') ; beat(dawn ? 'dawn-light' : 'darkstar', '語音'); }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* AIVAULT 神經訊號匯流排（前端 SDK）。預設關閉：未開啟時立刻 return，不改任何行為、不發任何網路請求。
 * 開啟（僅本機測試）：localStorage.setItem('neural_bus_on','1') 或 window.NEURAL_BUS_ON = true。
 * 開啟後：記錄 page_view / error / user action（click、submit）到記憶體佇列 window.NeuralBus.queue；
 * 只有另外設定 window.NEURAL_BUS_ENDPOINT 時才會 POST（且只送事件，不送任何輸入內容或金鑰）。 */
(function () {
  var on = false; try { on = window.NEURAL_BUS_ON === true || localStorage.getItem('neural_bus_on') === '1'; } catch (e) {}
  var me = document.currentScript; var program = (me && me.getAttribute('data-neural-program')) || location.pathname;
  if (!on) { window.NeuralBus = { on: false, emit: function () {}, program: program }; return; }
  var q = []; var sid = Math.random().toString(36).slice(2);
  function emit(kind, organ, payload, outcome) {
    var ev = { v: 1, ts: new Date().toISOString(), base: (window.NEURAL_BASE || 'base1'), program: program, organ: organ, kind: kind, session: sid, outcome: outcome || null, payload: payload || {} };
    q.push(ev); if (q.length > 500) q.shift();
    if (window.NEURAL_BUS_ENDPOINT) { try { navigator.sendBeacon(window.NEURAL_BUS_ENDPOINT, JSON.stringify(ev)); } catch (e) {} }
    return ev;
  }
  window.NeuralBus = { on: true, queue: q, emit: emit, program: program };
  emit('page_view', 'sensory', { ref: document.referrer ? 'yes' : 'no' });
  window.addEventListener('error', function (e) { emit('error', 'reflex', { msg: String(e.message || '').slice(0, 160) }, 'fail'); });
  window.addEventListener('unhandledrejection', function (e) { emit('error', 'reflex', { msg: String((e.reason && e.reason.message) || e.reason || '').slice(0, 160) }, 'fail'); });
  document.addEventListener('click', function (e) { var t = e.target && e.target.closest && e.target.closest('button,a,[data-neural]'); if (t) emit('user_action', 'sensory', { el: t.tagName, id: t.id || null }); }, true);
  document.addEventListener('submit', function (e) { emit('user_submit', 'sensory', { form: (e.target && e.target.id) || null }); }, true); // 不收集欄位內容
})();

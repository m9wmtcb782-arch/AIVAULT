// Optional non-destructive command entry for VERBATIM_READING.
// Load this script only when the feature is desired.
// Disable: localStorage.setItem('aivaultVerbatimOff', '1')
// Does not modify technical-dark-star.html, live voice, dual-agent,
// knowledge retrieval, academic report, or ebook layout.

(function () {
  if (localStorage.getItem('aivaultVerbatimOff') === '1') {
    console.info('[VERBATIM] disabled by localStorage');
    return;
  }

  const bridge = window.AIVAULT_VERBATIM_BRIDGE;
  if (!bridge) {
    console.warn('[VERBATIM] bridge not loaded');
    return;
  }

  let current = null;
  let progress = { ratio: 0 };

  function statusEl() {
    let el = document.getElementById('aivault-verbatim-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'aivault-verbatim-status';
      el.style.cssText = 'position:fixed;bottom:12px;left:12px;background:#111;color:#eee;padding:8px 12px;border-radius:8px;font-size:14px;z-index:9999;';
      document.body.appendChild(el);
    }
    return el;
  }

  function updateStatus(title) {
    const el = statusEl();
    el.textContent = bridge.statusHtml(title, progress);
    el.style.display = current ? 'block' : 'none';
  }

  function handleText(text) {
    if (!text) return false;
    const cmd = bridge.parseCommand(text);
    if (!cmd) return false;
    current = cmd;
    progress = { ratio: 0 };
    updateStatus(cmd.title + ' 第' + cmd.chapter + '章');
    console.info('[VERBATIM] command accepted', cmd);
    // Real chapter load + TTS sequence is delegated to orchestrator / future player.
    // This entry only routes the command and shows progress placeholder.
    return true;
  }

  // Expose control for pause / resume / stop
  window.AIVAULT_VERBATIM_CONTROL = {
    pause: function () {
      if (current) {
        bridge.pause();
        updateStatus(current.title);
      }
    },
    resume: function () {
      if (current) {
        bridge.resume();
        updateStatus(current.title);
      }
    },
    stop: function () {
      current = null;
      progress = { ratio: 0 };
      updateStatus('');
    },
    handleText
  };

  // Minimal hook: listen for custom event that a future non-destructive patch can dispatch
  window.addEventListener('aivault-verbatim-command', function (e) {
    if (e.detail && e.detail.text) handleText(e.detail.text);
  });

  console.info('[VERBATIM] command entry ready (optional, disableable)');
})();

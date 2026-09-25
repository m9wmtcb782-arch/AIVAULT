(() => {
  'use strict';
  if (window.__AIVAULT_DS_STRIP_DIAGNOSTIC__) return;
  window.__AIVAULT_DS_STRIP_DIAGNOSTIC__ = true;

  const MARKERS = [
    'Dark Star Runtime Diagnostic Report',
    'aivault-frontend-worker',
    '[UNAVAILABLE - Runtime Sandbox restricted direct outbound fetch',
    'Function Status: ACTIVE',
    'Function Version:'
  ];

  function isDiagnostic(text) {
    const s = String(text || '');
    if (!s) return false;
    if (/<!DOCTYPE html>/i.test(s) && /Dark Star Runtime Diagnostic Report/i.test(s)) return true;
    if (/title>\s*Dark Star Runtime Diagnostic Report/i.test(s)) return true;
    let hits = 0;
    for (const m of MARKERS) if (s.indexOf(m) !== -1) hits += 1;
    return hits >= 2;
  }

  function composer() {
    return document.getElementById('composerInput') || document.querySelector('.composer-input') || document.getElementById('liveInput');
  }

  function clearIfDiagnostic(el) {
    if (!el) return false;
    const val = el.value != null ? el.value : el.textContent;
    if (!isDiagnostic(val)) return false;
    if ('value' in el) el.value = '';
    else el.textContent = '';
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    return true;
  }

  function sweep() {
    const el = composer();
    if (clearIfDiagnostic(el)) {
      try { console.info('[DarkStar] stripped runtime diagnostic from composer'); } catch (e) {}
    }
    document.querySelectorAll('textarea, input[type="text"]').forEach(clearIfDiagnostic);
  }

  const NativeFetch = window.fetch;
  if (typeof NativeFetch === 'function' && !NativeFetch.__AIVAULT_DS_STRIP_DIAG__) {
    window.fetch = function (input, init) {
      return NativeFetch.apply(this, arguments).then(async (res) => {
        try {
          const url = String(input && input.url ? input.url : input || '');
          if (/aivault-frontend-worker/i.test(url)) {
            const clone = res.clone();
            const text = await clone.text();
            if (isDiagnostic(text) || /teaching-assistant\.html/i.test(text) || /UNAVAILABLE - Runtime Sandbox/i.test(text)) {
              sweep();
              queueMicrotask(sweep);
              setTimeout(sweep, 0);
              setTimeout(sweep, 50);
            }
          }
        } catch (e) {}
        return res;
      });
    };
    window.fetch.__AIVAULT_DS_STRIP_DIAG__ = true;
  }

  sweep();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sweep);
  window.addEventListener('load', sweep);
  setTimeout(sweep, 0);
  setTimeout(sweep, 200);
  setTimeout(sweep, 800);
  let n = 0;
  const t = setInterval(() => {
    sweep();
    if (++n > 40) clearInterval(t);
  }, 250);
})();

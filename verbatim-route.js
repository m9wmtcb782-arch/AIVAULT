// Disableable VERBATIM_READING route for Dark Star.
// Disable: localStorage.setItem('aivaultVerbatimOff','1')
// Does not alter existing live voice, video, search, or academic paths.
(function () {
  if (localStorage.getItem('aivaultVerbatimOff') === '1') return;
  const state = { active: false, segments: [], current: 0, audio: null };
  function log(s) { console.info('[VERBATIM]', s); }
  function muteLive() { if (window.bargeIn) try { window.bargeIn(); } catch (e) {} }
  function playSegment(idx) {
    if (idx >= state.segments.length) { state.active = false; log('PLAYBACK_COMPLETED'); return; }
    state.current = idx;
    const seg = state.segments[idx];
    if (!seg || !seg.src) { log('missing audio chunk ' + idx); return; }
    if (state.audio) { state.audio.pause(); state.audio.src = ''; }
    state.audio = new Audio(seg.src);
    state.audio.addEventListener('ended', function () { log('ended ' + idx); playSegment(idx + 1); });
    state.audio.addEventListener('error', function () { log('error on ' + idx + ', not skipping'); });
    state.audio.play().catch(function (e) { log('play rejected: ' + e.message); });
  }
  window.AIVAULT_VERBATIM_ROUTE = {
    handleCommand: function (text) {
      const m = String(text || '').match(/完整朗讀《([^\u300b]+)》\s*第([\u4e00二三四五六七八九十\d]+)章/);
      if (!m) return false;
      log('command: ' + m[1] + ' ch ' + m[2]);
      return { title: m[1], chapter: m[2] };
    },
    startVerbatim: function (title, chapter, segments) {
      state.active = true; state.segments = segments || []; state.current = 0;
      muteLive(); playSegment(0);
    },
    pause: function () { if (state.audio) state.audio.pause(); },
    resume: function () { if (state.audio) state.audio.play().catch(function(){}); },
    stop: function () { if (state.audio) { state.audio.pause(); state.audio.src = ''; } state.active = false; },
    reread: function () { if (state.active) playSegment(state.current); },
    isActive: function () { return state.active; }
  };
  log('route ready');
})();

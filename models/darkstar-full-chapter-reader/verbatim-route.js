// Disableable VERBATIM_READING route.
// Does not modify technical-dark-star-live-session.js core.
// Disable: localStorage.setItem('aivaultVerbatimOff','1')
// Reuses existing chapter reader / segment contracts; TTS is external non-paid Voice.

(function () {
  if (localStorage.getItem('aivaultVerbatimOff') === '1') return;

  const state = {
    active: false,
    book: null,
    chapter: null,
    segments: [],
    current: 0,
    audio: null,
    liveMuted: false
  };

  function log(s) { console.info('[VERBATIM]', s); }

  function muteLive() {
    // Soft mute: stop current Live playback buffers without tearing down WS.
    if (window.bargeIn) try { window.bargeIn(); } catch (e) {}
    state.liveMuted = true;
    log('live playback paused for verbatim');
  }

  function unmuteLive() {
    state.liveMuted = false;
    log('live playback eligible again');
  }

  function playSegment(idx) {
    if (idx < 0 || idx >= state.segments.length) {
      if (idx >= state.segments.length) {
        state.active = false;
        unmuteLive();
        log('PLAYBACK_COMPLETED');
      }
      return;
    }
    state.current = idx;
    const seg = state.segments[idx];
    if (state.audio) { state.audio.pause(); state.audio.src = ''; }
    // seg.src must be a pre-synthesized non-paid MP3 URL or blob
    if (!seg.src) { log('missing audio for chunk ' + idx); return; }
    state.audio = new Audio(seg.src);
    state.audio.addEventListener('ended', function () {
      log('ended chunk ' + idx);
      playSegment(idx + 1);
    });
    state.audio.addEventListener('error', function () {
      log('playback error on chunk ' + idx + ', not skipping text');
    });
    state.audio.play().catch(function (e) { log('play rejected: ' + e.message); });
  }

  function startVerbatim(bookTitle, chapterLabel, segments) {
    state.active = true;
    state.book = bookTitle;
    state.chapter = chapterLabel;
    state.segments = segments || [];
    state.current = 0;
    muteLive();
    playSegment(0);
  }

  function handleCommand(text) {
    const m = String(text || '').match(/完整朗讀《([^\u300b]+)》\s*第([\u4e00二三四五六七八九十\d]+)章/);
    if (!m) return false;
    // Actual chapter fetch + TTS synthesis must be supplied by caller with verified segments.
    log('command accepted: ' + m[1] + ' ch ' + m[2]);
    return { title: m[1], chapter: m[2] };
  }

  window.AIVAULT_VERBATIM_ROUTE = {
    handleCommand,
    startVerbatim,
    pause: function () { if (state.audio) state.audio.pause(); },
    resume: function () { if (state.audio) state.audio.play().catch(function(){}); },
    stop: function () {
      if (state.audio) { state.audio.pause(); state.audio.src = ''; }
      state.active = false;
      unmuteLive();
    },
    reread: function () { if (state.active) playSegment(state.current); },
    isActive: function () { return state.active; },
    progress: function () { return { current: state.current, total: state.segments.length }; }
  };

  log('route ready (disableable)');
})();

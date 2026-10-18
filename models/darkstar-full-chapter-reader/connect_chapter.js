// Minimal connector: full chapter -> verified segments -> verbatim route.
// Call after chapter_for_verbatim.py (or equivalent) returns ok + integrity.ok.
// Does not modify Dark Star live session or ebook UI.

(function () {
  function connect(result) {
    if (!result || !result.ok || !result.integrity || !result.integrity.ok) {
      console.warn('[VERBATIM] refused: integrity not ok');
      return false;
    }
    const route = window.AIVAULT_VERBATIM_ROUTE;
    if (!route) {
      console.warn('[VERBATIM] route not loaded');
      return false;
    }
    // segments must already contain exact original text;
    // audio src must be supplied by non-paid TTS step before start
    route.startVerbatim(
      result.chapter_title || result.ebook_id,
      'ch-' + result.chapter_index,
      result.segments
    );
    return true;
  }

  window.AIVAULT_CONNECT_CHAPTER = connect;
})();

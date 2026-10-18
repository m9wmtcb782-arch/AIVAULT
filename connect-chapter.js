// Requires result.ok && result.integrity.ok before starting.
(function () {
  window.AIVAULT_CONNECT_CHAPTER = function (result) {
    if (!result || !result.ok || !result.integrity || !result.integrity.ok) {
      console.warn('[VERBATIM] refused: integrity not ok');
      return false;
    }
    const route = window.AIVAULT_VERBATIM_ROUTE;
    if (!route) return false;
    route.startVerbatim(result.chapter_title || result.ebook_id, 'ch-' + result.chapter_index, result.segments);
    return true;
  };
})();

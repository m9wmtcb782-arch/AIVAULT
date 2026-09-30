/* ADD-only: normalize ingest book payload so FlipBook can read total_pages. */
(function () {
  "use strict";
  var E = window.AIVAULTEbook;
  if (!E || typeof E.fetchRemoteBook !== "function") return;
  var orig = E.fetchRemoteBook;
  E.fetchRemoteBook = function (ebookId, pageNumber) {
    return orig(ebookId, pageNumber).then(function (result) {
      var d = result && result.data;
      if (!d || typeof d !== "object") return result;
      var inner = d.data && typeof d.data === "object" ? d.data : d;
      var total = Number(inner.total_pages || inner.page_count || 0);
      if (!inner.ebook && total > 0) {
        inner.ebook = {
          ebook_id: inner.ebook_id || ebookId,
          total_pages: total,
          page_count: total,
          title: inner.title || "",
          author: inner.author || ""
        };
      } else if (inner.ebook && total > 0 && !inner.ebook.total_pages) {
        inner.ebook.total_pages = total;
        inner.ebook.page_count = inner.ebook.page_count || total;
      }
      if (!inner.page && Array.isArray(inner.pages) && inner.pages.length) {
        inner.page = inner.pages[0];
      }
      if (d.data && d.data !== inner) d.data = inner;
      result.data = d;
      return result;
    });
  };
})();

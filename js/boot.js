function qs(id) { return document.getElementById(id); }
function go(href) { location.href = href; }
document.addEventListener("DOMContentLoaded", () => {
  if (window.FKAudio) FKAudio.boot();
});
async function guarded(fn) {
  try { await fn(); }
  catch (e) { console.error(e); alert(e.message || String(e)); }
}

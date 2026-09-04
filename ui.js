(function (w) {
  function icon(name) {
    const p = {
      city: "M4 20 V10 L12 4 L20 10 V20 H14 V14 H10 V20Z",
      map: "M3 6 L9 4 L15 7 L21 5 V18 L15 20 L9 17 L3 19Z",
      army: "M12 3 L19 7 V13 C19 17 12 21 12 21 C12 21 5 17 5 13 V7Z",
      chat: "M4 5 H20 V15 H8 L4 19Z",
      more: "M5 12 H5.01 M12 12 H12.01 M19 12 H19.01"
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${name === "more" ? `<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>` : `<path d="${p[name]}"/>`}</svg>`;
  }
  function nav(active) {
    const items = [
      ["city", "主城", "game-city.html"],
      ["map", "世界", "game-map.html"],
      ["army", "軍隊", "game-army.html"],
      ["chat", "聊天", "game-chat.html"],
      ["more", "更多", "game-menu.html"]
    ];
    return `<nav class="bottom-nav">${items.map(([k, l, h]) => `<a class="${active === k ? "active" : ""}" href="${h}">${icon(k)}<span>${l}</span></a>`).join("")}</nav>`;
  }
  function fmt(n) {
    n = Math.floor(Number(n) || 0);
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }
  function remain(ts) {
    const s = Math.max(0, Math.ceil((ts - Date.now()) / 1000));
    const m = Math.floor(s / 60);
    return m + ":" + String(s % 60).padStart(2, "0");
  }
  function top(snap, extra) {
    const p = snap.player;
    const r = snap.resources || {};
    return `
      <header class="topbar">
        <div class="avatar">${(p.avatar || p.name || "?").toString().slice(0, 1)}</div>
        <div class="who">
          <div class="name">${p.name}</div>
          <div class="meta">Lv.${p.level} · 戰力 ${fmt(p.power)} ${extra || ""}</div>
        </div>
        <a class="coupon-chip" href="game-coupons.html">券 ${fmt(snap.coupons || r.coupons || 0)}</a>
      </header>
      <div class="res-row">
        <div class="res">木<b>${fmt(r.wood)}</b></div>
        <div class="res">糧<b>${fmt(r.food)}</b></div>
        <div class="res">石<b>${fmt(r.stone)}</b></div>
        <div class="res">鐵<b>${fmt(r.iron)}</b></div>
      </div>`;
  }
  function toast(el, text, ok) {
    if (!el) return;
    el.className = "msg" + (ok ? " ok" : "");
    el.textContent = text || "";
  }
  w.FKUI = { nav, top, fmt, remain, toast, icon };
})(window);

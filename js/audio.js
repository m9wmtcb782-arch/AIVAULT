(function (w) {
  let audio = null;
  let on = localStorage.getItem("aivault_game_music") !== "off";

  function ensure() {
    if (audio) return audio;
    audio = new Audio("assets/frost-theme.mp3");
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0.55;
    return audio;
  }

  function start() {
    if (!on) return;
    const a = ensure();
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  }

  function stop() {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }

  function toggle() {
    on = !on;
    localStorage.setItem("aivault_game_music", on ? "on" : "off");
    if (on) start(); else stop();
    renderFab();
  }

  function renderFab() {
    let el = document.getElementById("musicFab");
    if (!el) {
      el = document.createElement("button");
      el.id = "musicFab";
      el.className = "music-fab";
      el.type = "button";
      el.onclick = toggle;
      document.body.appendChild(el);
    }
    el.textContent = on ? "🎵 Music ON" : "🎵 Music OFF";
  }

  function boot() {
    renderFab();
    ensure();
    const unlock = () => { if (on) start(); };
    document.addEventListener("pointerdown", unlock, { once: false });
    document.addEventListener("touchstart", unlock, { once: false, passive: true });
    if (on) start();
  }

  w.FKAudio = { start, stop, toggle, boot, isOn: () => on };
})(window);

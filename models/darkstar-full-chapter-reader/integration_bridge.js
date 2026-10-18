// Independent VERBATIM_READING bridge.
// Does not modify technical-dark-star.html, dark-star-ebook.html,
// knowledge retrieval, or academic analysis paths.
// Load optionally; existing buttons and settings remain untouched.

(function (global) {
  const BRIDGE_ID = "aivault-verbatim-bridge";

  function parseCommand(text) {
    // Example: 暗星，請完整朗讀《憲法學講義》第三章
    const m = text.match(/完整朗讀《([^\u300b]+)》\s*第([\u4e00二三四五六七八九十\d]+)章/);
    if (!m) return null;
    return { title: m[1], chapter: m[2] };
  }

  function statusHtml(chapterTitle, progress) {
    const pct = progress && progress.ratio != null ? Math.round(progress.ratio * 100) : 0;
    return `正在逐字朗讀：${chapterTitle || "章節"} （${pct}%）`;
  }

  const api = {
    id: BRIDGE_ID,
    mode: "VERBATIM_READING",
    parseCommand,
    statusHtml,
    // Placeholder hooks; actual player is created by the Python orchestrator side
    // or by a future frontend adapter that calls the existing toc/book endpoints.
    start: function (opts) {
      console.info("[VERBATIM] start", opts);
      return { ok: true, state: "TEXT_READY", note: "bridge only; real playback requires frontend player" };
    },
    pause: function () { return { ok: true, state: "PAUSED" }; },
    resume: function () { return { ok: true, state: "PLAYING" }; },
    // Explicitly does not touch knowledge retrieval or academic report functions
    _protected: ["knowledge_search", "academic_report", "live_voice", "dual_agent"]
  };

  global.AIVAULT_VERBATIM_BRIDGE = api;
})(typeof window !== "undefined" ? window : globalThis);

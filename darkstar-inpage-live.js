/* 暗星數字人「連結即時暗星」— 在 technical-dark-star.html 頁內直接連線（不跳頁）。
   重用 technical-dark-star-live-session.js 的連線邏輯：以隔離作用域載入（不污染本頁全域），
   把它用到的元素 ID 對應到本模組自己的元素。
   - 右上角小視窗顯示鏡頭，↻ 切換前後鏡頭
   - 暗星輸出語音 → AnalyserNode → 小球嘴型
   - 暗星逐字稿 → 喜怒哀樂等情緒 → 小球表情 */
(function (w, d) {
  "use strict";
  if (w.AIVAULTDarkStarLive) return;
  var SESSION_SRC = "technical-dark-star-live-session.js?v=19";
  var api = null, loading = null, connected = false, analyser = null, raf = 0, lastEmotion = "", lastEmoAt = 0;
  var box = null, hidden = null, video = null;

  function css() {
    var s = d.createElement("style");
    s.textContent =
      "#dsLiveCam{position:fixed;right:214px;top:72px;width:160px;height:120px;z-index:81;border-radius:14px;overflow:hidden;background:#111;box-shadow:0 10px 28px rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.4)}" +
      "#dsLiveCam[hidden]{display:none}#dsLiveCam video{width:100%;height:100%;object-fit:cover;display:block}#dsLiveCam video.mirror{transform:scaleX(-1)}" +
      "#dsLiveRotate{position:absolute;right:6px;bottom:6px;width:30px;height:30px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:17px;line-height:30px;padding:0;cursor:pointer}" +
      "#dsLiveCamState{position:absolute;left:6px;top:6px;padding:2px 6px;border-radius:99px;background:rgba(0,0,0,.5);color:#fff;font-size:10px}" +
      "@media(max-width:700px){#dsLiveCam{right:9px;top:64px;width:112px;height:150px}}";
    d.head.appendChild(s);
  }
  function ensureUi() {
    if (box) return;
    css();
    box = d.createElement("div"); box.id = "dsLiveCam"; box.hidden = true;
    box.innerHTML = '<video autoplay playsinline muted class="mirror"></video><span id="dsLiveCamState">連線中…</span><button id="dsLiveRotate" type="button" aria-label="切換前後鏡頭" title="切換前後鏡頭">↻</button>';
    d.body.appendChild(box);
    video = box.querySelector("video"); video.muted = true; video.playsInline = true;
    // 不放進頁面 DOM：避免觸發本頁其他 MutationObserver
    hidden = d.createElement("div"); hidden.hidden = true;
    d.getElementById("dsLiveRotate").onclick = function () {
      if (!api || !connected) return;
      api.switchCamera().then(function () { video.classList.toggle("mirror", api.facing() === "user"); })
        .catch(function (e) { camState("無法切換鏡頭"); console.warn("[DarkStar live] switch", e); });
    };
  }
  function camState(t) { var e = d.getElementById("dsLiveCamState"); if (e) e.textContent = t; }

  // session 腳本內的 $('id') 對應到本模組元素
  var map = {};
  function el(id) {
    if (id === "preview") return video;
    if (!map[id]) {
      var tag = id === "voiceSelect" ? "select" : id === "liveInput" ? "textarea" : id === "log" ? "pre" : "div";
      map[id] = d.createElement(tag); map[id].setAttribute("data-live-id", id); hidden.appendChild(map[id]);
    }
    return map[id];
  }
  // 播放端 AudioContext：destination 改為經過 AnalyserNode，讓小球對嘴
  function makeAudioContext() {
    var Base = w.AudioContext || w.webkitAudioContext;
    function Ctx(opts) {
      var ctx = opts ? new Base(opts) : new Base();
      if (!opts) {
        var an = ctx.createAnalyser(); an.fftSize = 512; an.connect(ctx.destination); analyser = an;
        try { Object.defineProperty(ctx, "destination", { get: function () { return an; } }); } catch (e) {}
      }
      return ctx;
    }
    return Ctx;
  }
  function load() {
    if (api) return Promise.resolve(api);
    if (loading) return loading;
    ensureUi();
    loading = fetch(SESSION_SRC, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("無法載入連線模組（HTTP " + r.status + "）");
      return r.text();
    }).then(function (src) {
      var fakeDoc = { getElementById: el, body: hidden, createElement: d.createElement.bind(d) };
      var fakeWin = {};
      var factory = new Function("document", "window", "AudioContext", "localStorage", "location",
        src + "\n;return {start:start,stop:stop,switchCamera:switchCamera,sendTextToLive:sendTextToLive,facing:function(){return facing},isOpen:function(){return !!(ws&&ws.readyState===1)}};");
      api = factory(fakeDoc, fakeWin, makeAudioContext(), w.localStorage, w.location);
      // 監看逐字稿與狀態
      new MutationObserver(onTranscript).observe(el("chat"), { childList: true, subtree: true, characterData: true });
      new MutationObserver(function () { var t = el("status").textContent || ""; camState(t.replace(/^[^\s]+\s/, "").slice(0, 14) || "已連線"); }).observe(el("status"), { childList: true, characterData: true, subtree: true });
      return api;
    });
    loading.catch(function () { loading = null; });
    return loading;
  }

  // ---- 對嘴 ----
  function lipLoop() {
    cancelAnimationFrame(raf);
    var buf = null;
    (function tick() {
      raf = requestAnimationFrame(tick);
      var A = w.AIVAULTDarkStarAvatar;
      if (!analyser || !A) return;
      if (!buf || buf.length !== analyser.fftSize) buf = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buf);
      var s = 0; for (var i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      A.speak(Math.min(1, Math.sqrt(s / buf.length) * 5));
    })();
  }

  // ---- 情緒 ----
  var RULES = [
    ["angry", /生氣|憤怒|氣死|可惡|不爽|火大|太過分|angry|annoyed|furious|mad at|😠|😡|🤬|💢/gi],
    ["sad", /難過|傷心|遺憾|可惜|哭|悲傷|心疼|失望|抱歉|對不起|sad|sorry|unfortunately|upset|😢|😭|☹|🙁|😞|💔/gi],
    ["joy", /太棒|太好了|好耶|興奮|超讚|恭喜|萬歲|好期待|太厲害|excited|awesome|amazing|fantastic|yay|hooray|🎉|🤩|😆|🥳|！！|!!/gi],
    ["happy", /開心|高興|喜歡|很好|不錯|謝謝|哈哈|好的|沒問題|happy|glad|great|nice|thanks|thank you|lol|😊|😄|🙂|😀|❤️/gi],
    ["surprised", /驚訝|真的嗎|沒想到|居然|竟然|咦|哇|天啊|surpris|wow|really\?|no way|😮|😲|😯|🤯/gi],
    ["think", /思考|想想|分析|考慮|嗯+|讓我|也許|或許|可能|think|consider|let me|hmm|maybe|perhaps|🤔/gi]
  ];
  function classify(text) {
    var best = "neutral", score = 0;
    RULES.forEach(function (r) {
      var m = text.match(r[1]); var n = m ? m.length : 0;
      if (n > score) { score = n; best = r[0]; }
    });
    return best;
  }
  w.AIVAULTDarkStarEmotion = classify;
  function onTranscript() {
    var bubbles = el("chat").querySelectorAll(".bubble.ai");
    var last = bubbles[bubbles.length - 1]; if (!last) return;
    var text = (last.textContent || "").replace(/^暗星/, "").slice(-80);
    var e = classify(text), now = Date.now();
    if (e === lastEmotion && now - lastEmoAt < 2500) return;
    if (now - lastEmoAt < 500) return;
    lastEmotion = e; lastEmoAt = now;
    var A = w.AIVAULTDarkStarAvatar;
    if (A && A.expr) A.expr(e);
  }

  // ---- 連線／中斷 ----
  function btn() { return d.getElementById("dsconnect"); }
  async function connect() {
    var b = btn(); ensureUi();
    if (b) { b.disabled = true; b.textContent = "⏳ 連線中…"; }
    try {
      await load();
      box.hidden = false; camState("連線中…");
      await api.start();
      if (!api.isOpen()) throw new Error((el("status").textContent || "無法連線").replace(/^🔴\s*/, ""));
      connected = true; lipLoop();
      var A = w.AIVAULTDarkStarAvatar; if (A && A.setLink) A.setLink(true, "已連結");
      if (b) b.textContent = "⛔ 中斷連結";
    } catch (e) {
      console.warn("[DarkStar live]", e);
      try { if (api) await api.stop(); } catch (x) {}
      box.hidden = true; connected = false;
      var A2 = w.AIVAULTDarkStarAvatar; if (A2 && A2.setLink) A2.setLink(false, "未連結", "⚠️ " + String(e.message || e).slice(0, 18));
      if (b) b.textContent = "🔗 連結即時暗星";
    } finally { if (b) b.disabled = false; }
  }
  async function disconnect() {
    connected = false; cancelAnimationFrame(raf); analyser = null;
    try { if (api) await api.stop(); } catch (e) {}
    if (video) video.srcObject = null;
    if (box) box.hidden = true;
    var A = w.AIVAULTDarkStarAvatar; if (A) { A.speak(0); if (A.setLink) A.setLink(false, "未連結"); if (A.expr) A.expr("neutral"); }
    var b = btn(); if (b) b.textContent = "🔗 連結即時暗星";
  }
  function toggle() { return connected ? disconnect() : connect(); }
  w.addEventListener("pagehide", function () { if (connected) disconnect(); });
  w.AIVAULTDarkStarLive = { toggle: toggle, connect: connect, disconnect: disconnect, isConnected: function () { return connected; }, classify: classify };
})(window, document);

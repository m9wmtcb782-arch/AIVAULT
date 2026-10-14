/* 暗星數字人「連結即時暗星」— 在 technical-dark-star.html 頁內直接連線（不跳頁）。
   重用 technical-dark-star-live-session.js 的連線邏輯：以隔離作用域載入（不污染本頁全域），
   把它用到的元素 ID 對應到本模組自己的元素。
   - 右上角小視窗顯示鏡頭，↻ 切換前後鏡頭
   - 暗星輸出語音 → AnalyserNode → 小球嘴型
   - 暗星逐字稿 → 喜怒哀樂等情緒 → 小球表情 */
(function (w, d) {
  "use strict";
  if (w.AIVAULTDarkStarLive) return;
  var SESSION_SRC = "technical-dark-star-live-session.js?v=22";
  var loadFailed = false, LIVE_PAGE = "technical-dark-star-live-video-test.html";
  var api = null, loading = null, connected = false, analyser = null, raf = 0, lastEmotion = "", lastEmoAt = 0;
  var box = null, hidden = null, video = null;

  function css() {
    var s = d.createElement("style");
    s.textContent =
      "#dsLiveCam{position:fixed;right:214px;top:72px;width:160px;height:120px;z-index:81;border-radius:14px;overflow:hidden;background:#111;box-shadow:0 10px 28px rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.4)}" +
      "#dsLiveCam[hidden]{display:none}#dsLiveCam video{width:100%;height:100%;object-fit:cover;display:block}#dsLiveCam video.mirror{transform:scaleX(-1)}" +
      "#dsLiveRotate{position:absolute;right:6px;bottom:6px;width:30px;height:30px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:17px;line-height:30px;padding:0;cursor:pointer}" +
      "#dsLiveCamState{display:none!important;position:absolute;left:4px;right:4px;top:4px;padding:2px 6px;border-radius:8px;background:rgba(0,0,0,.6);color:#fff;font-size:10px;line-height:1.35;word-break:break-all;max-height:60%;overflow:hidden}" +
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
    box.addEventListener("click", function (e) { if (e.target.id !== "dsLiveRotate" && resumeIfNeeded()) camState("🔊 聲音已開啟"); });
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
  // 播放端 AudioContext：
  // 1) 在使用者點擊（手勢）當下就建立並 resume（iOS Safari 只有手勢內才能啟動聲音）
  // 2) 原本的輸出路徑完全不動（source → destination），另外「分接」一份給 AnalyserNode 做對嘴，
  //    分析器不接任何輸出，不會搶走聲音
  var primed = null, primedIn = null, inCtx = null;
  function Base() { return w.AudioContext || w.webkitAudioContext; }
  function tapContext(ctx) {
    if (ctx.__dsTapped) return ctx;
    ctx.__dsTapped = true;
    var an = ctx.createAnalyser(); an.fftSize = 512; analyser = an;
    var orig = ctx.createBufferSource.bind(ctx);
    ctx.createBufferSource = function () {
      var src = orig(), conn = src.connect;
      src.connect = function (node) {
        var r = conn.apply(src, arguments);
        // 輸出到喇叭或隱藏 <audio>（MediaStreamDestination）時，另分接一份給分析器；不改變原輸出
        var MSD = w.MediaStreamAudioDestinationNode;
        if (node === ctx.destination || (MSD && node instanceof MSD)) { try { conn.call(src, an); } catch (e) {} }
        return r;
      };
      return src;
    };
    return ctx;
  }
  function primeAudio() {
    try {
      var B = Base(); if (!B) return;
      if (!primed || primed.state === "closed") primed = tapContext(new B());
      // 麥克風輸入用的 16kHz context 也必須在手勢內建立並啟動，否則 iOS 會一直暫停 → 麥克風聲音送不出去
      if (!primedIn || primedIn.state === "closed") { try { primedIn = new B({ sampleRate: 16000 }); } catch (e) { primedIn = null; console.warn("[DarkStar live] 16k ctx", e); } }
      if (primedIn && primedIn.state !== "running") primedIn.resume().catch(function () {});
      if (primed.state !== "running") primed.resume().catch(function () {});
      // iOS 解鎖：在手勢內播放一段極短的無聲音訊
      var buf = primed.createBuffer(1, 1, 22050), s = primed.createBufferSource();
      s.buffer = buf; s.connect(primed.destination); s.start(0);
    } catch (e) { console.warn("[DarkStar live] prime audio", e); }
  }
  function makeAudioContext() {
    return function Ctx(opts) {
      var B = Base();
      if (opts) { // 麥克風輸入用（16kHz）：優先使用手勢內已啟動的 context
        var ic = primedIn && primedIn.state !== "closed" ? primedIn : new B(opts);
        primedIn = null; inCtx = ic; return ic;
      }
      var ctx = primed && primed.state !== "closed" ? primed : tapContext(new B());
      primed = null;
      return ctx;
    };
  }
  function resumeIfNeeded() {
    // session 內部的播放 context 透過 analyser.context 取得
    if (inCtx && inCtx.state !== "running") inCtx.resume().catch(function () {});
    var ctx = analyser && analyser.context;
    if (ctx && ctx.state !== "running") { ctx.resume().catch(function () {}); return false; }
    return true;
  }
  // ---- 狀態列 ----
  var st = { open: false, mic: 0, audioIn: 0, sent: 0, msgs: 0, err: "" };
  function line(t) { camState(t); }
  function dbg() { var t = map.dsAudioDbg && map.dsAudioDbg.textContent; return "\n送" + st.mic + " 訊" + st.msgs + (t ? " " + t : ""); }
  function refreshLine() {
    if (st.err) return line("錯誤：" + st.err + dbg());
    if (!st.open) return line("連線中…");
    var talking = analyser && lastLevel > 0.03;
    if (talking) return line("🗣️ 暗星說話中" + dbg());
    var micOk = st.mic > 0 ? "麥克風 ✓" : (inCtx && inCtx.state !== "running" ? "麥克風暫停（點小視窗）" : "麥克風等待中");
    line("🟢 已連線・" + micOk + (st.audioIn ? "・已收到語音" : "") + dbg());
  }
  var lastLevel = 0, lineTimer = 0;
  // ---- 逐字稿顯示在本頁一般聊天區（只顯示，不送到文字聊天後端、不存歷史）----
  // 助理列刻意不加 .assistant／.ai class（本頁沒有針對它們的樣式），避免「我的聲音」等腳本把它再念一次或當成文字回覆處理
  var turn = { user: null, ai: null, inTxt: "", outTxt: "" };
  function chatRow(role) {
    var inner = d.getElementById("messagesInner"); if (!inner) return null;
    var welcome = d.getElementById("welcome"); if (welcome) welcome.remove();
    var row = d.createElement("div"); row.className = role === "user" ? "message user" : "message";
    row.setAttribute("data-ds-live", role);
    var av = d.createElement("div"); av.className = "message-avatar"; av.textContent = role === "user" ? "你" : "✦";
    var body = d.createElement("div"); body.className = "message-body";
    var text = d.createElement("div"); text.className = "message-text"; body.appendChild(text);
    row.appendChild(av); row.appendChild(body); inner.appendChild(row);
    return row;
  }
  function scrollChat() { try { if (typeof w.scrollBottom === "function") w.scrollBottom(); else { var m = d.getElementById("messages"); if (m) m.scrollTop = m.scrollHeight; } } catch (e) {} }
  function showTxt(role, txt) {
    var key = role === "user" ? "user" : "ai";
    if (!turn[key]) { if (key === "user" && turn.ai) finishTurn(); turn[key] = chatRow(role); }
    if (!turn[key]) return;
    turn[key].querySelector(".message-text").textContent = txt; scrollChat();
  }
  function finishTurn() {
    var row = turn.ai;
    if (row && turn.outTxt.trim() && typeof w.createCopyButton === "function") {
      try { var a = d.createElement("div"); a.className = "message-actions"; a.appendChild(w.createCopyButton(turn.outTxt.trim())); row.querySelector(".message-body").appendChild(a); } catch (e) {}
    }
    turn = { user: null, ai: null, inTxt: "", outTxt: "" };
  }
  function onLiveMsg(m) {
    if (!m || typeof m !== "object") return;
    var sc = m.serverContent || m;
    var it = (sc.inputTranscription && sc.inputTranscription.text) || (m.type === "inputTranscription" && m.text) || "";
    var ot = (sc.outputTranscription && sc.outputTranscription.text) || (m.type === "outputTranscription" && m.text) || "";
    if (it) { turn.inTxt += it; showTxt("user", turn.inTxt.trim()); }
    if (ot) { turn.outTxt += ot; showTxt("assistant", turn.outTxt.trim()); }
    if (sc.turnComplete || m.turnComplete || m.type === "turnComplete" || sc.interrupted || m.type === "interrupted") finishTurn();
  }
  // 本頁其他腳本（dawn-light-dark-star-bridge.js、aivault-dual-agent-live.js）會包裝 WebSocket，
  // 未「喚醒」時把送往 live-voice 的麥克風音訊丟掉 → 伺服器收不到聲音、不回語音。
  // 這裡改用隱藏 iframe 內未被包裝的原生 WebSocket，與視訊頁完全相同的送出方式。
  var cleanFrame = null;
  function pristineWS() {
    try {
      if (!cleanFrame || !cleanFrame.contentWindow) {
        cleanFrame = d.createElement("iframe"); cleanFrame.setAttribute("aria-hidden", "true"); cleanFrame.tabIndex = -1;
        cleanFrame.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
        d.documentElement.appendChild(cleanFrame);
      }
      var W = cleanFrame.contentWindow && cleanFrame.contentWindow.WebSocket;
      if (W) return W;
    } catch (e) { console.warn("[DarkStar live] clean WebSocket", e); }
    return w.WebSocket;
  }
  function makeWebSocket() {
    function DsWS(url, protocols) {
      var WS = pristineWS(); // 不加 model 參數：與視訊頁送出的網址一致
      var sock = protocols ? new WS(url, protocols) : new WS(url);
      // iframe 來源的 ArrayBuffer 跨 realm，instanceof 會失敗 → 轉成本頁的 ArrayBuffer 再交給 session
      var userOnMsg = null;
      sock.addEventListener("message", function (ev) {
        if (!userOnMsg) return;
        var data = ev.data;
        if (data && typeof data !== "string" && typeof data.byteLength === "number" && !(data instanceof ArrayBuffer)) data = new Uint8Array(data).slice().buffer;
        userOnMsg({ data: data });
      });
      try { Object.defineProperty(sock, "onmessage", { configurable: true, get: function () { return userOnMsg; }, set: function (fn) { userOnMsg = fn; } }); } catch (e) {}
      sock.addEventListener("open", function () { st.open = true; st.err = ""; refreshLine(); });
      sock.addEventListener("message", function (ev) {
        st.msgs++;
        if (typeof ev.data !== "string") { st.audioIn++; return; }
        try {
          var m = JSON.parse(ev.data);
          try { onLiveMsg(m); } catch (x) { console.warn("[DarkStar live] transcript", x); }
          var er = m && (m.error && (m.error.message || m.error) || (m.type === "error" && m.message));
          if (er) {
            er = String(er); st.err = /AUTH/i.test(er) ? er + "（請先登入 AIVAULT）" : er;
            console.error("[DarkStar live] server error", er); refreshLine();
          }
          if (/audio/.test(ev.data) && /inlineData|"audio"/.test(ev.data)) st.audioIn++;
        } catch (e) {}
      });
      sock.addEventListener("close", function (ev) {
        st.open = false;
        if (connected && !st.err) st.err = "連線中斷（" + ev.code + (ev.reason ? "：" + ev.reason : "") + "）";
        console.warn("[DarkStar live] ws close", ev.code, ev.reason); refreshLine();
      });
      sock.addEventListener("error", function () { console.error("[DarkStar live] ws error"); });
      var send = sock.send.bind(sock);
      sock.send = function (data) { st.sent++; if (typeof data === "string" && data.indexOf('"type":"audio"') > 0) st.mic++; return send(data); };
      return sock;
    }
    DsWS.CONNECTING = 0; DsWS.OPEN = 1; DsWS.CLOSING = 2; DsWS.CLOSED = 3;
    return DsWS;
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
      var Ctx = makeAudioContext();
      var fakeWin = { AudioContext: Ctx, webkitAudioContext: Ctx };
      var factory = new Function("document", "window", "AudioContext", "localStorage", "location", "WebSocket",
        src + "\n;return {start:start,stop:stop,switchCamera:switchCamera,sendTextToLive:sendTextToLive,facing:function(){return facing},unlock:unlockAudio,isOpen:function(){return !!(ws&&ws.readyState===1)}};");
      api = factory(fakeDoc, fakeWin, Ctx, w.localStorage, w.location, makeWebSocket());
      // 監看逐字稿與狀態
      new MutationObserver(onTranscript).observe(el("chat"), { childList: true, subtree: true, characterData: true });
      new MutationObserver(function () { var t = el("status").textContent || ""; if (/請先登入 AIVAULT|無法取得對話主題|連線失敗，請稍後再試/.test(t)) { authNotice(t.replace(/^🔴\s*/, "")); if (connected) disconnect(); return; } if (/^🔴/.test(t)) { st.err = t.replace(/^🔴\s*/, ""); if (/AUTH/i.test(st.err)) st.err += "（請先登入 AIVAULT）"; refreshLine(); } }).observe(el("status"), { childList: true, characterData: true, subtree: true });
      return api;
    });
    loading.catch(function (e) { loading = null; loadFailed = true; console.warn("[DarkStar live] load", e); });
    return loading;
  }

  // 未登入：在暗星數字人面板下方顯示小提示（迷你視窗狀態文字已隱藏）
  var noticeTimer = 0;
  function authNotice(msg) {
    var n = d.getElementById("dsLiveAuthNotice");
    if (!n) {
      n = d.createElement("div"); n.id = "dsLiveAuthNotice"; n.setAttribute("role", "alert");
      n.style.cssText = "position:fixed;z-index:82;right:14px;top:330px;max-width:190px;padding:8px 10px;border-radius:12px;background:#fff3f3;color:#b00020;border:1px solid #f3c2c2;font-size:13px;line-height:1.4;box-shadow:0 6px 18px rgba(0,0,0,.12)";
      d.body.appendChild(n);
    }
    var panel = d.getElementById("aivault-darkstar-avatar");
    if (panel) { var r = panel.getBoundingClientRect(); n.style.top = Math.round(r.bottom + 8) + "px"; n.style.right = Math.max(4, Math.round(w.innerWidth - r.right)) + "px"; n.style.maxWidth = Math.round(r.width) + "px"; }
    n.textContent = (/登入/.test(msg || "") ? "🔒 " : "⚠️ ") + (msg || "請先登入 AIVAULT 再連線"); n.hidden = false;
    clearTimeout(noticeTimer); noticeTimer = setTimeout(function () { n.hidden = true; }, 8000);
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
      lastLevel = Math.min(1, Math.sqrt(s / buf.length) * 5); A.speak(lastLevel);
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
    var b = btn();
    // 先釋放本頁抽屜即時語音／喚醒麥克風／語音辨識，避免與這裡搶麥克風
    try { if (w.__AIVAULT_RELEASE_ALL_AUDIO__) w.__AIVAULT_RELEASE_ALL_AUDIO__(); } catch (e) { console.warn("[DarkStar live] release", e); }
    if (loadFailed && !api) { // 後備：模組載入失敗 → 照舊開啟視訊頁
      var win = w.open(LIVE_PAGE, "_blank", "noopener"); if (!win) w.location.href = LIVE_PAGE; return;
    }
    ensureUi();
    primeAudio(); // 必須在任何 await 之前（仍在點擊手勢內）
    if (api && api.unlock) { try { api.unlock(); } catch (e) { console.warn("[DarkStar live] unlock", e); } } // 隱藏 <audio> 也要在手勢內啟動
    if (b) { b.disabled = true; b.textContent = "⏳ 連線中…"; }
    try {
      await load();
      st = { open: false, mic: 0, audioIn: 0, sent: 0, msgs: 0, err: "" }; w.__dsLiveSt = st;
      box.hidden = false; line("連線中…");
      clearInterval(lineTimer); lineTimer = setInterval(refreshLine, 500);
      var hasLogin = false; try { hasLogin = !!w.localStorage.getItem("sb-clcddygkaaqqtsbswgdf-auth-token"); } catch (e) {}
      if (!hasLogin) console.warn("[DarkStar live] 找不到登入資料（sb-…-auth-token）");
      await api.start();
      if (!api.isOpen()) throw new Error((el("status").textContent || "無法連線").replace(/^🔴\s*/, ""));
      connected = true; lipLoop();
      if (!resumeIfNeeded()) line("🔇 點小視窗開啟聲音");
      var A = w.AIVAULTDarkStarAvatar; if (A && A.setLink) A.setLink(true, "已連結");
      if (b) b.textContent = "⛔ 中斷連結";
    } catch (e) {
      console.warn("[DarkStar live]", e);
      try { if (api) await api.stop(); } catch (x) {}
      connected = false; st.err = st.err || String(e.message || e); refreshLine(); clearInterval(lineTimer);
      setTimeout(function () { if (!connected) box.hidden = true; }, 6000);
      var A2 = w.AIVAULTDarkStarAvatar; if (A2 && A2.setLink) A2.setLink(false, "未連結", "⚠️ " + String(e.message || e).slice(0, 18));
      if (b) b.textContent = "🔗 連結即時暗星";
    } finally { if (b) b.disabled = false; }
  }
  async function disconnect() {
    connected = false; cancelAnimationFrame(raf); analyser = null; clearInterval(lineTimer);
    finishTurn(); console.info("[DarkStar live] stats", JSON.stringify(st), map.dsAudioDbg ? map.dsAudioDbg.textContent : "");
    try { if (api) await api.stop(); } catch (e) {}
    if (video) video.srcObject = null;
    if (box) box.hidden = true;
    try { if (navigator.audioSession) navigator.audioSession.type = "auto"; } catch (e) {}
    var A = w.AIVAULTDarkStarAvatar; if (A) { A.speak(0); if (A.setLink) A.setLink(false, "未連結"); if (A.expr) A.expr("neutral"); }
    var b = btn(); if (b) b.textContent = "🔗 連結即時暗星";
  }
  function toggle() { return connected ? disconnect() : connect(); }
  w.addEventListener("pagehide", function () { if (connected) disconnect(); });
  // 預先載入連線模組（只下載程式，不開麥克風、不連線），讓點擊時能在手勢內直接解鎖聲音
  function preload() { load().catch(function () {}); }
  if (d.readyState === "complete") setTimeout(preload, 0); else w.addEventListener("load", function () { setTimeout(preload, 0); });
  w.AIVAULTDarkStarLive = { toggle: toggle, connect: connect, disconnect: disconnect, isConnected: function () { return connected; }, classify: classify,
    audioState: function () { var c = analyser && analyser.context; return c ? c.state : "none"; } };
})(window, document);

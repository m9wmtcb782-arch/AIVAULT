/* AIVAULT 同步協作池天氣視覺層 v1（純加法覆蓋層，pointer-events:none，不改原頁）
   資料：GET 後端 aivault-weather（CWA 中央氣象署，金鑰只在後端）。前端不放任何 API key。
   失敗 → 本地時間判斷日夜＋晴天＋微風，標示「天氣離線」，不顯示假氣象數字。
   預覽：?weather=clear|cloudy|rain|heavy_rain|typhoon&night=1&wind=12&dir=90 */
(function () {
  if (window.__aivaultCollabWeather) return; window.__aivaultCollabWeather = 1;
  var API = 'https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/aivault-weather';
  var Q = new URLSearchParams(location.search);
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOBILE = /iPhone|iPad|Android/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 500;
  var MAXP = RM ? 60 : (MOBILE ? 220 : 480);
  function nz(v) { return v === null || v === undefined || v === '' || !isFinite(+v) ? null : +v; } // null＝無資料（不當 0）
  function badgeText(S) { // 純函式，可測試
    var nm = { clear: '晴', cloudy: '多雲', rain: '下雨', heavy_rain: '大雨', typhoon: '颱風' }[S.condition] || S.condition;
    if (S.preview) return '預覽：' + nm + (S.is_night ? '・夜' : '・日') + '（非真實氣象）';
    if (S.offline) return '天氣離線・' + (S.is_night ? '夜' : '日') + '（本地時間）';
    var t = S.temp_c == null ? '氣溫無資料' : S.temp_c + '°C';
    var w = S.wind_speed_ms == null ? '風速無資料' : '風 ' + S.wind_speed_ms + ' m/s';
    var d = S.wind_dir_deg == null ? (S.wind_speed_ms == null ? '' : ' 風向無資料') : ' ' + S.wind_dir_deg + '°';
    return nm + (S.typhoon_name ? '・' + S.typhoon_name : '') + '・' + t + '・' + w + d + (S.obs_time ? '・' + String(S.obs_time).slice(11, 16) : '') + '（CWA）'; }
  window.AIVAULT_weatherBadgeText = badgeText; window.AIVAULT_weatherNz = nz;
  var S = { condition: 'clear', is_night: localNight(), wind_dir_deg: 225, wind_speed_ms: 2, offline: true, preview: false };
  function localNight() { var h = +new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hourCycle: 'h23' }).format(new Date()) % 24; return h < 6 || h >= 18; } // 依 Asia/Taipei

  function boot() {
    var css = document.createElement('style');
    css.textContent =
      '#cpw-root{position:fixed;inset:0;pointer-events:none;z-index:2147483000;overflow:hidden}' +
      '#cpw-dark{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(10,16,40,.55),rgba(2,4,14,.78));opacity:0;transition:opacity 2s}' +
      '#cpw-cloud{position:absolute;inset:-20%;opacity:0;transition:opacity 2s;background:radial-gradient(closest-side,rgba(70,78,92,.55),transparent 70%) 10% 5%/45% 30% no-repeat,radial-gradient(closest-side,rgba(60,66,80,.5),transparent 70%) 60% 0%/55% 32% no-repeat,radial-gradient(closest-side,rgba(80,86,100,.45),transparent 70%) 90% 8%/40% 26% no-repeat}' +
      '#cpw-swirl{position:absolute;left:50%;top:-10%;width:130vmax;height:130vmax;margin-left:-65vmax;margin-top:-65vmax;opacity:0;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(120,130,150,.0) 0 14deg,rgba(120,130,150,.28) 22deg,rgba(120,130,150,0) 34deg);-webkit-mask:radial-gradient(circle,transparent 8%,#000 22%,#000 55%,transparent 70%);mask:radial-gradient(circle,transparent 8%,#000 22%,#000 55%,transparent 70%)}' +
      '#cpw-cv{position:absolute;inset:0;width:100%;height:100%}' +
      '#cpw-lamps{position:absolute;left:0;right:0;bottom:0;height:46%}' +
      '.cpw-lamp{position:absolute;bottom:4%;width:10px;height:clamp(90px,26vh,190px);transform:translateX(-50%)}' +
      '.cpw-pole{position:absolute;left:3px;bottom:0;width:4px;height:100%;background:linear-gradient(#556,#223);border-radius:2px}' +
      '.cpw-head{position:absolute;left:-9px;top:-6px;width:28px;height:10px;border-radius:10px 10px 3px 3px;background:#333a48}' +
      '.cpw-bulb{position:absolute;left:0;top:3px;width:10px;height:7px;border-radius:0 0 6px 6px;background:#555;transition:background 1.5s,box-shadow 1.5s}' +
      '.cpw-halo,.cpw-pool,.cpw-cone{position:absolute;opacity:0;transition:opacity 1.8s;mix-blend-mode:screen}' +
      '.cpw-halo{left:-70px;top:-70px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,rgba(255,226,150,.85),rgba(255,200,110,.25) 35%,transparent 70%)}' +
      '.cpw-cone{left:-60px;top:8px;width:130px;height:100%;background:linear-gradient(rgba(255,220,140,.32),rgba(255,220,140,.06));clip-path:polygon(42% 0,58% 0,100% 100%,0 100%)}' +
      '.cpw-pool{left:-110px;bottom:-28px;width:230px;height:60px;border-radius:50%;background:radial-gradient(ellipse,rgba(255,214,130,.7),rgba(255,200,110,.2) 45%,transparent 72%)}' +
      '.night .cpw-halo,.night .cpw-pool,.night .cpw-cone{opacity:1}.night .cpw-bulb{background:#ffe9a8;box-shadow:0 0 14px 6px rgba(255,220,140,.9)}' +
      '.night #cpw-dark{opacity:1}' +
      '.night .cpw-lamp:nth-child(odd) .cpw-halo{animation:cpwFlick 5s infinite}@keyframes cpwFlick{0%,100%{opacity:1}48%{opacity:.86}50%{opacity:1}}' +
      '#cpw-dark{-webkit-mask:var(--cpw-mask);mask:var(--cpw-mask)}' +
      '#cpw-turb{position:absolute;right:4%;bottom:4%;width:clamp(90px,16vw,170px);height:clamp(150px,30vh,280px)}' +
      '#cpw-sock{position:absolute;left:3%;bottom:4%;width:clamp(110px,18vw,190px);height:clamp(130px,24vh,220px)}' +
      '#cpw-badge{position:absolute;top:calc(env(safe-area-inset-top,0px) + 8px);right:8px;font:12px/1.35 system-ui,-apple-system,"PingFang TC",sans-serif;color:#eef;background:rgba(10,14,28,.66);border:1px solid rgba(255,255,255,.15);padding:5px 9px;border-radius:10px;backdrop-filter:blur(4px);max-width:60vw}' +
      '.typhoon #cpw-swirl{opacity:.9;animation:cpwSpin 9s linear infinite}@keyframes cpwSpin{to{transform:rotate(-360deg)}}' +
      '.rain #cpw-cloud,.heavy_rain #cpw-cloud,.cloudy #cpw-cloud,.typhoon #cpw-cloud{opacity:1}' +
      'html.cpw-shake body{animation:cpwShake 2.6s ease-in-out infinite}@keyframes cpwShake{0%,100%{transform:translate(0,0)}20%{transform:translate(1.5px,-1px) rotate(.12deg)}40%{transform:translate(-1.5px,1px)}60%{transform:translate(1px,1px) rotate(-.12deg)}80%{transform:translate(-1px,-1px)}}' +
      'html.cpw-shake img,html.cpw-shake svg:not(.cpw-own),html.cpw-shake .sprite{animation:cpwSway 1.7s ease-in-out infinite;transform-origin:50% 100%}@keyframes cpwSway{0%,100%{transform:rotate(-1.2deg)}50%{transform:rotate(1.2deg)}}' +
      '@media (prefers-reduced-motion:reduce){html.cpw-shake body,html.cpw-shake img,html.cpw-shake svg:not(.cpw-own){animation:none}.typhoon #cpw-swirl{animation-duration:40s}}';
    document.head.appendChild(css);
    var R = document.createElement('div'); R.id = 'cpw-root'; R.setAttribute('aria-hidden', 'true');
    var lamps = '', N = MOBILE ? 4 : 6;
    for (var i = 0; i < N; i++) lamps += '<div class="cpw-lamp" style="left:' + (14 + i * (72 / (N - 1))).toFixed(1) + '%"><div class="cpw-cone"></div><div class="cpw-pool"></div><div class="cpw-pole"></div><div class="cpw-head"></div><div class="cpw-bulb"></div><div class="cpw-halo"></div></div>';
    R.innerHTML = '<div id="cpw-cloud"></div><div id="cpw-swirl"></div><div id="cpw-dark"></div><canvas id="cpw-cv"></canvas><div id="cpw-lamps">' + lamps + '</div>' +
      '<svg id="cpw-turb" class="cpw-own" viewBox="0 0 100 180"><rect x="47" y="40" width="6" height="140" rx="2" fill="#dfe4ea" stroke="#9aa3ad" stroke-width=".6"/>' +
      '<g id="cpw-nac" transform="translate(50 40)"><rect x="-12" y="-4" width="20" height="8" rx="3" fill="#eef1f4" stroke="#9aa3ad" stroke-width=".6"/></g>' +
      '<g transform="translate(50 40)"><g id="cpw-rot">' + [0, 120, 240].map(function (a) { return '<path transform="rotate(' + a + ')" d="M0 0 L-3 -6 Q-2 -38 0 -44 Q3 -38 3 -6 Z" fill="#f5f7f9" stroke="#9aa3ad" stroke-width=".6"/>'; }).join('') + '<circle r="3.5" fill="#cfd6dd" stroke="#8a939d" stroke-width=".6"/></g></g>' +
      '<circle id="cpw-tl" cx="50" cy="34" r="1.6" fill="#f33" opacity="0"/></svg>' +
      '<svg id="cpw-sock" class="cpw-own" viewBox="0 0 120 140"><rect x="8" y="10" width="4" height="130" fill="#8a7a66"/><circle cx="10" cy="9" r="3.5" fill="#d4af37"/>' +
      '<g id="cpw-fishg" transform="translate(12 18)"><path id="cpw-fish" fill="#e8453c" stroke="#7a1d18" stroke-width=".8"/><path id="cpw-fish2" fill="none" stroke="#fff" stroke-width="2" opacity=".85"/><circle id="cpw-eye" r="3" fill="#fff" stroke="#222" stroke-width="1.4"/></g></svg>' +
      '<svg id="cpw-wc" class="cpw-own" viewBox="-30 -30 60 60" style="position:absolute;right:8px;top:calc(env(safe-area-inset-top,0px) + 44px);width:56px;height:56px"><circle r="27" fill="rgba(10,14,28,.55)" stroke="#fff"/><text y="-17" text-anchor="middle" fill="#f66" font-size="10" font-weight="700">N</text><g id="cpw-wa"><path d="M0 -16 L5 -6 L1.5 -6 L1.5 16 L-1.5 16 L-1.5 -6 L-5 -6Z" fill="#7df"/></g></svg><div id="cpw-badge">天氣載入中…</div>';
    document.body.appendChild(R);
    var cv = R.querySelector('#cpw-cv'), cx = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 2);
    function fit() { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; mask(); } addEventListener('resize', fit);
    function mask() { // 夜間暗層在路燈處挖洞 → 路燈真的照亮周圍
      var ls = R.querySelectorAll('.cpw-lamp'), g = [];
      for (var i = 0; i < ls.length; i++) { var b = ls[i].getBoundingClientRect(); g.push('radial-gradient(ellipse 130px 170px at ' + (b.left + 5) + 'px ' + (b.top + b.height * .55) + 'px,transparent 0,rgba(0,0,0,.35) 55%,#000 100%)'); }
      var v = g.join(','); var d = R.querySelector('#cpw-dark'); d.style.setProperty('--cpw-mask', v);
      d.style.webkitMaskComposite = 'source-in'; d.style.maskComposite = 'intersect';
    }
    fit(); setTimeout(mask, 300);
    var SW = S.wind_speed_ms || 0, P = [], ang = 0, sock = 0, t0 = performance.now();
    function target() { var c = S.condition; return c === 'heavy_rain' ? MAXP : c === 'typhoon' ? MAXP : c === 'rain' ? Math.round(MAXP * .45) : 0; }
    function frame(now) {
      var dt = Math.min(.05, (now - t0) / 1000); t0 = now;
      var noWind = S.wind_speed_ms == null; SW += ((noWind ? 0 : S.wind_speed_ms) - SW) * Math.min(1, dt * .8); // 無資料 → 風車停、風向魚下垂不擺
      var W = cv.width, H = cv.height, c = S.condition, ws = SW, typh = c === 'typhoon';
      var slant = typh ? 0.9 : Math.min(.45, ws / 25); // 雨斜度（往風吹去的方向）
      var noDir = S.wind_dir_deg == null, dirSign = noDir ? 1 : (Math.sin((S.wind_dir_deg + 180) * Math.PI / 180) >= 0 ? 1 : -1); // CWA 風向：風「來自」的方位，正北 0°、順時針；場景面向正北，右＝東
      cx.clearRect(0, 0, W, H);
      var n = target(), step = Math.max(1, Math.ceil(MAXP * dt / 2)); /* 約 2 秒平滑增減 */ for (var a = 0; a < step && P.length < n; a++) P.push(drop(W, H, false)); if (P.length > n) P.length = Math.max(n, P.length - step);
      cx.strokeStyle = S.is_night ? 'rgba(190,205,235,.6)' : (window.AIVAULT_MAP_MODE ? 'rgba(70,95,130,.6)' : 'rgba(170,190,215,.6)'); cx.lineWidth = (c === 'heavy_rain' || typh ? 1.6 : 1.1) * dpr; cx.beginPath();
      for (var i = 0; i < P.length; i++) { var p = P[i], vx = slant * dirSign * p.v, L = p.l;
        cx.moveTo(p.x, p.y); cx.lineTo(p.x - vx * L / p.v, p.y - L);
        p.x += vx * dt * 60; p.y += p.v * dt * 60; if (p.y > H || p.x < -50 || p.x > W + 50) P[i] = drop(W, H, false); }
      cx.stroke();
      if (typh && !RM) { cx.strokeStyle = 'rgba(230,235,245,.18)'; cx.lineWidth = 2 * dpr; for (var k = 0; k < 6; k++) { var yy = ((now / 7 + k * 173) % (H + 200)) - 100, xx = ((now * .9 + k * 311) % (W + 400)) - 200; cx.beginPath(); cx.moveTo(xx, yy); cx.quadraticCurveTo(xx + 90 * dirSign * dpr, yy - 20 * dpr, xx + 200 * dirSign * dpr, yy + 6 * dpr); cx.stroke(); } }
      // 風車：轉速 ∝ 風速（0 m/s 停；25 m/s 以上切出保護顯示最大）
      var rpm = Math.min(ws, 25) * (RM ? 1.5 : 6); ang = (ang + rpm * dt * 6) % 360;
      R.querySelector('#cpw-rot').setAttribute('transform', 'rotate(' + ang.toFixed(1) + ')');
      // 機艙朝向：風從 wind_dir_deg 吹來，轉子迎風；2D 側視以左右翻轉表示東西分量
      var from = noDir ? 1 : Math.sin(S.wind_dir_deg * Math.PI / 180); // >0 東風來
      R.querySelector('#cpw-nac').setAttribute('transform', 'translate(50 40) scale(' + (from >= 0 ? 1 : -1) + ' 1)'); // 轉子迎風（風從東來→轉子朝右/東）
      R.querySelector('#cpw-tl').setAttribute('opacity', S.is_night ? (Math.floor(now / 900) % 2 ? 1 : .15) : 0);
      // 風向魚：風大飄直、風小下垂；往風吹去方向飄
      var lift = Math.max(0, Math.min(1, ws / 10)); sock += dt * (2 + ws * .8);
      var flap = (RM || noWind) ? 0 : Math.sin(sock * 2.2) * (0.25 + lift * 0.5);
      var wa = R.querySelector('#cpw-wa'); wa.style.display = noDir ? 'none' : ''; if (!noDir) wa.setAttribute('transform', 'rotate(' + ((S.wind_dir_deg + 180) % 360) + ')'); // 地圖箭頭指向風吹去的方向（與地標同一正北）
      drawFish(lift, flap, dirSign); // 魚往下風處（wind_dir_deg+180）飄；畫面右＝東
      requestAnimationFrame(frame);
    }
    function drop(W, H, init) { var v = (8 + Math.random() * 8) * dpr * (S.condition === 'typhoon' ? 1.6 : 1); return { x: Math.random() * (W + 200) - 100, y: init ? Math.random() * H : -20 - Math.random() * 80, v: v, l: (10 + Math.random() * 12) * dpr }; }
    function drawFish(lift, flap, side) {
      var L = 95, sg = 9, pts = [], base = (90 - lift * 82) * Math.PI / 180; // 0 lift → 下垂
      for (var i = 0; i <= sg; i++) { var u = i / sg, a = base + Math.sin(u * 3 + sock * 3) * .12 * (1 - u * .3) * (1 + lift) + flap * u * .25;
        var r = u * L; pts.push([Math.cos(a) * r * (side > 0 ? 1 : -1) + (side > 0 ? 0 : 0), Math.sin(a) * r]); }
      var top = [], bot = [];
      for (i = 0; i <= sg; i++) { var u2 = i / sg, w = (1 - u2 * .55) * 13 * (0.65 + lift * .35), p = pts[i], q = pts[Math.min(sg, i + 1)], o = pts[Math.max(0, i - 1)];
        var dx = q[0] - o[0], dy = q[1] - o[1], d = Math.hypot(dx, dy) || 1; top.push([p[0] - dy / d * w, p[1] + dx / d * w]); bot.push([p[0] + dy / d * w, p[1] - dx / d * w]); }
      var e = pts[sg], f = top.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); });
      var b = bot.reverse().map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); });
      R.querySelector('#cpw-fish').setAttribute('d', 'M' + f.join(' L') + ' L' + e[0].toFixed(1) + ' ' + e[1].toFixed(1) + ' L' + b.join(' L') + 'Z');
      R.querySelector('#cpw-fish2').setAttribute('d', 'M' + pts.slice(2).map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L'));
      R.querySelector('#cpw-eye').setAttribute('cx', pts[1][0].toFixed(1)); R.querySelector('#cpw-eye').setAttribute('cy', pts[1][1].toFixed(1));
    }
    function apply() {
      window.AIVAULT_WEATHER_STATE = S;
      R.className = S.condition + (S.is_night ? ' night' : '');
      document.documentElement.classList.toggle('cpw-shake', S.condition === 'typhoon' && !RM);
      R.querySelector('#cpw-badge').textContent = badgeText(S);
      setTimeout(mask, 50);
    }
    var pw = Q.get('weather');
    if (pw) { S.preview = true; S.offline = false; S.condition = pw; S.is_night = Q.get('night') === '1' ? true : Q.get('night') === '0' ? false : localNight();
      S.wind_speed_ms = +(Q.get('wind') || (pw === 'typhoon' ? 22 : pw === 'heavy_rain' ? 9 : pw === 'rain' ? 5 : 2.5)); S.wind_dir_deg = +(Q.get('dir') || 90); apply(); }
    else { apply(); load(); setInterval(load, 10 * 60 * 1000); // 每 10 分鐘同步
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') load(); }); // 回到前景立即重抓
      setInterval(function () { var n = localNight(); if (n !== S.is_night) { S.is_night = n; apply(); } }, 60 * 1000); } // 每分鐘依台北時間重算日夜
    function load() {
      var ac = window.AbortController ? new AbortController() : null; if (ac) setTimeout(function () { ac.abort(); }, 8000);
      fetch(API, { cache: 'no-store', signal: ac && ac.signal }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
        if (!j || typeof j.condition !== 'string') throw 0;
        S = { condition: j.condition, is_night: !!j.is_night, wind_dir_deg: nz(j.wind_dir_deg), wind_speed_ms: nz(j.wind_speed_ms), temp_c: nz(j.temp_c), pop: j.pop, obs_time: j.obs_time, typhoon_name: j.typhoon_name, offline: false }; apply();
      }).catch(function () { S = { condition: 'clear', is_night: localNight(), wind_dir_deg: 225, wind_speed_ms: 2, offline: true }; apply(); });
    }
    requestAnimationFrame(frame);
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();

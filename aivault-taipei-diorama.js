/* AIVAULT 同步協作池・版本 A「台北微縮島嶼」(?map=diorama)
   底圖：AIVAULT 原創生成圖 assets/taipei-diorama/diorama-{day,night}.jpg（等角俯瞰、北朝上；無人無字）。
   動態層（canvas）：大路名牌（對位底圖示意街道）、行人、捷運列車、路燈光暈、風車葉片、風向魚、天氣看板；雨/颱風/節慶/101 煙火沿用既有覆蓋層。
   註：底圖為藝術化微縮，非精確比例；路名牌位置為對位示意。 */
(function () {
  if (window.__aivaultDiorama) return; window.__aivaultDiorama = 1;
  window.AIVAULT_MAP_MODE = 'diorama';
  var base = (document.currentScript && document.currentScript.src || '').replace(/[^\/]*$/, '');
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, MOB = Math.min(innerWidth, innerHeight) < 500;
  var IW = 768, IH = 1024; // 座標以 768×1024 標註
  var ROADS = [ // 底圖可見大街（影像座標）
    { n: '忠孝東路', p: [[250, 556], [420, 506], [560, 470], [700, 440]] },
    { n: '仁愛路', p: [[262, 612], [430, 560], [600, 512], [712, 486]] },
    { n: '信義路', p: [[290, 668], [450, 618], [620, 566], [720, 540]] },
    { n: '和平東路', p: [[330, 720], [480, 676], [640, 626]] },
    { n: '中山北路', p: [[300, 520], [330, 430], [380, 340]] },
    { n: '羅斯福路', p: [[262, 612], [290, 690], [330, 770]] },
    { n: '基隆路', p: [[650, 470], [630, 560], [600, 650]] },
    { n: '市民大道', p: [[210, 500], [380, 452], [540, 410]] },
    { n: '敦化路', p: [[520, 420], [540, 520], [560, 620]] }];
  var MRT = [{ c: '#e3002c', p: [[180, 470], [300, 500], [440, 560], [600, 600]] }, { c: '#0070bd', p: [[150, 540], [350, 520], [560, 480], [720, 450]] },
    { c: '#c48c31', p: [[470, 330], [560, 380], [640, 430], [660, 560]] }, { c: '#008659', p: [[300, 420], [280, 560], [300, 700]] }];
  var LAMPS = []; ROADS.forEach(function (r) { var P = r.p; for (var i = 0; i < P.length; i++) LAMPS.push(P[i]); });
  // 經緯度 → 影像座標（以 101、中正紀念堂、圓山飯店三點仿射）
  var A = [[25.0340, 121.5645, 540, 330], [25.0346, 121.5217, 185, 465], [25.0787, 121.5265, 430, 285]];
  function solve() { var m = A.map(function (a) { return [a[1], a[0], 1]; }), det = function (M) { return M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]); };
    var d = det(m), out = []; [2, 3].forEach(function (k) { var c = []; for (var j = 0; j < 3; j++) { var M = m.map(function (r, i) { var r2 = r.slice(); r2[j] = A[i][k]; return r2; }); c.push(det(M) / d); } out.push(c); }); return out; }
  var AF = solve();
  var root, img, cv, cx, board, dpr = Math.min(devicePixelRatio || 1, MOB ? 1.5 : 2), box = { x: 0, y: 0, k: 1 };
  function S(p) { return [box.x + p[0] * box.k, box.y + p[1] * box.k]; }
  window.AIVAULT_mapPoint = function (lat, lon) { if (Math.abs(lat - 25.034) < 1e-3 && Math.abs(lon - 121.5645) < 1e-3) return S([540, 300]); return S([AF[0][0] * lon + AF[0][1] * lat + AF[0][2], AF[1][0] * lon + AF[1][1] * lat + AF[1][2]]); };
  function night() { var r = document.getElementById('cpw-root'); if (r) return r.classList.contains('night'); var h = +new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hourCycle: 'h23' }).format(new Date()); return h < 6 || h >= 18; }
  function fit() { var W = innerWidth, H = innerHeight, k = Math.min(W / IW, H / IH); box = { k: k, x: (W - IW * k) / 2, y: (H - IH * k) / 2 }; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
  function len(P) { var L = [0]; for (var i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return L; }
  function at(P, L, d) { var i = 1; while (i < L.length - 1 && L[i] < d) i++; var u = (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return [P[i - 1][0] + u * (P[i][0] - P[i - 1][0]), P[i - 1][1] + u * (P[i][1] - P[i - 1][1]), P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]]; }
  ROADS.forEach(function (r) { r.L = len(r.p); }); MRT.forEach(function (m) { m.L = len(m.p); });
  var PEOPLE = [], TRAINS = [], COLORS = ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#8e44ad', '#ffffff', '#ffb703'];
  for (var i = 0; i < (MOB ? 40 : 90); i++) { var r = ROADS[i % ROADS.length]; PEOPLE.push({ r: r, d: Math.random() * r.L[r.L.length - 1], dir: Math.random() < .5 ? 1 : -1, side: Math.random() < .5 ? 1 : -1, sp: 6 + Math.random() * 5, c: COLORS[i % COLORS.length], ph: Math.random() * 6, ride: null }); }
  MRT.forEach(function (m) { for (var j = 0; j < 2; j++) TRAINS.push({ m: m, d: j ? m.L[m.L.length - 1] : 0, dir: j ? -1 : 1, wait: 0 }); });
  function boot() {
    var st = document.createElement('style');
    st.textContent = '#cpd-root{position:fixed;inset:0;z-index:2147482900;background:#cfd8e0;transition:background 1.5s}#cpd-root.on{background:#0b1226}#cpd-root img{position:absolute;opacity:0;transition:opacity 1.8s}#cpd-root img.show{opacity:1}' +
      '#cpd-cv{position:absolute;left:0;top:0}#cpw-lamps,#cpw-turb,#cpw-sock,#cpw-dark,#cpw-cloud{display:none!important}' +
      '#cpd-board{position:fixed;left:10px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:2147483005;font:13px/1.45 system-ui,"PingFang TC",sans-serif;color:#2b2118;background:linear-gradient(#fffaf0,#f3e7cf);border:3px solid #8a6a3d;border-radius:12px;padding:8px 12px;box-shadow:0 4px 12px rgba(0,0,0,.3);min-width:150px;pointer-events:none}#cpd-board b{font-size:22px}';
    document.head.appendChild(st);
    root = document.createElement('div'); root.id = 'cpd-root';
    root.innerHTML = '<img id="cpd-d" class="show" alt="" src="' + base + 'assets/taipei-diorama/diorama-day.jpg"><img id="cpd-n" alt="" src="' + base + 'assets/taipei-diorama/diorama-night.jpg"><canvas id="cpd-cv"></canvas>';
    document.body.insertBefore(root, document.body.firstChild);
    cv = root.querySelector('#cpd-cv'); cx = cv.getContext('2d');
    board = document.createElement('div'); board.id = 'cpd-board'; document.body.appendChild(board);
    addEventListener('resize', place); place(); requestAnimationFrame(loop); setInterval(updBoard, 30000); setTimeout(updBoard, 300);
  }
  function place() { fit(); [].forEach.call(root.querySelectorAll('img'), function (im) { im.style.left = box.x + 'px'; im.style.top = box.y + 'px'; im.style.width = IW * box.k + 'px'; im.style.height = IH * box.k + 'px'; }); }
  function updBoard() { var w = window.AIVAULT_WEATHER_STATE || {}, d = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date());
    var nm = { clear: '☀️ 晴', cloudy: '⛅ 多雲', rain: '🌧 雨', heavy_rain: '⛈ 大雨', typhoon: '🌀 颱風' }[w.condition] || '—';
    if (w.preview) board.innerHTML = '📅 ' + d + '<br>' + nm + '<br><small>預覽（非真實氣象）</small>';
    else if (w.offline || w.temp_c == null) board.innerHTML = '📅 ' + d + '<br>天氣離線<br><small>後端未連線，不顯示數字</small>';
    else board.innerHTML = '📅 ' + d + '<br>' + nm + ' <b>' + Math.round(w.temp_c) + '°C</b><br>降雨機率 ' + (w.pop != null ? w.pop + '%' : '—') + '<br><small>中央氣象署</small>'; }
  var t0 = performance.now(), ang = 0, lastBoard = '';
  function loop(now) {
    var dt = Math.min(.1, (now - t0) / 1000); t0 = now, N = night(); root.classList.toggle('on', N); root.querySelector('#cpd-n').classList.toggle('show', N); root.querySelector('#cpd-d').classList.toggle('show', !N);
    var w = window.AIVAULT_WEATHER_STATE || {}; var key = JSON.stringify([w.condition, w.preview, w.offline, w.temp_c]); if (key !== lastBoard) { lastBoard = key; updBoard(); }
    var k = box.k; cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, innerWidth, innerHeight);
    if (N) { cx.globalCompositeOperation = 'lighter'; LAMPS.forEach(function (p) { var s = S(p), g = cx.createRadialGradient(s[0], s[1], 0, s[0], s[1], 26 * k); g.addColorStop(0, 'rgba(255,214,130,.55)'); g.addColorStop(1, 'rgba(255,214,130,0)'); cx.fillStyle = g; cx.fillRect(s[0] - 26 * k, s[1] - 26 * k, 52 * k, 52 * k); }); cx.globalCompositeOperation = 'source-over'; }
    // 捷運（模擬）
    TRAINS.forEach(function (t) { var L = t.m.L[t.m.L.length - 1]; if (t.wait > 0) t.wait -= dt; else { t.d += t.dir * 26 * dt; if (t.d > L || t.d < 0) { t.dir *= -1; t.d = Math.max(0, Math.min(L, t.d)); t.wait = 4; } }
      var q = at(t.m.p, t.m.L, t.d), s = S(q), a = Math.atan2(q[3], q[2]); cx.save(); cx.translate(s[0], s[1]); cx.rotate(a); cx.fillStyle = t.m.c; cx.strokeStyle = '#222'; cx.lineWidth = 1; cx.beginPath(); cx.rect(-11 * k, -3.2 * k, 22 * k, 6.4 * k); cx.fill(); cx.stroke(); cx.fillStyle = N ? '#ffe9a8' : '#cfe6f5'; cx.fillRect(-9 * k, -1.4 * k, 18 * k, 2.8 * k); cx.restore(); t.s = s; });
    // 行人（通用小人，非協作池角色）；靠近停站列車時上車、隨車移動、到端點下車
    PEOPLE.forEach(function (p) { var s;
      if (p.ride) { s = p.ride.s; s = [s[0] + p.off * k, s[1] - 4 * k]; if (p.ride.wait > 0 && (p.left -= dt) < 0) p.ride = null; }
      else { var L = p.r.L[p.r.L.length - 1]; p.d += p.dir * p.sp * dt; if (p.d > L || p.d < 0) p.dir *= -1; var q = at(p.r.p, p.r.L, Math.max(0, Math.min(L, p.d))), n = Math.hypot(q[2], q[3]) || 1; s = S([q[0] - q[3] / n * 4 * p.side, q[1] + q[2] / n * 4 * p.side]);
        TRAINS.forEach(function (t) { if (!p.ride && t.wait > 3 && t.s && Math.hypot(t.s[0] - s[0], t.s[1] - s[1]) < 12 * k && Math.random() < .3) { p.ride = t; p.off = (Math.random() - .5) * 14; p.left = 6 + Math.random() * 8; } }); }
      p.ph += dt * 10; var h = Math.max(9, 11 * k), sw = RM ? 0 : Math.sin(p.ph) * 1.6 * k;
      cx.strokeStyle = '#2b2f3a'; cx.lineWidth = Math.max(1.5, 1.8 * k); cx.beginPath(); cx.moveTo(s[0], s[1] - h * .35); cx.lineTo(s[0] - sw, s[1]); cx.moveTo(s[0], s[1] - h * .35); cx.lineTo(s[0] + sw, s[1]); cx.stroke();
      cx.fillStyle = p.c; cx.fillRect(s[0] - h * .2, s[1] - h * .85, h * .4, h * .5); cx.fillStyle = '#f1c27d'; cx.beginPath(); cx.arc(s[0], s[1] - h, h * .2, 0, 6.283); cx.fill(); });
    // 路名牌
    cx.font = '800 ' + Math.max(11, 13 * k) + 'px "PingFang TC","Noto Sans TC",sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    ROADS.forEach(function (r) { var q = at(r.p, r.L, r.L[r.L.length - 1] * .5), s = S(q), tw = cx.measureText(r.n).width + 14; cx.fillStyle = 'rgba(25,28,36,.82)'; cx.strokeStyle = '#fff'; cx.lineWidth = 2; cx.beginPath(); cx.rect(s[0] - tw / 2, s[1] - 22 * k - 10, tw, 20); cx.fill(); cx.stroke(); cx.fillStyle = '#fff'; cx.fillText(r.n, s[0], s[1] - 22 * k); });
    // 風車葉片（底圖風車位置）＋風向魚
    var ws = (w.wind_speed_ms || 2), dir = (w.wind_dir_deg || 225); ang += Math.min(ws, 25) * dt * .9; var hub = S([708, 312]);
    cx.save(); cx.translate(hub[0], hub[1]); cx.rotate(ang); cx.fillStyle = '#fff'; cx.strokeStyle = '#889'; for (var b = 0; b < 3; b++) { cx.rotate(2.094); cx.beginPath(); cx.moveTo(-1.2 * k, 0); cx.lineTo(0, -15 * k); cx.lineTo(1.2 * k, 0); cx.fill(); cx.stroke(); } cx.restore();
    var pole = S([735, 330]), down = Math.sin((dir + 180) * Math.PI / 180) >= 0 ? 1 : -1, lift = Math.min(1, ws / 10), fl = RM ? 0 : Math.sin(now / 200) * .15;
    cx.strokeStyle = '#7a6a55'; cx.lineWidth = 1.5 * k; cx.beginPath(); cx.moveTo(pole[0], pole[1]); cx.lineTo(pole[0], pole[1] - 22 * k); cx.stroke();
    cx.save(); cx.translate(pole[0], pole[1] - 21 * k); cx.rotate(down > 0 ? (1 - lift) * 1.3 + fl : Math.PI - (1 - lift) * 1.3 - fl); cx.fillStyle = '#e8453c'; cx.beginPath(); cx.moveTo(0, -3 * k); cx.lineTo(16 * k, -1.2 * k); cx.lineTo(16 * k, 1.2 * k); cx.lineTo(0, 3 * k); cx.fill(); cx.restore();
    requestAnimationFrame(loop);
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();

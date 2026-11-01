/* AIVAULT 同步協作池地標天際線 v1（自繪 SVG／canvas，無外部素材；純加法覆蓋層 pointer-events:none）
   台北101（竹節）、中正紀念堂（白牆藍瓦八角頂）、圓山飯店（紅柱金黃宮殿屋頂）。夜間亮燈（跟天氣層 #cpw-root.night 或台北時間）。
   跨年：Asia/Taipei 12/31 23:00 ～ 1/1 01:00，101 各節噴發煙火＋0:00 倒數。預覽 ?festival=newyeareve */
(function () {
  if (window.__aivaultLandmarks) return; window.__aivaultLandmarks = 1;
  var Q = new URLSearchParams(location.search), RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tp(t) { var o = {}; new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(t).forEach(function (x) { o[x.type] = +x.value; }); return o; }
  function isNYE(t) { var o = tp(t); return (o.month === 12 && o.day === 31 && o.hour >= 23) || (o.month === 1 && o.day === 1 && o.hour < 1); }
  window.AIVAULT_isNewYearEve = isNYE;
  function nightNow() { var r = document.getElementById('cpw-root'); if (r) return r.classList.contains('night'); var h = tp(new Date()).hour; return h < 6 || h >= 18; }
  var W = '', W1 = '', W2 = '', W3 = '', i;
  // 101：8 節竹節（每節上寬下窄）＋基座＋尖塔
  var t = '<g transform="translate(700 0)"><rect x="-34" y="300" width="68" height="60" fill="#5f7d8c"/>';
  for (i = 0; i < 8; i++) { var y = 300 - (i + 1) * 30; t += '<path d="M-22 ' + (y + 30) + ' L-30 ' + y + ' L30 ' + y + ' L22 ' + (y + 30) + 'Z" fill="#6f93a3" stroke="#3e5864" stroke-width="1.2"/>';
    for (var k = -2; k <= 2; k++) W1 += '<rect x="' + (700 + k * 9 - 2) + '" y="' + (y + 8) + '" width="4" height="14"/>'; }
  t += '<rect x="-16" y="40" width="32" height="20" fill="#6f93a3" stroke="#3e5864"/><rect x="-3" y="-10" width="6" height="52" fill="#9ab"/><circle class="lt" cy="-12" r="3"/></g>';
  // 中正紀念堂：白牆＋藍瓦八角攢尖頂＋台階
  var c = '<g transform="translate(300 0)"><path d="M-110 360 L-70 320 L70 320 L110 360Z" fill="#e9ecef"/><rect x="-60" y="250" width="120" height="70" fill="#f8f9fa" stroke="#ccd" /><rect x="-16" y="275" width="32" height="45" fill="#1e3a8a" class="ld"/>' +
    '<path d="M-78 252 L0 222 L78 252Z" fill="#1d4ed8" stroke="#123a9a"/><rect x="-48" y="200" width="96" height="24" fill="#f8f9fa"/><path d="M-62 202 Q0 140 62 202Z" fill="#1d4ed8" stroke="#123a9a"/><rect x="-2" y="140" width="4" height="18" fill="#d4af37"/></g>';
  for (i = -1; i <= 1; i += 2) W2 += '<rect x="' + (300 + i * 38 - 8) + '" y="268" width="16" height="30"/>';
  // 圓山飯店：紅柱＋多層金黃歇山頂
  var g = '<g transform="translate(1080 0)"><rect x="-140" y="270" width="280" height="90" fill="#b91c1c"/>';
  for (i = -6; i <= 6; i++) g += '<rect x="' + (i * 21 - 3) + '" y="270" width="6" height="90" fill="#7f1d1d"/>';
  g += '<path d="M-165 272 L-120 236 L120 236 L165 272Z" fill="#f2b705" stroke="#a36f00"/><rect x="-100" y="208" width="200" height="30" fill="#b91c1c"/><path d="M-125 210 L-80 176 L80 176 L125 210Z" fill="#f2b705" stroke="#a36f00"/><rect x="-50" y="156" width="100" height="22" fill="#b91c1c"/><path d="M-70 158 L-30 130 L30 130 L70 158Z" fill="#f2b705" stroke="#a36f00"/></g>';
  for (i = -6; i < 6; i++) { W3 += '<rect x="' + (1080 + i * 21 + 6) + '" y="286" width="9" height="12"/><rect x="' + (1080 + i * 21 + 6) + '" y="316" width="9" height="12"/>'; }
  for (i = -4; i < 4; i++) W3 += '<rect x="' + (1080 + i * 21 + 6) + '" y="214" width="9" height="12"/>';
  // 依真實經緯度投影：觀者面向正北（畫面上＝北、右＝東）；緯度越北越遠（越小、越高）
  var LM = [{ id: '101', lat: 25.0340, lon: 121.5645, ox: 700, svg: t, w: W1 }, { id: 'cks', lat: 25.0346, lon: 121.5217, ox: 300, svg: c, w: W2 }, { id: 'grand', lat: 25.0787, lon: 121.5265, ox: 1080, svg: g, w: W3 }];
  window.AIVAULT_LANDMARKS = LM;
  var LON0 = 121.515, LON1 = 121.571, LAT0 = 25.030, LAT1 = 25.082;
  LM.forEach(function (m) { var dz = (m.lat - LAT0) / (LAT1 - LAT0); m.s = 1 - dz * .45; m.x = 120 + (m.lon - LON0) / (LON1 - LON0) * 1160; m.lift = dz * 95; });
  LM.sort(function (a, b) { return b.lat - a.lat; }); // 遠的先畫
  W = LM.map(function (m) { return '<g data-lm="' + m.id + '" transform="translate(' + m.x.toFixed(1) + ' ' + (360 - m.lift).toFixed(1) + ') scale(' + m.s.toFixed(3) + ') translate(' + (-m.ox) + ' -360)">' + m.svg + '<g class="lw">' + m.w + '</g></g>'; }).join('');
  var T101 = LM.filter(function (m) { return m.id === '101'; })[0];
  function boot() {
    var MAPM = !!window.AIVAULT_MAP_MODE; // 地圖模式：地標畫在地圖上（aivault-taipei-map.js），此處只負責跨年 101 煙火
    var st = document.createElement('style');
    st.textContent = (MAPM ? '#cpl-root{display:none!important}' : '') + '#cpl-root{position:fixed;left:0;right:0;bottom:22%;height:40vh;pointer-events:none;z-index:2147482980}#cpl-root svg{width:100%;height:100%}' +
      '#cpl-root .lw{fill:#3a4652;transition:fill 1.5s}#cpl-root .lt{fill:#a33}#cpl-root.on{z-index:2147483001}#cpl-root.on [data-lm]>g:first-child{filter:brightness(.5) saturate(.8)}#cpl-root.on .lw{fill:#ffd97a;filter:drop-shadow(0 0 3px #ffb43a)}#cpl-root.on .lt{fill:#f44;filter:drop-shadow(0 0 6px #f44)}' +
      '#cpl-root.on .ld{fill:#ffe9a8}#cpl-root.on #cpl-glow{opacity:1}#cpl-glow{opacity:0;transition:opacity 1.5s}' +
      '#cpl-fw{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483002}' +
      '#cpl-cd{position:fixed;left:50%;top:14%;transform:translateX(-50%);font:800 clamp(26px,7vw,64px) system-ui,"PingFang TC",sans-serif;color:#fff;text-shadow:0 0 18px #f0c,0 0 6px #000;pointer-events:none;z-index:2147483003;text-align:center}';
    document.head.appendChild(st);
    var R = document.createElement('div'); R.id = 'cpl-root'; R.setAttribute('aria-hidden', 'true');
    R.innerHTML = '<svg viewBox="0 0 1400 360" preserveAspectRatio="xMidYMax meet"><defs><radialGradient id="cplg"><stop offset="0" stop-color="#ffcf6a" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf6a" stop-opacity="0"/></radialGradient></defs>' +
      '<g id="cpl-glow">' + LM.map(function (m) { return '<ellipse cx="' + m.x.toFixed(0) + '" cy="' + (250 - m.lift).toFixed(0) + '" rx="' + (150 * m.s).toFixed(0) + '" ry="' + (130 * m.s).toFixed(0) + '" fill="url(#cplg)"/>'; }).join('') + '</g>' + W + '<g transform="translate(40 40)"><circle r="26" fill="rgba(10,14,28,.55)" stroke="#fff" stroke-width="1.5"/><path d="M0 -20 L6 0 L0 -4 L-6 0Z" fill="#f44"/><path d="M0 20 L6 0 L0 4 L-6 0Z" fill="#ddd"/><text y="-29" text-anchor="middle" fill="#fff" font-size="14" font-weight="700">N</text><text x="31" y="5" fill="#fff" font-size="11">E</text><text x="-40" y="5" fill="#fff" font-size="11">W</text></g></svg>';
    document.body.appendChild(R);
    function tick() { R.classList.toggle('on', nightNow() || nye()); } setTimeout(tick, 60); setInterval(tick, 3000); // 等天氣層建立後再判斷日夜
    var prev = Q.get('festival') === 'newyeareve';
    function nye() { return prev || isNYE(new Date()); }
    var cv = null, cx, P = [], cd = null, dpr = Math.min(devicePixelRatio || 1, 2), last = 0;
    function burst() { // 從 101 各節噴發
      var b = R.querySelector('svg').getBoundingClientRect(), s = Math.min(b.width / 1400, b.height / 360), ox = b.left + (b.width - 1400 * s) / 2, oy = b.top + (b.height - 360 * s);
      if (MAPM && window.AIVAULT_mapPoint) { var mp = window.AIVAULT_mapPoint(25.0340, 121.5645), tr = Math.random() * 8 | 0; var x0 = mp[0] + (Math.random() - .5) * 10, y0 = mp[1] - 8 - tr * 7; return spray(x0, y0); }
      var tier = Math.floor(Math.random() * 9), lx = (tier === 8 ? 0 : (Math.random() < .5 ? -1 : 1) * 30), ly = (tier === 8 ? -10 : 300 - tier * 30);
      var x = (T101.x + lx * T101.s) * s + ox, y = (360 - T101.lift + (ly - 360) * T101.s) * s + oy;
      spray(x, y);
    }
    function spray(x, y) {
      var hue = Math.random() * 360, n = RM ? 18 : 46;
      for (var j = 0; j < n; j++) { var a = Math.PI * 2 * j / n, v = 2 + Math.random() * 3.5; P.push({ x: x * dpr, y: y * dpr, vx: Math.cos(a) * v * dpr, vy: (Math.sin(a) * v - 1.6) * dpr, l: 1, h: hue + Math.random() * 40 }); }
      if (P.length > 900) P.splice(0, P.length - 900);
    }
    function loop(now) {
      if (!nye()) { if (cv) { cv.remove(); cv = null; cd && cd.remove(); cd = null; P = []; } return setTimeout(function () { requestAnimationFrame(loop); }, 30000); }
      if (!cv) { cv = document.createElement('canvas'); cv.id = 'cpl-fw'; document.body.appendChild(cv); cx = cv.getContext('2d'); cd = document.createElement('div'); cd.id = 'cpl-cd'; document.body.appendChild(cd); }
      if (cv.width !== innerWidth * dpr) { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
      if (window.AIVAULT_MAP_MODE !== '3d' && now - last > (RM ? 1400 : 420)) { last = now; burst(); } // 3D 模式煙火由 3D 場景從 101 發射
      cx.globalCompositeOperation = 'source-over'; cx.clearRect(0, 0, cv.width, cv.height); cx.globalCompositeOperation = 'lighter';
            for (var j = P.length - 1; j >= 0; j--) { var p = P[j]; p.x += p.vx; p.y += p.vy; p.vy += .045 * dpr; p.vx *= .985; p.l -= .009;
        if (p.l <= 0) { P.splice(j, 1); continue; } cx.fillStyle = 'hsla(' + p.h + ',100%,62%,' + p.l + ')'; cx.beginPath(); cx.arc(p.x, p.y, 2.4 * dpr, 0, 6.283); cx.fill(); }
      var o = tp(new Date());
      if (prev) cd.textContent = '🎆 跨年倒數（預覽）';
      else if (o.month === 12 && o.hour === 23 && o.minute >= 59) cd.textContent = String(60 - o.second); // 0:00 倒數
      else if (o.month === 12) cd.textContent = '跨年倒數 ' + (59 - o.minute) + ' 分';
      else cd.textContent = '🎉 新年快樂！';
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();

/* AIVAULT 同步協作池・臺北市地圖場景 v1（純加法底圖層；北方朝上）
   12 行政區界與區名、山（陰影＋等高線）、河流、道路（國道/高架/幹道）、捷運六線＋車站、地標（自繪、夜間亮燈）、
   捷運「模擬」行駛：沿路線雙向對開、進站停 6 秒、01:00–06:00（Asia/Taipei）停駛、夜間車廂亮燈。非實時列車位置。
   啟用：?map=1（預覽頁預設開）。需先載入 aivault-taipei-map-data.js。協作池原有人物／互動不在此檔，未更動。 */
(function () {
  var D = window.AIVAULT_TAIPEI_MAP; if (!D || window.__aivaultMap) return; window.__aivaultMap = 1;
  var Q = new URLSearchParams(location.search), RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var base = (document.currentScript && document.currentScript.src || '').replace(/[^\/]*$/, '');
  window.AIVAULT_MAP_MODE = true;
  function P(lat, lon) { return [(lon - D.lon0) / (D.lon1 - D.lon0) * D.w, (D.lat1 - lat) / (D.lat1 - D.lat0) * D.h]; }
  function tp() { var o = {}; new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date()).forEach(function (x) { o[x.type] = +x.value; }); return o; }
  function night() { var r = document.getElementById('cpw-root'); if (r) return r.classList.contains('night'); var h = tp().hour; return h < 6 || h >= 18; }
  function pl(p) { return 'M' + p.map(function (q) { return q[0] + ' ' + q[1]; }).join('L'); }
  var LM = [ // 自繪地標（地圖圖示尺寸）
    { n: '台北101', d: '信義區', lat: 25.0340, lon: 121.5645, svg: function () { var s = '<rect x="-7" y="-6" width="14" height="6" fill="#5f7d8c"/>'; for (var i = 0; i < 8; i++) s += '<path d="M-4.5 ' + (-6 - i * 6) + 'L-6.5 ' + (-12 - i * 6) + 'L6.5 ' + (-12 - i * 6) + 'L4.5 ' + (-6 - i * 6) + 'Z" fill="#6f93a3" stroke="#3e5864" stroke-width=".5"/><rect class="mw" x="-3" y="' + (-10 - i * 6) + '" width="6" height="2"/>'; return s + '<rect x="-.8" y="-66" width="1.6" height="12" fill="#9ab"/>'; } },
    { n: '中正紀念堂', d: '中正區', lat: 25.0346, lon: 121.5217, svg: function () { return '<path d="M-18 0L-12 -6L12 -6L18 0Z" fill="#eef"/><rect x="-10" y="-20" width="20" height="14" fill="#f8f9fa" stroke="#bbc" stroke-width=".5"/><rect class="mw" x="-3" y="-15" width="6" height="9"/><path d="M-13 -19L0 -25L13 -19Z" fill="#1d4ed8"/><rect x="-8" y="-30" width="16" height="6" fill="#f8f9fa"/><path d="M-10 -29Q0 -42 10 -29Z" fill="#1d4ed8"/>'; } },
    { n: '圓山大飯店', d: '中山區', lat: 25.0787, lon: 121.5265, svg: function () { var s = '<rect x="-22" y="-14" width="44" height="14" fill="#b91c1c"/>'; for (var i = -4; i <= 4; i++) s += '<rect x="' + (i * 5 - .8) + '" y="-14" width="1.6" height="14" fill="#7f1d1d"/>'; return s + '<rect class="mw" x="-18" y="-10" width="36" height="2.5"/><path d="M-26 -13L-19 -19L19 -19L26 -13Z" fill="#f2b705"/><rect x="-14" y="-25" width="28" height="7" fill="#b91c1c"/><path d="M-18 -24L-11 -30L11 -30L18 -24Z" fill="#f2b705"/>'; } },
    { n: '臺北市政府', d: '信義區', lat: 25.0375, lon: 121.5637, svg: function () { return '<rect x="-16" y="-14" width="32" height="14" fill="#cfd6dc" stroke="#7d8790" stroke-width=".6"/><rect x="-4" y="-20" width="8" height="6" fill="#cfd6dc" stroke="#7d8790" stroke-width=".6"/><rect class="mw" x="-13" y="-11" width="26" height="2"/><rect class="mw" x="-13" y="-6" width="26" height="2"/>'; } },
    { n: '總統府', d: '中正區', lat: 25.0400, lon: 121.5119, svg: function () { return '<rect x="-20" y="-12" width="40" height="12" fill="#b5523b" stroke="#fff" stroke-width=".5"/><rect x="-4" y="-34" width="8" height="22" fill="#b5523b" stroke="#fff" stroke-width=".5"/><path d="M-5 -34L0 -39L5 -34Z" fill="#8c3b2a"/><rect class="mw" x="-2" y="-30" width="4" height="12"/><rect class="mw" x="-17" y="-8" width="34" height="2"/>'; } },
    { n: '北門 承恩門', d: '中正區', lat: 25.0478, lon: 121.5111, svg: function () { return '<rect x="-12" y="-8" width="24" height="8" fill="#9c4a32" stroke="#5e2a1b" stroke-width=".5"/><path d="M-3 0V-4A3 3 0 0 1 3 -4V0Z" fill="#2b1a12"/><rect x="-9" y="-16" width="18" height="8" fill="#a5523a" stroke="#5e2a1b" stroke-width=".5"/><rect class="mw" x="-6" y="-14" width="3" height="3"/><rect class="mw" x="3" y="-14" width="3" height="3"/><path d="M-12 -16L0 -22L12 -16Z" fill="#3b2b25"/>'; } },
    { n: '南門 麗正門', d: '中正區', lat: 25.0327, lon: 121.5137, svg: function () { return '<rect x="-12" y="-8" width="24" height="8" fill="#b8a48a" stroke="#6b5a44" stroke-width=".5"/><path d="M-3 0V-4A3 3 0 0 1 3 -4V0Z" fill="#2b1a12"/><rect x="-8" y="-15" width="16" height="7" fill="#f3e6cc"/><rect x="-7" y="-15" width="1.4" height="7" fill="#b91c1c"/><rect x="-.7" y="-15" width="1.4" height="7" fill="#b91c1c"/><rect x="5.6" y="-15" width="1.4" height="7" fill="#b91c1c"/><rect class="mw" x="-5" y="-13" width="4" height="3"/><rect class="mw" x="1.2" y="-13" width="4" height="3"/><path d="M-13 -14L-9 -20L9 -20L13 -14Z" fill="#5a4636"/><path d="M-9 -20L0 -23L9 -20Z" fill="#5a4636"/>'; } },
    { n: '小南門 重熙門', d: '中正區', lat: 25.0371, lon: 121.5079, svg: function () { return '<rect x="-10" y="-7" width="20" height="7" fill="#b8a48a" stroke="#6b5a44" stroke-width=".5"/><path d="M-2.5 0V-3A2.5 2.5 0 0 1 2.5 -3V0Z" fill="#2b1a12"/><rect x="-6" y="-13" width="12" height="6" fill="#f3e6cc"/><rect x="-5.5" y="-13" width="1.2" height="6" fill="#b91c1c"/><rect x="4.3" y="-13" width="1.2" height="6" fill="#b91c1c"/><rect class="mw" x="-3" y="-11.5" width="6" height="2.5"/><path d="M-11 -12L-7 -17L7 -17L11 -12Z" fill="#2f8f4e"/><path d="M-7 -17L0 -20L7 -17Z" fill="#2f8f4e"/>'; } }
  ];
  window.AIVAULT_mapLandmarks = LM;
  var M = D.mrt, CO = M.colors;
  function boot() {
    var st = document.createElement('style');
    st.textContent = '#cpm-root{position:fixed;inset:0;z-index:2147482900;pointer-events:none;background:#9cc6dd}#cpm-root svg{width:100%;height:100%}' +
      '#cpm-root .dist{fill:rgba(250,246,232,.18);stroke:#7a5c3a;stroke-width:1.6;stroke-dasharray:6 3}#cpm-root .dn{font:700 17px "PingFang TC","Noto Sans TC",sans-serif;fill:#3b2a17;paint-order:stroke;stroke:rgba(255,255,255,.8);stroke-width:3px;text-anchor:middle}' +
      '#cpm-root .ct{fill:none;stroke:rgba(90,60,30,.35);stroke-width:.8}#cpm-root .rv{fill:none;stroke:#4f9fd6;stroke-linecap:round;stroke-linejoin:round}#cpm-root .rn{font:italic 12px sans-serif;fill:#1d5e93;paint-order:stroke;stroke:#fff;stroke-width:2.5px}' +
      '#cpm-root .rd{fill:none;stroke-linecap:round;stroke-linejoin:round}#cpm-root .rd-fw{stroke:#e07b2e;stroke-width:5}#cpm-root .rd-ev{stroke:#f2c14e;stroke-width:4;stroke-dasharray:10 2}#cpm-root .rd-ar{stroke:#fff;stroke-width:3.2}#cpm-root .rdc{stroke:#6b5b4b;stroke-width:6.4}' +
      '#cpm-root .rl{font:600 10.5px "PingFang TC",sans-serif;fill:#4a3726;paint-order:stroke;stroke:#fff;stroke-width:2.5px}#cpm-root .tk{fill:none;stroke-width:3.4;stroke-linecap:round}#cpm-root .stn{fill:#fff;stroke:#333;stroke-width:1}#cpm-root .sn{font:9.5px "PingFang TC",sans-serif;fill:#222;paint-order:stroke;stroke:#fff;stroke-width:2px}' +
      '#cpm-root .mt{font:700 12px "PingFang TC",sans-serif;fill:#3d5a2a;paint-order:stroke;stroke:rgba(255,255,255,.8);stroke-width:2.5px;text-anchor:middle}#cpm-root .ln{font:700 10px "PingFang TC",sans-serif;fill:#111;paint-order:stroke;stroke:#fff;stroke-width:2.5px;text-anchor:middle}' +
      '#cpm-root .mw{fill:#4a5560;transition:fill 1.2s}#cpm-root.on .mw{fill:#ffd97a;filter:drop-shadow(0 0 2px #ffb43a)}#cpm-root.on .lmg{opacity:1}.lmg{opacity:0;transition:opacity 1.2s}' +
      '#cpm-root .fog{opacity:0;transition:opacity 3s}#cpm-root.wet .fog{opacity:.75}#cpm-root.on #cpm-terr{filter:brightness(.55)}' +
      '#cpm-sim{position:fixed;left:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 8px);z-index:2147483004;font:12px system-ui,"PingFang TC",sans-serif;color:#fff;background:rgba(10,14,28,.7);padding:4px 9px;border-radius:10px;pointer-events:none}';
    document.head.appendChild(st);
    var s = '<svg viewBox="0 0 ' + D.w + ' ' + D.h + '" preserveAspectRatio="xMidYMid meet"><defs><radialGradient id="cpmg"><stop offset="0" stop-color="#ffcf6a" stop-opacity=".7"/><stop offset="1" stop-color="#ffcf6a" stop-opacity="0"/></radialGradient>' +
      '<filter id="cpmb"><feGaussianBlur stdDeviation="18"/></filter></defs>';
    s += '<image id="cpm-terr" href="' + base + 'aivault-taipei-terrain.jpg" x="0" y="0" width="' + D.w + '" height="' + D.h + '" preserveAspectRatio="none"/>';
    s += D.contours.map(function (c) { return '<path class="ct" d="' + c.d + '"' + (c.lv >= 500 ? ' style="stroke-width:1.1"' : '') + '/>'; }).join('');
    s += D.rivers.map(function (r) { var w = r.n === '淡水河' ? 14 : r.n === '基隆河' || r.n === '新店溪' ? 9 : 6; return '<path class="rv" d="' + pl(r.p) + '" stroke-width="' + w + '"/>'; }).join('');
    s += D.districts.map(function (d) { return '<path class="dist" d="' + d.d + '"/>'; }).join('');
    s += D.roads.map(function (r) { return '<path class="rd rdc" d="' + pl(r.p) + '"' + (r.t === 'ar' ? ' style="stroke-width:4.6"' : '') + '/><path class="rd rd-' + r.t + '" id="rd' + r.n + '" d="' + pl(r.p) + '"/>'; }).join('');
    s += D.roads.map(function (r) { return '<text class="rl"><textPath href="#rd' + r.n + '" startOffset="35%">' + r.n + '</textPath></text>'; }).join('');
    s += M.tracks.map(function (t) { return '<path class="tk" d="' + pl(t.p) + '" stroke="' + CO[t.l] + '"' + (t.approx ? ' stroke-dasharray="7 3"' : '') + '/>'; }).join('');
    var MAJOR = /台北車站|臺北車站|西門|中正紀念堂|古亭|忠孝復興|忠孝新生|南京復興|松江南京|中山$|民權西路|大安|東門|台北101|市政府|南港展覽館|動物園|士林|北投|淡水|公館|景美|大坪林|板橋|頂溪|內湖|大直|松山機場|劍潭|圓山|中山國中|象山|松山$|大橋頭/;
    s += M.stations.map(function (x) { var big = MAJOR.test(x.n); return '<circle class="stn" cx="' + x.p[0] + '" cy="' + x.p[1] + '" r="' + (big ? 3.6 : 2.4) + '"/>' + (big ? '<text class="sn" x="' + (x.p[0] + 5) + '" y="' + (x.p[1] - 4) + '">' + x.n + '</text>' : ''); }).join('');
    s += D.mountains.map(function (m) { return '<text class="mt" x="' + m.p[0] + '" y="' + m.p[1] + '">⛰ ' + m.n + '</text>'; }).join('');
    s += '<g class="fog" filter="url(#cpmb)">' + D.mountains.map(function (m) { return '<ellipse cx="' + m.p[0] + '" cy="' + (m.p[1] + 10) + '" rx="85" ry="34" fill="#eef2f5"/>'; }).join('') + '</g>';
    s += D.districts.map(function (d) { return '<text class="dn" x="' + d.cx + '" y="' + d.cy + '">' + d.name + '</text>'; }).join('');
    s += '<g id="cpm-trains"></g>';
    s += LM.map(function (m) { var p = P(m.lat, m.lon); m.p = p; return '<g transform="translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')"><ellipse class="lmg" cy="-14" rx="34" ry="30" fill="url(#cpmg)"/>' + m.svg() + '<text class="ln" y="10"' + (m.n.length > 4 ? ' style="font-size:8px"' : '') + '>' + m.n + '</text></g>'; }).join('');
    s += '<g transform="translate(' + (D.w - 60) + ' 70)"><circle r="34" fill="rgba(255,255,255,.85)" stroke="#333" stroke-width="2"/><path d="M0 -27L8 0L0 -6L-8 0Z" fill="#d22"/><path d="M0 27L8 0L0 6L-8 0Z" fill="#888"/><text y="-38" text-anchor="middle" font-size="18" font-weight="800" fill="#d22">N</text></g>';
    s += '<text x="12" y="' + (D.h - 10) + '" font-size="10" fill="#334">界線：內政部（政府資料開放授權）｜DEM：AWS Terrain Tiles｜捷運：臺北市捷運局 data.taipei｜河川/道路：手描示意</text></svg>';
    var R = document.createElement('div'); R.id = 'cpm-root'; R.setAttribute('aria-hidden', 'true'); R.innerHTML = s;
    document.body.insertBefore(R, document.body.firstChild);
    var sim = document.createElement('div'); sim.id = 'cpm-sim'; document.body.appendChild(sim);
    window.AIVAULT_mapPoint = function (lat, lon) { var sv = R.querySelector('svg').getBoundingClientRect(), k = Math.min(sv.width / D.w, sv.height / D.h), p = P(lat, lon);
      return [sv.left + (sv.width - D.w * k) / 2 + p[0] * k, sv.top + (sv.height - D.h * k) / 2 + p[1] * k]; };
    // —— 捷運模擬 ——
    var TR = [], G = R.querySelector('#cpm-trains'), NS = 'http://www.w3.org/2000/svg';
    M.tracks.forEach(function (t, i) {
      var L = [0]; for (var k = 1; k < t.p.length; k++) L.push(L[k - 1] + Math.hypot(t.p[k][0] - t.p[k - 1][0], t.p[k][1] - t.p[k - 1][1]));
      var len = L[L.length - 1]; if (len < 25) return;
      var stops = []; M.stations.forEach(function (x) { var best = 1e9, at = 0; for (var k = 1; k < t.p.length; k++) { var a = t.p[k - 1], b = t.p[k], dx = b[0] - a[0], dy = b[1] - a[1], q = Math.max(0, Math.min(1, ((x.p[0] - a[0]) * dx + (x.p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))), d = Math.hypot(a[0] + q * dx - x.p[0], a[1] + q * dy - x.p[1]); if (d < best) { best = d; at = L[k - 1] + q * (L[k] - L[k - 1]); } } if (best < 6) stops.push(at); });
      stops.sort(function (a, b) { return a - b; }); if (stops.length < 2) stops = [0, len];
      var n = Math.max(1, Math.min(3, Math.round(len / 160)));
      for (var j = 0; j < n * 2; j++) { var el = document.createElementNS(NS, 'g'); el.innerHTML = '<rect x="-7" y="-3" width="14" height="6" rx="2.5" fill="' + CO[t.l] + '" stroke="#222" stroke-width=".8"/><rect class="mw" x="-5" y="-1.4" width="10" height="2.8" rx="1"/>'; G.appendChild(el);
        TR.push({ t: t, L: L, len: len, stops: stops, dir: j % 2 ? -1 : 1, si: Math.floor(Math.random() * stops.length), pos: 0, wait: Math.random() * 6, el: el }); }
    });
    TR.forEach(function (o) { o.pos = o.stops[o.si]; });
    function at(o, d) { var L = o.L, p = o.t.p, k = 1; while (k < L.length - 1 && L[k] < d) k++; var u = (d - L[k - 1]) / ((L[k] - L[k - 1]) || 1); return [p[k - 1][0] + u * (p[k][0] - p[k - 1][0]), p[k - 1][1] + u * (p[k][1] - p[k - 1][1]), Math.atan2(p[k][1] - p[k - 1][1], p[k][0] - p[k - 1][0]) * 57.3]; }
    var t0 = performance.now(), SPD = RM ? 6 : 22; // 地圖單位/秒（模擬）
    function frame(now) {
      var dt = Math.min(.1, (now - t0) / 1000); t0 = now; var h = tp().hour, off = h >= 1 && h < 6 && !Q.get('mrt');
      R.classList.toggle('on', night()); var wr = document.getElementById('cpw-root'); R.classList.toggle('wet', !!wr && /rain|typhoon/.test(wr.className));
      sim.textContent = off ? '🚇 捷運（模擬）：01:00–06:00 停駛' : '🚇 捷運行駛為「模擬」，非實時列車位置';
      TR.forEach(function (o) {
        if (!off) {
          if (o.wait > 0) o.wait -= dt; else {
            var ni = o.si + o.dir; if (ni < 0 || ni >= o.stops.length) { o.dir *= -1; ni = o.si + o.dir; }
            var tg = o.stops[ni], step = SPD * dt * o.dir; o.pos += step;
            if ((o.dir > 0 && o.pos >= tg) || (o.dir < 0 && o.pos <= tg)) { o.pos = tg; o.si = ni; o.wait = 6; }
          } }
        var q = at(o, o.pos); o.el.setAttribute('transform', 'translate(' + q[0].toFixed(1) + ' ' + q[1].toFixed(1) + ') rotate(' + q[2].toFixed(0) + ')'); o.el.style.opacity = off ? .35 : 1;
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();

/* AIVAULT 臺北衛星地圖 v1
 * 底圖：Google Maps JS API（mapTypeId 'hybrid'，金鑰執行時從 aivault-weather/config 取得，不寫死、不輸出）。
 *       預設：國土測繪中心 PHOTO2 正射影像＋EMAP12 標註（免費、零 Google 載入）；加 ?map=google 才載入 Google，兩者絕不同畫面混用。
 * 疊加：地標（HTML，向量文字）、捷運線與依班距模擬列車、松山機場起降模擬、公車／汽車／學生／行人模擬、
 *       我的位置（watchPosition）＋指南針（DeviceOrientation）——位置只在本機，不儲存、不上傳。
 * 3D：縮放 ≥ 15 時載入 js/aivault-taipei-satellite-3d.js（Three.js，Kenney CC0 骨架動畫人物與車輛）。
 * 不載入暗星、語音、天氣或任何寫入資料庫的程式。 */
(function () {
  'use strict';
  var D = window.AIVAULT_TPE_SAT, WALKS = window.AIVAULT_TPE_WALKS || [];
  if (!D) return;
  var Q = new URLSearchParams(location.search);
  var CFG = 'https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/aivault-weather/config';
  var MOB = /iPhone|iPad|Android/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 560;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CENTER = { lat: +(Q.get('lat') || 25.0560), lng: +(Q.get('lng') || 121.5400) }, Z0 = Q.get('z') ? +Q.get('z') : null, PI = Math.PI;
  var $ = function (id) { return document.getElementById(id); };
  var T = window.AIVAULT_TPE = { stats: {}, base: null };
  var SELF = (document.currentScript && document.currentScript.src) || location.href;

  /* ---------- 台北時間 ---------- */
  var HOUR_OVERRIDE = Q.get('hour') != null ? +Q.get('hour') : null;
  T.setHour = function (h) { HOUR_OVERRIDE = h == null ? null : +h; tick(); };
  var FMT = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
  function tpe() {
    var o = {}; FMT.formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
    var h = +o.hour % 24, m = +o.minute, s = +o.second, f = h + m / 60 + s / 3600 + (Date.now() % 1000) / 3.6e6;
    if (HOUR_OVERRIDE != null) f = HOUR_OVERRIDE + (f % 1) * 0; // 預覽：固定時段
    var wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[o.weekday];
    return { f: HOUR_OVERRIDE != null ? HOUR_OVERRIDE + (s + m * 60) / 3600 : f, wd: wd, weekend: wd === 0 || wd === 6, txt: o.hour + ':' + o.minute, day: '日一二三四五六'[wd] };
  }
  /* 模擬用秒數：以台北當日秒數為準（同一時間每個人看到的列車位置一致） */
  function simSec() { var t = tpe(); return t.f * 3600; }

  /* ---------- Web Mercator ---------- */
  function wx(lng) { return (lng + 180) / 360; }
  function wy(lat) { var s = Math.sin(lat * PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * PI); }
  function hav(a, b, c, d) { var x = (d - b) * PI / 180 * Math.cos((a + c) / 2 * PI / 180), y = (c - a) * PI / 180; return Math.hypot(x, y) * 6371000; }
  function prepPath(coords) { // coords: [[lng,lat],...]
    var X = [], Y = [], C = [0], L = 0;
    for (var i = 0; i < coords.length; i++) { X.push(wx(coords[i][0])); Y.push(wy(coords[i][1])); if (i) { L += hav(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]); C.push(L); } }
    return { X: X, Y: Y, C: C, L: L, lat: coords[0][1] };
  }
  function at(P, d) { // d：沿線距離（m）→ 世界座標＋方向
    if (d <= 0) d = 0; if (d >= P.L) d = P.L - 0.01;
    var lo = 0, hi = P.C.length - 1; while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (P.C[mid] <= d) lo = mid; else hi = mid; }
    var seg = (P.C[hi] - P.C[lo]) || 1, u = (d - P.C[lo]) / seg;
    return { x: P.X[lo] + (P.X[hi] - P.X[lo]) * u, y: P.Y[lo] + (P.Y[hi] - P.Y[lo]) * u, dx: P.X[hi] - P.X[lo], dy: P.Y[hi] - P.Y[lo] };
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
  var ease = { inOut: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }, out: function (t) { return 1 - Math.pow(1 - t, 3); }, inQ: function (t) { return t * t; } };

  /* ---------- 狀態列 ---------- */
  var stT = 0;
  function status(msg, err, keep) { var s = $('tpe-status'); s.textContent = msg; s.className = err ? 'err' : ''; s.style.opacity = 1; clearTimeout(stT); if (!keep) stT = setTimeout(function () { s.style.opacity = 0; }, 5000); }

  /* ---------- 底圖轉接層 ---------- */
  var A = null; // { kind, center(), zoom(), heading(), addEl(el,lat,lng), panTo(lat,lng,z), resetNorth(), onDrag(cb), onView(cb), destroy() }
  function freshMapDiv() { var old = $('tpe-map'), n = document.createElement('div'); n.id = 'tpe-map'; n.setAttribute('aria-label', '臺北衛星地圖'); old.parentNode.replaceChild(n, old); return n; }
  function loadScript(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = function () { no(new Error('載入失敗：' + src.split('?')[0])); }; document.head.appendChild(s); }); }
  function loadCss(href) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); }

  function getKey() {
    if (Q.get('map') !== 'google') return Promise.reject(new Error('免費底圖（預設；Google 需加 ?map=google）'));
    var ac = window.AbortController ? new AbortController() : null; if (ac) setTimeout(function () { ac.abort(); }, 8000);
    return fetch(CFG, { cache: 'no-store', signal: ac && ac.signal }).then(function (r) { if (!r.ok) throw new Error('金鑰設定讀取失敗 HTTP ' + r.status); return r.json(); })
      .then(function (j) { var k = j && (j.maps_js_key || j.map_tiles_key); if (!k) throw new Error('後端沒有 Google 金鑰'); return { key: k, mapId: Q.get('mapId') || j.map_id || '' }; });
  }

  function startGoogle(cfg) {
    return new Promise(function (ok, no) {
      var done = false, to = setTimeout(function () { if (!done) no(new Error('Google 地圖載入逾時')); }, 20000);
      window.gm_authFailure = function () { var e = new Error('Google 金鑰驗證失敗（請確認已啟用 Maps JavaScript API 與 HTTP 參照網址限制）'); if (!done) { done = true; no(e); } else fallback(e.message); };
      window.__aivTpeG = function () {
        try {
          var g = google.maps, el = freshMapDiv();
          var opt = { center: CENTER, zoom: Z0 || 13, mapTypeId: 'hybrid', gestureHandling: 'greedy', disableDefaultUI: true, zoomControl: !MOB, scaleControl: true, clickableIcons: false, keyboardShortcuts: true, tilt: 0, heading: 0, backgroundColor: '#0d1420' };
          if (cfg.mapId) opt.mapId = cfg.mapId;
          var map = new g.Map(el, opt);
          var ov = new g.OverlayView(), items = [], root = document.createElement('div'); root.className = 'tpe-ov'; root.style.position = 'absolute';
          ov.onAdd = function () { ov.getPanes().overlayMouseTarget.appendChild(root); };
          ov.draw = function () { var p = ov.getProjection(); if (!p) return; for (var i = 0; i < items.length; i++) { var it = items[i]; if (it.el.style.display === 'none') continue; var q = p.fromLatLngToDivPixel(new g.LatLng(it.lat, it.lng)); it.el.style.left = Math.round(q.x) + 'px'; it.el.style.top = Math.round(q.y) + 'px'; } };
          ov.onRemove = function () { root.remove(); };
          ov.setMap(map);
          A = {
            kind: 'google', map: map,
            center: function () { var c = map.getCenter(); return { lat: c.lat(), lng: c.lng() }; },
            zoom: function () { return map.getZoom(); },
            heading: function () { return map.getHeading ? (map.getHeading() || 0) : 0; },
            addEl: function (e, lat, lng) { var it = { el: e, lat: lat, lng: lng }; root.appendChild(e); items.push(it); ov.draw(); return { set: function (a, b) { it.lat = a; it.lng = b; ov.draw(); } }; },
            panTo: function (lat, lng, z) { map.panTo({ lat: lat, lng: lng }); if (z && map.getZoom() < z) map.setZoom(z); },
            resetNorth: function () { if (map.setHeading) map.setHeading(0); if (map.setTilt) map.setTilt(0); },
            onDrag: function (cb) { map.addListener('dragstart', cb); },
            onView: function (cb) { map.addListener('zoom_changed', cb); map.addListener('idle', cb); },
            renderingType: function () { return map.getRenderingType ? String(map.getRenderingType()) : 'UNKNOWN'; },
            destroy: function () { try { ov.setMap(null); } catch (e) { } }
          };
          T.base = 'google';
          g.event.addListenerOnce(map, 'tilesloaded', function () { if (!done) { done = true; clearTimeout(to); ok(); } });
        } catch (e) { if (!done) { done = true; no(e); } }
      };
      loadScript('https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(cfg.key) + '&v=weekly&language=zh-TW&region=TW&loading=async&callback=__aivTpeG')
        .catch(function (e) { if (!done) { done = true; no(e); } });
    });
  }

  function startNlsc(reason) {
    loadCss('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css');
    return loadScript('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js').then(function () {
      var el = freshMapDiv(), L = window.L;
      var map = L.map(el, { center: [CENTER.lat, CENTER.lng], zoom: Z0 || 13, maxZoom: 20, minZoom: 10, zoomControl: !MOB, attributionControl: true, zoomSnap: 0.25, wheelPxPerZoomLevel: 90 });
      var NL = '<a href="https://maps.nlsc.gov.tw/" target="_blank" rel="noopener">內政部國土測繪中心</a> 臺灣通用電子地圖正射影像（PHOTO2）／電子地圖透明圖層（EMAP12），依<a href="https://data.gov.tw/license" target="_blank" rel="noopener">政府資料開放授權條款－第1版</a>';
      L.tileLayer('https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}', { maxNativeZoom: 20, maxZoom: 20, attribution: NL }).addTo(map);
      L.tileLayer('https://wmts.nlsc.gov.tw/wmts/EMAP12/default/GoogleMapsCompatible/{z}/{y}/{x}', { maxNativeZoom: 19, maxZoom: 20, opacity: .95 }).addTo(map);
      L.control.scale({ imperial: false }).addTo(map);
      A = {
        kind: 'nlsc', map: map,
        center: function () { var c = map.getCenter(); return { lat: c.lat, lng: c.lng }; },
        zoom: function () { return map.getZoom(); }, heading: function () { return 0; },
        addEl: function (e, lat, lng) { var m = L.marker([lat, lng], { icon: L.divIcon({ className: 'tpe-div', html: '', iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(map); m.getElement().appendChild(e); e.style.left = '0px'; e.style.top = '0px'; return { set: function (a, b) { m.setLatLng([a, b]); } }; },
        panTo: function (lat, lng, z) { map.flyTo([lat, lng], Math.max(map.getZoom(), z || 0), { duration: .8, easeLinearity: .25 }); },
        resetNorth: function () { }, onDrag: function (cb) { map.on('dragstart', cb); },
        onView: function (cb) { map.on('zoom zoomend moveend', cb); },
        renderingType: function () { return 'RASTER（Leaflet）'; }, destroy: function () { map.remove(); }
      };
      T.base = 'nlsc';
      status('底圖：國土測繪中心正射影像＋電子地圖標註（' + reason + '）', false, false);
    });
  }

  var started = false;
  function fallback(reason) {
    if (T.base === 'nlsc') return;
    try { if (A) A.destroy(); } catch (e) { }
    A = null; started = false;
    startNlsc(reason).then(afterMap).catch(function (e) { status('地圖無法載入：' + e.message, true, true); });
  }

  /* ---------- 地標與捷運站 ---------- */
  var CAT = { must: { n: '重點地標', ic: '⭐' }, uni: { n: '大學', ic: '🎓' }, temple: { n: '廟宇', ic: '⛩️' }, night: { n: '夜市', ic: '🏮' } };
  var ICON = { '臺北松山機場 TSA': '✈️', '臺北市政府': '🏛️', '馬偕紀念醫院（台北院區）': '🏥' };
  var LINE = { R: ['淡水信義線', '#e3002c'], BL: ['板南線', '#0070bd'], BR: ['文湖線', '#c48c31'], O: ['中和新蘆線', '#f8b61c'], G: ['松山新店線', '#008659'], Y: ['環狀線', '#ffdb00'] };
  var LAYERS = { must: 1, uni: 1, temple: 1, night: 1, station: 1, trains: 1, buses: 1, cars: 1, students: 1, people: 1, flights: 1 };
  var LNAME = { must: '⭐ 重點地標', uni: '🎓 大學', temple: '⛩️ 廟宇', night: '🏮 夜市', station: '🚉 捷運站', trains: '🚇 列車（模擬）', buses: '🚌 公車（模擬）', cars: '🚗 汽車（模擬）', students: '🎒 學生（模擬）', people: '🚶 行人（模擬）', flights: '🛫 起降（模擬）' };
  var LM = [], ST = [];
  function makeMarkers() {
    LM = []; ST = [];
    D.landmarks.forEach(function (l) {
      var e = document.createElement('div'); e.className = 'lm ' + l.c;
      e.title = l.n + '\n座標來源：' + l.src + (l.chk ? '；交叉核對：' + l.chk : '') + (l.note ? '；' + l.note : '');
      e.innerHTML = '<span class="pin"><span class="ic">' + (ICON[l.n] || CAT[l.c].ic) + '</span><span class="t"></span></span>';
      e.querySelector('.t').textContent = l.n;
      A.addEl(e, l.lat, l.lng); LM.push({ el: e, d: l });
    });
    var seen = {};
    D.mrt.stations.forEach(function (s) {
      if (seen[s.n]) return; seen[s.n] = 1;
      var lc = 'R'; var best = 1e9; D.mrt.tracks.forEach(function (t) { t.p.forEach(function (q) { var dd = Math.abs(q[0] - s.p[0]) + Math.abs(q[1] - s.p[1]); if (dd < best) { best = dd; lc = t.l; } }); });
      var e = document.createElement('div'); e.className = 'st'; e.style.setProperty('--c', LINE[lc][1]); e.textContent = s.n;
      A.addEl(e, s.p[1], s.p[0]); ST.push(e);
    });
  }
  function refreshMarkers() {
    if (!A) return; var z = A.zoom(), t = tpe(), glow = t.f >= 17 && t.f < 24;
    LM.forEach(function (m) {
      var c = m.d.c, on = LAYERS[c];
      m.el.style.display = on ? '' : 'none';
      var small = c !== 'must' && z < (c === 'night' ? 13 : 14); m.el.classList.toggle('small', small);
      if (c === 'night') m.el.classList.toggle('glow', glow);
    });
    var sOn = LAYERS.station && z >= 14; ST.forEach(function (e) { e.style.display = sOn ? '' : 'none'; });
  }

  /* ---------- 模擬資料準備 ---------- */
  var TRK = [], BUS = [], CAR = [], SITES = [], RWY = null;
  // 班距（分鐘）：[平日尖峰 07:00–09:00/17:00–19:30, 平日離峰, 23:00 後, 例假日]
  // 來源：臺北捷運公司「路線及班距」(metro.taipei，115-08/09 更新)；環狀線：新北捷運 2025-08-01 公告（尖峰 4 分 50 秒、離峰 7 分 30 秒、夜間 10 分）
  var HW = { R: [6, 9, 13.5, 8.5], BL: [6, 8, 10, 8.5], BR: [3, 7, 12, 7], O: [6, 9.5, 12, 9.5], G: [5, 7, 12, 7], Y: [4.83, 7.5, 10, 7.5] };
  function headway(l) { var t = tpe(), h = t.f, v = HW[l]; if (!v || h < 6) return null; if (h >= 23) return v[2]; if (l === 'Y' && h >= 19.5) return v[2]; if (t.weekend) return v[3]; if ((h >= 7 && h < 9) || (h >= 17 && h < 19.5)) return v[0]; return v[1]; }
  function carDensity(h) { return h < 5 ? .08 : h < 7 ? .3 : h < 9.5 ? 1 : h < 17 ? .6 : h < 19.5 ? 1 : h < 23 ? .5 : .22; }
  function prep() {
    TRK = D.mrt.tracks.map(function (t) { var P = prepPath(t.p); P.l = t.l; P.seed = hash(t.l + t.p[0].join()) * 1e4; return P; }).filter(function (P) { return P.L > 400; });
    D.roads.forEach(function (r) { var P = prepPath(r.coords); P.n = r.name; P.seed = hash(r.name) * 1e4; (r.kind === 'bus' ? BUS : CAR).push(P); });
    var BC = ['#16a34a', '#dc2626', '#d97706', '#2563eb']; BUS.forEach(function (b, i) { b.color = BC[i % BC.length]; });
    SITES = WALKS.map(function (s) { return { n: s.n, k: s.k, paths: s.paths.map(prepPath).filter(function (P) { return P.L > 30; }) }; }).filter(function (s) { return s.paths.length; });
    var r = D.runway; RWY = { a: { x: wx(r.le[0]), y: wy(r.le[1]) }, b: { x: wx(r.he[0]), y: wy(r.he[1]) }, L: hav(r.le[1], r.le[0], r.he[1], r.he[0]), lat: r.le[1] };
  }

  /* ---------- 每幀模擬：產生實體清單（世界座標） ---------- */
  var BUDGET = MOB ? 420 : 1100, BMAX = BUDGET, ENT = [];
  function simulate() {
    var t = tpe(), h = t.f, S = simSec(), E = [];
    function push(o) { E.push(o); }
    // 捷運：依班距推算，雙向；均速約 10 m/s（含停站）
    if (LAYERS.trains) TRK.forEach(function (P) {
      var hw = headway(P.l); if (!hw) return; var v = 10, sp = hw * 60 * v, n = Math.ceil(P.L / sp) + 1;
      for (var dir = 0; dir < 2; dir++) for (var k = 0; k < n; k++) {
        var d = ((S * v + k * sp + P.seed + dir * sp / 2) % (n * sp)); if (d > P.L) continue;
        var q = at(P, dir ? P.L - d : d); push({ t: 'train', x: q.x, y: q.y, dx: dir ? -q.dx : q.dx, dy: dir ? -q.dy : q.dy, c: LINE[P.l][1], side: dir ? 1 : -1, lat: P.lat });
      }
    });
    // 公車：尖峰 6 分、離峰 10 分；05:30–23:30
    if (LAYERS.buses && h >= 5.5 && h < 23.5) BUS.forEach(function (P) {
      var hw = ((h >= 7 && h < 9.5) || (h >= 17 && h < 19.5)) ? 6 : 10, v = 5, sp = hw * 60 * v, n = Math.ceil(P.L / sp) + 1;
      for (var dir = 0; dir < 2; dir++) for (var k = 0; k < n; k++) { var d = (S * v + k * sp + P.seed + dir * 777) % (n * sp); if (d > P.L) continue; var q = at(P, dir ? P.L - d : d); push({ t: 'bus', x: q.x, y: q.y, dx: dir ? -q.dx : q.dx, dy: dir ? -q.dy : q.dy, c: P.color, side: dir ? 1 : -1, lat: P.lat, label: P.n }); }
    });
    // 汽車：密度隨時段（尖峰最密）
    if (LAYERS.cars) { var dens = carDensity(h); CAR.concat(BUS).forEach(function (P) {
      var gap = 55 / dens, v = dens > .8 ? 5.5 : 9, n = Math.max(1, Math.floor(P.L / gap));
      for (var dir = 0; dir < 2; dir++) for (var k = 0; k < n; k++) { var jit = hash(P.n + k + dir) * gap, d = (S * v * (0.85 + hash(P.n + 'v' + k) * .3) + k * gap + jit + dir * 31) % (n * gap); if (d > P.L) continue; var q = at(P, dir ? P.L - d : d); push({ t: 'car', x: q.x, y: q.y, dx: dir ? -q.dx : q.dx, dy: dir ? -q.dy : q.dy, v: (k + dir * 3) % 6, side: dir ? 1 : -1, lat: P.lat }); }
    }); }
    // 學生（平日 07:30–17:30）與行人
    var school = !t.weekend && h >= 7.5 && h < 17.5;
    SITES.forEach(function (s) {
      var n = 0, kind = 'people';
      if (s.k === 'school') { if (!LAYERS.students || !school) return; n = MOB ? 6 : 10; kind = 'student'; }
      else { if (!LAYERS.people) return; n = s.k === 'night' ? (h >= 17 ? (MOB ? 10 : 16) : (h >= 11 ? 3 : 0)) : s.k === 'shop' ? (h >= 10 && h < 22.5 ? (MOB ? 8 : 12) : 1) : (h >= 6 ? (MOB ? 4 : 7) : 0); }
      for (var i = 0; i < n; i++) {
        var P = s.paths[i % s.paths.length], v = 1.1 + hash(s.n + i) * .5, ph = hash(s.n + 'p' + i) * P.L * 2, d = (S * v + ph) % (2 * P.L), back = d > P.L, dd = back ? 2 * P.L - d : d;
        var q = at(P, dd); push({ t: kind, x: q.x, y: q.y, dx: back ? -q.dx : q.dx, dy: back ? -q.dy : q.dy, v: Math.floor(hash(s.n + 'm' + i) * 6), side: (hash(s.n + 's' + i) - .5) * 2, lat: P.lat, ph: (S * v / .7) % (2 * PI) });
      }
    });
    // 松山機場：06:00–23:00 每 7.5 分鐘一次起降（起飛／降落交替），使用跑道 10（向東）
    if (LAYERS.flights && h >= 6 && h < 23) {
      var per = 450, idx = Math.floor(S / per), u = (S % per);
      var ax = RWY.a.x, ay = RWY.a.y, bx = RWY.b.x, by = RWY.b.y, ux = (bx - ax), uy = (by - ay);
      if (idx % 2 === 0) { // 降落：自西方 8 km 進場 → 接地 → 減速滑行
        if (u < 150) { var mPerW = RWY.L, far = 8000 / mPerW, p, alt;
          if (u < 105) { var k2 = ease.inOut(u / 105); p = -far + (far + .12) * k2; alt = Math.max(0, 1 - k2 * 1.02) * 450; }
          else { var k3 = ease.out((u - 105) / 45); p = .12 + .5 * k3; alt = 0; }
          push({ t: 'plane', x: ax + ux * p, y: ay + uy * p, dx: ux, dy: uy, alt: alt, lat: RWY.lat, op: u > 140 ? (150 - u) / 10 : 1, label: '降落（模擬）' }); }
      } else { // 起飛：跑道 10 起滾加速 → 抬頭 → 爬升離場
        if (u < 120) { var p2, alt2;
          if (u < 38) { var k4 = ease.inQ(u / 38); p2 = .02 + .6 * k4; alt2 = 0; }
          else { var k5 = (u - 38) / 82; p2 = .62 + k5 * 3.4; alt2 = Math.pow(k5, 1.3) * 900; }
          push({ t: 'plane', x: ax + ux * p2, y: ay + uy * p2, dx: ux, dy: uy, alt: alt2, lat: RWY.lat, op: u < 4 ? u / 4 : u > 110 ? (120 - u) / 10 : 1, label: '起飛（模擬）' }); }
      }
    }
    ENT = E; return E;
  }

  /* ---------- 繪製（2D 畫布：遠景點；3D 模組：近景模型） ---------- */
  var cv = $('tpe-fx'), cx = cv.getContext('2d'), DPR = Math.min(devicePixelRatio || 1, 3);
  function fit() { DPR = Math.min(devicePixelRatio || 1, 3); cv.width = Math.round(innerWidth * DPR); cv.height = Math.round(innerHeight * DPR); if (T3) T3.resize(); }
  addEventListener('resize', fit); fit();
  function view() { var c = A.center(), z = A.zoom(); return { z: z, s: 256 * Math.pow(2, z), cx: wx(c.lng), cy: wy(c.lat), w: innerWidth, h: innerHeight }; }
  function scr(V, x, y) { return [(x - V.cx) * V.s + V.w / 2, (y - V.cy) * V.s + V.h / 2]; }
  function mpp(V, lat) { return 40075016.7 * Math.cos(lat * PI / 180) / V.s; } // 每像素公尺
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  var CARC = ['#e5e7eb', '#f59e0b', '#111827', '#ef4444', '#3b82f6', '#9ca3af'];
  var T3 = null, T3loading = false, T3fail = false;
  function want3d(z) { return z >= 15 && !Q.get('no3d'); }
  function draw(V, E) {
    cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.clearRect(0, 0, V.w, V.h);
    var use3d = want3d(V.z) && T3, list3 = [], drawn = 0, M = 60;
    // 我的位置誤差圈
    if (ME && ME.acc) { var p0 = scr(V, wx(ME.lng), wy(ME.lat)), r0 = ME.acc / mpp(V, ME.lat); cx.beginPath(); cx.arc(p0[0], p0[1], Math.max(r0, 6), 0, 2 * PI); cx.fillStyle = 'rgba(47,124,246,.16)'; cx.fill(); cx.lineWidth = 1.5; cx.strokeStyle = 'rgba(47,124,246,.55)'; cx.stroke(); }
    for (var i = 0; i < E.length && drawn < BUDGET; i++) {
      var e = E[i], p = scr(V, e.x, e.y); if (p[0] < -M || p[1] < -M || p[0] > V.w + M || p[1] > V.h + M) continue;
      var ang = Math.atan2(e.dy, e.dx), m = mpp(V, e.lat), nx = -Math.sin(ang), ny = Math.cos(ang);
      var lane = e.t === 'train' ? 3.5 / m + 2 : e.t === 'bus' || e.t === 'car' ? 3 / m + 1.5 : e.t === 'plane' ? 0 : e.side * 2 / m;
      e.sx = p[0] + nx * lane * (e.side > 0 ? 1 : -1) * (e.t === 'student' || e.t === 'people' ? 0 : 1) + (e.t === 'student' || e.t === 'people' ? nx * lane : 0); e.sy = p[1] + ny * lane * (e.side > 0 ? 1 : -1) * (e.t === 'student' || e.t === 'people' ? 0 : 1) + (e.t === 'student' || e.t === 'people' ? ny * lane : 0);
      e.ang = ang; e.m = m; drawn++;
      var human = e.t === 'student' || e.t === 'people';
      if (use3d && (human ? V.z >= 16 : true)) { list3.push(e); cx.beginPath(); cx.ellipse(e.sx, e.sy + 1, human ? 5 : 7, human ? 2.2 : 3, 0, 0, 2 * PI); cx.fillStyle = 'rgba(0,0,0,.22)'; cx.fill(); continue; }
      cx.save(); cx.translate(e.sx, e.sy);
      if (human) { cx.beginPath(); cx.arc(0, 0, V.z >= 15 ? 3.2 : 2.4, 0, 2 * PI); cx.fillStyle = e.t === 'student' ? 'rgba(96,165,250,.95)' : 'rgba(255,214,120,.95)'; cx.shadowColor = 'rgba(0,0,0,.5)'; cx.shadowBlur = 3; cx.fill(); }
      else if (e.t === 'plane') {
        var sc = Math.max(1, 34 / m / 40) * (1 + e.alt / 900 * .6), k = Math.max(16, 37 / m) * (1 + e.alt / 1500);
        cx.globalAlpha = Math.max(0, Math.min(1, e.op));
        cx.save(); cx.translate(e.alt / 60, e.alt / 45); cx.rotate(ang); cx.fillStyle = 'rgba(0,0,0,.28)'; planePath(cx, k); cx.fill(); cx.restore();
        cx.rotate(ang); cx.fillStyle = '#fff'; cx.strokeStyle = '#1f2937'; cx.lineWidth = 1; planePath(cx, k); cx.fill(); cx.stroke();
      } else {
        cx.rotate(ang); var Lp = e.t === 'train' ? Math.max(14, 60 / m) : e.t === 'bus' ? Math.max(7, 12 / m) : Math.max(4, 4.5 / m), Wp = e.t === 'train' ? Math.max(4.5, 3.2 / m) : e.t === 'bus' ? Math.max(3.5, 2.6 / m) : Math.max(2.6, 1.9 / m);
        cx.shadowColor = 'rgba(0,0,0,.45)'; cx.shadowBlur = 3; rr(cx, -Lp / 2, -Wp / 2, Lp, Wp, Wp / 2); cx.fillStyle = e.t === 'car' ? CARC[e.v] : e.c; cx.fill();
        if (e.t !== 'car') { cx.shadowBlur = 0; cx.lineWidth = 1; cx.strokeStyle = 'rgba(255,255,255,.9)'; cx.stroke(); }
      }
      cx.restore();
    }
    T.stats.drawn = drawn; T.stats.total = E.length;
    if (want3d(V.z)) { if (!T3 && !T3loading && !T3fail) load3d(); if (T3) T3.render(V, list3, performance.now()); }
    else if (T3) T3.render(V, [], performance.now());
  }
  function planePath(c, k) { c.beginPath(); var s = k / 40; c.moveTo(20 * s, 0); c.quadraticCurveTo(18 * s, -2.2 * s, 12 * s, -2.4 * s); c.lineTo(2 * s, -2.6 * s); c.lineTo(-4 * s, -17 * s); c.lineTo(-8 * s, -17 * s); c.lineTo(-5 * s, -2.6 * s); c.lineTo(-14 * s, -2.2 * s); c.lineTo(-18 * s, -7 * s); c.lineTo(-20 * s, -7 * s); c.lineTo(-18.5 * s, 0); c.lineTo(-20 * s, 7 * s); c.lineTo(-18 * s, 7 * s); c.lineTo(-14 * s, 2.2 * s); c.lineTo(-5 * s, 2.6 * s); c.lineTo(-8 * s, 17 * s); c.lineTo(-4 * s, 17 * s); c.lineTo(2 * s, 2.6 * s); c.lineTo(12 * s, 2.4 * s); c.quadraticCurveTo(18 * s, 2.2 * s, 20 * s, 0); c.closePath(); }
  function load3d() {
    T3loading = true;
    import(new URL('aivault-taipei-satellite-3d.js?v=v1', SELF).href).then(function (m) { return m.create({ dpr: Math.min(devicePixelRatio || 1, MOB ? 2 : 2.5), mobile: MOB, reduced: RM }); })
      .then(function (t3) { T3 = t3; T3loading = false; T.stats.three = 'ready'; })
      .catch(function (e) { T3fail = true; T3loading = false; T.stats.three = 'fail: ' + e.message; console.warn('3D 模型載入失敗，改用 2D', e); });
  }

  /* ---------- 捷運線（2D 畫布底層，向量線，任何縮放都銳利） ---------- */
  var lineCv = document.createElement('canvas'); lineCv.id = 'tpe-lines'; lineCv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:4';
  document.body.appendChild(lineCv); var lx = lineCv.getContext('2d');
  function drawLines(V) {
    lineCv.width = cv.width; lineCv.height = cv.height; lx.setTransform(DPR, 0, 0, DPR, 0, 0); lx.lineCap = 'round'; lx.lineJoin = 'round';
    var w = V.z >= 16 ? 6 : V.z >= 14 ? 4.5 : 3;
    if (LAYERS.trains || LAYERS.station) TRK.concat([]).forEach(function (P) {
      lx.beginPath(); for (var i = 0; i < P.X.length; i++) { var p = scr(V, P.X[i], P.Y[i]); if (i) lx.lineTo(p[0], p[1]); else lx.moveTo(p[0], p[1]); }
      lx.strokeStyle = 'rgba(255,255,255,.85)'; lx.lineWidth = w + 2.5; lx.stroke(); lx.strokeStyle = LINE[P.l][1]; lx.lineWidth = w; lx.stroke();
    });
    // 松山機場跑道 10/28 標示
    if (LAYERS.flights && RWY && V.z >= 13) { var a = scr(V, RWY.a.x, RWY.a.y), b = scr(V, RWY.b.x, RWY.b.y); lx.setLineDash([10, 8]); lx.strokeStyle = 'rgba(255,255,255,.75)'; lx.lineWidth = 2; lx.beginPath(); lx.moveTo(a[0], a[1]); lx.lineTo(b[0], b[1]); lx.stroke(); lx.setLineDash([]);
      lx.font = '700 12px system-ui,"PingFang TC",sans-serif'; lx.fillStyle = '#fff'; lx.strokeStyle = 'rgba(0,0,0,.7)'; lx.lineWidth = 3; ['10', '28'].forEach(function (t, i) { var q = i ? b : a; lx.strokeText(t, q[0] - 8, q[1] + 18); lx.fillText(t, q[0] - 8, q[1] + 18); }); }
  }

  /* ---------- 我的位置＋指南針（只在本機） ---------- */
  var ME = null, meH = null, meEl = null, FOLLOW = false, HD = null, HDcur = null, watchId = null;
  function meMarker() {
    meEl = document.createElement('div'); meEl.className = 'me';
    meEl.innerHTML = '<svg class="cone" viewBox="-60 -60 120 120"><defs><radialGradient id="tpeCone" cx="0" cy="0" r="60" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2f7cf6" stop-opacity=".55"/><stop offset="1" stop-color="#2f7cf6" stop-opacity="0"/></radialGradient></defs><path d="M0 0 L-26 -55 A60 60 0 0 1 26 -55 Z" fill="url(#tpeCone)"/></svg><div class="dot"></div>';
    meH = A.addEl(meEl, ME.lat, ME.lng);
  }
  function onPos(p) {
    var first = !ME; ME = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, gh: p.coords.heading };
    if (!meEl) meMarker(); else meH.set(ME.lat, ME.lng);
    if (HD == null && ME.gh != null && !isNaN(ME.gh)) HD = ME.gh;
    if (first) { A.panTo(ME.lat, ME.lng, 17); status('已取得位置（誤差約 ' + Math.round(ME.acc) + ' m）。位置只在本機使用，不儲存、不上傳。'); }
    else if (FOLLOW) A.panTo(ME.lat, ME.lng);
  }
  function onErr(e) { status('無法取得位置：' + (e.code === 1 ? '你拒絕了定位權限' : e.code === 2 ? '目前無法定位' : '定位逾時') + '（可在瀏覽器設定重新允許）', true); }
  function onOrient(e) {
    var hd = null;
    if (e.webkitCompassHeading != null && !isNaN(e.webkitCompassHeading)) hd = e.webkitCompassHeading; // iOS
    else if ((e.absolute || e.type === 'deviceorientationabsolute') && e.alpha != null) hd = (360 - e.alpha) % 360; // Android
    if (hd == null) return;
    var so = (screen.orientation && screen.orientation.angle) || window.orientation || 0; HD = (hd + so + 360) % 360;
  }
  var orientOn = false;
  function listenOrient() { if (orientOn) return; orientOn = true; if ('ondeviceorientationabsolute' in window) addEventListener('deviceorientationabsolute', onOrient); addEventListener('deviceorientation', onOrient); }
  T.mockOrient = onOrient; // 測試用（送入假事件）
  function startLocate() {
    if (!window.isSecureContext) return status('定位需要 HTTPS 頁面', true);
    if (!navigator.geolocation) return status('此瀏覽器不支援定位', true);
    // iOS 13+：必須在使用者點按當下要求方向權限
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(function (s) { if (s === 'granted') listenOrient(); else status('未允許指南針方向（可再點 📍 重試）', true); }).catch(function () { });
    } else listenOrient();
    if (watchId == null) watchId = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
    status('正在取得位置…（只在本機使用）');
  }
  function dirName(d) { return ['北', '東北', '東', '東南', '南', '西南', '西', '西北'][Math.round(d / 45) % 8]; }

  /* ---------- 介面 ---------- */
  function ui() {
    var tg = $('tpe-toggles'); tg.innerHTML = '';
    Object.keys(LAYERS).forEach(function (k) { var l = document.createElement('label'), c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!LAYERS[k]; c.onchange = function () { LAYERS[k] = c.checked ? 1 : 0; refreshMarkers(); }; l.appendChild(c); l.appendChild(document.createTextNode(LNAME[k])); tg.appendChild(l); });
    $('b-panel').onclick = function () { var p = $('tpe-panel'); p.hidden = !p.hidden; if (!p.hidden) hwPanel(); };
    $('b-loc').onclick = startLocate;
    $('b-follow').onclick = function () { FOLLOW = !FOLLOW; this.setAttribute('aria-pressed', FOLLOW); if (FOLLOW) { if (!ME) startLocate(); else A.panTo(ME.lat, ME.lng, 17); status('跟隨我：開（拖動地圖即關閉）'); } else status('跟隨我：關'); };
    $('b-north').onclick = function () { if (A) A.resetNorth(); status(HD != null ? '地圖已朝正北；你目前面向 ' + Math.round(HD) + '°（' + dirName(HD) + '）' : '地圖已朝正北（尚未取得裝置方向：請先點 📍 並允許方向權限）'); };
    var at = $('tpe-attr');
    at.innerHTML = (T.base === 'google' ? '底圖：Google 衛星混合圖（版權標示見地圖右下角）。' : '') +
      '地標：© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors（ODbL）與維基百科座標交叉核對。捷運班距：臺北捷運公司、新北捷運公司官網公告。捷運線形：臺北市政府捷運工程局開放資料（簡化）。步行與道路路徑：OSRM／routing.openstreetmap.de（OSM）。跑道：OurAirports。3D 人物與車輛：Kenney（CC0）。3D 引擎：three.js（MIT）。';
  }
  function hwPanel() {
    var el = $('tpe-headway'), t = tpe(), h = '';
    Object.keys(LINE).forEach(function (l) { var v = headway(l); h += '<div><i style="background:' + LINE[l][1] + '"></i>' + LINE[l][0] + '：' + (v ? '約 ' + (v % 1 ? v.toFixed(1) : v) + ' 分一班' : '收班（06:00 首班）') + '</div>'; });
    el.innerHTML = h + '<div style="color:#9fb3cc">依官方公告班距模擬，非即時列車位置。' + (t.weekend ? '（例假日）' : '（平日）') + '</div>';
  }
  function tick() {
    var t = tpe(); $('tpe-clock').textContent = '台北 ' + (HOUR_OVERRIDE != null ? String(Math.floor(HOUR_OVERRIDE)).padStart(2, '0') + ':00（預覽時段）' : t.txt) + ' 週' + t.day + (T.base ? ' · ' + (T.base === 'google' ? 'Google 衛星' : '國土測繪中心影像') : '');
    refreshMarkers(); if (!$('tpe-panel').hidden) hwPanel();
  }

  /* ---------- 主迴圈 ---------- */
  var last = performance.now(), fN = 0, fT = last, FPS = 60;
  function frame(now) {
    if (A) { var V = view(); if (V.z != null && !isNaN(V.cx)) { drawLines(V); draw(V, simulate()); } if (HD != null && meEl) { HDcur = HDcur == null ? HD : HDcur + (((HD - HDcur + 540) % 360) - 180) * Math.min(1, (now - last) / 1000 * 6); meEl.classList.add('hd'); meEl.querySelector('.cone').style.transform = 'rotate(' + (HDcur - A.heading()) + 'deg)'; $('needle').style.transform = 'rotate(' + (-A.heading()) + 'deg)'; } }
    fN++; if (now - fT > 2000) { FPS = fN * 1000 / (now - fT); fN = 0; fT = now; if (FPS < 45 && BUDGET > 80) BUDGET = Math.round(BUDGET * .75); else if (FPS > 57 && BUDGET < BMAX) BUDGET = Math.min(BMAX, Math.round(BUDGET * 1.15) + 10); T.stats.fps = Math.round(FPS); T.stats.budget = BUDGET; T.stats.zoom = A && A.zoom(); }
    last = now; requestAnimationFrame(frame);
  }
  function afterMap() {
    if (started) return; started = true; T._A = A;
    makeMarkers(); ui(); tick(); A.onView(refreshMarkers); A.onDrag(function () { if (FOLLOW) { FOLLOW = false; $('b-follow').setAttribute('aria-pressed', 'false'); status('跟隨我：已關閉（你拖動了地圖）'); } });
    if (ME) { meEl = null; meMarker(); }
    if (T.base === 'google') status('底圖：Google 衛星混合圖（hybrid）· 繪製：' + A.renderingType());
    T.stats.rendering = A.renderingType && A.renderingType();
  }
  prep(); setInterval(tick, 30 * 1000); requestAnimationFrame(frame);
  getKey().then(startGoogle).then(afterMap).catch(function (e) { fallback(e.message || String(e)); });
})();

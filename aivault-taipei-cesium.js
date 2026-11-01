/* AIVAULT 同步協作池・版本 C（?map=cesium）：CesiumJS（Apache-2.0，jsDelivr CDN）＋ OpenStreetMap 圖磚（© OpenStreetMap contributors, ODbL）。
   不用 Cesium ion token、不用 Google 3D Tiles、無付費服務：底圖 OSM 圖磚、地形平面（EllipsoidTerrain）、
   建物＝信義區真實輪廓（data.taipei 建築執照套繪圖）擠出，依高度/樓層彩色、夜間亮燈；其餘區域程式生成彩色樓房示意。
   疊上：8+3 地標、幹道路名、捷運（模擬）、行人（通用小人，非協作池角色）、天氣/節慶/101 煙火（沿用 HTML 覆蓋層）、風車。 */
(function () {
  var D = window.AIVAULT_TAIPEI_MAP; if (!D || window.__aivaultCesium) return; window.__aivaultCesium = 1;
  window.AIVAULT_MAP_MODE = 'cesium';
  var Q = new URLSearchParams(location.search), MOB = Math.min(innerWidth, innerHeight) < 500;
  var V = '1.122.0', CDN = 'https://cdn.jsdelivr.net/npm/cesium@' + V + '/Build/Cesium/';
  window.CESIUM_BASE_URL = CDN;
  var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = CDN + 'Widgets/widgets.css'; document.head.appendChild(css);
  var st = document.createElement('style'); st.textContent = '#cpc-root{position:fixed;inset:0;z-index:2147482900}#cpw-lamps,#cpw-turb,#cpw-sock,#cpw-dark,#cpw-cloud{display:none!important}.cesium-viewer-bottom{z-index:2147483006}';
  document.head.appendChild(st);
  var sc = document.createElement('script'); sc.src = CDN + 'Cesium.js'; sc.onload = start; sc.onerror = function () { var s2 = document.createElement('script'); s2.src = 'aivault-taipei-map.js?v=m1'; document.head.appendChild(s2); }; document.head.appendChild(sc);
  function inv(u, v) { return [D.lon0 + u / D.w * (D.lon1 - D.lon0), D.lat1 - v / D.h * (D.lat1 - D.lat0)]; }
  function night() { var r = document.getElementById('cpw-root'); if (r) return r.classList.contains('night'); var h = +new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hourCycle: 'h23' }).format(new Date()); return h < 6 || h >= 18; }
  function start() {
    var C = window.Cesium, root = document.createElement('div'); root.id = 'cpc-root'; document.body.insertBefore(root, document.body.firstChild);
    var vw = new C.Viewer(root, { baseLayer: new C.ImageryLayer(new C.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' })), terrainProvider: new C.EllipsoidTerrainProvider(),
      animation: false, timeline: false, geocoder: false, homeButton: false, sceneModePicker: false, baseLayerPicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false, selectionIndicator: false, requestRenderMode: false });
    vw.resolutionScale = Q.get('res') === 'low' ? .5 : MOB ? .75 : Math.min(devicePixelRatio || 1, 1.5);
    vw.scene.globe.enableLighting = false; vw.scene.skyAtmosphere.show = true; vw.scene.fog.enabled = true;
    var cam = (Q.get('cam') || '25.030,121.548,2600').split(',').map(Number);
    vw.camera.setView({ destination: C.Cartesian3.fromDegrees(cam[1], cam[0] - cam[2] / 111000 * 1.4, cam[2]), orientation: { heading: 0, pitch: C.Math.toRadians(-38), roll: 0 } });
    var E = vw.entities, BLD = [];
    function hcol(f) { var t = Math.min(1, f / 40); return C.Color.fromHsl(.08 + t * .5, .45, .62 - t * .15, 1); }
    // 信義區真實建物
    (window.AIVAULT_XINYI_BLD || []).forEach(function (b) { var pos = []; for (var i = 1; i < b.length; i += 2) { var g = inv(b[i], b[i + 1]); pos.push(g[0], g[1]); }
      var h = Math.max(4, b[0] * 3.3), col = hcol(b[0]); BLD.push({ e: E.add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray(pos), height: 0, extrudedHeight: h, material: col, outline: false } }), c: col }); });
    // 其他區程式生成彩色樓房（示意）
    var PAL = ['#b5523b', '#f3ead8', '#c9ced3', '#7fb3b8', '#6fa3c7', '#8fc1b5', '#e8c38a', '#d9a07a'], N = MOB ? 250 : 700;
    for (var i = 0; i < N; i++) { var lon = 121.505 + Math.random() * .06, lat = 25.020 + Math.random() * .045; if (lon > 121.552 && lat < 25.046 && lat > 25.024) continue; var w = 0.00012 + Math.random() * .0002, hh = 8 + Math.random() * (Math.random() < .15 ? 90 : 30), col = C.Color.fromCssColorString(PAL[i % PAL.length]);
      BLD.push({ e: E.add({ polygon: { hierarchy: C.Cartesian3.fromDegreesArray([lon, lat, lon + w, lat, lon + w, lat + w * .8, lon, lat + w * .8]), height: 0, extrudedHeight: hh, material: col } }), c: col }); }
    // 地標（程式建模）
    function tower(n, lat, lon, parts, labelH) { var y = 0; parts.forEach(function (p) { E.add({ position: C.Cartesian3.fromDegrees(lon, lat, y + p[1] / 2), box: { dimensions: new C.Cartesian3(p[0], p[0], p[1]), material: C.Color.fromCssColorString(p[2]) } }); y += p[1]; });
      E.add({ position: C.Cartesian3.fromDegrees(lon, lat, (labelH || y) + 30), label: { text: n, font: 'bold 20px "PingFang TC",sans-serif', fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 4, style: C.LabelStyle.FILL_AND_OUTLINE, disableDepthTestDistance: Number.POSITIVE_INFINITY } }); return y; }
    var t101 = [[60, 40, '#5f7d8c']]; for (var k = 0; k < 8; k++) t101.push([50, 45, '#6f93a3']); t101.push([25, 40, '#6f93a3'], [5, 60, '#aabbcc']);
    tower('台北101', 25.0340, 121.5645, t101); tower('南山廣場', 25.0335, 121.5660, [[45, 200, '#9fb4c4'], [30, 60, '#b8c9d6']]); tower('陶朱隱園', 25.0377, 121.5671, [[40, 90, '#8fbf7a']]);
    tower('臺北市政府', 25.0375, 121.5637, [[140, 50, '#cfd6dc']]); tower('中正紀念堂', 25.0346, 121.5217, [[90, 15, '#e9ecef'], [55, 40, '#f8f9fa'], [60, 25, '#1d4ed8']]);
    tower('總統府', 25.0400, 121.5119, [[130, 30, '#b5523b'], [25, 60, '#b5523b']]); tower('圓山大飯店', 25.0787, 121.5265, [[160, 40, '#b91c1c'], [170, 15, '#f2b705'], [100, 20, '#b91c1c'], [110, 12, '#f2b705']]);
    tower('北門 承恩門', 25.0478, 121.5111, [[30, 15, '#9c4a32'], [24, 12, '#3b2b25']]); tower('南門 麗正門', 25.0327, 121.5137, [[30, 12, '#b8a48a'], [28, 10, '#5a4636']]); tower('小南門 重熙門', 25.0371, 121.5079, [[24, 10, '#b8a48a'], [22, 8, '#2f8f4e']]);
    // 道路＋路名、捷運
    D.roads.forEach(function (r) { var pos = []; r.p.forEach(function (q) { var g = inv(q[0], q[1]); pos.push(g[0], g[1]); }); var ev = r.t !== 'ar';
      E.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(pos), width: r.t === 'fw' ? 7 : ev ? 6 : 5, material: C.Color.fromCssColorString(r.t === 'fw' ? '#e07b2e' : ev ? '#f2c14e' : '#ffffff').withAlpha(.85), clampToGround: true } });
      var m = r.p[Math.floor(r.p.length / 2)], g = inv(m[0], m[1]); E.add({ position: C.Cartesian3.fromDegrees(g[0], g[1], 40), label: { text: r.n, font: 'bold 18px "PingFang TC",sans-serif', fillColor: C.Color.WHITE, showBackground: true, backgroundColor: C.Color.fromCssColorString(r.t === 'fw' ? '#0b6e3c' : ev ? '#1f4e9c' : '#191c24').withAlpha(.85), disableDepthTestDistance: Number.POSITIVE_INFINITY, scaleByDistance: new C.NearFarScalar(800, 1.2, 9000, .5) } }); });
    var TR = [];
    D.mrt.tracks.forEach(function (t) { var pos = []; t.p.forEach(function (q) { var g = inv(q[0], q[1]); pos.push(g[0], g[1]); }); var col = C.Color.fromCssColorString(D.mrt.colors[t.l]);
      E.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(pos), width: 4, material: col, clampToGround: true } });
      var L = [0]; for (var i = 1; i < t.p.length; i++) L.push(L[i - 1] + Math.hypot(t.p[i][0] - t.p[i - 1][0], t.p[i][1] - t.p[i - 1][1])); if (L[L.length - 1] < 25) return;
      for (var j = 0; j < 2; j++) (function (o) { o.e = E.add({ position: new C.CallbackProperty(function () { return o.pos; }, false), box: { dimensions: new C.Cartesian3(120, 30, 25), material: col }, orientation: new C.CallbackProperty(function () { return o.ori; }, false) }); TR.push(o); })({ t: t, L: L, d: j ? L[L.length - 1] : 0, dir: j ? -1 : 1, wait: 0, pos: C.Cartesian3.fromDegrees(0, 0), ori: C.Quaternion.IDENTITY }); });
    function at(P, L, d) { var i = 1; while (i < L.length - 1 && L[i] < d) i++; var u = (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return [P[i - 1][0] + u * (P[i][0] - P[i - 1][0]), P[i - 1][1] + u * (P[i][1] - P[i - 1][1]), Math.atan2(P[i][1] - P[i - 1][1], P[i][0] - P[i - 1][0])]; }
    // 行人（通用小人）沿幹道
    var ROADS = D.roads.filter(function (r) { return r.t === 'ar'; }).map(function (r) { var L = [0]; for (var i = 1; i < r.p.length; i++) L.push(L[i - 1] + Math.hypot(r.p[i][0] - r.p[i - 1][0], r.p[i][1] - r.p[i - 1][1])); return { p: r.p, L: L }; });
    var PEO = [], PC = ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#8e44ad', '#ffb703'];
    for (var i2 = 0; i2 < (MOB ? 60 : 160); i2++) (function (o) { o.e = E.add({ position: new C.CallbackProperty(function () { return o.pos; }, false), cylinder: { length: 18, topRadius: 4, bottomRadius: 4, material: C.Color.fromCssColorString(PC[i2 % PC.length]) } }); PEO.push(o); })({ r: ROADS[i2 % ROADS.length], d: Math.random() * 100, dir: Math.random() < .5 ? 1 : -1, side: Math.random() < .5 ? 1 : -1, pos: C.Cartesian3.fromDegrees(0, 0) });
    var last = performance.now(), sim = document.createElement('div'); sim.style.cssText = 'position:fixed;left:8px;bottom:40px;z-index:2147483004;font:12px system-ui,"PingFang TC",sans-serif;color:#fff;background:rgba(10,14,28,.7);padding:4px 9px;border-radius:10px;pointer-events:none';
    sim.textContent = '版本 C：CesiumJS＋OSM 圖磚（無 ion token）｜捷運與行人為「模擬」'; document.body.appendChild(sim);
    var wasN = null;
    vw.scene.preRender.addEventListener(function () { var now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now; var Nn = night();
      if (Nn !== wasN) { wasN = Nn; vw.imageryLayers.get(0).brightness = Nn ? .35 : 1; BLD.forEach(function (b) { b.e.polygon.material = Nn ? C.Color.lerp(b.c, C.Color.fromCssColorString('#ffd27a'), .45, new C.Color()) : b.c; }); }
      TR.forEach(function (o) { var Lm = o.L[o.L.length - 1]; if (o.wait > 0) o.wait -= dt; else { o.d += o.dir * 20 * dt; if (o.d > Lm || o.d < 0) { o.dir *= -1; o.d = Math.max(0, Math.min(Lm, o.d)); o.wait = 5; } }
        var q = at(o.t.p, o.L, o.d), g = inv(q[0], q[1]); o.pos = C.Cartesian3.fromDegrees(g[0], g[1], 14); o.ori = C.Transforms.headingPitchRollQuaternion(o.pos, new C.HeadingPitchRoll(q[2], 0, 0)); });
      PEO.forEach(function (o) { var Lm = o.r.L[o.r.L.length - 1]; o.d += o.dir * 1.2 * dt; if (o.d > Lm || o.d < 0) o.dir *= -1; var q = at(o.r.p, o.r.L, Math.max(0, Math.min(Lm, o.d))), g = inv(q[0] - Math.sin(q[2]) * 1.2 * o.side, q[1] + Math.cos(q[2]) * 1.2 * o.side); o.pos = C.Cartesian3.fromDegrees(g[0], g[1], 9); });
    });
    window.AIVAULT_mapPoint = function (lat, lon) { var p = C.SceneTransforms.worldToWindowCoordinates ? C.SceneTransforms.worldToWindowCoordinates(vw.scene, C.Cartesian3.fromDegrees(lon, lat, 300)) : C.SceneTransforms.wgs84ToWindowCoordinates(vw.scene, C.Cartesian3.fromDegrees(lon, lat, 300)); return p ? [p.x, p.y] : [innerWidth / 2, innerHeight / 3]; };
    window.AIVAULT_CESIUM = vw;
  }
})();

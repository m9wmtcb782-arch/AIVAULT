/* AIVAULT 同步協作池・版本 D（?map=google）：CesiumJS ＋ Google Photorealistic 3D Tiles（Map Tiles API）。
   金鑰不在 repo：從後端 aivault-weather GET /config 取得 {map_tiles_key}（Supabase Secret GOOGLE_MAP_TILES_KEY，只回允許的 Origin；金鑰另有 Referer 限制）。
   取不到 → 顯示「Google 3D 未啟用」並退回版本 B（?map=3d）。
   配額：root.json 每次載入最多請求 1 次；內容（含 session）存 sessionStorage 約 2.5 小時重用。showCreditsOnScreen 必開、globe.show=false。
   疊加：路名、捷運（模擬）、行人（通用小人）、地標名、風車＋風向魚（經緯度＋高程放置）、天氣/節慶/101 煙火（HTML 覆蓋層）。 */
(function () {
  var D = window.AIVAULT_TAIPEI_MAP; if (!D || window.__aivaultGoogle) return; window.__aivaultGoogle = 1;
  window.AIVAULT_MAP_MODE = 'google';
  var API = 'https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/aivault-weather/config', ROOT = 'https://tile.googleapis.com/v1/3dtiles/root.json';
  var Q = new URLSearchParams(location.search), MOB = Math.min(innerWidth, innerHeight) < 500, CDN = 'https://cdn.jsdelivr.net/npm/cesium@1.122.0/Build/Cesium/', SK = 'aivault_g3d_root', TTL = 2.5 * 3600 * 1000;
  var st = document.createElement('style'); st.textContent = '#cpg-root{position:fixed;inset:0;z-index:2147482900;background:#0b1226}#cpw-lamps,#cpw-turb,#cpw-sock,#cpw-dark,#cpw-cloud{display:none!important}.cesium-viewer-bottom{z-index:2147483006}#cpg-note{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147483007;background:#7a1d18;color:#fff;font:13px system-ui,"PingFang TC",sans-serif;padding:6px 12px;border-radius:10px}';
  document.head.appendChild(st);
  function fallback(why) { var n = document.createElement('div'); n.id = 'cpg-note'; n.textContent = 'Google 3D 未啟用（' + why + '），已改用版本 B'; document.body.appendChild(n); window.AIVAULT_MAP_MODE = '3d';
    ['aivault-taipei-xinyi-buildings.js?v=x1', 'aivault-taipei-3d.js?v=3d7'].reduce(function (p, src) { return p.then(function () { return new Promise(function (ok) { var s = document.createElement('script'); s.src = src; s.onload = s.onerror = ok; document.head.appendChild(s); }); }); }, Promise.resolve()); }
  function getKey() { if (window.__AIVAULT_LOCAL_TILES_KEY) return Promise.resolve(window.__AIVAULT_LOCAL_TILES_KEY); // 僅本機測試注入，不在 repo
    return fetch(API, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('後端 ' + r.status); return r.json(); }).then(function (j) { if (!j || !j.map_tiles_key) throw new Error('無金鑰'); return j.map_tiles_key; }); }
  function getRoot(key) { try { var c = JSON.parse(sessionStorage.getItem(SK) || 'null'); if (c && Date.now() - c.t < TTL) return Promise.resolve(c.j); } catch (e) {}
    return fetch(ROOT + '?key=' + encodeURIComponent(key)).then(function (r) { if (!r.ok) throw new Error('root ' + r.status); return r.json(); }).then(function (j) {
      (function abs(t) { if (t.content && t.content.uri && t.content.uri[0] === '/') t.content.uri = 'https://tile.googleapis.com' + t.content.uri; (t.children || []).forEach(abs); })(j.root);
      try { sessionStorage.setItem(SK, JSON.stringify({ t: Date.now(), j: j })); } catch (e) {} return j; }); }
  function loadCesium() { return new Promise(function (ok, no) { window.CESIUM_BASE_URL = CDN; var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CDN + 'Widgets/widgets.css'; document.head.appendChild(l); var s = document.createElement('script'); s.src = CDN + 'Cesium.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
  function inv(u, v) { return [D.lon0 + u / D.w * (D.lon1 - D.lon0), D.lat1 - v / D.h * (D.lat1 - D.lat0)]; }
  function night() { var r = document.getElementById('cpw-root'); if (r) return r.classList.contains('night'); var h = +new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hourCycle: 'h23' }).format(new Date()); return h < 6 || h >= 18; }
  getKey().then(function (key) { return Promise.all([key, getRoot(key), loadCesium()]); }).then(function (a) { start(a[0], a[1]); }).catch(function (e) { fallback(String(e && e.message || e).replace(/key=[^&\s]+/g, 'key=***')); });
  function start(key, rootJson) {
    var C = window.Cesium, root = document.createElement('div'); root.id = 'cpg-root'; document.body.insertBefore(root, document.body.firstChild);
    var vw = new C.Viewer(root, { baseLayer: false, terrainProvider: new C.EllipsoidTerrainProvider(), animation: false, timeline: false, geocoder: false, homeButton: false, sceneModePicker: false, baseLayerPicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false, selectionIndicator: false, showRenderLoopErrors: false });
    vw.scene.globe.show = false; vw.scene.skyAtmosphere.show = true; vw.resolutionScale = Q.get('res') === 'low' ? .5 : MOB ? .75 : Math.min(devicePixelRatio || 1, 1.5);
    var rj = JSON.parse(JSON.stringify(rootJson)); (function addKey(t) { if (t.content && t.content.uri) t.content.uri += (t.content.uri.indexOf('?') < 0 ? '?' : '&') + 'key=' + encodeURIComponent(key); (t.children || []).forEach(addKey); })(rj.root); // 金鑰只在記憶體，不存 sessionStorage
    var blob = URL.createObjectURL(new Blob([JSON.stringify(rj)], { type: 'application/json' }));
    var dark = new C.CustomShader({ uniforms: { u_k: { type: C.UniformType.FLOAT, value: 1 } }, fragmentShaderText: 'void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material){ material.diffuse *= u_k; }' });
    C.Cesium3DTileset.fromUrl(blob, { showCreditsOnScreen: true, maximumScreenSpaceError: MOB ? 24 : 12, customShader: dark }).then(function (ts) { vw.scene.primitives.add(ts); }).catch(function () { fallback('圖磚載入失敗'); });
    var cam = (Q.get('cam') || '25.0335,121.5650,1100').split(',').map(Number);
    vw.camera.setView({ destination: C.Cartesian3.fromDegrees(cam[1], cam[0] - cam[2] / 111000 * 1.2, cam[2]), orientation: { heading: 0, pitch: C.Math.toRadians(-40), roll: 0 } });
    var E = vw.entities, HB = 45; // 台北盆地地面約在橢球面上 +20~45 m（Google tiles 為橢球高）
    D.roads.forEach(function (r) { var pos = []; r.p.forEach(function (q) { var g = inv(q[0], q[1]); pos.push(g[0], g[1], HB + 2); }); var ev = r.t !== 'ar';
      E.add({ polyline: { positions: C.Cartesian3.fromDegreesArrayHeights(pos), width: 3, material: C.Color.fromCssColorString(r.t === 'fw' ? '#e07b2e' : ev ? '#f2c14e' : '#ffffff').withAlpha(.55) } });
      var m = r.p[Math.floor(r.p.length / 2)], g = inv(m[0], m[1]); E.add({ position: C.Cartesian3.fromDegrees(g[0], g[1], HB + 60), label: { text: r.n, font: 'bold 18px "PingFang TC",sans-serif', fillColor: C.Color.WHITE, showBackground: true, backgroundColor: C.Color.fromCssColorString(r.t === 'fw' ? '#0b6e3c' : ev ? '#1f4e9c' : '#191c24').withAlpha(.85), disableDepthTestDistance: Number.POSITIVE_INFINITY, scaleByDistance: new C.NearFarScalar(500, 1.2, 8000, .5) } }); });
    [['台北101', 25.0340, 121.5645, 560], ['南山廣場', 25.0335, 121.5660, 320], ['陶朱隱園', 25.0377, 121.5671, 150], ['臺北市政府', 25.0375, 121.5637, 110], ['中正紀念堂', 25.0346, 121.5217, 120], ['總統府', 25.0400, 121.5119, 120], ['圓山大飯店', 25.0787, 121.5265, 150], ['北門', 25.0478, 121.5111, 70], ['南門', 25.0327, 121.5137, 70], ['小南門', 25.0371, 121.5079, 70]].forEach(function (l) {
      E.add({ position: C.Cartesian3.fromDegrees(l[2], l[1], l[3]), label: { text: l[0], font: 'bold 20px "PingFang TC",sans-serif', fillColor: C.Color.YELLOW, outlineColor: C.Color.BLACK, outlineWidth: 4, style: C.LabelStyle.FILL_AND_OUTLINE, disableDepthTestDistance: Number.POSITIVE_INFINITY } }); });
    function at(P, L, d) { var i = 1; while (i < L.length - 1 && L[i] < d) i++; var u = (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return [P[i - 1][0] + u * (P[i][0] - P[i - 1][0]), P[i - 1][1] + u * (P[i][1] - P[i - 1][1]), Math.atan2(P[i][1] - P[i - 1][1], P[i][0] - P[i - 1][0])]; }
    function lens(P) { var L = [0]; for (var i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return L; }
    var TR = [];
    D.mrt.tracks.forEach(function (t) { var pos = []; t.p.forEach(function (q) { var g = inv(q[0], q[1]); pos.push(g[0], g[1], HB + 4); }); var col = C.Color.fromCssColorString(D.mrt.colors[t.l]);
      E.add({ polyline: { positions: C.Cartesian3.fromDegreesArrayHeights(pos), width: 4, material: col.withAlpha(.8) } }); var L = lens(t.p); if (L[L.length - 1] < 25) return;
      for (var j = 0; j < 2; j++) (function (o) { o.e = E.add({ position: new C.CallbackProperty(function () { return o.pos; }, false), orientation: new C.CallbackProperty(function () { return o.ori; }, false), box: { dimensions: new C.Cartesian3(110, 14, 12), material: col } }); TR.push(o); })({ t: t, L: L, d: j ? L[L.length - 1] : 0, dir: j ? -1 : 1, wait: 0, pos: C.Cartesian3.fromDegrees(0, 0), ori: C.Quaternion.IDENTITY }); });
    var ROADS = D.roads.filter(function (r) { return r.t === 'ar'; }).map(function (r) { return { p: r.p, L: lens(r.p) }; }), PEO = [], PC = ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#8e44ad', '#ffb703'];
    for (var i = 0; i < (MOB ? 60 : 160); i++) (function (o, k) { o.e = E.add({ position: new C.CallbackProperty(function () { return o.pos; }, false), point: { pixelSize: 7, color: C.Color.fromCssColorString(PC[k % PC.length]), outlineColor: C.Color.WHITE, outlineWidth: 1.5, disableDepthTestDistance: Number.POSITIVE_INFINITY } }); PEO.push(o); })({ r: ROADS[i % ROADS.length], d: Math.random() * 100, dir: Math.random() < .5 ? 1 : -1, side: Math.random() < .5 ? 1 : -1, pos: C.Cartesian3.fromDegrees(0, 0) }, i);
    // 風車＋風向魚（象山附近，經緯度＋高程）
    var TL = [121.5770, 25.0270, 230], hub = C.Cartesian3.fromDegrees(TL[0], TL[1], TL[2] + 60), bladeA = 0;
    E.add({ position: C.Cartesian3.fromDegrees(TL[0], TL[1], TL[2] + 30), cylinder: { length: 60, topRadius: 1.5, bottomRadius: 2.5, material: C.Color.WHITE } });
    for (var b = 0; b < 3; b++) (function (bb) { E.add({ position: hub, orientation: new C.CallbackProperty(function () { var w = window.AIVAULT_WEATHER_STATE || {}; return C.Transforms.headingPitchRollQuaternion(hub, new C.HeadingPitchRoll(C.Math.toRadians((w.wind_dir_deg || 225) - 90), 0, bladeA + bb * 2.094)); }, false), box: { dimensions: new C.Cartesian3(1, 2, 36), material: C.Color.WHITESMOKE } }); })(b);
    var sock = C.Cartesian3.fromDegrees(TL[0] + .0004, TL[1], TL[2] + 28);
    E.add({ position: C.Cartesian3.fromDegrees(TL[0] + .0004, TL[1], TL[2] + 14), cylinder: { length: 28, topRadius: .5, bottomRadius: .5, material: C.Color.GRAY } });
    E.add({ position: sock, orientation: new C.CallbackProperty(function () { var w = window.AIVAULT_WEATHER_STATE || {}, lift = Math.min(1, (w.wind_speed_ms || 2) / 10); return C.Transforms.headingPitchRollQuaternion(sock, new C.HeadingPitchRoll(C.Math.toRadians((w.wind_dir_deg || 225) + 180 - 90), -(1 - lift) * 1.2, 0)); }, false), cylinder: { length: 14, topRadius: 1, bottomRadius: 3, material: C.Color.fromCssColorString('#e8453c') } });
    E.add({ position: C.Cartesian3.fromDegrees(TL[0], TL[1], TL[2] + 110), label: { text: '風車・風向魚', font: '16px "PingFang TC",sans-serif', fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, disableDepthTestDistance: Number.POSITIVE_INFINITY } });
    var last = performance.now(), sim = document.createElement('div'); sim.style.cssText = 'position:fixed;left:8px;bottom:56px;z-index:2147483004;font:12px system-ui,"PingFang TC",sans-serif;color:#fff;background:rgba(10,14,28,.7);padding:4px 9px;border-radius:10px;pointer-events:none';
    sim.textContent = '版本 D：Google Photorealistic 3D Tiles｜捷運與行人為「模擬」'; document.body.appendChild(sim);
    vw.scene.preRender.addEventListener(function () { var now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now; var N = night(), wx = (document.getElementById('cpw-root') || {}).className || '';
      dark.setUniform('u_k', N ? .32 : /rain|typhoon/.test(wx) ? .75 : 1); vw.scene.skyAtmosphere.brightnessShift = N ? -.8 : 0;
      var w = window.AIVAULT_WEATHER_STATE || {}; bladeA += Math.min(w.wind_speed_ms || 2, 25) * dt * .4;
      TR.forEach(function (o) { var Lm = o.L[o.L.length - 1]; if (o.wait > 0) o.wait -= dt; else { o.d += o.dir * 20 * dt; if (o.d > Lm || o.d < 0) { o.dir *= -1; o.d = Math.max(0, Math.min(Lm, o.d)); o.wait = 5; } } var q = at(o.t.p, o.L, o.d), g = inv(q[0], q[1]); o.pos = C.Cartesian3.fromDegrees(g[0], g[1], HB + 10); o.ori = C.Transforms.headingPitchRollQuaternion(o.pos, new C.HeadingPitchRoll(q[2], 0, 0)); });
      PEO.forEach(function (o) { var Lm = o.r.L[o.r.L.length - 1]; o.d += o.dir * 1.2 * dt; if (o.d > Lm || o.d < 0) o.dir *= -1; var q = at(o.r.p, o.r.L, Math.max(0, Math.min(Lm, o.d))), g = inv(q[0] - Math.sin(q[2]) * 1.2 * o.side, q[1] + Math.cos(q[2]) * 1.2 * o.side); o.pos = C.Cartesian3.fromDegrees(g[0], g[1], HB + 3); }); });
    window.AIVAULT_mapPoint = function (lat, lon) { var p = C.SceneTransforms.worldToWindowCoordinates(vw.scene, C.Cartesian3.fromDegrees(lon, lat, 420)); return p ? [p.x, p.y] : [innerWidth / 2, innerHeight / 3]; };
  }
})();

/* AIVAULT 同步協作池・臺北 3D 地圖場景 v1（Three.js r160，MIT，jsDelivr CDN；全部程式建模，無付費/版權模型）
   地形：aivault-taipei-height.png（AWS Terrain Tiles DEM，高度×1.6 誇張）；區界、河流、道路（高架有高度）、捷運（模擬行駛）、
   8 個低多邊形地標（101、中正紀念堂、圓山飯店、市政府、總統府、北門、南門、小南門）、日夜光影、路燈點光源、雨/颱風粒子、風車、風向魚、101 跨年煙火。
   iPhone：DPR≤1.5、無陰影、粒子上限、路燈點光源上限 6；無 WebGL → 退回 2D（aivault-taipei-map.js）。啟用 ?map=3d。
   協作池原有人物：本檔提供 window.AIVAULT_3D.addSprite(img, path) billboard 介面，未更動人物外觀；尚未接上私有頁人物資料。 */
(function () {
  var D = window.AIVAULT_TAIPEI_MAP; if (!D || window.__aivault3d) return; window.__aivault3d = 1;
  var Q = new URLSearchParams(location.search), RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOB = /iPhone|iPad|Android/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 500;
  var base = (document.currentScript && document.currentScript.src || '').replace(/[^\/]*$/, '');
  function hasGL() { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
  function fallback2D() { var s = document.createElement('script'); s.src = base + 'aivault-taipei-map.js?v=m1'; document.head.appendChild(s); }
  if (!hasGL()) return fallback2D();
  window.AIVAULT_MAP_MODE = '3d';
  var hide = document.createElement('style'); hide.textContent = '#cpw-lamps,#cpw-turb,#cpw-sock,#cpw-dark,#cpw-cloud{display:none!important}'; // 3D 場景內已有路燈點光源、風車、風向魚、日夜
  (document.head || document.documentElement).appendChild(hide);
  function tp() { var o = {}; new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date()).forEach(function (x) { o[x.type] = +x.value; }); return o; }
  function night() { var r = document.getElementById('cpw-root'); if (r) return r.classList.contains('night'); var h = tp().hour; return h < 6 || h >= 18; }
  function weather() { var r = document.getElementById('cpw-root'); return r ? (r.className.match(/clear|cloudy|heavy_rain|rain|typhoon/) || ['clear'])[0] : 'clear'; }
  function wind() { var w = window.AIVAULT_WEATHER_STATE; return w ? [w.wind_dir_deg || 0, w.wind_speed_ms || 0] : [225, 2]; }
  var BGU = null; Promise.all([import('https://cdn.jsdelivr.net/npm/three@0.160.0/+esm'), import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js/+esm')
    .catch(function () { return null; }), import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js/+esm').catch(function () { return null; })]).then(function (m) { BGU = m[2]; start(m[0], m[1] && m[1].OrbitControls); }).catch(fallback2D);
  function start(T, Orbit) {
    var W0 = D.w, H0 = D.h, EX = 1.6, MPU = 22.3; // 1 地圖單位 ≈ 22.3 m
    var root = document.createElement('div'); root.id = 'cp3-root'; root.style.cssText = 'position:fixed;inset:0;z-index:2147482900;background:#9cc6dd';
    document.body.insertBefore(root, document.body.firstChild);
    var R = new T.WebGLRenderer({ antialias: !MOB, powerPreference: 'low-power' }); var TIERS = [2, 1.5, 1, .75, .5], LOW = Q.get('res') === 'low', ti = LOW ? 4 : TIERS.indexOf(MOB ? 1.5 : 2); if (ti < 0) ti = 1; while (TIERS[ti] > (devicePixelRatio || 1) && ti < 2) ti++;
    R.setPixelRatio(TIERS[ti]); if (LOW || Q.get('pixel') === '1') R.domElement.style.imageRendering = 'pixelated'; /* 低解析＋nearest 放大（像素風） */ R.setSize(innerWidth, innerHeight); root.appendChild(R.domElement);
    var S = new T.Scene(); S.fog = new T.Fog(0x9cc6dd, 900, 2600);
    var C = new T.PerspectiveCamera(45, innerWidth / innerHeight, 1, 6000); C.position.set(110, 230, 560);
    var ctl = Orbit ? new Orbit(C, R.domElement) : null; if (ctl) { ctl.target.set(-10, 0, 270); ctl.maxPolarAngle = 1.35; ctl.minDistance = 60; ctl.maxDistance = 1800; ctl.enableDamping = true; ctl.update(); } else C.lookAt(-10, 0, 270);
    addEventListener('resize', function () { R.setSize(innerWidth, innerHeight); C.aspect = innerWidth / innerHeight; C.updateProjectionMatrix(); });
    var sun = new T.DirectionalLight(0xffe2b0, 1.9); sun.position.set(-500, 800, 300); S.add(sun); var amb = new T.HemisphereLight(0xfff1dc, 0x4a5a33, .85); S.add(amb);
    var img = new Image(); img.crossOrigin = 'anonymous'; img.onload = build; img.onerror = function () { build(null); }; img.src = base + 'aivault-taipei-height.png';
    var HM = null, hw = 0, hh = 0;
    function hAt(u, v) { if (!HM) return 0; var x = Math.max(0, Math.min(hw - 1, u / W0 * hw | 0)), y = Math.max(0, Math.min(hh - 1, v / H0 * hh | 0)); return HM[(y * hw + x) * 4] / 255 * 1100 / MPU * EX; }
    function V(u, v, dy) { return new T.Vector3(u - W0 / 2, hAt(u, v) + (dy || 0), v - H0 / 2); }
    function line(pts, color, dy, width) { var g = new T.BufferGeometry().setFromPoints(dense(pts).map(function (p) { return V(p[0], p[1], dy); })); return new T.Line(g, new T.LineBasicMaterial({ color: color, linewidth: width || 1 })); }
    function dense(p) { var o = []; for (var i = 1; i < p.length; i++) { var a = p[i - 1], b = p[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6)); for (var k = 0; k < n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } o.push(p[p.length - 1]); return o; }
    function ribbon(pts, w, color, dy, piers) { // 有寬度的道路/河/高架
      var P = dense(pts), pos = [], idx = [];
      for (var i = 0; i < P.length; i++) { var a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2;
        var y = hAt(P[i][0], P[i][1]) + dy; pos.push(P[i][0] + nx - W0 / 2, y, P[i][1] + nz - H0 / 2, P[i][0] - nx - W0 / 2, y, P[i][1] - nz - H0 / 2);
        if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i); }
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      var m = new T.Mesh(g, new T.MeshStandardMaterial({ color: color, side: T.DoubleSide, roughness: .9 })); S.add(m);
      if (piers) for (i = 0; i < P.length; i += 4) { var pc = new T.Mesh(PIER, PIERM); var hv = hAt(P[i][0], P[i][1]); pc.scale.y = dy; pc.position.set(P[i][0] - W0 / 2, hv + dy / 2, P[i][1] - H0 / 2); S.add(pc); }
      return m;
    }
    var PIER = new T.CylinderGeometry(.6, .6, 1, 5), PIERM = new T.MeshStandardMaterial({ color: 0x9a9a9a });
    function build() {
      if (img.naturalWidth) { var cv = document.createElement('canvas'); hw = cv.width = img.naturalWidth; hh = cv.height = img.naturalHeight; var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); try { HM = cx.getImageData(0, 0, hw, hh).data; } catch (e) { HM = null; } }
      var seg = MOB ? 120 : 200, g = new T.PlaneGeometry(W0, H0, seg, Math.round(seg * H0 / W0)); g.rotateX(-Math.PI / 2);
      var p = g.attributes.position; for (var i = 0; i < p.count; i++) p.setY(i, hAt(p.getX(i) + W0 / 2, p.getZ(i) + H0 / 2)); g.computeVertexNormals();
      var tex = new T.TextureLoader().load(base + 'aivault-taipei-terrain.jpg'); tex.colorSpace = T.SRGBColorSpace;
      S.add(new T.Mesh(g, new T.MeshStandardMaterial({ map: tex, roughness: 1 })));
      D.districts.forEach(function (d) { d.d.split('M').filter(Boolean).forEach(function (r) { var pts = r.replace('Z', '').split('L').map(function (s) { return s.trim().split(' ').map(Number); }); pts.push(pts[0]); S.add(line(pts, 0x7a3c1a, 1.5)); }); label(d.name, d.cx, d.cy, 26, '#3b2a17'); });
      D.rivers.forEach(function (r) { ribbon(r.p, r.n === '淡水河' ? 14 : r.n === '景美溪' ? 6 : 9, 0x4f9fd6, .6); });
      D.roads.forEach(function (r) { var ev = r.t !== 'ar'; ribbon(r.p, r.t === 'fw' ? 5 : r.t === 'ev' ? 4 : 3, r.t === 'fw' ? 0xe07b2e : r.t === 'ev' ? 0xf2c14e : 0xf4f4f4, ev ? 4 : .8, ev); roadLabels(r, ev); });
      D.mrt.tracks.forEach(function (t) { S.add(line(t.p, D.mrt.colors[t.l], 2.2)); });
      D.mountains.forEach(function (m) { label('⛰ ' + m.n, m.p[0], m.p[1], 16, '#2e4a1f', 14); });
      landmarks(); lamps(); trains(); weatherFx(); turbine(); fireworks(); people(); mini(); camParam();
      R.setAnimationLoop(loop);
    }
    function roadLabels(r, ev) { // 主動標所有幹道路名：每 ~110 地圖單位一個大字牌，永遠面向鏡頭
      var P = dense(r.p), n = Math.max(1, Math.round(P.length * 6 / 110));
      for (var i = 0; i < n; i++) { var q = P[Math.floor((i + .5) / n * (P.length - 1))]; roadSign(r.n, q[0], q[1], ev ? 14 : 8, r.t); } }
    function roadSign(t, u, v, dy, kind) { var c = document.createElement('canvas'), x = c.getContext('2d'); c.width = 320; c.height = 80;
      var bg = kind === 'fw' ? '#0b6e3c' : kind === 'ev' ? '#1f4e9c' : 'rgba(25,28,36,.82)'; x.font = '800 44px "PingFang TC","Noto Sans TC",sans-serif';
      var w = Math.min(310, x.measureText(t).width + 30); x.fillStyle = bg; x.beginPath(); x.roundRect ? x.roundRect((320 - w) / 2, 6, w, 66, 14) : x.rect((320 - w) / 2, 6, w, 66); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 3; x.stroke();
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText(t, 160, 56);
      var sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false, transparent: true })); sp.scale.set(36, 9, 1); sp.position.copy(V(u, v, dy + 4)); sp.renderOrder = 6; S.add(sp); return sp; }
    function label(t, u, v, size, color, dy) { var c = document.createElement('canvas'), x = c.getContext('2d'); c.width = 256; c.height = 64; x.font = '700 30px "PingFang TC","Noto Sans TC",sans-serif'; x.textAlign = 'center'; x.lineWidth = 6; x.strokeStyle = 'rgba(255,255,255,.9)'; x.strokeText(t, 128, 42); x.fillStyle = color; x.fillText(t, 128, 42);
      var s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(size * 4, size, 1); s.position.copy(V(u, v, (dy || 8) + 4)); s.renderOrder = 5; S.add(s); return s; }
    function P(lat, lon) { return [(lon - D.lon0) / (D.lon1 - D.lon0) * W0, (D.lat1 - lat) / (D.lat1 - D.lat0) * H0]; }
    var WIN = [], WINM = new T.MeshStandardMaterial({ color: 0x334455, emissive: 0x000000 });
    function box(g, w, h, d, c, x, y, z) { var m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ color: c, flatShading: true })); m.position.set(x || 0, (y || 0) + h / 2, z || 0); g.add(m); return m; }
    function roof(g, w, d, h, c, y, pyr) { var m = new T.Mesh(pyr ? new T.ConeGeometry(w * .72, h, pyr) : new T.ConeGeometry(w * .75, h, 4), new T.MeshStandardMaterial({ color: c, flatShading: true })); m.rotation.y = Math.PI / 4; m.scale.z = d / w; m.position.y = y + h / 2; g.add(m); return m; }
    function win(g, w, h, x, y, z) { var m = new T.Mesh(new T.PlaneGeometry(w, h), WINM); m.position.set(x, y, z); g.add(m); WIN.push(m); }
    var L101 = null;
    function landmarks() {
      var K = 1.6, defs = [
        ['台北101', 25.0340, 121.5645, function (g) { box(g, 9, 6, 9, 0x5f7d8c); for (var i = 0; i < 8; i++) { var m = new T.Mesh(new T.CylinderGeometry(4.6, 3.6, 6, 4), new T.MeshStandardMaterial({ color: 0x6f93a3, flatShading: true })); m.rotation.y = Math.PI / 4; m.position.y = 9 + i * 6; g.add(m); win(g, 4, 1.4, 0, 9 + i * 6, 3.4); } box(g, 4, 4, 4, 0x6f93a3, 0, 57); var s = new T.Mesh(new T.CylinderGeometry(.3, .5, 12, 5), new T.MeshStandardMaterial({ color: 0xaabbcc })); s.position.y = 67; g.add(s); L101 = g; }],
        ['中正紀念堂', 25.0346, 121.5217, function (g) { box(g, 22, 3, 22, 0xe9ecef); box(g, 13, 10, 13, 0xf8f9fa, 0, 3); win(g, 3, 6, 0, 7, 6.6); roof(g, 15, 15, 4, 0x1d4ed8, 13, 8); box(g, 9, 3, 9, 0xf8f9fa, 0, 17); roof(g, 10, 10, 6, 0x1d4ed8, 20, 8); }],
        ['圓山大飯店', 25.0787, 121.5265, function (g) { box(g, 30, 8, 9, 0xb91c1c); win(g, 26, 1.5, 0, 5, 4.6); roof(g, 32, 11, 4, 0xf2b705, 8); box(g, 18, 4, 6, 0xb91c1c, 0, 11); roof(g, 20, 8, 3, 0xf2b705, 15); }],
        ['臺北市政府', 25.0375, 121.5637, function (g) { box(g, 20, 9, 14, 0xcfd6dc); win(g, 18, 1.2, 0, 4, 7.1); win(g, 18, 1.2, 0, 7, 7.1); box(g, 5, 4, 5, 0xcfd6dc, 0, 9); }],
        ['總統府', 25.0400, 121.5119, function (g) { box(g, 26, 7, 8, 0xb5523b); win(g, 24, 1.2, 0, 4, 4.1); box(g, 5, 18, 5, 0xb5523b, 0, 7); win(g, 1.6, 6, 0, 15, 2.6); roof(g, 5, 5, 3, 0x8c3b2a, 25); }],
        ['北門 承恩門', 25.0478, 121.5111, function (g) { box(g, 9, 4, 7, 0x9c4a32); box(g, 7, 4, 5, 0xa5523a, 0, 4); win(g, 1.4, 1.4, -1.8, 6, 2.6); win(g, 1.4, 1.4, 1.8, 6, 2.6); roof(g, 9, 7, 2, 0x3b2b25, 8); }],
        ['南門 麗正門', 25.0327, 121.5137, function (g) { box(g, 9, 4, 7, 0xb8a48a); box(g, 6, 3, 4, 0xf3e6cc, 0, 4); win(g, 4, 1.2, 0, 5.5, 2.1); roof(g, 9, 7, 2.6, 0x5a4636, 7); }],
        ['小南門 重熙門', 25.0371, 121.5079, function (g) { box(g, 7, 3, 5, 0xb8a48a); box(g, 4.5, 2.5, 3, 0xf3e6cc, 0, 3); win(g, 3, 1, 0, 4.3, 1.6); roof(g, 7, 5, 2.2, 0x2f8f4e, 5.5); }]];
      defs.forEach(function (d) { var g = new T.Group(), p = P(d[1], d[2]); d[3](g); g.scale.setScalar(K); g.position.copy(V(p[0], p[1], 0)); S.add(g); label(d[0], p[0], p[1], 13, '#111', d[0] === '台北101' ? 72 : 26); });
    }
    var LAMPS = [], LAMPM = new T.MeshStandardMaterial({ color: 0x555555, emissive: 0 });
    function lamps() { // 沿幹道放路燈；點光源上限（iPhone 4，桌機 8）其餘只發光
      var n = 0, maxL = MOB ? 4 : 8;
      D.roads.filter(function (r) { return r.t === 'ar'; }).forEach(function (r) { dense(r.p).forEach(function (q, i) { if (i % 6) return;
        var pole = new T.Mesh(new T.CylinderGeometry(.25, .25, 6, 4), PIERM), bulb = new T.Mesh(new T.SphereGeometry(.9, 6, 4), LAMPM);
        var v = V(q[0] + 2.5, q[1], 0); pole.position.copy(v).add(new T.Vector3(0, 3, 0)); bulb.position.copy(v).add(new T.Vector3(0, 6.3, 0)); S.add(pole); S.add(bulb);
        if (n++ % 4 === 0 && LAMPS.length < maxL) { var pl = new T.PointLight(0xffd38a, 0, 60, 1.6); pl.position.copy(bulb.position); S.add(pl); LAMPS.push(pl); } }); });
    }
    var TR = [], CARM = {};
    function trains() {
      D.mrt.tracks.forEach(function (t) { var P = dense(t.p); if (P.length < 6) return; var c = D.mrt.colors[t.l];
        CARM[t.l] = CARM[t.l] || new T.MeshStandardMaterial({ color: c, emissive: 0x000000 });
        var stops = []; D.mrt.stations.forEach(function (s) { var bi = -1, bd = 6; P.forEach(function (q, i) { var d = Math.hypot(q[0] - s.p[0], q[1] - s.p[1]); if (d < bd) { bd = d; bi = i; } }); if (bi >= 0) stops.push(bi); });
        stops = stops.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; }); if (stops.length < 2) stops = [0, P.length - 1];
        for (var j = 0; j < 2; j++) { var m = new T.Mesh(new T.BoxGeometry(12, 3, 3.4), CARM[t.l]); S.add(m); TR.push({ P: P, stops: stops, si: j ? stops.length - 1 : 0, dir: j ? -1 : 1, f: stops[j ? stops.length - 1 : 0], wait: Math.random() * 6, m: m }); } });
    }
    // —— 通用低多邊形行人（非協作池角色，不冒充原角色；拿到原素材後用 addSprite 替換）——
    var PEOPLE = [], ROADS = [], PG = { body: new T.CylinderGeometry(.55, .65, 1.9, 6), head: new T.SphereGeometry(.5, 8, 6), leg: new T.BoxGeometry(.32, 1.2, .32) };
    var SKIN = new T.MeshStandardMaterial({ color: 0xf1c27d }), LEGM = new T.MeshStandardMaterial({ color: 0x2b2f3a });
    var SHIRT = [0xe63946, 0x457b9d, 0x2a9d8f, 0xf4a261, 0x8e44ad, 0xffffff, 0x1d3557, 0xffb703].map(function (c) { return new T.MeshStandardMaterial({ color: c, emissive: 0 }); });
    function person(k) { var g = new T.Group(), b = new T.Mesh(PG.body, SHIRT[k % SHIRT.length]); b.position.y = 2.15; g.add(b); var h = new T.Mesh(PG.head, SKIN); h.position.y = 3.6; g.add(h);
      var l1 = new T.Mesh(PG.leg, LEGM), l2 = new T.Mesh(PG.leg, LEGM); l1.geometry.translate(0, 0, 0); l1.position.set(-.25, .6, 0); l2.position.set(.25, .6, 0); g.add(l1); g.add(l2); g.userData.legs = [l1, l2]; g.scale.setScalar(1.25); S.add(g); return g; }
    function people() {
      ROADS = D.roads.filter(function (r) { return r.t === 'ar'; }).map(function (r) { return dense(r.p); });
      var N = MOB ? 36 : 80;
      for (var i = 0; i < N; i++) { var R0 = ROADS[i % ROADS.length]; PEOPLE.push({ g: person(i), road: R0, f: Math.random() * (R0.length - 1), dir: Math.random() < .5 ? 1 : -1, side: Math.random() < .5 ? 1 : -1, sp: 1.1 + Math.random() * .7, state: 'walk', ph: Math.random() * 6, cool: 2 + Math.random() * 12 }); }
    }
    function trainStopPos(o) { var q = o.P[o.stops[o.si]]; return q; }
    function updPeople(dt, now) {
      PEOPLE.forEach(function (p) {
        if (p.state === 'walk') {
          p.f += p.dir * p.sp * dt; if (p.f <= 0 || p.f >= p.road.length - 1) { p.dir *= -1; p.f = Math.max(0, Math.min(p.road.length - 1.001, p.f)); }
          var i = Math.floor(p.f), u = p.f - i, a = p.road[i], b = p.road[Math.min(p.road.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
          var x = a[0] + dx * u - dz / L * 2.6 * p.side, z = a[1] + dz * u + dx / L * 2.6 * p.side; // 人行道：路中心線側移
          p.g.position.copy(V(x, z, .2)); p.g.rotation.y = Math.atan2(dx * p.dir, dz * p.dir); p.ph += dt * 9 * p.sp;
          p.g.userData.legs[0].rotation.x = Math.sin(p.ph) * .6; p.g.userData.legs[1].rotation.x = -Math.sin(p.ph) * .6; p.g.visible = true;
          p.cool -= dt;
          if (p.cool <= 0) { for (var k = 0; k < TR.length; k++) { var o = TR[k]; if (o.wait > 1.5) { var q = trainStopPos(o); if (Math.hypot(q[0] - x, q[1] - z) < 14) { p.state = 'ride'; p.train = o; p.rideStops = 1 + (Math.random() * 4 | 0); p.lastSi = o.si; p.seat = (Math.random() - .5) * 6; break; } } } if (p.state === 'walk') p.cool = 2; }
        } else { // 隨列車移動
          var o = p.train; p.g.position.copy(o.m.position).add(new T.Vector3(Math.cos(o.m.rotation.y) * p.seat, 1.3, -Math.sin(o.m.rotation.y) * p.seat)); p.g.rotation.y = o.m.rotation.y; p.g.userData.legs[0].rotation.x = p.g.userData.legs[1].rotation.x = 0;
          if (o.si !== p.lastSi) { p.lastSi = o.si; p.rideStops--; }
          if (p.rideStops <= 0 && o.wait > 0) { // 到站下車：走到最近的幹道人行道
            var q2 = trainStopPos(o), best = null, bd = 40; ROADS.forEach(function (R1) { for (var j = 0; j < R1.length; j += 2) { var d = Math.hypot(R1[j][0] - q2[0], R1[j][1] - q2[1]); if (d < bd) { bd = d; best = [R1, j]; } } });
            if (best) { p.state = 'walk'; p.road = best[0]; p.f = best[1]; p.cool = 25 + Math.random() * 30; } else p.rideStops = 1;
          }
        }
      });
    }
    // —— 微縮模型風：一般樓房（窗戶貼圖、夜間亮窗）、山林、周圍水面＋雲海、熱氣球、tilt-shift ——
    var BLDM = null, BAL = [], SIGNM = null, XB = window.AIVAULT_XINYI_BLD, XBB = [1e9, 1e9, -1e9, -1e9], XM = null, CARS = [];
    if (XB) XB.forEach(function (b) { for (var i = 1; i < b.length; i += 2) { XBB[0] = Math.min(XBB[0], b[i]); XBB[2] = Math.max(XBB[2], b[i]); XBB[1] = Math.min(XBB[1], b[i + 1]); XBB[3] = Math.max(XBB[3], b[i + 1]); } });
    function xinyi() { // 信義區真實建物輪廓＋樓層擠出（data.taipei 建築執照套繪圖）
      if (!XB || !BGU) return; var gs = [], PAL2 = [0xb5523b, 0xf3ead8, 0xc9ced3, 0x7fb3b8, 0x6fa3c7, 0x8fc1b5, 0xe8c38a, 0xd9a07a], c = new T.Color();
      XB.forEach(function (b, k) { var pts = []; for (var i = 1; i < b.length; i += 2) pts.push(new T.Vector2(b[i] - W0 / 2, -(b[i + 1] - H0 / 2))); if (pts.length < 3) return;
        var hgt = Math.max(1.2, b[0] * 3.3 / MPU * 2.5), g = new T.ExtrudeGeometry(new T.Shape(pts), { depth: hgt, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
        var cx0 = 0, cz0 = 0; pts.forEach(function (p) { cx0 += p.x; cz0 += -p.y; }); cx0 /= pts.length; cz0 /= pts.length; g.translate(0, hAt(cx0 + W0 / 2, cz0 + H0 / 2), 0);
        c.setHex(PAL2[k % PAL2.length]); var n = g.attributes.position.count, ca = new Float32Array(n * 3); for (var j = 0; j < n; j++) { ca[j * 3] = c.r; ca[j * 3 + 1] = c.g; ca[j * 3 + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(ca, 3)); g.deleteAttribute('uv'); gs.push(g); });
      var m = BGU.mergeGeometries(gs, false); if (!m) return; XM = new T.MeshStandardMaterial({ vertexColors: true, roughness: .8, emissive: 0x000000 }); S.add(new T.Mesh(m, XM));
      label('信義區：真實建物輪廓（data.taipei）', (XBB[0] + XBB[2]) / 2, XBB[1] - 6, 12, '#123', 30); }
    function extras() {
      // 公園綠地
      [[25.0300, 121.5355, 16, '大安森林公園'], [25.0400, 121.5600, 9, '國父紀念館'], [25.0230, 121.5050, 12, '青年公園'], [25.0640, 121.5390, 7, '榮星花園'], [25.0700, 121.5170, 8, '花博公園']].forEach(function (pk) { var p = P(pk[0], pk[1]), g = new T.Mesh(new T.CircleGeometry(pk[2], 18), new T.MeshStandardMaterial({ color: 0x6fbf5a })); g.rotation.x = -Math.PI / 2; g.position.copy(V(p[0], p[1], .9)); S.add(g);
        for (var i = 0; i < 14; i++) { var a = Math.random() * 6.283, r = Math.random() * pk[2] * .85, t = new T.Mesh(new T.SphereGeometry(1.4, 6, 4), new T.MeshStandardMaterial({ color: 0x2e7d32, flatShading: true })); t.position.copy(V(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r, 2.2)); S.add(t); } label('🌳 ' + pk[3], p[0], p[1], 11, '#1b5e20', 8); });
      // 道路標線（幹道中央白色虛線）
      D.roads.forEach(function (r) { var l = line(r.p, 0xffffff, r.t === 'ar' ? 1.0 : 4.2); l.material = new T.LineDashedMaterial({ color: 0xffffff, dashSize: 2, gapSize: 2 }); l.computeLineDistances(); S.add(l); });
      // 新地標：南山廣場、陶朱隱園、信義天橋
      var p1 = P(25.0335, 121.5660), g1 = new T.Group(); [[10, 34, 0x9fb4c4], [8, 10, 0xb8c9d6], [5, 6, 0xcfd9e0]].reduce(function (y, b) { var m = new T.Mesh(new T.BoxGeometry(b[0], b[1], b[0] * .8), new T.MeshStandardMaterial({ color: b[2], flatShading: true })); m.position.y = y + b[1] / 2; g1.add(m); return y + b[1]; }, 0); g1.position.copy(V(p1[0], p1[1], 0)); g1.scale.setScalar(1.6); S.add(g1); label('南山廣場', p1[0], p1[1], 13, '#111', 82);
      var p2 = P(25.0377, 121.5671), g2 = new T.Group(); for (var i = 0; i < 20; i++) { var m = new T.Mesh(new T.BoxGeometry(5, 1.2, 5), new T.MeshStandardMaterial({ color: i % 2 ? 0x8fbf7a : 0xd9dde0, flatShading: true })); m.position.y = i * 1.3 + .6; m.rotation.y = i * .08; g2.add(m); } g2.position.copy(V(p2[0], p2[1], 0)); g2.scale.setScalar(1.6); S.add(g2); label('陶朱隱園', p2[0], p2[1], 13, '#111', 50);
      ribbon([P(25.0410, 121.5650), P(25.0392, 121.5662), P(25.0365, 121.5662), P(25.0345, 121.5652)], 2.2, 0xdfe6ea, 3.5, true); ribbon([P(25.0375, 121.5637), P(25.0378, 121.5662)], 2.2, 0xdfe6ea, 3.5, true); var pb = P(25.0378, 121.5655); label('信義天橋', pb[0], pb[1], 11, '#123', 10);
      // YouBike 站（主要捷運站旁）
      var YB = /台北車站|臺北車站|西門|中正紀念堂|古亭|忠孝復興|大安|市政府|台北101|公館|松山機場|南京復興|東門|忠孝新生|士林|動物園/;
      D.mrt.stations.filter(function (x) { return YB.test(x.n); }).forEach(function (x) { var g = new T.Group(); for (var i = 0; i < 6; i++) { var b = new T.Mesh(new T.BoxGeometry(.4, 1, 1.6), new T.MeshStandardMaterial({ color: 0xff9f1c })); b.position.set(i * .9 - 2.2, .5, 0); g.add(b); } var k = new T.Mesh(new T.BoxGeometry(.8, 2, .8), new T.MeshStandardMaterial({ color: 0xffd60a })); k.position.set(3.2, 1, 0); g.add(k); g.position.copy(V(x.p[0] + 4, x.p[1] + 4, 0)); g.scale.setScalar(1.3); S.add(g); });
      // 車輛、機車（彩色，沿道路行駛）
      var CC = [0xe63946, 0x1d70b8, 0xffffff, 0x222222, 0xffb703, 0x2a9d8f, 0xc0c0c0], NV = MOB ? 50 : 140;
      for (var v = 0; v < NV; v++) { var R0 = ROADS[v % ROADS.length], moto = v % 3 === 0, g3 = new T.Group(), body = new T.Mesh(moto ? new T.BoxGeometry(1.4, .9, .5) : new T.BoxGeometry(2.6, 1.1, 1.4), new T.MeshStandardMaterial({ color: CC[v % CC.length] })); body.position.y = .6; g3.add(body);
        if (!moto) { var top = new T.Mesh(new T.BoxGeometry(1.4, .6, 1.2), new T.MeshStandardMaterial({ color: 0x9fd3ff })); top.position.set(-.1, 1.4, 0); g3.add(top); } else { var rider = new T.Mesh(new T.SphereGeometry(.35, 6, 4), SKIN); rider.position.y = 1.5; g3.add(rider); }
        S.add(g3); CARS.push({ g: g3, road: R0, f: Math.random() * (R0.length - 1), dir: Math.random() < .5 ? 1 : -1, sp: (moto ? 3 : 2.4) + Math.random() * 1.5 }); }
    }
    function updCars(dt) { CARS.forEach(function (c) { c.f += c.dir * c.sp * dt; if (c.f <= 0 || c.f >= c.road.length - 1) { c.dir *= -1; c.f = Math.max(0, Math.min(c.road.length - 1.001, c.f)); }
      var i = Math.floor(c.f), u = c.f - i, a = c.road[i], b = c.road[Math.min(c.road.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, lane = .9 * c.dir;
      c.g.position.copy(V(a[0] + dx * u + dz / L * lane, a[1] + dz * u - dx / L * lane, 1)); c.g.rotation.y = -Math.atan2(dz * c.dir, dx * c.dir); }); }
    function inside(u, v) { for (var i = 0; i < POLY.length; i++) { var P = POLY[i], c = false; for (var a = 0, b = P.length - 1; a < P.length; b = a++) if ((P[a][1] > v) !== (P[b][1] > v) && u < (P[b][0] - P[a][0]) * (v - P[a][1]) / (P[b][1] - P[a][1]) + P[a][0]) c = !c; if (c) return true; } return false; }
    var POLY = []; D.districts.forEach(function (d) { d.d.split('M').filter(Boolean).forEach(function (r) { POLY.push(r.replace('Z', '').split('L').map(function (s) { return s.trim().split(' ').map(Number); })); }); });
    function winTex() { var c = document.createElement('canvas'); c.width = 32; c.height = 64; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 32, 64); x.fillStyle = '#556677'; for (var r = 0; r < 8; r++) for (var q = 0; q < 4; q++) x.fillRect(3 + q * 7.5, 4 + r * 7.6, 4.5, 4.6); var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t; }
    function winEm() { var c = document.createElement('canvas'); c.width = 32; c.height = 64; var x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 32, 64); for (var r = 0; r < 8; r++) for (var q = 0; q < 4; q++) { x.fillStyle = Math.random() < .65 ? '#ffcf7a' : '#000'; x.fillRect(3 + q * 7.5, 4 + r * 7.6, 4.5, 4.6); } return new T.CanvasTexture(c); }
    function mini() {
      var NB = MOB ? 700 : 2200, NT = MOB ? 900 : 3000, dm = new T.Object3D(), col = new T.Color();
      BLDM = new T.MeshStandardMaterial({ map: winTex(), emissiveMap: winEm(), emissive: 0x000000, roughness: .85 });
      var bi = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), BLDM, NB), n = 0, tries = 0, PAL = [0xb5523b, 0xc8674a, 0xf3ead8, 0xe9dcc4, 0xc9ced3, 0xaeb6bd, 0x7fb3b8, 0x6fa3c7, 0x8fc1b5, 0xe8c38a, 0xd9a07a, 0xf0d9b5]; // 磚紅、米白、淺灰、玻璃藍綠…
      var roofs = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .9 }), NB), signs = new T.InstancedMesh(new T.PlaneGeometry(1, 1), new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000, side: T.DoubleSide }), NB), ns = 0, RP = [0x6b4f3a, 0x3d5a6c, 0x8a3b2f, 0x555b61, 0x4f6b3a], SP = [0xe63946, 0xffb703, 0x2a9d8f, 0x1d70b8, 0xf28482, 0x06d6a0];
      SIGNM = signs.material;
      while (n < NB && tries++ < NB * 30) { var u = 150 + Math.random() * 650, v = 560 + Math.random() * 560; if (!inside(u, v) || hAt(u, v) > 3.5) continue; if (XB && u > XBB[0] && u < XBB[2] && v > XBB[1] && v < XBB[3]) continue;
        var nearR = D.rivers.some(function (r) { return r.p.some(function (q) { return Math.hypot(q[0] - u, q[1] - v) < 16; }); }); if (nearR) continue;
        var dc = Math.hypot(u - 470, v - 900), hgt = 2 + Math.random() * (dc < 120 ? 14 : 6); var w = 3 + Math.random() * 4, d = 3 + Math.random() * 4;
        dm.position.copy(V(u, v, hgt / 2)); dm.scale.set(w, hgt, d); dm.rotation.y = 0; dm.updateMatrix(); bi.setMatrixAt(n, dm.matrix); bi.setColorAt(n, col.setHex(PAL[(Math.random() * PAL.length) | 0]));
        dm.position.copy(V(u, v, hgt + .25)); dm.scale.set(w * 1.06, .5, d * 1.06); dm.updateMatrix(); roofs.setMatrixAt(n, dm.matrix); roofs.setColorAt(n, col.setHex(RP[n % RP.length]));
        if (Math.random() < .22) { dm.position.copy(V(u, v + d / 2 + .06, Math.min(hgt * .45, 3))); dm.scale.set(w * .7, 1.1, 1); dm.updateMatrix(); signs.setMatrixAt(ns, dm.matrix); signs.setColorAt(ns, col.setHex(SP[ns % SP.length])); ns++; }
        n++; }
      bi.count = n; roofs.count = n; signs.count = ns; S.add(bi); S.add(roofs); S.add(signs); xinyi(); extras();
      var tg = new T.ConeGeometry(1.6, 4.5, 5); tg.translate(0, 2.25, 0); var ti2 = new T.InstancedMesh(tg, new T.MeshStandardMaterial({ color: 0x2f6b2a, flatShading: true }), NT); n = 0; tries = 0;
      while (n < NT && tries++ < NT * 20) { var u2 = Math.random() * W0, v2 = Math.random() * H0, h2 = hAt(u2, v2); if (h2 < 4 || !inside(u2, v2) && Math.random() < .7) continue; var s2 = .8 + Math.random() * 1.2; dm.position.copy(V(u2, v2, 0)); dm.scale.set(s2, s2 * (1 + Math.random() * .5), s2); dm.updateMatrix(); ti2.setMatrixAt(n, dm.matrix); ti2.setColorAt(n, col.setHSL(.27 + Math.random() * .08, .45, .22 + Math.random() * .12)); n++; }
      ti2.count = n; S.add(ti2);
      var water = new T.Mesh(new T.PlaneGeometry(6000, 6000), new T.MeshStandardMaterial({ color: 0x5b9fc7, roughness: .3, metalness: .1 })); water.rotation.x = -Math.PI / 2; water.position.y = -2; S.add(water);
      var cc = document.createElement('canvas'); cc.width = cc.height = 64; var x = cc.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.6, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      var cm = new T.SpriteMaterial({ map: new T.CanvasTexture(cc), transparent: true, depthWrite: false, opacity: .95 }), NC = MOB ? 50 : 140;
      for (var i = 0; i < NC; i++) { var a = Math.random() * 6.283, r = 760 + Math.random() * 380, sp = new T.Sprite(cm); sp.position.set(Math.cos(a) * r * .85, 10 + Math.random() * 40, Math.sin(a) * r); var sc = 120 + Math.random() * 180; sp.scale.set(sc, sc * .55, 1); S.add(sp); }
      [[25.06, 121.50, 0xe63946], [25.02, 121.58, 0xffb703], [25.10, 121.56, 0x2a9d8f], [25.00, 121.53, 0x8e44ad]].forEach(function (b, i) { var g2 = new T.Group(), env = new T.Mesh(new T.SphereGeometry(5, 10, 8), new T.MeshStandardMaterial({ color: b[2], flatShading: true })); env.scale.y = 1.2; env.position.y = 9; g2.add(env); var bk = new T.Mesh(new T.BoxGeometry(2, 1.6, 2), new T.MeshStandardMaterial({ color: 0x8b5a2b })); bk.position.y = 1; g2.add(bk);
        var p = P(b[0], b[1]); g2.position.copy(V(p[0], p[1], 70 + i * 12)); g2.userData.y0 = g2.position.y; g2.userData.ph = i * 1.7; S.add(g2); BAL.push(g2); });
      var ts = document.createElement('div'); ts.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147482901;backdrop-filter:blur(' + (MOB ? 2 : 3) + 'px);-webkit-backdrop-filter:blur(' + (MOB ? 2 : 3) + 'px);-webkit-mask:linear-gradient(#000 0,transparent 32%,transparent 72%,#000 100%);mask:linear-gradient(#000 0,transparent 32%,transparent 72%,#000 100%)';
      if (Q.get('tiltshift') !== '0' && ti < 4) document.body.appendChild(ts); // tilt-shift 景深（低解析模式自動關）
    }
    function camParam() { var c = (Q.get('cam') || '').split(',').map(Number); if (c.length >= 3 && c.every(isFinite)) { var t = window.AIVAULT_3D.project(c[0], c[1]); var d = c[2]; C.position.set(t.x + d * .35, t.y + d * .75, t.z + d); if (ctl) { ctl.target.copy(t); ctl.update(); } else C.lookAt(t); } }
    var sim;
    var RAIN, RAINN = MOB ? 900 : 2200;
    function weatherFx() { var g = new T.BufferGeometry(), a = new Float32Array(RAINN * 3); for (var i = 0; i < RAINN; i++) { a[i * 3] = (Math.random() - .5) * 900; a[i * 3 + 1] = Math.random() * 400; a[i * 3 + 2] = (Math.random() - .5) * 900; }
      g.setAttribute('position', new T.BufferAttribute(a, 3)); RAIN = new T.Points(g, new T.PointsMaterial({ color: 0xb8c8e0, size: 2.2, transparent: true, opacity: .7 })); RAIN.visible = false; S.add(RAIN); }
    var ROT, NAC, SOCK;
    function turbine() { var p = P(25.12, 121.615), g = new T.Group(); g.position.copy(V(p[0], p[1], 0)); // 內湖山區風車（場景裝飾）
      var tw = new T.Mesh(new T.CylinderGeometry(.6, 1, 34, 6), new T.MeshStandardMaterial({ color: 0xeef1f4 })); tw.position.y = 17; g.add(tw);
      NAC = new T.Group(); NAC.position.y = 34; g.add(NAC); var nb = new T.Mesh(new T.BoxGeometry(2, 2, 5), new T.MeshStandardMaterial({ color: 0xffffff })); NAC.add(nb);
      ROT = new T.Group(); ROT.position.z = 3; NAC.add(ROT); for (var i = 0; i < 3; i++) { var b = new T.Mesh(new T.BoxGeometry(1.2, 18, .3), new T.MeshStandardMaterial({ color: 0xf5f7f9 })); b.position.y = 9; var h = new T.Group(); h.rotation.z = i * 2.094; h.add(b); ROT.add(h); }
      S.add(g);
      var pole = new T.Mesh(new T.CylinderGeometry(.3, .3, 18, 5), PIERM); pole.position.set(g.position.x + 14, g.position.y + 9, g.position.z); S.add(pole);
      SOCK = new T.Group(); SOCK.position.set(g.position.x + 14, g.position.y + 17.5, g.position.z); S.add(SOCK);
      var cone = new T.Mesh(new T.CylinderGeometry(1.6, .5, 9, 8, 1, true), new T.MeshStandardMaterial({ color: 0xe8453c, side: T.DoubleSide })); cone.rotation.x = Math.PI / 2; cone.position.z = 4.5; SOCK.add(cone);
      label('風車・風向魚', p[0] + 6, p[1], 12, '#123', 42); }
    var FW = [], FWG, FWN = MOB ? 900 : 2400;
    function fireworks() { FWG = new T.BufferGeometry(); FWG.setAttribute('position', new T.BufferAttribute(new Float32Array(FWN * 3), 3)); FWG.setAttribute('color', new T.BufferAttribute(new Float32Array(FWN * 3), 3));
      var pts = new T.Points(FWG, new T.PointsMaterial({ size: 4.5, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); S.add(pts); }
    function nye() { return Q.get('festival') === 'newyeareve' || (window.AIVAULT_isNewYearEve && window.AIVAULT_isNewYearEve(new Date())); }
    var t0 = performance.now(), lastB = 0, ang = 0, fN = 0, fT = performance.now(), FPS = 0;
    function perf(now) { fN++; if (now - fT < 2000) return; FPS = fN * 1000 / (now - fT); fN = 0; fT = now; // 依 FPS 自動升降解析度
      if (Q.get('autores') !== '0') { if (FPS < 28 && ti < TIERS.length - 1) { ti++; R.setPixelRatio(TIERS[ti]); } else if (FPS > 56 && ti > (LOW ? 4 : MOB ? 1 : 0)) { ti--; R.setPixelRatio(TIERS[ti]); } }
      if (sim) sim.textContent = '🚇 捷運與行人皆為「模擬」（通用行人，非協作池角色）｜' + FPS.toFixed(0) + ' FPS @ DPR ' + TIERS[ti] + (LOW ? '（低解析）' : '') + '｜拖曳旋轉、雙指縮放'; }
    function loop(now) {
      perf(now); var dt = Math.min(.1, (now - t0) / 1000); t0 = now; var N = night(), wx = weather(), w = wind(), h = tp().hour, off = h >= 1 && h < 6 && !Q.get('mrt');
      sun.intensity = N ? .12 : (wx === 'clear' ? 1.6 : .8); amb.intensity = N ? .28 : .9; var sky = N ? 0x0b1430 : (wx === 'clear' ? 0x9cc6dd : 0x8d99a6); S.background = new T.Color(sky); S.fog.color.setHex(sky);
      LAMPS.forEach(function (l) { l.intensity = N ? 900 : 0; }); LAMPM.emissive.setHex(N ? 0xffd38a : 0); WINM.emissive.setHex(N ? 0xffc860 : 0);
      for (var k in CARM) CARM[k].emissive.setHex(N ? 0x332200 : 0);
      var wet = /rain|typhoon/.test(wx); RAIN.visible = wet; if (wet) { var a = RAIN.geometry.attributes.position.array, sp = wx === 'rain' ? 140 : 260, sx = wx === 'typhoon' ? 120 : 10; for (var i = 0; i < RAINN; i++) { a[i * 3 + 1] -= sp * dt; a[i * 3] += sx * dt; if (a[i * 3 + 1] < 0) { a[i * 3 + 1] = 400; a[i * 3] = (Math.random() - .5) * 900; } } RAIN.geometry.attributes.position.needsUpdate = true; RAIN.position.set(C.position.x * .5, 0, C.position.z * .5 - 200); }
      S.fog.near = wet ? 300 : 900;
      // 風：CWA 風向（來向，正北 0°）；場景 -Z 為北。風車迎風、風向魚指向下風
      var rad = w[0] * Math.PI / 180; if (NAC) { NAC.rotation.y = Math.atan2(Math.sin(rad), -Math.cos(rad)) ; ang += Math.min(w[1], 25) * dt * .5; ROT.rotation.z = -ang; }
      if (SOCK) { SOCK.rotation.y = Math.atan2(-Math.sin(rad), Math.cos(rad)); SOCK.rotation.x = (1 - Math.min(1, w[1] / 10)) * 1.2 + Math.sin(now / 300) * .05 * (RM ? 0 : 1); }
      TR.forEach(function (o) { if (!off) { if (o.wait > 0) o.wait -= dt; else { var ni = o.si + o.dir; if (ni < 0 || ni >= o.stops.length) { o.dir *= -1; ni = o.si + o.dir; } var tg = o.stops[ni]; o.f += o.dir * dt * (RM ? 1.5 : 5); if ((o.dir > 0 && o.f >= tg) || (o.dir < 0 && o.f <= tg)) { o.f = tg; o.si = ni; o.wait = 6; } } }
        var i0 = Math.max(0, Math.min(o.P.length - 2, Math.floor(o.f))), u = o.f - i0, a = o.P[i0], b = o.P[i0 + 1]; o.m.position.copy(V(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 3.5)); o.m.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]); o.m.visible = true; });
      if (nye() && L101 && now - lastB > 220) { lastB = now; var tier = Math.random() * 9 | 0, c = new T.Color().setHSL(Math.random(), 1, .62), n = MOB ? 60 : 120; for (var j = 0; j < n; j++) { var th = Math.random() * 6.283, ph = Math.random() * 3.14, v = 22 + Math.random() * 18; FW.push({ p: L101.position.clone().add(new T.Vector3(0, (10 + tier * 6.5) * 1.6, 0)), v: new T.Vector3(Math.sin(ph) * Math.cos(th) * v, Math.cos(ph) * v + 8, Math.sin(ph) * Math.sin(th) * v), l: 1, c: c }); } if (FW.length > FWN) FW.splice(0, FW.length - FWN); }
      if (FWG) { var pa = FWG.attributes.position.array, ca = FWG.attributes.color.array; for (i = 0; i < FWN; i++) { var f = FW[i]; if (f) { f.v.y -= 9.8 * dt; f.p.addScaledVector(f.v, dt); f.l -= dt * .45; pa[i * 3] = f.p.x; pa[i * 3 + 1] = f.p.y; pa[i * 3 + 2] = f.p.z; var bl = Math.min(1, f.l * 1.6); ca[i * 3] = f.c.r * bl; ca[i * 3 + 1] = f.c.g * bl; ca[i * 3 + 2] = f.c.b * bl; } else { pa[i * 3 + 1] = -999; } } FW = FW.filter(function (f) { return f.l > 0; }); FWG.attributes.position.needsUpdate = true; FWG.attributes.color.needsUpdate = true; }
      updPeople(dt, now); if (BLDM) BLDM.emissive.setHex(N ? 0xffffff : 0x000000); if (SIGNM) SIGNM.emissive.setHex(N ? 0x553322 : 0); if (XM) XM.emissive.setHex(N ? 0x2a1e10 : 0); updCars(dt); BAL.forEach(function (b) { b.position.y = b.userData.y0 + Math.sin(now / 1500 + b.userData.ph) * 4; b.position.x += Math.sin(now / 9000 + b.userData.ph) * .03; });
      if (Q.get('follow') === 'rider') { var rd = PEOPLE.filter(function (p) { return p.state === 'ride'; })[0]; if (rd) { var tp3 = rd.g.position; C.position.set(tp3.x + 22, tp3.y + 26, tp3.z + 34); C.lookAt(tp3); if (ctl) ctl.target.copy(tp3); } } // 預覽：鏡頭跟隨搭車行人 SHIRT.forEach(function (m) { m.emissive.setHex(N ? 0x222222 : 0); });
      if (ctl && Q.get('follow') !== 'rider') ctl.update(); R.render(S, C);
    }
    window.AIVAULT_3D = { stats: function () { return { fps: Math.round(FPS), dpr: TIERS[ti], people: PEOPLE.length, riding: PEOPLE.filter(function (p) { return p.state === 'ride'; }).length, trains: TR.length }; }, scene: S, THREE: T, project: function (lat, lon) { var p = P(lat, lon); return V(p[0], p[1], 0); },
      addSprite: function (image, path) { /* 給協作池原人物：以原圖做 billboard，沿 path（地圖單位）行走；不改外觀 */ var s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(image), transparent: true })); s.scale.set(8, 12, 1); S.add(s); return s; } };
    sim = document.createElement('div'); sim.style.cssText = 'position:fixed;left:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 8px);z-index:2147483004;font:12px system-ui,"PingFang TC",sans-serif;color:#fff;background:rgba(10,14,28,.7);padding:4px 9px;border-radius:10px;pointer-events:none';
    sim.textContent = '🚇 捷運與行人皆為「模擬」（通用行人，非協作池角色）｜3D：拖曳旋轉、雙指縮放'; document.body.appendChild(sim);
  }
})();

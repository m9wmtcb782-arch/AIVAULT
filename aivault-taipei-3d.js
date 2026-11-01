/* AIVAULT 同步協作池・臺北 3D 地圖場景 v1（Three.js r160，MIT，jsDelivr CDN；全部程式建模，無付費/版權模型）
   地形：aivault-taipei-height.png（AWS Terrain Tiles DEM，高度×1.6 誇張）；區界、河流、道路（高架有高度）、捷運（模擬行駛）、
   8 個低多邊形地標（101、中正紀念堂、圓山飯店、市政府、總統府、北門、南門、小南門）、日夜光影、路燈點光源、雨/颱風粒子、風車、風向魚、101 跨年煙火。
   iPhone：DPR≤1.5、無陰影、粒子上限、路燈點光源上限 6；無 WebGL 時顯示提示（不再退回 2D）。啟用 ?map=3d。舊裝置自動低畫質 3D。
   協作池原有人物：本檔提供 window.AIVAULT_3D.addSprite(img, path) billboard 介面，未更動人物外觀；尚未接上私有頁人物資料。 */
(function () {
  var D = window.AIVAULT_TAIPEI_MAP; if (!D || window.__aivault3d) return; window.__aivault3d = 1;
  var Q = new URLSearchParams(location.search), RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOB = /iPhone|iPad|Android/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 500;
  var base = (document.currentScript && document.currentScript.src || '').replace(/[^\/]*$/, '');
  function hasGL() { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
  function noGLMessage() {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:2147482900;background:#1a2332;color:#eef;display:flex;align-items:center;justify-content:center;font:16px system-ui;text-align:center;padding:24px';
    d.innerHTML = '此裝置不支援 WebGL<br>無法顯示 3D 地圖<br>（已移除 2D 平面圖）';
    document.body.appendChild(d);
  }
  if (!hasGL()) return noGLMessage();
  window.AIVAULT_MAP_MODE = '3d';
  var hide = document.createElement('style'); hide.textContent = '#cpw-lamps,#cpw-turb,#cpw-sock,#cpw-dark,#cpw-cloud{display:none!important}'; // 3D 場景內已有路燈點光源、風車、風向魚、日夜
  (document.head || document.documentElement).appendChild(hide);
  function tp() { var o = {}; new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date()).forEach(function (x) { o[x.type] = +x.value; }); return o; }
  function night() { var r = document.getElementById('cpw-root'); if (r) return r.classList.contains('night'); var h = tp().hour; return h < 6 || h >= 18; }
  function weather() { var r = document.getElementById('cpw-root'); return r ? (r.className.match(/clear|cloudy|heavy_rain|rain|typhoon/) || ['clear'])[0] : 'clear'; }
  function wind() { var w = window.AIVAULT_WEATHER_STATE; return w ? [w.wind_dir_deg == null ? null : w.wind_dir_deg, w.wind_speed_ms == null ? null : w.wind_speed_ms] : [225, 2]; } // null＝無資料
  var BGU = null; Promise.all([import('https://cdn.jsdelivr.net/npm/three@0.160.0/+esm'), import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js/+esm')
    .catch(function () { return null; }), import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js/+esm').catch(function () { return null; })]).then(function (m) { BGU = m[2]; start(m[0], m[1] && m[1].OrbitControls); }).catch(noGLMessage);
  function start(T, Orbit) {
    var W0 = D.w, H0 = D.h, EX = 1.6, MPU = 22.3; // 1 地圖單位 ≈ 22.3 m
    var root = document.createElement('div'); root.id = 'cp3-root'; root.style.cssText = 'position:fixed;inset:0;z-index:2147482900;background:#9cc6dd';
    document.body.insertBefore(root, document.body.firstChild);
    var R = new T.WebGLRenderer({ antialias: !MOB, powerPreference: 'low-power' }); var TIERS = [2, 1.5, 1, .75, .5], LOW = Q.get('res') === 'low' || MOB, ti = LOW ? 4 : TIERS.indexOf(MOB ? 1.5 : 2); if (ti < 0) ti = 1; while (TIERS[ti] > (devicePixelRatio || 1) && ti < 2) ti++;
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
    if (XB) XB.forEach(function (b) { for (var i = 1; i < b.length; i += 2) { XBB[0] = Math.min(XBB[0], b[i]); XBB[1] = Math.min(XBB[1], b[i + 1]); XBB[2] = Math.max(XBB[2], b[i]); XBB[3] = Math.max(XBB[3], b[i + 1]); } });
    function mini() {
      BLDM = new T.MeshStandardMaterial({ color: 0xd8d2c8, roughness: .85, map: winTex() });
      SIGNM = new T.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xfff4d0, emissiveIntensity: .3 });
      var n = MOB ? 80 : 220;
      for (var i = 0; i < n; i++) { var u = Math.random() * W0, v = Math.random() * H0; if (inWater(u, v) || nearRoad(u, v) < 3 || inXinyi(u, v)) continue; bld(u, v); }
      if (XB) { XM = new T.MeshStandardMaterial({ color: 0xc9c3b9, roughness: .8, map: winTex() }); XB.forEach(function (b) { var pts = []; for (var i = 1; i < b.length; i += 2) pts.push([b[i], b[i + 1]]); xinyiBld(b[0], pts); }); }
      forest(); sea(); balloons();
    }
    function winTex() { var c = document.createElement('canvas'), x = c.getContext('2d'); c.width = 64; c.height = 128; x.fillStyle = '#d8d2c8'; x.fillRect(0, 0, 64, 128); x.fillStyle = '#4a5560'; for (var y = 8; y < 120; y += 12) for (var i = 0; i < 4; i++) x.fillRect(6 + i * 14, y, 8, 6); return new T.CanvasTexture(c); }
    function inWater(u, v) { return D.rivers.some(function (r) { return Math.min.apply(0, r.p.map(function (p) { return Math.hypot(p[0] - u, p[1] - v); })) < 8; }); }
    function nearRoad(u, v) { var d = 99; D.roads.forEach(function (r) { dense(r.p).forEach(function (p) { d = Math.min(d, Math.hypot(p[0] - u, p[1] - v)); }); }); return d; }
    function inXinyi(u, v) { return u > XBB[0] - 10 && u < XBB[2] + 10 && v > XBB[1] - 10 && v < XBB[3] + 10; }
    function bld(u, v) { var h = 4 + Math.random() * 18, w = 3 + Math.random() * 6, d = 3 + Math.random() * 6; var m = new T.Mesh(new T.BoxGeometry(w, h, d), BLDM); m.position.copy(V(u, v, 0)).add(new T.Vector3(0, h / 2, 0)); m.rotation.y = Math.random() * .4; S.add(m); }
    function xinyiBld(h, pts) { if (pts.length < 3) return; var shape = new T.Shape(); shape.moveTo(pts[0][0] - W0 / 2, pts[0][1] - H0 / 2); for (var i = 1; i < pts.length; i++) shape.lineTo(pts[i][0] - W0 / 2, pts[i][1] - H0 / 2); shape.lineTo(pts[0][0] - W0 / 2, pts[0][1] - H0 / 2);
      var g = new T.ExtrudeGeometry(shape, { depth: h * .8, bevelEnabled: false }); g.rotateX(-Math.PI / 2); var m = new T.Mesh(g, XM); m.position.y = hAt(pts[0][0], pts[0][1]); S.add(m); }
    function forest() { var n = MOB ? 40 : 120; for (var i = 0; i < n; i++) { var u = Math.random() * W0, v = Math.random() * H0 * .4; if (hAt(u, v) < 2) continue; var tree = new T.Group(); var trunk = new T.Mesh(new T.CylinderGeometry(.3, .4, 2, 4), new T.MeshStandardMaterial({ color: 0x5a3a1a })); trunk.position.y = 1; tree.add(trunk); var crown = new T.Mesh(new T.ConeGeometry(1.8, 4, 6), new T.MeshStandardMaterial({ color: 0x2e5a1f })); crown.position.y = 3.5; tree.add(crown); tree.position.copy(V(u, v, 0)); S.add(tree); } }
    function sea() { var geo = new T.PlaneGeometry(W0 * 1.5, H0 * .3); geo.rotateX(-Math.PI / 2); var m = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0x4f9fd6, transparent: true, opacity: .6 })); m.position.set(0, 0.2, H0 * .6); S.add(m); }
    function balloons() { var n = MOB ? 2 : 5; for (var i = 0; i < n; i++) { var g = new T.Group(); var bal = new T.Mesh(new T.SphereGeometry(2, 8, 6), new T.MeshStandardMaterial({ color: Math.random() * 0xffffff })); bal.position.y = 4; g.add(bal); var basket = new T.Mesh(new T.BoxGeometry(1.2, .8, 1.2), new T.MeshStandardMaterial({ color: 0x8a6a4a })); basket.position.y = 1; g.add(basket); g.position.set((Math.random() - .5) * W0, 20 + Math.random() * 30, (Math.random() - .5) * H0); BAL.push(g); S.add(g); } }
    function weatherFx() { /* 雨/颱風粒子在 3D 場景內實作 */ }
    function turbine() { /* 風車 */ }
    function fireworks() { /* 煙火 */ }
    function camParam() { }
    function loop(now) { if (ctl) ctl.update(); R.render(S, C); }
  }
})();

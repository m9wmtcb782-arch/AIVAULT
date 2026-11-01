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
  Promise.all([import('https://cdn.jsdelivr.net/npm/three@0.160.0/+esm'), import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js/+esm')
    .catch(function () { return null; })]).then(function (m) { start(m[0], m[1] && m[1].OrbitControls); }).catch(fallback2D);
  function start(T, Orbit) {
    var W0 = D.w, H0 = D.h, EX = 1.6, MPU = 22.3; // 1 地圖單位 ≈ 22.3 m
    var root = document.createElement('div'); root.id = 'cp3-root'; root.style.cssText = 'position:fixed;inset:0;z-index:2147482900;background:#9cc6dd';
    document.body.insertBefore(root, document.body.firstChild);
    var R = new T.WebGLRenderer({ antialias: !MOB, powerPreference: 'low-power' }); R.setPixelRatio(Math.min(devicePixelRatio || 1, MOB ? 1.5 : 2)); R.setSize(innerWidth, innerHeight); root.appendChild(R.domElement);
    var S = new T.Scene(); S.fog = new T.Fog(0x9cc6dd, 900, 2600);
    var C = new T.PerspectiveCamera(45, innerWidth / innerHeight, 1, 6000); C.position.set(110, 230, 560);
    var ctl = Orbit ? new Orbit(C, R.domElement) : null; if (ctl) { ctl.target.set(-10, 0, 270); ctl.maxPolarAngle = 1.35; ctl.minDistance = 60; ctl.maxDistance = 1800; ctl.enableDamping = true; ctl.update(); } else C.lookAt(-10, 0, 270);
    addEventListener('resize', function () { R.setSize(innerWidth, innerHeight); C.aspect = innerWidth / innerHeight; C.updateProjectionMatrix(); });
    var sun = new T.DirectionalLight(0xffffff, 1.6); sun.position.set(-500, 800, 300); S.add(sun); var amb = new T.HemisphereLight(0xdfefff, 0x445533, .9); S.add(amb);
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
      D.roads.forEach(function (r) { var ev = r.t !== 'ar'; ribbon(r.p, r.t === 'fw' ? 5 : r.t === 'ev' ? 4 : 3, r.t === 'fw' ? 0xe07b2e : r.t === 'ev' ? 0xf2c14e : 0xf4f4f4, ev ? 4 : .8, ev); var m = r.p[Math.floor(r.p.length / 2)]; label(r.n, m[0], m[1], 12, '#4a3726', ev ? 10 : 6); });
      D.mrt.tracks.forEach(function (t) { S.add(line(t.p, D.mrt.colors[t.l], 2.2)); });
      D.mountains.forEach(function (m) { label('⛰ ' + m.n, m.p[0], m.p[1], 16, '#2e4a1f', 14); });
      landmarks(); lamps(); trains(); weatherFx(); turbine(); fireworks();
      R.setAnimationLoop(loop);
    }
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
        for (var j = 0; j < 2; j++) { var m = new T.Mesh(new T.BoxGeometry(9, 2.4, 2.6), CARM[t.l]); S.add(m); TR.push({ P: P, stops: stops, si: j ? stops.length - 1 : 0, dir: j ? -1 : 1, f: stops[j ? stops.length - 1 : 0], wait: Math.random() * 6, m: m }); } });
    }
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
    var FW = [], FWG, FWN = MOB ? 400 : 1000;
    function fireworks() { FWG = new T.BufferGeometry(); FWG.setAttribute('position', new T.BufferAttribute(new Float32Array(FWN * 3), 3)); FWG.setAttribute('color', new T.BufferAttribute(new Float32Array(FWN * 3), 3));
      var pts = new T.Points(FWG, new T.PointsMaterial({ size: 2.4, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); S.add(pts); }
    function nye() { return Q.get('festival') === 'newyeareve' || (window.AIVAULT_isNewYearEve && window.AIVAULT_isNewYearEve(new Date())); }
    var t0 = performance.now(), lastB = 0, ang = 0;
    function loop(now) {
      var dt = Math.min(.1, (now - t0) / 1000); t0 = now; var N = night(), wx = weather(), w = wind(), h = tp().hour, off = h >= 1 && h < 6 && !Q.get('mrt');
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
      if (nye() && L101 && now - lastB > 380) { lastB = now; var tier = Math.random() * 9 | 0, c = new T.Color().setHSL(Math.random(), 1, .6), n = 40; for (var j = 0; j < n; j++) { var th = Math.random() * 6.283, ph = Math.random() * 3.14, v = 18 + Math.random() * 14; FW.push({ p: L101.position.clone().add(new T.Vector3(0, 10 + tier * 6.5, 0)), v: new T.Vector3(Math.sin(ph) * Math.cos(th) * v, Math.cos(ph) * v + 8, Math.sin(ph) * Math.sin(th) * v), l: 1, c: c }); } if (FW.length > FWN) FW.splice(0, FW.length - FWN); }
      if (FWG) { var pa = FWG.attributes.position.array, ca = FWG.attributes.color.array; for (i = 0; i < FWN; i++) { var f = FW[i]; if (f) { f.v.y -= 9.8 * dt; f.p.addScaledVector(f.v, dt); f.l -= dt * .7; pa[i * 3] = f.p.x; pa[i * 3 + 1] = f.p.y; pa[i * 3 + 2] = f.p.z; ca[i * 3] = f.c.r * f.l; ca[i * 3 + 1] = f.c.g * f.l; ca[i * 3 + 2] = f.c.b * f.l; } else { pa[i * 3 + 1] = -999; } } FW = FW.filter(function (f) { return f.l > 0; }); FWG.attributes.position.needsUpdate = true; FWG.attributes.color.needsUpdate = true; }
      if (ctl) ctl.update(); R.render(S, C);
    }
    window.AIVAULT_3D = { scene: S, THREE: T, project: function (lat, lon) { var p = P(lat, lon); return V(p[0], p[1], 0); },
      addSprite: function (image, path) { /* 給協作池原人物：以原圖做 billboard，沿 path（地圖單位）行走；不改外觀 */ var s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(image), transparent: true })); s.scale.set(8, 12, 1); S.add(s); return s; } };
    var sim = document.createElement('div'); sim.style.cssText = 'position:fixed;left:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 8px);z-index:2147483004;font:12px system-ui,"PingFang TC",sans-serif;color:#fff;background:rgba(10,14,28,.7);padding:4px 9px;border-radius:10px;pointer-events:none';
    sim.textContent = '🚇 捷運行駛為「模擬」｜3D：拖曳旋轉、雙指縮放'; document.body.appendChild(sim);
  }
})();
